import type { ApiWorkerEnv } from '../types/env';
import { ValidationError } from '../utils/error-handler';
import { projectService } from './project.service';
import { deployProxyService, type ProjectContext } from './deploy-proxy.service';
import { aiService } from './ai.service';
import { extractSseEvents } from '../utils/sse-parser';
import { slugify } from '../utils/strings';
import {
    SourceType,
    type Project,
    type ProjectMetadataOverrides,
    type DeploymentStatusPayload,
} from '../types/project';

export interface DeployInput {
    projectId: string;
    sourceType?: SourceType;
    zipData?: string;
    htmlContent?: string;
    analysisId?: string;
}

/**
 * Core deployment business logic.
 * Handles validation, enrichment, and background monitoring.
 */
class DeployService {
    /** Parse and validate deploy request body */
    parseDeployInput(body: unknown): DeployInput {
        const raw = body as Record<string, unknown>;
        const projectId = (raw?.id ?? raw?.projectId) as string | undefined;
        if (!projectId?.trim()) {
            throw new ValidationError('project.id is required. Create a project before deploying.');
        }
        return {
            projectId: projectId.trim(),
            sourceType: this.parseSourceType(raw.sourceType),
            zipData: typeof raw.zipData === 'string' ? raw.zipData : undefined,
            htmlContent: typeof raw.htmlContent === 'string' ? raw.htmlContent : undefined,
            analysisId: typeof raw.analysisId === 'string' ? raw.analysisId : undefined,
        };
    }

    private parseSourceType(value: unknown): SourceType | undefined {
        if (typeof value !== 'string') return undefined;
        return Object.values(SourceType).includes(value as SourceType)
            ? (value as SourceType)
            : undefined;
    }

    /** Resolve final source type from input or project default */
    resolveSourceType(input: DeployInput, project: Project): SourceType {
        const sourceType = input.sourceType ?? project.sourceType;
        if (!sourceType) {
            throw new ValidationError('sourceType is required when deploying a project.');
        }
        return sourceType;
    }

    /** Validate that required inputs are present for the source type */
    validateSourceInputs(sourceType: SourceType, project: Project, input: DeployInput): void {
        if (sourceType === SourceType.Zip && !input.zipData?.trim()) {
            throw new ValidationError('zipData is required for ZIP deployments.');
        }
        if (sourceType === SourceType.Html) {
            const html = input.htmlContent || project.htmlContent;
            if (!html?.trim()) {
                throw new ValidationError('htmlContent is required for HTML deployments.');
            }
        }
        if (sourceType === SourceType.GitHub) {
            if (!project.repoUrl?.trim() || project.repoUrl.startsWith('draft:')) {
                throw new ValidationError('repoUrl must be configured for GitHub deployments.');
            }
        }
    }

    /** Build the project payload to send to deploy service */
    buildDeployPayload(
        project: Project,
        sourceType: SourceType,
        analysisId: string | undefined,
        htmlContent: string | undefined,
        deployTarget: Project['deployTarget'],
    ): Project {
        return {
            id: project.id,
            name: project.name,
            repoUrl: project.repoUrl,
            sourceType,
            slug: project.slug,
            ...(analysisId && { analysisId }),
            lastDeployed: project.lastDeployed,
            status: project.status,
            ...(project.url && { url: project.url }),
            ...(project.description && { description: project.description }),
            framework: project.framework,
            ...(project.category && { category: project.category }),
            ...(project.tags && { tags: project.tags }),
            deployTarget,
            ...(project.providerUrl && { providerUrl: project.providerUrl }),
            ...(project.cloudflareProjectName && { cloudflareProjectName: project.cloudflareProjectName }),
            ...(sourceType === SourceType.Html && htmlContent && { htmlContent }),
        };
    }

    /**
     * Ensure project has a slug, using Context API + AI if needed.
     * The slug is required for deployment as it determines the app's URL.
     */
    async ensureProjectHasSlug(
        env: ApiWorkerEnv,
        _request: Request,
        project: Project,
        sourceType: SourceType,
        input: DeployInput,
    ): Promise<{ project: Project; analysisId?: string }> {
        // Already has slug, no need to enrich
        if (project.slug?.trim()) {
            return { project, analysisId: input.analysisId };
        }

        let contextId: string | undefined;

        try {
            // 1. Get project context from Node server
            const contextResult = await deployProxyService.getContext(env, {
                repoUrl: project.repoUrl,
                sourceType,
                zipData: input.zipData,
                htmlContent: input.htmlContent || project.htmlContent,
            });

            contextId = contextResult.contextId;

            // 2. Build context string for AI
            const contextStr = this.buildContextString(contextResult.context);

            // 3. Call AI to generate metadata
            const aiResult = await aiService.generateProjectMetadata(
                env,
                project.name,
                project.repoUrl,
                contextStr,
            );

            // 4. Apply AI-generated metadata to project
            if (aiResult) {
                const fallbackSlug = slugify(
                    aiResult.slug ??
                    aiResult.name ??
                    project.name ??
                    project.repoUrl ??
                    project.id,
                );
                const meta: ProjectMetadataOverrides = {
                    name: aiResult.name ?? undefined,
                    slug: aiResult.slug ?? fallbackSlug,
                    description: aiResult.description ?? undefined,
                    category: aiResult.category ?? undefined,
                    tags: aiResult.tags.length > 0 ? aiResult.tags : undefined,
                };
                project = {
                    ...project,
                    ...this.buildMetadataPatch(project, meta),
                };
                if (!project.slug?.trim()) {
                    project.slug = fallbackSlug;
                }
            }
        } catch (err) {
            console.error('[DeployService] Context/AI enrichment failed, continuing without:', err);
        }

        return { project, analysisId: contextId };
    }

    /**
     * Build a context string from ProjectContext for AI consumption.
     */
    private buildContextString(context: ProjectContext): string {
        const parts: string[] = [];

        if (context.framework) {
            parts.push(`Framework: ${context.framework}`);
        }

        if (context.packageJson?.name) {
            parts.push(`Package name: ${context.packageJson.name}`);
        }

        if (context.packageJson?.description) {
            parts.push(`Package description: ${context.packageJson.description}`);
        }

        if (context.packageJson?.dependencies) {
            const deps = Object.keys(context.packageJson.dependencies).slice(0, 10);
            if (deps.length > 0) {
                parts.push(`Key dependencies: ${deps.join(', ')}`);
            }
        }

        if (context.readme) {
            // Truncate README for AI context
            const readmePreview = context.readme.slice(0, 2000);
            parts.push(`README preview:\n${readmePreview}`);
        }

        if (context.indexHtml) {
            // Extract title from HTML if present
            const titleMatch = context.indexHtml.match(/<title>([^<]+)<\/title>/i);
            if (titleMatch) {
                parts.push(`HTML title: ${titleMatch[1]}`);
            }
        }

        if (context.directoryTree.length > 0) {
            const files = context.directoryTree.slice(0, 20).join(', ');
            parts.push(`Project files: ${files}`);
        }

        return parts.join('\n\n');
    }

    private buildMetadataPatch(current: Project, meta: ProjectMetadataOverrides): Partial<Project> {
        const patch: Partial<Project> = {};
        if (!current.slug && meta.slug) patch.slug = meta.slug;
        if (!current.name && meta.name) patch.name = meta.name;
        if (!current.description && meta.description) patch.description = meta.description;
        if (!current.category && meta.category) patch.category = meta.category;
        if ((!current.tags || current.tags.length === 0) && meta.tags) patch.tags = meta.tags;
        return patch;
    }

    /** Monitor deployment status via SSE and update project when complete */
    async monitorDeployment(
        env: ApiWorkerEnv,
        db: D1Database,
        deploymentId: string,
        projectId: string,
    ): Promise<void> {
        try {
            const stream = await deployProxyService.connectStream(env, deploymentId);
            if (!stream) return;

            const reader = stream.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value);
                const { events, rest } = extractSseEvents(buffer);
                buffer = rest;

                for (const payloadStr of events) {
                    try {
                        const payload: DeploymentStatusPayload = JSON.parse(payloadStr);
                        if (await this.handleStatusPayload(db, projectId, payload)) {
                            return;
                        }
                    } catch {
                        // Skip malformed events
                    }
                }
            }
        } catch (err) {
            console.error('[DeployService] Monitor failed:', err);
        }
    }

    private async handleStatusPayload(
        db: D1Database,
        projectId: string,
        payload: DeploymentStatusPayload,
    ): Promise<boolean> {
        if (payload.type !== 'status') return false;

        const current = await projectService.getProjectById(db, projectId);
        if (!current) return false;

        if (payload.status === 'SUCCESS') {
            const meta = payload.projectMetadata ?? {};
            const patch = this.buildMetadataPatch(current, meta);
            if (Object.keys(patch).length > 0) {
                await projectService.updateProject(db, projectId, patch);
            }
            await projectService.updateProjectDeployment(db, projectId, {
                status: 'Live',
                lastDeployed: new Date().toISOString(),
                ...(meta.url && { url: meta.url }),
            });
            return true;
        }

        if (payload.status === 'FAILED') {
            await projectService.updateProjectDeployment(db, projectId, {
                status: 'Failed',
                lastDeployed: new Date().toISOString(),
            });
            return true;
        }

        return false;
    }
}

export const deployService = new DeployService();

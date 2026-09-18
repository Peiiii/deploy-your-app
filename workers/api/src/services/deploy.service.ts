import type { ApiWorkerEnv } from '../types/env';
import { ValidationError } from '../utils/error-handler';
import { projectService } from './project.service';
import { deployProxyService, type ProjectContext } from './deploy-proxy.service';
import { aiService } from './ai.service';
import { deploymentMetadataPolicy } from './deployment-metadata-policy';
import { extractSseEvents } from '../utils/sse-parser';
import { slugify } from '../utils/strings';
import { deploymentRepository } from '../repositories/deployment.repository';
import {
    SourceType,
    type Project,
    type DeploymentStatusPayload,
} from '../types/project';

export interface DeployInput {
    projectId: string;
    sourceType?: SourceType;
    zipData?: string;
    htmlContent?: string;
    analysisId?: string;
    flowId?: string;
    clientChannel: 'web' | 'desktop' | 'extension' | 'cli' | 'api';
    sourceFilename?: string;
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
            flowId:
                typeof raw.deploymentFlowId === 'string' &&
                /^[a-f0-9-]{36}$/i.test(raw.deploymentFlowId)
                    ? raw.deploymentFlowId
                    : undefined,
            clientChannel: this.parseClientChannel(raw.clientChannel),
            sourceFilename:
                typeof raw.sourceFilename === 'string'
                    ? raw.sourceFilename.slice(0, 255)
                    : undefined,
        };
    }

    private parseClientChannel = (
        value: unknown,
    ): DeployInput['clientChannel'] => {
        return ['web', 'desktop', 'extension', 'cli', 'api'].includes(String(value))
            ? (value as DeployInput['clientChannel'])
            : 'web';
    };

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
     * Fill any missing discovery metadata from source context and AI.
     * Existing user-authored fields remain authoritative.
     */
    enrichProjectMetadata = async (
        env: ApiWorkerEnv,
        db: D1Database,
        _request: Request,
        project: Project,
        sourceType: SourceType,
        input: DeployInput,
    ): Promise<{ project: Project; analysisId?: string; debugLogs: string[] }> => {
        const debugLogs: string[] = [];
        const missingFields = deploymentMetadataPolicy.getMissingFields(project);

        if (missingFields.length === 0) {
            debugLogs.push('✓ Project metadata is already complete');
            return { project, analysisId: input.analysisId, debugLogs };
        }

        debugLogs.push(`ℹ Missing metadata: ${missingFields.join(', ')}`);

        // Treat literal "null" as missing
        const existingSlug = project.slug?.trim();
        if (existingSlug?.toLowerCase() === 'null') {
            project = { ...project, slug: undefined };
            debugLogs.push('⚠ Cleared invalid "null" slug');
        }

        let contextId: string | undefined;

        try {
            // 1. Get project context from Node server
            debugLogs.push('📦 Starting context extraction...');
            debugLogs.push(`   Source: ${sourceType}`);
            debugLogs.push(`   Repo: ${project.repoUrl}`);

            console.log('[enrichProjectMetadata] Starting context extraction for:', project.name);
            console.log('[enrichProjectMetadata] Source type:', sourceType);

            const contextResult = await deployProxyService.getContext(env, {
                repoUrl: project.repoUrl,
                sourceType,
                zipData: input.zipData,
                htmlContent: input.htmlContent || project.htmlContent,
            });

            contextId = contextResult.contextId;
            console.log('[enrichProjectMetadata] Context extracted successfully. ID:', contextId);
            console.log('[enrichProjectMetadata] Framework detected:', contextResult.context.framework);
            console.log('[enrichProjectMetadata] Files found:', contextResult.context.directoryTree.length);

            debugLogs.push(`✓ Context extracted (ID: ${contextId})`);
            debugLogs.push(`   Framework: ${contextResult.context.framework || 'Unknown'}`);
            debugLogs.push(`   Files: ${contextResult.context.directoryTree.length}`);
            if (contextResult.context.packageJson?.name) {
                debugLogs.push(`   Package: ${contextResult.context.packageJson.name}`);
            }

            // 2. Build context string for AI
            const contextStr = this.buildContextString(contextResult.context);
            console.log('[enrichProjectMetadata] Context string length:', contextStr.length);
            debugLogs.push(`   Context size: ${contextStr.length} chars`);

            // 3. Call AI to generate metadata
            debugLogs.push('🤖 Calling AI to generate metadata...');
            console.log('[enrichProjectMetadata] Calling AI to generate metadata...');

            const aiResult = await aiService.generateProjectMetadata(
                env,
                project.name,
                project.repoUrl,
                contextStr,
            );

            console.log('[enrichProjectMetadata] AI metadata generated:', {
                name: aiResult?.name,
                slug: aiResult?.slug,
                category: aiResult?.category,
                tagsCount: aiResult?.tags?.length || 0,
            });

            debugLogs.push('✓ AI metadata request completed:');
            debugLogs.push(`   Description: ${aiResult.description?.substring(0, 50) || '(none)'}${aiResult.description && aiResult.description.length > 50 ? '...' : ''}`);
            debugLogs.push(`   Category: ${aiResult.category || '(none)'}`);
            debugLogs.push(`   Tags: ${aiResult.tags?.join(', ') || '(none)'}`);

            // 4. Fill only the fields the user has not supplied.
            const patch = deploymentMetadataPolicy.buildPatch(
                project,
                aiResult,
                contextResult.context,
            );
            if (!project.slug?.trim() && !patch.slug) {
                patch.slug = slugify(
                    aiResult.slug ??
                    aiResult.name ??
                    project.name ??
                    project.repoUrl ??
                    project.id,
                );
                debugLogs.push(`   Using fallback slug: ${patch.slug}`);
            }

            if (Object.keys(patch).length > 0) {
                console.log('[enrichProjectMetadata] Updating database with metadata:', patch);
                debugLogs.push('💾 Updating missing metadata in database...');

                try {
                    const updated = await projectService.updateProject(
                        db,
                        project.id,
                        patch,
                    );
                    if (updated) {
                        project = updated;
                        console.log('[enrichProjectMetadata] Database updated successfully');
                        debugLogs.push('✓ Database updated successfully');
                        debugLogs.push(`   Final slug: ${updated.slug}`);
                        debugLogs.push(`   Description: ${updated.description || 'N/A'}`);
                        debugLogs.push(`   Category: ${updated.category || 'N/A'}`);
                        debugLogs.push(`   Tags: ${updated.tags?.join(', ') || 'N/A'}`);
                    }
                } catch (err) {
                    if (err instanceof Error && err.message.includes('Slug is already in use')) {
                        debugLogs.push('⚠ Slug conflict detected, finding alternative...');
                        const patchWithoutSlug = { ...patch };
                        delete patchWithoutSlug.slug;
                        if (Object.keys(patchWithoutSlug).length > 0) {
                            const updatedWithoutSlug = await projectService.updateProject(
                                db,
                                project.id,
                                patchWithoutSlug,
                            );
                            if (updatedWithoutSlug) project = updatedWithoutSlug;
                        }
                        project = await projectService.ensureSlugForProject(
                            env,
                            db,
                            { ...project, slug: undefined },
                        );
                        debugLogs.push(`✓ Assigned unique slug: ${project.slug}`);
                    } else {
                        throw err;
                    }
                }
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error('[enrichProjectMetadata] Context/AI enrichment failed:', errorMsg);
            console.error('[enrichProjectMetadata] Stack:', err instanceof Error ? err.stack : 'N/A');
            debugLogs.push(`❌ Enrichment failed: ${errorMsg}`);
            if (err instanceof Error && err.stack) {
                debugLogs.push(`   Stack: ${err.stack.split('\n').slice(0, 3).join('\n   ')}`);
            }
        }

        if (!project.slug?.trim()) {
            project = await projectService.ensureSlugForProject(env, db, project);
            debugLogs.push(`✓ Assigned fallback slug: ${project.slug}`);
        }

        return { project, analysisId: contextId, debugLogs };
    };

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

    /** Monitor deployment status via SSE and update project when complete */
    async monitorDeployment(
        env: ApiWorkerEnv,
        db: D1Database,
        deploymentId: string,
        projectId: string,
        attemptId: string,
        startedAtMs: number,
    ): Promise<void> {
        try {
            deployProxyService.injectLog(deploymentId, 'Worker monitoring deployment status...', 'info');

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
                        if (await this.handleStatusPayload(env, db, projectId, attemptId, startedAtMs, payload)) {
                            deployProxyService.injectLog(deploymentId, 'Deployment status updated successfully', 'success');
                            return;
                        }
                    } catch {
                        // Skip malformed events
                    }
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error('[DeployService] Monitor failed:', err);
            deployProxyService.injectLog(deploymentId, `Worker monitoring error: ${errorMessage}`, 'error');
            await deploymentRepository.finishAttempt(
                db,
                attemptId,
                'failed',
                new Date().toISOString(),
                Date.now() - startedAtMs,
                'monitor_error',
            );
            await projectService.updateProjectDeployment(db, projectId, {
                status: 'Failed',
            });
        }
    }

    private async handleStatusPayload(
        env: ApiWorkerEnv,
        db: D1Database,
        projectId: string,
        attemptId: string,
        startedAtMs: number,
        payload: DeploymentStatusPayload,
    ): Promise<boolean> {
        if (payload.type !== 'status') return false;

        const current = await projectService.getProjectById(db, projectId);
        if (!current) return false;

        if (payload.status === 'SUCCESS') {
            const meta = payload.projectMetadata ?? {};
            const patch = deploymentMetadataPolicy.buildPatch(current, meta, {});
            if (Object.keys(patch).length > 0) {
                try {
                    await projectService.updateProject(db, projectId, patch);
                } catch (err) {
                    console.error('[DeployService] Failed to persist metadata patch:', err);

                    // Best-effort fallback: if slug is still missing, force-assign
                    // a unique slug so Cloud DB / SDK surfaces keep working.
                    if (!current.slug?.trim()) {
                        await projectService.ensureSlugForProject(env, db, current);
                    }
                }
            }
            await projectService.updateProjectDeployment(db, projectId, {
                status: 'Live',
                lastDeployed: new Date().toISOString(),
                ...(meta.url && { url: meta.url }),
            });
            await deploymentRepository.finishAttempt(
                db,
                attemptId,
                'succeeded',
                new Date().toISOString(),
                Date.now() - startedAtMs,
            );
            return true;
        }

        if (payload.status === 'FAILED') {
            await projectService.updateProjectDeployment(db, projectId, {
                status: 'Failed',
            });
            await deploymentRepository.finishAttempt(
                db,
                attemptId,
                'failed',
                new Date().toISOString(),
                Date.now() - startedAtMs,
                'builder_failed',
            );
            return true;
        }

        return false;
    }
}

export const deployService = new DeployService();

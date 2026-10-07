import type { ApiWorkerEnv } from '../types/env';
import { ValidationError } from '../utils/error-handler';
import { projectService } from './project.service';
import type { ProjectContext } from '../types/project';
import { aiService } from './ai.service';
import { deploymentMetadataPolicy } from './deployment-metadata-policy';

import { configService } from './config.service';
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
    zipSourceKey?: string;
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
            zipSourceKey: typeof raw.zipSourceKey === 'string' ? raw.zipSourceKey : undefined,
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
        if (sourceType === SourceType.Zip && !input.zipData?.trim() && !input.zipSourceKey) {
            throw new ValidationError('Upload a ZIP file before deploying.');
        }
        if (sourceType === SourceType.Html) {
            const html = input.htmlContent || project.htmlContent;
            if (!html?.trim()) {
                throw new ValidationError('htmlContent is required for HTML deployments.');
            }
        }
        if (sourceType === SourceType.GitHub) {
            const candidate = project.repoUrl?.trim().replace(/^git@github\.com:/, 'https://github.com/');
            let url: URL;
            try { url = new URL(/^github\.com\//i.test(candidate) ? `https://${candidate}` : candidate); }
            catch { throw new ValidationError('Enter a public GitHub repository: https://github.com/owner/repo'); }
            if (url.hostname !== 'github.com' || !['https:', 'http:'].includes(url.protocol) || !/^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/tree\/[^?#]+)?\/?$/.test(url.pathname) || url.username || url.password) {
                throw new ValidationError('Enter a public GitHub repository: https://github.com/owner/repo');
            }
            project.repoUrl = `https://github.com${url.pathname}`;
        }
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
        input: Partial<DeployInput>,
        preparedContext: ProjectContext,
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
            const contextResult = { contextId: undefined, context: preparedContext };
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

    /** Persist terminal status inside the active SSE request before exposing it. */
    statusHandler = async (env: ApiWorkerEnv, db: D1Database, deploymentId: string) => {
        const attempt = await deploymentRepository.findByProviderId(db, deploymentId);
        let settled = false;
        return async (payload: DeploymentStatusPayload): Promise<void> => {
            if (settled || !attempt || !['accepted', 'started'].includes(attempt.status) || payload.type !== 'status' || !['SUCCESS', 'FAILED'].includes(payload.status ?? '')) return;
            if (!await deploymentRepository.isLatest(db, attempt)) {
                await deploymentRepository.finishAttempt(db, attempt.id, payload.status === 'SUCCESS' ? 'succeeded' : 'failed', new Date().toISOString(), Date.now() - Date.parse(attempt.started_at), payload.errorCode, payload);
                settled = true;
                return;
            }
            await this.handleStatusPayload(env, db, attempt.project_id, attempt.id,
                Date.parse(attempt.started_at), payload);
            settled = true;
        };
    };

    /** Recover deployments independently of an open browser or SSE connection. */
    reconcileDeployment = async (env: ApiWorkerEnv, db: D1Database, deploymentId: string): Promise<DeploymentStatusPayload> => {
        const attempt = await deploymentRepository.findByProviderId(db, deploymentId);
        if (!attempt) throw new ValidationError('Deployment not found.');
        if (attempt.status === 'succeeded') {
            const project = await projectService.getProjectById(db, attempt.project_id);
            return { type: 'status', status: 'SUCCESS', stage: attempt.stage, buildMode: attempt.build_mode as 'static' | 'build', projectMetadata: { name: project?.name, slug: project?.slug, description: project?.description, category: project?.category, tags: project?.tags, url: attempt.result_url || project?.url } };
        }
        if (attempt.status === 'failed' || attempt.status === 'rejected') return {
            type: 'status', status: 'FAILED', stage: attempt.stage, buildMode: attempt.build_mode as 'static' | 'build', errorCode: attempt.error_code, errorMessage: attempt.error_message,
        };
        return { type: 'status', status: 'BUILDING', stage: attempt.stage || 'publish', buildMode: 'static' };
    };

    reconcilePending = async (env: ApiWorkerEnv, db: D1Database): Promise<void> => {
        for (const attempt of await deploymentRepository.listPending(db)) {
            try {
                if (env.APP_GATEWAY) {
                    const gateway = env.APP_GATEWAY.get(env.APP_GATEWAY.idFromName(attempt.project_id));
                    const response = await gateway.fetch('https://app.internal/recover-publication', { headers: { 'x-project-id': attempt.project_id } });
                    if (!response.ok) throw new Error('Publication recovery is unavailable.');
                    const { pending } = await response.json() as { pending: boolean };
                    if (!pending && Date.now() - Date.parse(attempt.started_at) > 86400000) {
                        const handle = await this.statusHandler(env, db, attempt.provider_deployment_id);
                        await handle({ type: 'status', status: 'FAILED', errorCode: 'result_unavailable', errorMessage: 'Deployment result could not be recovered. Please deploy again.', stage: 'recovery' });
                    }
                }
            }
            catch {
                console.warn('[DeployService] Status recovery will retry');
            }
        }
    };

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
            const meta = { ...payload.projectMetadata };
            // Older builders replay SUCCESS without metadata. Only recover a URL
            // from the configured R2 namespace after confirming the asset exists.
            if (!meta.url && current.slug && env.ASSETS &&
                configService.getDeployTarget(env) === 'r2' &&
                await env.ASSETS.head(`apps/${current.slug}/current/index.html`)) {
                meta.url = `https://${current.slug}.${configService.getAppsRootDomain(env)}/`;
            }
            if (!meta.url) throw new Error('Successful deployment has no verified URL');
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
            }, attemptId);
            await deploymentRepository.finishAttempt(
                db,
                attemptId,
                'succeeded',
                new Date().toISOString(),
                Date.now() - startedAtMs,
                undefined, { ...payload, projectMetadata: meta },
            );
            return true;
        }

        if (payload.status === 'FAILED') {
            await projectService.updateProjectDeployment(db, projectId, {
                // The failed attempt is separate from the already published application.
                status: current.url && current.lastSuccessAt ? 'Live' : 'Failed',
                ...(current.url && current.lastSuccessAt ? { lastDeployed: current.lastSuccessAt } : {}),
            }, attemptId);
            await deploymentRepository.finishAttempt(
                db,
                attemptId,
                'failed',
                new Date().toISOString(),
                Date.now() - startedAtMs,
                payload.errorCode ?? 'builder_failed',
                payload,
            );
            return true;
        }

        return false;
    }
}

export const deployService = new DeployService();

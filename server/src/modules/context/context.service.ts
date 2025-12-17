import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';
import { CONFIG } from '../../common/config/config.js';
import { SourceType } from '../../common/types.js';
import { materializeSourceForDeployment } from '../deployment/pipeline/sourceMaterialization.js';
import { deployments } from '../deployment/state.js';
import type {
    ContextInput,
    ContextOutput,
    ContextSession,
    ProjectContext,
} from './context.types.js';
import { extractHtmlContent, extractInlineHtml } from './extractors/html-extractor.js';
import { extractPackageJson, detectFramework } from './extractors/package-extractor.js';
import { extractDirectoryTree } from './extractors/directory-extractor.js';
import { extractReadme } from './extractors/readme-extractor.js';

// ============================================================
// Session Storage
// ============================================================

/** In-memory storage for context sessions (reused by deploy) */
export const contextSessions = new Map<string, ContextSession>();

// ============================================================
// Service
// ============================================================

class ContextService {
    /**
     * Extract project context from source.
     * For GitHub: clones repo and extracts files.
     * For ZIP: unzips and extracts files.
     * For HTML: returns inline HTML directly.
     */
    getContext = async (input: ContextInput): Promise<ContextOutput> => {
        const contextId = randomUUID();

        // HTML source: no need for workDir
        if (input.sourceType === SourceType.Html) {
            return {
                contextId,
                context: this.buildHtmlContext(input.htmlContent),
            };
        }

        // GitHub/ZIP: materialize source first
        const workDir = path.join(CONFIG.paths.buildsRoot, `context-${contextId}`);

        try {
            const tempProject = {
                id: contextId,
                name: 'temp',
                repoUrl: input.repoUrl,
                sourceType: input.sourceType,
                lastDeployed: '',
                status: 'Building' as const,
                framework: 'Unknown' as const,
            };

            // For ZIP source, store zipData in deployments state first
            if (input.sourceType === SourceType.Zip && input.zipData) {
                deployments.set(contextId, {
                    status: 'ANALYZING',
                    logs: [],
                    project: tempProject,
                    workDir,
                    zipData: input.zipData,
                });
            }

            await materializeSourceForDeployment(
                contextId,
                tempProject,
                workDir,
            );

            const context = await this.extractContextFromDir(workDir);

            // Store session for later deploy reuse
            contextSessions.set(contextId, {
                workDir,
                repoUrl: input.repoUrl,
            });

            return { contextId, context };
        } catch (err) {
            // Cleanup on failure
            await this.cleanupWorkDir(workDir);
            throw err;
        }
    };

    /**
     * Build context for inline HTML (no file system access).
     */
    private buildHtmlContext = (htmlContent?: string): ProjectContext => {
        return {
            indexHtml: extractInlineHtml(htmlContent),
            directoryTree: ['index.html'],
            framework: 'html',
        };
    };

    /**
     * Extract context from a materialized work directory.
     */
    private extractContextFromDir = async (workDir: string): Promise<ProjectContext> => {
        const [indexHtml, packageJson, directoryTree, readme] = await Promise.all([
            extractHtmlContent(workDir),
            extractPackageJson(workDir),
            extractDirectoryTree(workDir),
            extractReadme(workDir),
        ]);

        const framework = detectFramework(packageJson);

        return {
            indexHtml,
            packageJson,
            directoryTree,
            readme,
            framework,
        };
    };

    /**
     * Cleanup a context session's workDir.
     */
    cleanupSession = async (contextId: string): Promise<void> => {
        const session = contextSessions.get(contextId);
        if (session) {
            await this.cleanupWorkDir(session.workDir);
            contextSessions.delete(contextId);
        }
    };

    /**
     * Remove a work directory.
     */
    private cleanupWorkDir = async (workDir: string): Promise<void> => {
        try {
            await fs.rm(workDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    };
}

export const contextService = new ContextService();

import { useDeploymentStore } from '@/features/deployment/stores/deploymentStore';
import type { ProjectManager } from '@/managers/ProjectManager';
import type { IDeploymentProvider } from '@/services/interfaces';
import type { DeploymentMetadata, Project } from '@/types';
import { SourceType } from '@/types';

type DeploymentStoreSnapshot = ReturnType<typeof useDeploymentStore.getState>;

/**
 * Handles project creation logic for different source types.
 * Used both by the wizard flow and the project-first flow.
 */
export class ProjectCreator {
    constructor(
        private provider: IDeploymentProvider,
        private projectManager: ProjectManager,
    ) { }

    /**
     * Run a lightweight pre-deployment analysis for the given project.
     */
    analyzeProject = async (
        project: Project,
    ): Promise<{ analysisId?: string; metadata?: DeploymentMetadata }> => {
        try {
            const result = await this.provider.analyzeSource(project);
            return result;
        } catch (err) {
            console.error('Project analysis failed', err);
            throw err;
        }
    };

    /**
     * Derive a reasonable default project name from the current wizard state.
     */
    getFallbackNameFromState = (state: DeploymentStoreSnapshot): string => {
        if (state.projectName) {
            return state.projectName;
        }
        if (state.sourceType === SourceType.GITHUB) {
            return state.repoUrl.split('/').filter(Boolean).pop() || 'my-app';
        }
        if (state.sourceType === SourceType.ZIP) {
            return state.zipFile?.name.replace(/\.zip$/i, '') || 'my-app';
        }
        return 'my-html-app';
    };

    /**
     * Project-first flow: create (or reuse) a project from the current wizard state.
     */
    createFromWizard = async (): Promise<Project | undefined> => {
        const state = useDeploymentStore.getState();
        const fallbackName = this.getFallbackNameFromState(state);

        if (state.sourceType === SourceType.GITHUB) {
            return this.createFromGithub(state, fallbackName);
        }

        if (state.sourceType === SourceType.ZIP) {
            return this.createFromZip(state, fallbackName);
        }

        if (state.sourceType === SourceType.HTML) {
            return this.createFromHtml(state, fallbackName);
        }

        return undefined;
    };

    createFromGithub = async (
        state: DeploymentStoreSnapshot,
        fallbackName: string,
    ): Promise<Project | undefined> => {
        const trimmedRepo = state.repoUrl.trim();
        if (!trimmedRepo) {
            return undefined;
        }

        try {
            const existing = await this.projectManager.findExistingProjectForRepo(trimmedRepo);
            if (existing) {
                return existing;
            }
        } catch (err) {
            console.error('Failed to check existing project for repo', err);
        }

        const tempProject: Project = {
            id: 'temp',
            name: fallbackName,
            repoUrl: trimmedRepo,
            sourceType: SourceType.GITHUB,
            lastDeployed: '',
            status: 'Building',
            framework: 'Unknown',
        };

        try {
            const analysisResult = await this.analyzeProject(tempProject);

            const metadataOverrides = analysisResult.metadata
                ? {
                    name: analysisResult.metadata.name,
                    slug: analysisResult.metadata.slug,
                    description: analysisResult.metadata.description,
                    category: analysisResult.metadata.category,
                    tags: analysisResult.metadata.tags,
                }
                : undefined;

            const finalName = analysisResult.metadata?.name ?? fallbackName;

            return await this.projectManager.addProject(
                finalName,
                state.sourceType,
                trimmedRepo,
                metadataOverrides ? { metadata: metadataOverrides } : undefined,
            );
        } catch (err) {
            console.error('Failed to analyze repository for project creation', err);
            return await this.projectManager.addProject(
                fallbackName,
                state.sourceType,
                trimmedRepo,
            );
        }
    };

    createFromZip = async (
        state: DeploymentStoreSnapshot,
        fallbackName: string,
    ): Promise<Project | undefined> => {
        const identifier = state.zipFile?.name || 'archive.zip';
        return await this.projectManager.addProject(
            fallbackName,
            state.sourceType,
            identifier,
        );
    };

    createFromHtml = async (
        state: DeploymentStoreSnapshot,
        fallbackName: string,
    ): Promise<Project | undefined> => {
        if (!state.htmlContent.trim()) {
            return undefined;
        }
        return await this.projectManager.addProject(
            fallbackName,
            state.sourceType,
            'inline.html',
            { htmlContent: state.htmlContent },
        );
    };
}

import { useProjectSettingsStore } from '@/features/project-settings/stores/project-settings.store';
import { useProjectStore } from '@/stores/project.store';
import { useDeploymentStore } from '@/features/deployment/stores/deployment.store';
import { DeploymentStatus, SourceType } from '@/types';
import type { Project } from '@/types';
import type { ProjectManager } from '@/managers/project.manager';
import type { DeploymentManager } from '@/features/deployment/managers/deployment.manager';

/**
 * Handles redeploy operations for project settings.
 */
export class RedeployHandler {
    constructor(
        private projectManager: ProjectManager,
        private deploymentManager: DeploymentManager,
    ) { }

    private getCurrentProject = (): Project | null => {
        const projectId = useProjectSettingsStore.getState().projectId;
        if (!projectId) return null;
        return useProjectStore.getState().projects.find((p) => p.id === projectId) || null;
    };

    redeployFromGitHub = async () => {
        const project = this.getCurrentProject();
        if (!project || !project.repoUrl) return;

        const actions = useProjectSettingsStore.getState().actions;
        actions.setError(null);
        actions.setIsRedeploying(true);

        try {
            const payload: Project = { ...project, sourceType: SourceType.GITHUB };
            await this.deploymentManager.redeployProject(payload, {
                onComplete: () => this.projectManager.loadProjects(),
            });
        } catch (err) {
            console.error(err);
            actions.setError('Failed to trigger redeploy from GitHub.');
        } finally {
            actions.setIsRedeploying(false);
        }
    };

    deployFromHtml = async () => {
        const project = this.getCurrentProject();
        if (!project) return;

        const hasSavedHtml = Boolean(project.htmlContent?.trim().length);
        if (!hasSavedHtml) {
            useProjectSettingsStore.getState().actions.setError(
                'No saved HTML content on this project.'
            );
            return;
        }

        const actions = useProjectSettingsStore.getState().actions;
        actions.setError(null);
        actions.setIsDeployingHtml(true);

        try {
            const payload: Project = {
                ...project,
                sourceType: SourceType.HTML,
                htmlContent: project.htmlContent,
            };
            await this.deploymentManager.redeployProject(payload, {
                onComplete: () => this.projectManager.loadProjects(),
            });
        } catch (err) {
            console.error(err);
            actions.setError('Failed to deploy from HTML.');
        } finally {
            actions.setIsDeployingHtml(false);
        }
    };

    uploadZipAndDeploy = async (file: File) => {
        const project = this.getCurrentProject();
        if (!project) return;

        if (!file.name.endsWith('.zip')) {
            useProjectSettingsStore.getState().actions.setError('Please upload a .zip file.');
            return;
        }

        const actions = useProjectSettingsStore.getState().actions;
        actions.setError(null);
        actions.setZipUploading(true);

        try {
            const payload: Project = { ...project, sourceType: SourceType.ZIP };
            await this.deploymentManager.redeployProject(payload, {
                zipFile: file,
                onComplete: () => this.projectManager.loadProjects(),
            });
        } catch (err) {
            console.error(err);
            actions.setError('Failed to deploy from ZIP archive.');
        } finally {
            actions.setZipUploading(false);
        }
    };

    uploadHtmlAndDeploy = async (file: File) => {
        const project = this.getCurrentProject();
        if (!project) return;

        if (!file.name.toLowerCase().endsWith('.html')) {
            useProjectSettingsStore.getState().actions.setError('Please upload a .html file.');
            return;
        }

        const actions = useProjectSettingsStore.getState().actions;
        actions.setError(null);
        actions.setHtmlUploading(true);

        try {
            const content = await file.text();
            const payload: Project = {
                ...project,
                sourceType: SourceType.HTML,
                htmlContent: content,
            };
            await this.deploymentManager.redeployProject(payload, {
                onComplete: () => this.projectManager.loadProjects(),
            });
        } catch (err) {
            console.error(err);
            actions.setError('Failed to deploy from HTML file.');
        } finally {
            actions.setHtmlUploading(false);
        }
    };

    handleZipInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const deploymentStatus = useDeploymentStore.getState().deploymentStatus;
        const zipUploading = useProjectSettingsStore.getState().zipUploading;
        const isInProgress =
            deploymentStatus === DeploymentStatus.BUILDING ||
            deploymentStatus === DeploymentStatus.DEPLOYING;

        if (zipUploading || isInProgress) {
            event.target.value = '';
            return;
        }

        await this.uploadZipAndDeploy(file);
        event.target.value = '';
    };

    handleHtmlInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const deploymentStatus = useDeploymentStore.getState().deploymentStatus;
        const htmlUploading = useProjectSettingsStore.getState().htmlUploading;
        const isInProgress =
            deploymentStatus === DeploymentStatus.BUILDING ||
            deploymentStatus === DeploymentStatus.DEPLOYING;

        if (htmlUploading || isInProgress) {
            event.target.value = '';
            return;
        }

        await this.uploadHtmlAndDeploy(file);
        event.target.value = '';
    };
}

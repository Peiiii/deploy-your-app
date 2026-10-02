import type { Project } from '@/types';
import { DeploymentStatus, SourceType } from '@/types';
import { useDeploymentStore } from '../stores/deployment.store';
import { normalizeGitHubRepoUrl } from '@/utils/project';
import { ProjectCreator } from './project-creator';
import type { DeploymentResult, IDeploymentProvider } from '@/services/interfaces';
import type { ProjectManager } from '@/managers/project.manager';
import { DeploymentStoreActions } from './deployment-store-actions';
import { DeploymentExecutor } from './deployment-executor';

/**
 * DeploymentManager - Unified API for all deployment operations.
 *
 * This is a Facade that delegates to specialized internal classes:
 * - DeploymentExecutor: Handles deployment execution
 * - ProjectCreator: Handles project creation and analysis
 * - DeploymentStoreActions: Handles store operations
 */
export class DeploymentManager {
  private deploymentExecutor: DeploymentExecutor;
  private projectCreator: ProjectCreator;
  private storeActions: DeploymentStoreActions;

  constructor(
    provider: IDeploymentProvider,
    private projectManager: ProjectManager
  ) {
    this.projectCreator = new ProjectCreator(projectManager);
    this.storeActions = new DeploymentStoreActions();
    this.deploymentExecutor = new DeploymentExecutor(provider, projectManager);
  }

  // ============================================================
  // Public API - Deployment
  // ============================================================

  /**
   * Deploy a project (both initial deployment and redeployment).
   */
  deployProject = (
    project: Project,
    options?: { zipFile?: File | null; onComplete?: (result?: DeploymentResult) => void }
  ): Promise<void> => {
    if (useDeploymentStore.getState().isPublishingNewProject) {
      return Promise.reject(new Error('A publication is already in progress.'));
    }
    if (project.sourceType === SourceType.GITHUB) {
      const repoUrl = normalizeGitHubRepoUrl(project.repoUrl);
      if (!repoUrl) return Promise.reject(new Error('Enter a valid GitHub repository URL.'));
      project = { ...project, repoUrl };
    }
    return this.deploymentExecutor.deployProject(project, options);
  };

  initializeNewPublication = (source: SourceType) => {
    const state = useDeploymentStore.getState();
    if (
      state.isPublishingNewProject ||
      state.deploymentStatus === DeploymentStatus.BUILDING ||
      state.deploymentStatus === DeploymentStatus.DEPLOYING
    )
      return;
    state.actions.reset();
    state.actions.setSourceType(source);
  };

  publishNewProject = async (): Promise<void> => {
    const state = useDeploymentStore.getState();
    if (
      state.isPublishingNewProject ||
      state.deploymentStatus === DeploymentStatus.BUILDING ||
      state.deploymentStatus === DeploymentStatus.DEPLOYING
    )
      return;
    const repoUrl = normalizeGitHubRepoUrl(state.repoUrl);
    if (state.sourceType === SourceType.HTML && !state.htmlContent.trim())
      throw new Error('Add HTML content first.');
    if (state.sourceType === SourceType.ZIP && !state.zipFile)
      throw new Error('Select a ZIP file first.');
    if (state.sourceType === SourceType.GITHUB && !repoUrl)
      throw new Error('Enter a valid GitHub repository URL.');
    state.actions.setIsPublishingNewProject(true);
    try {
      let project = await this.projectCreator.createFromWizard();
      const name = this.projectCreator.getFallbackNameFromState(state);
      // The backend reads the saved repository when building GitHub projects.
      const patch = {
        ...(name !== project.name ? { name } : {}),
        ...(state.sourceType === SourceType.GITHUB && repoUrl !== project.repoUrl ? { repoUrl: repoUrl! } : {}),
      };
      if (Object.keys(patch).length) {
        project = await this.projectManager.updateProject(project.id, patch);
      }
      await this.deploymentExecutor.deployProject(
        {
          ...project,
          sourceType: state.sourceType,
          ...(state.sourceType === SourceType.HTML ? { htmlContent: state.htmlContent } : {}),
        },
        { zipFile: state.zipFile }
      );
    } catch (error) {
      state.actions.setDeploymentStatus(DeploymentStatus.FAILED);
      state.actions.addLog({
        timestamp: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Publication failed.',
        type: 'error',
      });
      throw error;
    } finally {
      state.actions.setIsPublishingNewProject(false);
    }
  };

  // ============================================================
  // Public API - Store Actions
  // ============================================================

  resetWizard = () => this.storeActions.reset();

  handleSourceChange = (type: SourceType) => this.storeActions.handleSourceChange(type);

  handleFileDrop = (file: File) => this.storeActions.handleFileDrop(file);

  handleHtmlFileUpload = (file: File) => this.storeActions.handleHtmlFileUpload(file);

  autoProjectName = (val: string, type: SourceType) => this.storeActions.autoProjectName(val, type);

  setRepoUrl = (url: string) => this.storeActions.setRepoUrl(url);

  setHtmlContent = (html: string) => this.storeActions.setHtmlContent(html);

  setProjectName = (name: string) => this.storeActions.setProjectName(name);

  clearZipFile = () => this.storeActions.clearZipFile();
}

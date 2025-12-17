import type { Project } from '@/types';
import type { SourceType } from '@/types';
import type { DeploymentResult, IDeploymentProvider } from '@/services/interfaces';
import type { ProjectManager } from '@/managers/project.manager';
import type { UIManager } from '@/managers/ui.manager';
import { DeploymentStoreActions } from './deployment-store-actions';
import { ProjectCreator } from './project-creator';
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
    projectManager: ProjectManager,
    uiManager: UIManager,
  ) {
    this.storeActions = new DeploymentStoreActions();
    this.projectCreator = new ProjectCreator(provider, projectManager);
    this.deploymentExecutor = new DeploymentExecutor(
      provider,
      projectManager,
      uiManager,
      this.projectCreator,
    );
  }

  // ============================================================
  // Public API - Deployment
  // ============================================================

  /**
   * Deploy a project (both initial deployment and redeployment).
   */
  deployProject = (
    project: Project,
    options?: { zipFile?: File | null; onComplete?: (result?: DeploymentResult) => void },
  ): Promise<void> => {
    return this.deploymentExecutor.deployProject(project, options);
  };






  // ============================================================
  // Public API - Store Actions
  // ============================================================

  resetWizard = () => this.storeActions.reset();

  handleSourceChange = (type: SourceType) => this.storeActions.handleSourceChange(type);

  handleFileDrop = (file: File) => this.storeActions.handleFileDrop(file);

  handleHtmlFileUpload = (file: File) => this.storeActions.handleHtmlFileUpload(file);

  autoProjectName = (val: string, type: SourceType) =>
    this.storeActions.autoProjectName(val, type);

  setRepoUrl = (url: string) => this.storeActions.setRepoUrl(url);

  setHtmlContent = (html: string) => this.storeActions.setHtmlContent(html);

  setProjectName = (name: string) => this.storeActions.setProjectName(name);

  clearZipFile = () => this.storeActions.clearZipFile();
}

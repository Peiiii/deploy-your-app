import type { Project } from '@/types';
import type { SourceType } from '@/types';
import type { DeploymentResult, IDeploymentProvider } from '@/services/interfaces';
import type { ProjectManager } from '@/managers/project-manager';
import type { UIManager } from '@/managers/ui-manager';
import { DeploymentStoreActions } from './deployment-store-actions';
import { ProjectCreator } from './project-creator';
import { WizardExecutor } from './wizard-executor';

/**
 * DeploymentManager - Unified API for all deployment operations.
 *
 * This is a Facade that delegates to specialized internal classes:
 * - WizardExecutor: Handles wizard flows and deployment execution
 * - ProjectCreator: Handles project creation and analysis
 * - DeploymentStoreActions: Handles store operations
 */
export class DeploymentManager {
  private wizardExecutor: WizardExecutor;
  private projectCreator: ProjectCreator;
  private storeActions: DeploymentStoreActions;

  constructor(
    provider: IDeploymentProvider,
    projectManager: ProjectManager,
    uiManager: UIManager,
  ) {
    this.storeActions = new DeploymentStoreActions();
    this.projectCreator = new ProjectCreator(provider, projectManager);
    this.wizardExecutor = new WizardExecutor(
      provider,
      projectManager,
      uiManager,
      this.projectCreator,
    );
  }

  // ============================================================
  // Public API - Wizard & Deployment
  // ============================================================

  /**
   * Entry point for the "New Deployment" wizard.
   */
  startFromWizard = (): Promise<void> => {
    return this.wizardExecutor.startFromWizard();
  };

  /**
   * Redeploy an existing project.
   */
  redeployProject = (
    project: Project,
    options?: { zipFile?: File | null; onComplete?: (result?: DeploymentResult) => void },
  ): Promise<void> => {
    return this.wizardExecutor.redeployProject(project, options);
  };

  /**
   * Start a deployment run for a temporary project.
   */
  startDeploymentRun = (): Promise<DeploymentResult | undefined> => {
    return this.wizardExecutor.startDeploymentRun();
  };

  // ============================================================
  // Public API - Project Creation
  // ============================================================

  /**
   * Create a project from the current wizard state without deploying.
   */
  createProjectFromWizard = (): Promise<Project | undefined> => {
    return this.projectCreator.createFromWizard();
  };

  /**
   * Analyze a project's source code.
   */
  analyzeProject = (project: Project) => {
    return this.projectCreator.analyzeProject(project);
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

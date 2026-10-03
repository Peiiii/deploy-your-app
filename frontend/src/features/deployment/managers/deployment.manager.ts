import { useAuthStore } from '@/features/auth/stores/auth.store';
import { ProjectAddressError } from '@/services/project-address';
import { ProjectCreationLimitError } from '@/services/project-request-error';
import { getPublicationSlug, isValidPublicationSlug } from './publication-details';
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
  private savedPublication: {
    ownerId: string;
    targetId: string;
    draft: Pick<ReturnType<typeof useDeploymentStore.getState>, 'newProjectId' | 'sourceType' | 'htmlContent' | 'zipFile' | 'repoUrl' | 'projectName' | 'publicationSlug' | 'addressSeed' | 'publicationAddressError'>;
  } | null = null;
  private addressGeneration?: AbortController;

  constructor(
    provider: IDeploymentProvider,
    private projectManager: ProjectManager
  ) {
    this.projectCreator = new ProjectCreator(projectManager);
    this.storeActions = new DeploymentStoreActions();
    this.deploymentExecutor = new DeploymentExecutor(provider, projectManager);
    useAuthStore.subscribe((state, previous) => {
      if (state.user?.id !== previous.user?.id) this.savedPublication = null;
    });
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

  prepareExistingUpdate = (project: Project): boolean => {
    const ownerId = useAuthStore.getState().user?.id;
    const state = useDeploymentStore.getState();
    if (!ownerId || project.ownerId !== ownerId || state.isPublishingNewProject ||
      state.deploymentStatus === DeploymentStatus.BUILDING || state.deploymentStatus === DeploymentStatus.DEPLOYING) return false;
    this.cancelAddressGeneration();
    const draft = {
      newProjectId: state.newProjectId, sourceType: state.sourceType,
      htmlContent: state.htmlContent, zipFile: state.zipFile, repoUrl: state.repoUrl,
      projectName: state.projectName, publicationSlug: state.publicationSlug,
      addressSeed: state.addressSeed, publicationAddressError: state.publicationAddressError,
    };
    this.savedPublication = { ownerId, targetId: project.id, draft };
    state.actions.reset();
    return true;
  };

  getPendingUpdateContent = (projectId: string) => {
    const saved = this.savedPublication;
    if (!saved || saved.ownerId !== useAuthStore.getState().user?.id || saved.targetId !== projectId) return null;
    const draft = saved.draft;
    const hasContent = draft.sourceType === SourceType.HTML ? !!draft.htmlContent.trim()
      : draft.sourceType === SourceType.ZIP ? !!draft.zipFile : !!normalizeGitHubRepoUrl(draft.repoUrl);
    return hasContent ? { sourceType: draft.sourceType, htmlContent: draft.htmlContent, zipFile: draft.zipFile, repoUrl: draft.repoUrl } : null;
  };

  resumeNewPublication = (source: SourceType) => {
    const saved = this.savedPublication;
    if (saved && saved.ownerId === useAuthStore.getState().user?.id) {
      const state = useDeploymentStore.getState();
      if (state.deploymentStatus === DeploymentStatus.BUILDING || state.deploymentStatus === DeploymentStatus.DEPLOYING) return;
      state.actions.reset();
      useDeploymentStore.setState(saved.draft);
      return;
    }
    this.initializeNewPublication(source);
  };

  initializeNewPublication = (source: SourceType) => {
    const state = useDeploymentStore.getState();
    if (
      state.isPublishingNewProject ||
      state.deploymentStatus === DeploymentStatus.BUILDING ||
      state.deploymentStatus === DeploymentStatus.DEPLOYING
    )
      return;
    this.cancelAddressGeneration();
    this.savedPublication = null;
    state.actions.reset();
    state.actions.setSourceType(source);
  };

  publishNewProject = async (): Promise<void> => {
    const state = useDeploymentStore.getState();
    if (
      state.isPublishingNewProject ||
      state.isGeneratingAddress ||
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
    const slug = getPublicationSlug(state);
    if (!isValidPublicationSlug(slug)) throw new ProjectAddressError('INVALID_ADDRESS');
    state.actions.setIsPublishingNewProject(true);
    try {
      let project = await this.projectCreator.createFromWizard();
      const name = this.projectCreator.getFallbackNameFromState(state);
      // The backend reads the saved repository when building GitHub projects.
      const patch = {
        ...(slug !== project.slug ? { slug } : {}),
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
      if (error instanceof ProjectAddressError) {
        useDeploymentStore.setState({ publicationAddressError: error.code });
        throw error;
      }
      if (error instanceof ProjectCreationLimitError) throw error;
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

  cancelAddressGeneration = () => {
    this.addressGeneration?.abort();
    this.addressGeneration = undefined;
    useDeploymentStore.setState({ isGeneratingAddress: false, addressGenerationFailed: false });
  };

  generatePublicationAddress = async (): Promise<void> => {
    const state = useDeploymentStore.getState();
    if (!state.projectName.trim() || state.isGeneratingAddress || state.isPublishingNewProject ||
        state.deploymentStatus === DeploymentStatus.BUILDING || state.deploymentStatus === DeploymentStatus.DEPLOYING) return;
    const controller = new AbortController();
    this.addressGeneration = controller;
    useDeploymentStore.setState({ isGeneratingAddress: true, addressGenerationFailed: false });
    const deadline = setTimeout(() => {
      if (this.addressGeneration !== controller) return;
      controller.abort();
      this.addressGeneration = undefined;
      useDeploymentStore.setState({ isGeneratingAddress: false, addressGenerationFailed: true });
    }, 15000);
    try {
      const result = await this.projectManager.generateAddressSuggestion(state.projectName.trim(), state.newProjectId ?? undefined, controller.signal);
      if (this.addressGeneration !== controller || controller.signal.aborted) return;
      const current = useDeploymentStore.getState();
      if (current.projectName !== state.projectName || current.newProjectId !== state.newProjectId || current.publicationSlug !== state.publicationSlug) return;
      if (!isValidPublicationSlug(result.slug)) throw new Error('AI returned an invalid address');
      current.actions.setPublicationSlug(result.slug);
    } catch {
      if (this.addressGeneration === controller && !controller.signal.aborted) useDeploymentStore.setState({ addressGenerationFailed: true });
    } finally {
      clearTimeout(deadline);
      if (this.addressGeneration === controller) {
        this.addressGeneration = undefined;
        useDeploymentStore.setState({ isGeneratingAddress: false });
      }
    }
  };

  // ============================================================
  // Public API - Store Actions
  // ============================================================

  resetWizard = () => { this.cancelAddressGeneration(); this.storeActions.reset(); };

  handleSourceChange = (type: SourceType) => { this.cancelAddressGeneration(); this.storeActions.handleSourceChange(type); };

  handleFileDrop = (file: File) => this.storeActions.handleFileDrop(file);

  handleHtmlFileUpload = (file: File) => this.storeActions.handleHtmlFileUpload(file);

  autoProjectName = (val: string, type: SourceType) => this.storeActions.autoProjectName(val, type);

  setRepoUrl = (url: string) => this.storeActions.setRepoUrl(url);

  setHtmlContent = (html: string) => this.storeActions.setHtmlContent(html);

  setProjectName = (name: string) => { this.cancelAddressGeneration(); this.storeActions.setProjectName(name); };

  setPublicationSlug = (slug: string | null) => { this.cancelAddressGeneration(); useDeploymentStore.getState().actions.setPublicationSlug(slug); };

  clearZipFile = () => this.storeActions.clearZipFile();
}

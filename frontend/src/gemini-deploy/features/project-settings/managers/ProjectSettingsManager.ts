import { useProjectSettingsStore } from '@/stores/projectSettingsStore';
import { useProjectStore } from '@/stores/projectStore';
import { useDeploymentStore } from '@/features/deployment/stores/deploymentStore';
import { DeploymentStatus, SourceType } from '@/types';
import type { Project } from '@/types';
import type { ProjectManager } from './ProjectManager';
import type { DeploymentManager } from './DeploymentManager';
import type { UIManager } from './UIManager';
import type { AuthManager } from './AuthManager';
import type { ReactionManager } from './ReactionManager';
import type { AnalyticsManager } from './AnalyticsManager';
import i18n from '@i18n/config';

/**
 * ProjectSettingsManager handles all business logic for the ProjectSettings page.
 * All methods are arrow functions to avoid `this` binding issues.
 */
export class ProjectSettingsManager {
  private projectManager: ProjectManager;
  private deploymentManager: DeploymentManager;
  private uiManager: UIManager;
  private authManager: AuthManager;
  private reactionManager: ReactionManager;
  private analyticsManager: AnalyticsManager;

  constructor(
    projectManager: ProjectManager,
    deploymentManager: DeploymentManager,
    uiManager: UIManager,
    authManager: AuthManager,
    reactionManager: ReactionManager,
    analyticsManager: AnalyticsManager,
  ) {
    this.projectManager = projectManager;
    this.deploymentManager = deploymentManager;
    this.uiManager = uiManager;
    this.authManager = authManager;
    this.reactionManager = reactionManager;
    this.analyticsManager = analyticsManager;
  }

  /**
   * Get the current project from the project store by ID stored in settings store.
   */
  private getCurrentProject = (): Project | null => {
    const projectId = useProjectSettingsStore.getState().projectId;
    if (!projectId) return null;
    const projects = useProjectStore.getState().projects;
    return projects.find((p) => p.id === projectId) || null;
  };

  /**
   * Initialize the form with data from a project.
   */
  initializeForm = (project: Project) => {
    useProjectSettingsStore.getState().actions.initializeFromProject(project);
  };

  /**
   * Load analytics data for the current project.
   */
  loadAnalytics = (projectId: string, range: '7d' | '30d' = '7d') => {
    this.analyticsManager.loadProjectStats(projectId, range);
  };

  /**
   * Load reactions for the current project.
   */
  loadReactions = (projectId: string) => {
    this.reactionManager.loadReactionsForProject(projectId);
  };

  /**
   * Check if the slug is editable based on project status.
   */
  isSlugEditable = (project: Project): boolean => {
    return project.status !== 'Live' && project.status !== 'Building';
  };

  /**
   * Save the repository URL for the current project.
   */
  saveRepoUrl = async () => {
    const project = this.getCurrentProject();
    if (!project) return;

    const repoUrlDraft = useProjectSettingsStore.getState().repoUrlDraft;
    const actions = useProjectSettingsStore.getState().actions;

    actions.setError(null);
    actions.setIsSavingRepoUrl(true);

    try {
      await this.projectManager.updateProject(project.id, {
        repoUrl: repoUrlDraft.trim(),
      });
    } catch (err) {
      console.error(err);
      actions.setError('Failed to update repository URL.');
    } finally {
      actions.setIsSavingRepoUrl(false);
    }
  };

  /**
   * Save all metadata fields (name, slug, description, category, tags).
   */
  saveMetadata = async () => {
    const project = this.getCurrentProject();
    if (!project) return;

    const state = useProjectSettingsStore.getState();
    const actions = state.actions;

    actions.setError(null);
    actions.setIsSavingMetadata(true);

    try {
      const trimmedName = state.nameDraft.trim();
      const trimmedDescription = state.descriptionDraft.trim();
      const trimmedCategory = state.categoryDraft.trim();
      const trimmedSlug = state.slugDraft.trim();
      const slugIsEditable = this.isSlugEditable(project);
      const tagsArray =
        state.tagsDraft
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0) ?? [];

      await this.projectManager.updateProject(project.id, {
        ...(trimmedName ? { name: trimmedName } : {}),
        ...(slugIsEditable && trimmedSlug ? { slug: trimmedSlug } : {}),
        ...(trimmedDescription ? { description: trimmedDescription } : {}),
        ...(trimmedCategory ? { category: trimmedCategory } : {}),
        ...(tagsArray.length > 0 ? { tags: tagsArray } : { tags: [] }),
      });
      this.uiManager.showSuccessToast('Metadata saved successfully.');
    } catch (err) {
      console.error(err);
      this.uiManager.showErrorToast('Failed to update project metadata.');
    } finally {
      actions.setIsSavingMetadata(false);
    }
  };

  /**
   * Upload a custom thumbnail image.
   */
  uploadThumbnail = async (file: File) => {
    const project = this.getCurrentProject();
    if (!project) return;

    const actions = useProjectSettingsStore.getState().actions;
    const isUploading = useProjectSettingsStore.getState().isUploadingThumbnail;
    if (isUploading) return;

    actions.setError(null);
    actions.setIsUploadingThumbnail(true);

    try {
      await this.projectManager.uploadThumbnail(project.id, file);
      actions.bumpThumbnailVersion();
      this.uiManager.showSuccessToast('Thumbnail uploaded successfully.');
    } catch (err) {
      console.error(err);
      const fallbackMessage = 'Failed to upload thumbnail image.';
      const message =
        err instanceof Error && err.message ? err.message : fallbackMessage;
      this.uiManager.showErrorToast(message);
    } finally {
      actions.setIsUploadingThumbnail(false);
    }
  };

  /**
   * Handle thumbnail file input change.
   */
  handleThumbnailFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await this.uploadThumbnail(file);
    e.target.value = '';
  };

  /**
   * Handle thumbnail paste event.
   */
  handleThumbnailPaste = async (event: React.ClipboardEvent<HTMLDivElement>) => {
    const isUploading = useProjectSettingsStore.getState().isUploadingThumbnail;
    if (isUploading) return;

    const { items } = event.clipboardData;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (!file) continue;
        event.preventDefault();
        await this.uploadThumbnail(file);
        break;
      }
    }
  };

  /**
   * Redeploy the project from GitHub.
   */
  redeployFromGitHub = async () => {
    const project = this.getCurrentProject();
    if (!project || !project.repoUrl) return;

    const actions = useProjectSettingsStore.getState().actions;
    actions.setError(null);
    actions.setIsRedeploying(true);

    try {
      const payload: Project = {
        ...project,
        sourceType: SourceType.GITHUB,
      };
      await this.deploymentManager.redeployProject(payload, {
        onComplete: () => {
          this.projectManager.loadProjects();
        },
      });
    } catch (err) {
      console.error(err);
      actions.setError('Failed to trigger redeploy from GitHub.');
    } finally {
      actions.setIsRedeploying(false);
    }
  };

  /**
   * Deploy from saved HTML content.
   */
  deployFromHtml = async () => {
    const project = this.getCurrentProject();
    if (!project) return;

    const hasSavedHtml = Boolean(
      project.htmlContent && project.htmlContent.trim().length > 0,
    );
    if (!hasSavedHtml) {
      useProjectSettingsStore
        .getState()
        .actions.setError(
          'No saved HTML content on this project. Upload an HTML file to deploy.',
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
        onComplete: () => {
          this.projectManager.loadProjects();
        },
      });
    } catch (err) {
      console.error(err);
      actions.setError('Failed to deploy from HTML.');
    } finally {
      actions.setIsDeployingHtml(false);
    }
  };

  /**
   * Upload a ZIP file and deploy.
   */
  uploadZipAndDeploy = async (file: File) => {
    const project = this.getCurrentProject();
    if (!project) return;

    if (!file.name.endsWith('.zip')) {
      useProjectSettingsStore
        .getState()
        .actions.setError('Please upload a .zip file.');
      return;
    }

    const actions = useProjectSettingsStore.getState().actions;
    actions.setError(null);
    actions.setZipUploading(true);

    try {
      const payload: Project = {
        ...project,
        sourceType: SourceType.ZIP,
      };
      await this.deploymentManager.redeployProject(payload, {
        zipFile: file,
        onComplete: () => {
          this.projectManager.loadProjects();
        },
      });
    } catch (err) {
      console.error(err);
      actions.setError('Failed to deploy from ZIP archive.');
    } finally {
      actions.setZipUploading(false);
    }
  };

  /**
   * Upload an HTML file and deploy.
   */
  uploadHtmlAndDeploy = async (file: File) => {
    const project = this.getCurrentProject();
    if (!project) return;

    if (!file.name.toLowerCase().endsWith('.html')) {
      useProjectSettingsStore
        .getState()
        .actions.setError('Please upload a .html file.');
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
        onComplete: () => {
          this.projectManager.loadProjects();
        },
      });
    } catch (err) {
      console.error(err);
      actions.setError('Failed to deploy from HTML file.');
    } finally {
      actions.setHtmlUploading(false);
    }
  };

  /**
   * Handle ZIP file input change event.
   */
  handleZipInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const deploymentStatus = useDeploymentStore.getState().deploymentStatus;
    const zipUploading = useProjectSettingsStore.getState().zipUploading;
    const isDeploymentInProgress =
      deploymentStatus === DeploymentStatus.BUILDING ||
      deploymentStatus === DeploymentStatus.DEPLOYING;

    if (zipUploading || isDeploymentInProgress) {
      event.target.value = '';
      return;
    }

    await this.uploadZipAndDeploy(file);
    event.target.value = '';
  };

  /**
   * Handle HTML file input change event.
   */
  handleHtmlInputChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const deploymentStatus = useDeploymentStore.getState().deploymentStatus;
    const htmlUploading = useProjectSettingsStore.getState().htmlUploading;
    const isDeploymentInProgress =
      deploymentStatus === DeploymentStatus.BUILDING ||
      deploymentStatus === DeploymentStatus.DEPLOYING;

    if (htmlUploading || isDeploymentInProgress) {
      event.target.value = '';
      return;
    }

    await this.uploadHtmlAndDeploy(file);
    event.target.value = '';
  };

  /**
   * Toggle public visibility of the project.
   */
  togglePublicVisibility = async () => {
    const project = this.getCurrentProject();
    if (!project) return;

    const actions = useProjectSettingsStore.getState().actions;
    actions.setError(null);

    try {
      const nextValue = !(project.isPublic ?? true);
      await this.projectManager.updateProject(project.id, {
        isPublic: nextValue,
      });
    } catch (err) {
      console.error(err);
      const t = i18n.t.bind(i18n);
      actions.setError(t('project.failedToUpdateVisibility'));
    }
  };

  /**
   * Delete the current project.
   */
  deleteProject = async (): Promise<boolean> => {
    const project = this.getCurrentProject();
    if (!project) return false;

    const t = i18n.t.bind(i18n);
    const confirmed = await this.uiManager.showConfirm({
      title: t('project.dangerZone'),
      message: t('project.deleteConfirm'),
      primaryLabel: t('project.deleteProject'),
      secondaryLabel: t('common.cancel'),
    });

    if (!confirmed) {
      return false;
    }

    const actions = useProjectSettingsStore.getState().actions;
    actions.setError(null);

    try {
      await this.projectManager.deleteProject(project.id);
      return true;
    } catch (err) {
      console.error(err);
      actions.setError(t('project.failedToDelete'));
      return false;
    }
  };

  /**
   * Toggle like for the current project.
   */
  toggleLike = () => {
    const project = this.getCurrentProject();
    if (!project) return;

    const user = this.authManager.getCurrentUser();
    if (!user) {
      this.authManager.openAuthModal('login');
      return;
    }

    this.reactionManager.toggleLike(project.id);
  };

  /**
   * Toggle favorite for the current project.
   */
  toggleFavorite = () => {
    const project = this.getCurrentProject();
    if (!project) return;

    const user = this.authManager.getCurrentUser();
    if (!user) {
      this.authManager.openAuthModal('login');
      return;
    }

    this.reactionManager.toggleFavorite(project.id);
  };

  /**
   * Reset the form state.
   */
  resetForm = () => {
    useProjectSettingsStore.getState().actions.resetForm();
  };
}

import type { Project } from '@/types';
import type { ProjectManager } from '@/managers/ProjectManager';
import type { UIManager } from '@/managers/UIManager';
import type { AuthManager } from '@/features/auth/managers/AuthManager';
import type { ReactionManager } from '@/managers/ReactionManager';
import type { AnalyticsManager } from '@/managers/AnalyticsManager';
import type { DeploymentManager } from '@/features/deployment/managers/DeploymentManager';
import { MetadataHandler } from './MetadataHandler';
import { ThumbnailHandler } from './ThumbnailHandler';
import { RedeployHandler } from './RedeployHandler';
import { ProjectActions } from './ProjectActions';

/**
 * ProjectSettingsManager - Unified API for project settings operations.
 *
 * This is a Facade that delegates to specialized internal classes:
 * - MetadataHandler: name, slug, description, category, tags
 * - ThumbnailHandler: thumbnail upload
 * - RedeployHandler: redeploy operations
 * - ProjectActions: delete, visibility, reactions
 */
export class ProjectSettingsManager {
  private metadataHandler: MetadataHandler;
  private thumbnailHandler: ThumbnailHandler;
  private redeployHandler: RedeployHandler;
  private projectActions: ProjectActions;

  constructor(
    projectManager: ProjectManager,
    deploymentManager: DeploymentManager,
    uiManager: UIManager,
    authManager: AuthManager,
    reactionManager: ReactionManager,
    analyticsManager: AnalyticsManager,
  ) {
    this.metadataHandler = new MetadataHandler(projectManager, uiManager);
    this.thumbnailHandler = new ThumbnailHandler(projectManager, uiManager);
    this.redeployHandler = new RedeployHandler(projectManager, deploymentManager);
    this.projectActions = new ProjectActions(
      projectManager,
      uiManager,
      authManager,
      reactionManager,
      analyticsManager,
    );
  }

  // ============================================================
  // Public API - Metadata
  // ============================================================

  isSlugEditable = (project: Project) => this.metadataHandler.isSlugEditable(project);
  saveRepoUrl = () => this.metadataHandler.saveRepoUrl();
  saveMetadata = () => this.metadataHandler.saveMetadata();

  // ============================================================
  // Public API - Thumbnail
  // ============================================================

  uploadThumbnail = (file: File) => this.thumbnailHandler.uploadThumbnail(file);
  handleThumbnailFileChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    this.thumbnailHandler.handleFileChange(e);
  handleThumbnailPaste = (e: React.ClipboardEvent<HTMLDivElement>) =>
    this.thumbnailHandler.handlePaste(e);

  // ============================================================
  // Public API - Redeploy
  // ============================================================

  redeployFromGitHub = () => this.redeployHandler.redeployFromGitHub();
  deployFromHtml = () => this.redeployHandler.deployFromHtml();
  uploadZipAndDeploy = (file: File) => this.redeployHandler.uploadZipAndDeploy(file);
  uploadHtmlAndDeploy = (file: File) => this.redeployHandler.uploadHtmlAndDeploy(file);
  handleZipInputChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    this.redeployHandler.handleZipInputChange(e);
  handleHtmlInputChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    this.redeployHandler.handleHtmlInputChange(e);

  // ============================================================
  // Public API - Project Actions
  // ============================================================

  initializeForm = (project: Project) => this.projectActions.initializeForm(project);
  loadAnalytics = (projectId: string, range?: '7d' | '30d') =>
    this.projectActions.loadAnalytics(projectId, range);
  loadReactions = (projectId: string) => this.projectActions.loadReactions(projectId);
  togglePublicVisibility = () => this.projectActions.togglePublicVisibility();
  deleteProject = () => this.projectActions.deleteProject();
  toggleLike = () => this.projectActions.toggleLike();
  toggleFavorite = () => this.projectActions.toggleFavorite();
  resetForm = () => this.projectActions.resetForm();
}

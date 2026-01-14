import type { Project } from '@/types';
import type { ProjectManager } from '@/managers/project.manager';
import type { UIManager } from '@/managers/ui.manager';
import type { AuthManager } from '@/features/auth/managers/auth.manager';
import type { ReactionManager } from '@/managers/reaction.manager';
import type { AnalyticsManager } from '@/managers/analytics.manager';
import type { DeploymentManager } from '@/features/deployment/managers/deployment.manager';
import { MetadataHandler } from './metadata-handler';
import { ThumbnailHandler } from './thumbnail-handler';
import { DeploymentHandler } from './deployment-handler';
import { ProjectActions } from './project-actions';
import { CloudDbSettingsHandler } from './cloud-db-settings-handler';

/**
 * Facade manager for project settings page.
 * Delegates to:
 * - MetadataHandler: name, slug, category, tags, etc.
 * - ThumbnailHandler: thumbnail upload
 * - DeploymentHandler: deployment operations
 */
export class ProjectSettingsManager {
  private metadataHandler: MetadataHandler;
  private thumbnailHandler: ThumbnailHandler;
  private deploymentHandler: DeploymentHandler;
  private projectActions: ProjectActions;
  private cloudDbSettingsHandler: CloudDbSettingsHandler;

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
    this.deploymentHandler = new DeploymentHandler(projectManager, deploymentManager);
    this.projectActions = new ProjectActions(
      projectManager,
      uiManager,
      authManager,
      reactionManager,
      analyticsManager,
    );
    this.cloudDbSettingsHandler = new CloudDbSettingsHandler(uiManager);
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
  // Deployment operations
  deployFromGitHub = () => this.deploymentHandler.deployFromGitHub();
  deployFromHtml = () => this.deploymentHandler.deployFromHtml();
  uploadZipAndDeploy = (file: File) => this.deploymentHandler.uploadZipAndDeploy(file);
  uploadHtmlAndDeploy = (file: File) => this.deploymentHandler.uploadHtmlAndDeploy(file);
  deployHtmlContent = (content: string) => this.deploymentHandler.deployHtmlContent(content);
  handleZipInputChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    this.deploymentHandler.handleZipInputChange(event);
  handleHtmlInputChange = (event: React.ChangeEvent<HTMLInputElement>) =>
    this.deploymentHandler.handleHtmlInputChange(event);

  // ============================================================
  // Public API - Project Actions
  // ============================================================

  initializeForm = (project: Project) => this.projectActions.initializeForm(project);
  loadAnalytics = (projectId: string, range?: '7d' | '30d') =>
    this.projectActions.loadAnalytics(projectId, range);
  loadReactions = (projectId: string) => this.projectActions.loadReactions(projectId);
  togglePublicVisibility = () => this.projectActions.togglePublicVisibility();
  toggleExtensionSupport = () => this.projectActions.toggleExtensionSupport();
  deleteProject = () => this.projectActions.deleteProject();
  toggleLike = () => this.projectActions.toggleLike();
  toggleFavorite = () => this.projectActions.toggleFavorite();
  resetForm = () => this.projectActions.resetForm();

  // ============================================================
  // Public API - Cloud DB Settings (product feature)
  // ============================================================

  cloudDbSetProjectContext = (input: { projectId: string; appId: string }) =>
    this.cloudDbSettingsHandler.setProjectContext(input);
  cloudDbLoadCollections = () => this.cloudDbSettingsHandler.loadCollections();
  cloudDbAddCollection = (collection: string) => this.cloudDbSettingsHandler.addCollection(collection);
  cloudDbSelectCollection = (collection: string) => this.cloudDbSettingsHandler.selectCollection(collection);
  cloudDbLoadSelectedCollection = () => this.cloudDbSettingsHandler.loadSelectedCollection();
  cloudDbSetPermissionMode = (mode: 'creator_read_write' | 'all_read_creator_write' | 'all_read_readonly' | 'none') =>
    this.cloudDbSettingsHandler.setPermissionMode(mode);
  cloudDbSavePermission = () => this.cloudDbSettingsHandler.savePermission();
  cloudDbResetPermission = () => this.cloudDbSettingsHandler.resetPermission();
  cloudDbSetRulesDraft = (text: string) => this.cloudDbSettingsHandler.setRulesDraft(text);
  cloudDbApplyRulesTemplate = (template: 'public_feed_or_owner' | 'owner_only') =>
    this.cloudDbSettingsHandler.applyRulesTemplate(template);
  cloudDbFormatRulesDraft = () => this.cloudDbSettingsHandler.formatRulesDraft();
  cloudDbSaveRules = () => this.cloudDbSettingsHandler.saveRules();
  cloudDbDeleteRules = () => this.cloudDbSettingsHandler.deleteRules();
}

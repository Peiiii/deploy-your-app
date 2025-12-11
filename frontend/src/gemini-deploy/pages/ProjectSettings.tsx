import { ArrowLeft } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { DeploymentSession } from '../components/DeploymentSession';
import { ProjectSettingsCard } from '../components/ProjectSettingsCard';
import { URLS } from '../constants';
import { usePresenter } from '../contexts/PresenterContext';
import { useAnalyticsStore } from '../stores/analyticsStore';
import { useAuthStore } from '../stores/authStore';
import { useDeploymentStore } from '../stores/deploymentStore';
import { useProjectStore } from '../stores/projectStore';
import { useReactionStore } from '../stores/reactionStore';
import type { Project } from '../types';
import { DeploymentStatus, SourceType } from '../types';

function formatRepoLabel(project: Project): string {
  const { repoUrl, sourceType } = project;
  if (!repoUrl) return 'Not configured';
  if (
    (sourceType === SourceType.ZIP || sourceType === SourceType.HTML) &&
    !repoUrl.startsWith('http')
  ) {
    return repoUrl;
  }
  if (repoUrl.startsWith(URLS.GITHUB_BASE)) {
    const trimmed = repoUrl.replace(URLS.GITHUB_BASE, '');
    return trimmed || repoUrl;
  }
  return repoUrl;
}

export const ProjectSettings: React.FC = () => {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const projects = useProjectStore((s) => s.projects);
  const user = useAuthStore((s) => s.user);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [isRedeploying, setIsRedeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [categoryDraft, setCategoryDraft] = useState('');
  const [tagsDraft, setTagsDraft] = useState('');
  const [repoUrlDraft, setRepoUrlDraft] = useState('');
  const [zipUploading, setZipUploading] = useState(false);
  // Local state for managing custom thumbnail uploads.
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [thumbnailVersion, setThumbnailVersion] = useState(0);
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const projectId = params.id ?? null;

  const deploymentStatus = useDeploymentStore((s) => s.deploymentStatus);
  const isDeploymentInProgress =
    deploymentStatus === DeploymentStatus.BUILDING ||
    deploymentStatus === DeploymentStatus.DEPLOYING;

  const project = useMemo(
    () => projects.find((p) => p.id === projectId) || null,
    [projects, projectId],
  );

  const analyticsEntry = useAnalyticsStore((s) =>
    project ? s.byProjectId[project.id] : undefined,
  );
  const reactionEntry = useReactionStore((s) =>
    project ? s.byProjectId[project.id] : undefined,
  );

  // Load projects if not available yet
  useEffect(() => {
    if (!projectId) return;
    if (!project && projects.length === 0) {
      presenter.project.loadProjects();
    }
  }, [projectId, project, projects.length, presenter.project]);

  // Sync draft fields when project changes
  useEffect(() => {
    if (project) {
      setRepoUrlDraft(project.repoUrl || '');
      setNameDraft(project.name || '');
      setDescriptionDraft(project.description || '');
      setCategoryDraft(project.category || '');
      setTagsDraft(
        project.tags && project.tags.length > 0 ? project.tags.join(', ') : '',
      );
    }
  }, [project]);

  // Load analytics once the project is available.
  useEffect(() => {
    if (!project) return;
    presenter.analytics.loadProjectStats(project.id, '7d');
  }, [project, presenter.analytics]);

  const thumbnailUrl = React.useMemo(() => {
    if (!project?.url) return null;
    try {
      // Use the same __thumbnail.png endpoint as the Explore cards so that
      // user uploads and auto-generated screenshots share the same path.
      return new URL('__thumbnail.png', project.url).toString();
    } catch {
      return null;
    }
  }, [project?.url]);

  // Load reactions once the project is available.
  useEffect(() => {
    if (!project || !user) return;
    presenter.reaction.loadReactionsForProject(project.id);
  }, [project, user, presenter.reaction]);

  if (!projectId) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <p className="text-sm text-red-500">Invalid project URL.</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <p className="text-sm text-slate-500 dark:text-gray-400">
          {t('common.loadingProjectDetails')}
        </p>
      </div>
    );
  }

  const canRedeployFromGitHub =
    !!project.repoUrl && project.repoUrl.startsWith(URLS.GITHUB_BASE);

  const handleSaveRepoUrl = async () => {
    setError(null);
    setIsSaving(true);
    try {
      await presenter.project.updateProject(project.id, {
        repoUrl: repoUrlDraft.trim(),
      });
    } catch (err) {
      console.error(err);
      setError('Failed to update repository URL.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleThumbnailUpload = async (file: File) => {
    if (!file || isUploadingThumbnail) return;
    setError(null);
    setIsUploadingThumbnail(true);
    try {
      await presenter.project.uploadThumbnail(project.id, file);
      // Bump a local version so the preview image cache is busted.
      setThumbnailVersion((v) => v + 1);
      presenter.ui.showSuccessToast('Thumbnail uploaded successfully.');
    } catch (err) {
      console.error(err);
      const fallbackMessage = 'Failed to upload thumbnail image.';
      const message =
        err instanceof Error && err.message
          ? err.message
          : fallbackMessage;
      presenter.ui.showErrorToast(message);
    } finally {
      setIsUploadingThumbnail(false);
    }
  };

  const handleThumbnailFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleThumbnailUpload(file);
    // Reset input so the same file can be selected again if needed.
    e.target.value = '';
  };

  const handleThumbnailPaste = async (
    event: React.ClipboardEvent<HTMLDivElement>,
  ) => {
    if (isUploadingThumbnail) return;
    const { items } = event.clipboardData;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (!file) continue;
        event.preventDefault();
        await handleThumbnailUpload(file);
        break;
      }
    }
  };

  const handleSaveMetadata = async () => {
    if (!project) return;
    setError(null);
    setIsSavingMetadata(true);
    try {
      const trimmedName = nameDraft.trim();
      const trimmedDescription = descriptionDraft.trim();
      const trimmedCategory = categoryDraft.trim();
      const tagsArray =
        tagsDraft
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0) ?? [];

      await presenter.project.updateProject(project.id, {
        ...(trimmedName ? { name: trimmedName } : {}),
        ...(trimmedDescription ? { description: trimmedDescription } : {}),
        ...(trimmedCategory ? { category: trimmedCategory } : {}),
        ...(tagsArray.length > 0 ? { tags: tagsArray } : { tags: [] }),
      });
      presenter.ui.showSuccessToast('Metadata saved successfully.');
    } catch (err) {
      console.error(err);
      presenter.ui.showErrorToast('Failed to update project metadata.');
    } finally {
      setIsSavingMetadata(false);
    }
  };

  const handleRedeployFromGitHub = async () => {
    if (!canRedeployFromGitHub) return;
    setError(null);
    setIsRedeploying(true);
    try {
      const payload: Project = {
        ...project,
        sourceType: SourceType.GITHUB,
      };
      await presenter.deployment.redeployProject(payload, {
        onComplete: () => {
          presenter.project.loadProjects();
        },
      });
    } catch (err) {
      console.error(err);
      setError('Failed to trigger redeploy from GitHub.');
    } finally {
      setIsRedeploying(false);
    }
  };

  const handleZipUpload = async (file: File) => {
    if (!file.name.endsWith('.zip')) {
      setError('Please upload a .zip file.');
      return;
    }
    setError(null);
    setZipUploading(true);
    try {
      const payload: Project = {
        ...project,
        sourceType: SourceType.ZIP,
      };
      await presenter.deployment.redeployProject(payload, {
        zipFile: file,
        onComplete: () => {
          presenter.project.loadProjects();
        },
      });
    } catch (err) {
      console.error(err);
      setError('Failed to deploy from ZIP archive.');
    } finally {
      setZipUploading(false);
    }
  };

  const handleDeleteProject = async () => {
    const confirmed = await presenter.ui.showConfirm({
      title: t('project.dangerZone'),
      message: t('project.deleteConfirm'),
      primaryLabel: t('project.deleteProject'),
      secondaryLabel: t('common.cancel'),
    });
    if (!confirmed) {
      return;
    }
    setError(null);
    try {
      await presenter.project.deleteProject(project.id);
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      setError(t('project.failedToDelete'));
    }
  };

  const handleTogglePublicVisibility = async () => {
    setError(null);
    try {
      const nextValue = !(project.isPublic ?? true);
      await presenter.project.updateProject(project.id, {
        isPublic: nextValue,
      });
    } catch (err) {
      console.error(err);
      setError(t('project.failedToUpdateVisibility'));
    }
  };

  const handleToggleLike = () => {
    if (!user) {
      presenter.auth.openAuthModal('login');
      return;
    }
    presenter.reaction.toggleLike(project.id);
  };

  const handleToggleFavorite = () => {
    if (!user) {
      presenter.auth.openAuthModal('login');
      return;
    }
    presenter.reaction.toggleFavorite(project.id);
  };

  const analytics = {
    views7d: analyticsEntry?.stats?.views7d ?? 0,
    totalViews: analyticsEntry?.stats?.totalViews ?? 0,
    lastViewAt: analyticsEntry?.stats?.lastViewAt,
    isLoading: analyticsEntry?.isLoading ?? false,
    error: analyticsEntry?.error,
  };

  const reactions = {
    likesCount: reactionEntry?.likesCount ?? 0,
    favoritesCount: reactionEntry?.favoritesCount ?? 0,
    likedByCurrentUser: reactionEntry?.likedByCurrentUser ?? false,
    favoritedByCurrentUser: reactionEntry?.favoritedByCurrentUser ?? false,
  };

  const repoLabel = formatRepoLabel(project);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 md:space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('common.back')}
        </button>
        <span className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-400 border border-slate-200 dark:border-white/10">
          Project ID: {project.id}
        </span>
      </div>

      <ProjectSettingsCard
        project={project}
        repoLabel={repoLabel}
        repoUrlDraft={repoUrlDraft}
        onRepoUrlChange={setRepoUrlDraft}
        onSaveRepoUrl={handleSaveRepoUrl}
        isSavingRepoUrl={isSaving}
        nameDraft={nameDraft}
        onNameChange={setNameDraft}
        descriptionDraft={descriptionDraft}
        onDescriptionChange={setDescriptionDraft}
        categoryDraft={categoryDraft}
        onCategoryChange={setCategoryDraft}
        tagsDraft={tagsDraft}
        onTagsChange={setTagsDraft}
        isSavingMetadata={isSavingMetadata}
        onSaveMetadata={handleSaveMetadata}
        canRedeployFromGitHub={canRedeployFromGitHub}
        isRedeploying={isRedeploying}
        isDeploymentInProgress={isDeploymentInProgress}
        onRedeployFromGitHub={handleRedeployFromGitHub}
        zipUploading={zipUploading}
        onZipUpload={handleZipUpload}
        thumbnailUrl={thumbnailUrl}
        thumbnailVersion={thumbnailVersion}
        isUploadingThumbnail={isUploadingThumbnail}
        onThumbnailFileChange={handleThumbnailFileChange}
        onThumbnailPaste={handleThumbnailPaste}
        isPublic={project.isPublic}
        onTogglePublicVisibility={handleTogglePublicVisibility}
        analytics={analytics}
        reactions={reactions}
        onToggleLike={handleToggleLike}
        onToggleFavorite={handleToggleFavorite}
        error={error}
        onDeleteProject={handleDeleteProject}
      />

      <DeploymentSession projectUrlOverride={project.url} />
    </div>
  );
};

import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  ExternalLink,
  GitBranch,
  Heart,
  HeartOff,
  RefreshCcw,
  Save,
  Star,
  Upload,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { DeploymentSession } from '../components/DeploymentSession';
import { URLS } from '../constants';
import { usePresenter } from '../contexts/PresenterContext';
import { useDeploymentStore } from '../stores/deploymentStore';
import { useProjectStore } from '../stores/projectStore';
import { useAnalyticsStore } from '../stores/analyticsStore';
import { useReactionStore } from '../stores/reactionStore';
import { useAuthStore } from '../stores/authStore';
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

      {/* Project Overview */}
      <div className="glass-card rounded-2xl p-6 md:p-8 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center border shadow-inner bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
              <span className="font-bold text-sm tracking-tighter">
                {project.framework.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {project.name}
              </h1>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                {project.category || 'Other'} ·{' '}
                {project.tags && project.tags.length > 0
                  ? project.tags.join(', ')
                  : 'No tags'}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 text-xs">
            <div
              className={`inline-flex items-center gap-2 px-2 py-1 rounded-full border uppercase tracking-wider font-bold ${project.status === 'Live'
                ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
                : project.status === 'Failed'
                  ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                  : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20'
                }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${project.status === 'Live'
                  ? 'bg-green-500 dark:bg-green-400 animate-pulse'
                  : project.status === 'Failed'
                    ? 'bg-red-500 dark:bg-red-400'
                    : 'bg-yellow-500 dark:bg-yellow-400'
                  }`}
              />
              {project.status}
            </div>
            <div className="flex items-center gap-1 text-slate-500 dark:text-gray-400">
              <Clock className="w-3 h-3" /> {t('project.lastDeploy')}: {project.lastDeployed}
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Source configuration */}
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                {t('project.repository')}
              </h3>
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    value={repoUrlDraft}
                    onChange={(e) => setRepoUrlDraft(e.target.value)}
                    placeholder="https://github.com/owner/repo"
                    className="w-full pr-24 pl-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleSaveRepoUrl}
                    disabled={isSaving}
                    className="absolute inset-y-1.5 right-1.5 px-3 text-xs font-semibold rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50"
                  >
                    <Save className="w-3 h-3 inline-block mr-1" />
                    {t('common.save')}
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  {t('project.repoUrlDescription')}
                </p>
                {project.repoUrl && (
                  <a
                    href={project.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-gray-300 hover:text-brand-500 dark:hover:text-brand-400"
                  >
                    <GitBranch className="w-3 h-3" />
                    {formatRepoLabel(project)}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {t('project.metadata')}
              </h3>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-500 dark:text-gray-400">
                  {t('project.displayName')}
                </label>
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder={t('project.displayNamePlaceholder')}
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-700 dark:text-gray-200">
                    {t('project.likeAndFavorite')}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400">
                    {t('project.likeAndFavoriteDescription')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!user) {
                        presenter.auth.openAuthModal('login');
                        return;
                      }
                      presenter.reaction.toggleLike(project.id);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] text-slate-700 dark:text-slate-200 hover:border-pink-500 hover:text-pink-600 dark:hover:text-pink-400"
                  >
                    {reactionEntry?.likedByCurrentUser ? (
                      <Heart className="w-3 h-3 fill-pink-500 text-pink-500" />
                    ) : (
                      <HeartOff className="w-3 h-3" />
                    )}
                    <span>
                      {reactionEntry?.likesCount ?? 0}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!user) {
                        presenter.auth.openAuthModal('login');
                        return;
                      }
                      presenter.reaction.toggleFavorite(project.id);
                    }}
                    className={`inline-flex items-center justify-center w-7 h-7 rounded-full border text-[11px] ${
                      reactionEntry?.favoritedByCurrentUser
                        ? 'bg-yellow-400/90 border-yellow-500 text-yellow-900'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300'
                    }`}
                    aria-label={t('project.toggleFavorite')}
                  >
                    <Star
                      className={`w-3 h-3 ${
                        reactionEntry?.favoritedByCurrentUser
                          ? 'fill-current'
                          : ''
                      }`}
                    />
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-500 dark:text-gray-400">
                  {t('project.description')}
                </label>
                <textarea
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
                  placeholder={t('project.descriptionPlaceholder')}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-500 dark:text-gray-400">
                    {t('project.category')}
                  </label>
                  <input
                    type="text"
                    value={categoryDraft}
                    onChange={(e) => setCategoryDraft(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    placeholder={t('project.categoryPlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-500 dark:text-gray-400">
                    {t('project.tags')}
                  </label>
                  <input
                    type="text"
                    value={tagsDraft}
                    onChange={(e) => setTagsDraft(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    placeholder={t('project.tagsPlaceholder')}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-700 dark:text-gray-200">
                    {t('project.showInExplore')}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400">
                    {t('project.showInExploreDescription')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
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
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${project.isPublic ?? true
                      ? 'bg-green-500/80 border-green-500'
                      : 'bg-slate-400/60 dark:bg-slate-700/80 border-slate-400 dark:border-slate-600'
                    }`}
                  aria-label={t('project.togglePublicVisibility')}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${project.isPublic ?? true ? 'translate-x-5' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleSaveMetadata}
                  disabled={isSavingMetadata}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50"
                >
                  <Save className="w-3 h-3" />
                  {t('project.saveMetadata')}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Redeploy
              </h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleRedeployFromGitHub}
                  disabled={
                    !canRedeployFromGitHub ||
                    isRedeploying ||
                    isDeploymentInProgress
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-brand-500 hover:text-white hover:border-brand-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCcw className="w-3 h-3" />
                  Redeploy from GitHub
                </button>

                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 hover:border-brand-500 hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer transition-colors">
                  <Upload className="w-3 h-3" />
                  <span>{zipUploading ? 'Uploading...' : 'Upload ZIP & Deploy'}</span>
                  <input
                    type="file"
                    accept=".zip"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (zipUploading || isDeploymentInProgress) {
                        e.target.value = '';
                        return;
                      }
                      await handleZipUpload(file);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
              <p className="text-xs text-slate-500 dark:text-gray-500">
                ZIP deployments are one-off: the uploaded archive is only used for the current
                deployment. Your GitHub URL stays configured and can be used again later.
              </p>
            </div>
          </div>

          {/* Runtime details */}
          <div className="w-full md:w-64 space-y-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-gray-400">{t('dashboard.environment')}</span>
                <span className="text-slate-900 dark:text-white font-medium">
                  {t('dashboard.production')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-gray-400">{t('project.framework')}</span>
                <span className="text-slate-900 dark:text-white font-medium">
                  {project.framework}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-gray-400">{t('project.publicUrl')}</span>
              </div>
              {project.url ? (
                <a
                  href={project.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300 break-all"
                >
                  {project.url}
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <p className="text-[11px] text-slate-400 dark:text-gray-500">
                  Not accessible yet.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-gray-400">
                  {t('project.viewsLast7Days')}
                </span>
                <span className="text-slate-900 dark:text-white font-medium">
                  {analyticsEntry?.stats
                    ? analyticsEntry.stats.views7d.toString()
                    : analyticsEntry?.isLoading
                      ? '...'
                      : '0'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-gray-400">
                  {t('project.totalViews')}
                </span>
                <span className="text-slate-900 dark:text-white font-medium">
                  {analyticsEntry?.stats
                    ? analyticsEntry.stats.totalViews.toString()
                    : analyticsEntry?.isLoading
                      ? '...'
                      : '0'}
                </span>
              </div>
              {analyticsEntry?.stats?.lastViewAt && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-gray-400">
                    {t('project.lastView')}
                  </span>
                  <span className="text-slate-900 dark:text-white font-medium">
                    {new Date(
                      analyticsEntry.stats.lastViewAt,
                    ).toLocaleString()}
                  </span>
                </div>
              )}
              {analyticsEntry?.error && (
                <p className="text-[11px] text-red-500 dark:text-red-400">
                  {analyticsEntry.error}
                </p>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3 h-3" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <DeploymentSession projectUrlOverride={project.url} />
    </div>
  );
};

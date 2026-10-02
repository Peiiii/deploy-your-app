import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { PageLayout } from '@/components/page-layout';
import { PageSkeleton } from '@/components/loading-state';
import { PageState } from '@/components/page-state';
import { SessionError } from '@/components/session-error';
import { ProjectSettingsCard } from '@/features/project-settings/components/project-settings-card';
import { URLS } from '@/constants';
import { usePresenter } from '@/contexts/presenter-context';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useProjectStore } from '@/stores/project.store';
import { useProjectSettingsStore } from '@/features/project-settings/stores/project-settings.store';

export const ProjectSettings: React.FC = () => {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const projects = useProjectStore((s) => s.projects);
  const authLoading = useAuthStore((s) => s.isLoading);
  const sessionError = useAuthStore((s) => s.sessionError);
  const hasLoaded = useProjectStore((s) => s.hasLoaded);
  const isLoading = useProjectStore((s) => s.isLoading);
  const loadError = useProjectStore((s) => s.loadError);
  const hasMore = useProjectStore((s) => s.pagination.hasMore);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const projectId = params.id ?? null;

  // Subscribe to error from settings store
  const error = useProjectSettingsStore((s) => s.error);

  const project = useMemo(
    () => projects.find((p) => p.id === projectId) || null,
    [projects, projectId],
  );

  // App restores the session and initial list. Locate older projects across pages
  // without competing with initial loading or requesting before authentication.
  useEffect(() => {
    if (user && hasLoaded && !project && !isLoading && !loadError && hasMore) {
      void presenter.project.loadMore();
    }
  }, [user, hasLoaded, project, isLoading, loadError, hasMore, presenter.project]);

  // Initialize form when project changes
  useEffect(() => {
    if (project) {
      presenter.projectSettings.initializeForm(project);
    }
  }, [project, presenter.projectSettings]);

  // Load analytics once the project is available.
  useEffect(() => {
    if (!project) return;
    presenter.projectSettings.loadAnalytics(project.id, '7d');
  }, [project, presenter.projectSettings]);

  // Load reactions once the project is available.
  useEffect(() => {
    if (!project || !user) return;
    presenter.projectSettings.loadReactions(project.id);
  }, [project, user, presenter.projectSettings]);

  // Handle delete navigation
  const handleDeleteProject = async () => {
    const deleted = await presenter.projectSettings.deleteProject();
    if (deleted) {
      navigate('/dashboard');
    }
  };

  if (authLoading) return <PageSkeleton title={t('common.settings')} shape="details" />;
  if (sessionError) return <PageLayout title={t('common.settings')}><SessionError /></PageLayout>;
  if (!user) return <PageLayout title={t('common.settings')}><PageState title={t('dashboard.signInToViewProjects')} description={t('dashboard.dashboardPrivate')} action={<button className="btn-primary" onClick={() => presenter.auth.openAuthModal('login')}>{t('common.signIn')}</button>} /></PageLayout>;
  if (!project) {
    if (loadError) return <PageLayout title={t('common.settings')}><PageState title={t('experience.projectsError')} action={<button className="btn-primary" onClick={() => { void (hasLoaded ? presenter.project.loadMore() : presenter.project.loadProjects()); }}>{t('common.retry')}</button>} /></PageLayout>;
    if (!hasLoaded || isLoading || hasMore) return <PageSkeleton title={t('common.settings')} shape="details" />;
    return <PageLayout title={t('common.settings')}><PageState title={t('experience.projectUnavailable')} description={t('experience.projectUnavailableDescription')} action={<button className="btn-secondary" onClick={() => navigate('/dashboard')}>{t('dashboard.viewAllProjects')}</button>} /></PageLayout>;
  }

  const canRedeployFromGitHub =
    !!project.repoUrl && project.repoUrl.startsWith(URLS.GITHUB_BASE);

  return <ProjectSettingsCard project={project} canDeployFromGitHub={canRedeployFromGitHub} error={error} onDeleteProject={handleDeleteProject} />;
};

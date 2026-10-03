import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
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
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.isLoading);
  const navigate = useNavigate();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const params = useParams<{ id: string }>();
  const projectId = params.id ?? null;

  // Subscribe to error from settings store
  const error = useProjectSettingsStore((s) => s.error);

  const project = useMemo(
    () => projects.find((p) => p.id === projectId && p.ownerId === user?.id) || null,
    [projects, projectId, user?.id],
  );

  useEffect(() => {
    if (!projectId || !user || project) return;
    let current = true;
    void presenter.project.ensureProjectLoaded(projectId, user.id).catch(() => {
      if (current) setLoadError(projectId);
    });
    return () => { current = false; };
  }, [projectId, user, project, presenter.project, retry]);

  // Initialize form when project changes
  useEffect(() => {
    if (project) {
      presenter.projectSettings.initializeForm(project);
    }
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

  if (!projectId) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-6 text-center">
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            Invalid project URL.
          </p>
        </div>
      </div>
    );
  }

  if (!user && !authLoading) {
    return <div className="p-8 text-center"><button type="button" className="rounded-lg bg-brand-600 px-4 py-2 text-white" onClick={() => presenter.auth.openAuthModal('login')}>{t('deployment.loginToUpdate')}</button></div>;
  }

  if (!project && loadError === projectId) {
    return <div role="alert" className="space-y-3 p-8 text-center text-sm text-slate-500"><p>{t('deployment.updateLoadError')}</p><button type="button" className="text-brand-600" onClick={() => { setLoadError(null); setRetry(value => value + 1); }}>{t('common.retry')}</button></div>;
  }

  if (!project) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-12 text-center">
          <div className="inline-block w-8 h-8 border-2 border-slate-300 dark:border-slate-600 border-t-brand-500 rounded-full animate-spin mb-4"></div>
          <p className="text-sm text-slate-600 dark:text-gray-400">
            {t('common.loadingProjectDetails')}
          </p>
        </div>
      </div>
    );
  }

  const canRedeployFromGitHub =
    !!project.repoUrl && project.repoUrl.startsWith(URLS.GITHUB_BASE);

  // Layout Note: The ProjectSettingsCard (via ProjectLayout) now handles
  // the full page structure including header and padding.
  // We utilize a fragment here to avoid double-padding the content.
  return (
    <>
      {/* Back button is now integrated into URL flow or ProjectLayout header context if needed */}
      <div className="hidden">
        {/* Legacy header components that were removed.
               ProjectLayout now renders the header. */}
      </div>

      <ProjectSettingsCard
        project={project}
        canDeployFromGitHub={canRedeployFromGitHub}
        error={error}
        onDeleteProject={handleDeleteProject}
      />

    </>
  );
};

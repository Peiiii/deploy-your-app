import { ArrowLeft } from 'lucide-react';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { DeploymentSession } from '@/components/DeploymentSession';
import { ProjectSettingsCard } from '@/components/ProjectSettingsCard';
import { URLS } from '@/constants';
import { usePresenter } from '@/contexts/PresenterContext';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { useProjectSettingsStore } from '@/stores/projectSettingsStore';

export const ProjectSettings: React.FC = () => {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const projects = useProjectStore((s) => s.projects);
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

  // Load projects if not available yet
  useEffect(() => {
    if (!projectId) return;
    if (!project && projects.length === 0) {
      presenter.project.loadProjects();
    }
  }, [projectId, project, projects.length, presenter.project]);

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

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 md:space-y-8 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('common.back')}
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-gray-400 border border-slate-200 dark:border-slate-700 font-mono">
            {project.id.slice(0, 8)}...
          </span>
          {project.url && (
            <a
              href={project.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs px-3 py-1.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 hover:bg-brand-500/20 transition-colors"
            >
              {t('common.visit')}
            </a>
          )}
        </div>
      </div>

      <ProjectSettingsCard
        project={project}
        canDeployFromGitHub={canRedeployFromGitHub}
        error={error}
        onDeleteProject={handleDeleteProject}
      />

      <DeploymentSession projectUrlOverride={project.url} />
    </div>
  );
};

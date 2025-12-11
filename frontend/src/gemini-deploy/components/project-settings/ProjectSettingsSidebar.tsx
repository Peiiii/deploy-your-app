import React from 'react';
import { ExternalLink, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  ProjectSettingsCardAnalyticsProps,
  ProjectSettingsProject,
} from './types';

interface ProjectSettingsSidebarProps {
  project: ProjectSettingsProject;
  analytics: ProjectSettingsCardAnalyticsProps;
  onDeleteProject: () => void;
}

export const ProjectSettingsSidebar: React.FC<ProjectSettingsSidebarProps> = ({
  project,
  analytics,
  onDeleteProject,
}) => {
  const { t } = useTranslation();

  return (
    <div className="w-full md:w-64 space-y-4">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-4 space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-gray-400">
            {t('dashboard.environment')}
          </span>
          <span className="text-slate-900 dark:text-white font-medium">
            {t('dashboard.production')}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-gray-400">
            {t('project.framework')}
          </span>
          <span className="text-slate-900 dark:text-white font-medium">
            {project.framework}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-4 space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-gray-400">
            {t('project.publicUrl')}
          </span>
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
            {analytics.isLoading ? '...' : analytics.views7d.toString()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-gray-400">
            {t('project.totalViews')}
          </span>
          <span className="text-slate-900 dark:text-white font-medium">
            {analytics.isLoading ? '...' : analytics.totalViews.toString()}
          </span>
        </div>
        {analytics.lastViewAt && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-gray-400">
              {t('project.lastView')}
            </span>
            <span className="text-slate-900 dark:text-white font-medium">
              {new Date(analytics.lastViewAt).toLocaleString()}
            </span>
          </div>
        )}
        {analytics.error && (
          <p className="text-[11px] text-red-500 dark:text-red-400">
            {analytics.error}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 space-y-3 text-xs">
        <p className="font-semibold text-red-600 dark:text-red-400">
          {t('project.dangerZone')}
        </p>
        <p className="text-[11px] text-red-700/80 dark:text-red-300/80">
          {t('project.deleteDescription')}
        </p>
        <button
          type="button"
          onClick={onDeleteProject}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-600 hover:text-white dark:hover:bg-red-500 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          {t('project.deleteProject')}
        </button>
      </div>
    </div>
  );
};


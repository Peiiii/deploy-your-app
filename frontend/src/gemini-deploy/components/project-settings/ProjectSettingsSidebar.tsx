import React from 'react';
import { Check, Copy, ExternalLink, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
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
  const { copied, copyToClipboard } = useCopyToClipboard();

  const handleCopyUrl = () => {
    if (project.url) {
      copyToClipboard(project.url);
    }
  };

  return (
    <div className="w-full md:w-72 space-y-4">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950/40 dark:to-slate-900/40 p-4 space-y-3 text-xs">
        <h4 className="text-xs font-semibold text-slate-700 dark:text-gray-300 uppercase tracking-wider mb-2">
          {t('project.projectInfo')}
        </h4>
        <div className="flex items-center justify-between py-1.5 border-b border-slate-200 dark:border-slate-800 last:border-0">
          <span className="text-slate-500 dark:text-gray-400">
            {t('dashboard.environment')}
          </span>
          <span className="text-slate-900 dark:text-white font-semibold">
            {t('dashboard.production')}
          </span>
        </div>
        <div className="flex items-center justify-between py-1.5 border-b border-slate-200 dark:border-slate-800 last:border-0">
          <span className="text-slate-500 dark:text-gray-400">
            {t('project.framework')}
          </span>
          <span className="text-slate-900 dark:text-white font-semibold">
            {project.framework}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950/40 dark:to-slate-900/40 p-4 space-y-3 text-xs">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-slate-700 dark:text-gray-300 uppercase tracking-wider">
            {t('project.publicUrl')}
          </h4>
          {project.url && (
            <button
              onClick={handleCopyUrl}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              title={t('common.copyUrl')}
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" />
                  <span>{t('common.copied')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>{t('common.copyUrl')}</span>
                </>
              )}
            </button>
          )}
        </div>
        {project.url ? (
          <a
            href={project.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300 break-all transition-colors"
          >
            <span className="truncate">{project.url}</span>
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
          </a>
        ) : (
          <p className="text-[11px] text-slate-400 dark:text-gray-500">
            {t('common.notAccessible')}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950/40 dark:to-slate-900/40 p-4 space-y-3 text-xs">
        <h4 className="text-xs font-semibold text-slate-700 dark:text-gray-300 uppercase tracking-wider mb-2">
          {t('project.analytics')}
        </h4>
        <div className="flex items-center justify-between py-1.5 border-b border-slate-200 dark:border-slate-800">
          <span className="text-slate-500 dark:text-gray-400">
            {t('project.viewsLast7Days')}
          </span>
          <span className="text-slate-900 dark:text-white font-semibold text-base">
            {analytics.isLoading ? (
              <span className="inline-block w-8 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></span>
            ) : (
              analytics.views7d.toLocaleString()
            )}
          </span>
        </div>
        <div className="flex items-center justify-between py-1.5 border-b border-slate-200 dark:border-slate-800">
          <span className="text-slate-500 dark:text-gray-400">
            {t('project.totalViews')}
          </span>
          <span className="text-slate-900 dark:text-white font-semibold text-base">
            {analytics.isLoading ? (
              <span className="inline-block w-8 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></span>
            ) : (
              analytics.totalViews.toLocaleString()
            )}
          </span>
        </div>
        {analytics.lastViewAt && (
          <div className="flex items-center justify-between py-1.5">
            <span className="text-slate-500 dark:text-gray-400">
              {t('project.lastView')}
            </span>
            <span className="text-slate-900 dark:text-white font-medium text-[10px]">
              {new Date(analytics.lastViewAt).toLocaleString()}
            </span>
          </div>
        )}
        {analytics.error && (
          <p className="text-[11px] text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-2 py-1 rounded">
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


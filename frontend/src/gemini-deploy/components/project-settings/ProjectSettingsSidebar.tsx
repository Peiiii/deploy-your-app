import React from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePresenter } from '../../contexts/PresenterContext';
import { useAnalyticsStore } from '../../stores/analyticsStore';
import type { Project } from '../../types';

interface ProjectSettingsSidebarProps {
  project: Project;
  onDeleteProject: () => void;
}

export const ProjectSettingsSidebar: React.FC<ProjectSettingsSidebarProps> = ({
  project,
  onDeleteProject,
}) => {
  const { t } = useTranslation();
  const presenter = usePresenter();

  // Subscribe to analytics from store
  const analyticsEntry = useAnalyticsStore((s) => s.byProjectId[project.id]);
  const views7d = analyticsEntry?.stats?.views7d ?? 0;
  const totalViews = analyticsEntry?.stats?.totalViews ?? 0;
  const lastViewAt = analyticsEntry?.stats?.lastViewAt;
  const isLoading = analyticsEntry?.isLoading ?? false;
  const error = analyticsEntry?.error;

  const showInExplore = project.isPublic ?? true;

  return (
    <div className="w-full md:w-72 space-y-4">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/30 p-4 space-y-3 text-xs">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-700 dark:text-gray-300 uppercase tracking-wider">
              {t('project.showInExplore')}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-gray-400">
              {t('project.showInExploreDescription')}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={showInExplore}
            onClick={presenter.projectSettings.togglePublicVisibility}
            className={`relative inline-flex h-6 w-14 items-center rounded-full border transition-colors ${
              showInExplore
                ? 'bg-brand-500/90 border-brand-500/60'
                : 'bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
            }`}
            title={t('project.togglePublicVisibility')}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                showInExplore ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
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
            {isLoading ? (
              <span className="inline-block w-8 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></span>
            ) : (
              views7d.toLocaleString()
            )}
          </span>
        </div>
        <div className="flex items-center justify-between py-1.5 border-b border-slate-200 dark:border-slate-800">
          <span className="text-slate-500 dark:text-gray-400">
            {t('project.totalViews')}
          </span>
          <span className="text-slate-900 dark:text-white font-semibold text-base">
            {isLoading ? (
              <span className="inline-block w-8 h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></span>
            ) : (
              totalViews.toLocaleString()
            )}
          </span>
        </div>
        {lastViewAt && (
          <div className="flex items-center justify-between py-1.5">
            <span className="text-slate-500 dark:text-gray-400">
              {t('project.lastView')}
            </span>
            <span className="text-slate-900 dark:text-white font-medium text-[10px]">
              {new Date(lastViewAt).toLocaleString()}
            </span>
          </div>
        )}
        {error && (
          <p className="text-[11px] text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-2 py-1 rounded">
            {error}
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

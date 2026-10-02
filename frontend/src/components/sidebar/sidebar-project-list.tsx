import React from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SidebarProjectItem } from './sidebar-project-item';
import { SidebarProjectListSkeleton } from './sidebar-project-list-skeleton';
import type { Project } from '../../types';

interface SidebarProjectListProps {
  projects: Project[];
  pinnedProjectIds: string[];
  onTogglePin: (e: React.MouseEvent, projectId: string) => void;
  isLoading?: boolean;
  hasLoadError?: boolean;
  onRetry?: () => void;
}

export const SidebarProjectList: React.FC<SidebarProjectListProps> = ({
  projects,
  pinnedProjectIds,
  onTogglePin,
  isLoading = false,
  hasLoadError = false,
  onRetry,
}) => {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <div className="mt-5 pt-4 flex flex-col min-h-0 flex-1">
      <div className="px-3 mb-3 flex items-center justify-between gap-2 flex-shrink-0">
        <p className="text-xs font-medium text-app-muted">
          {t('navigation.projects')}
        </p>
      </div>
      <div className="overflow-y-auto flex-1 min-h-0">
        {isLoading && projects.length === 0 ? (
          <SidebarProjectListSkeleton />
        ) : hasLoadError && projects.length === 0 ? (
          <div className="px-3 py-1 text-[11px] text-slate-400 dark:text-gray-500">
            <p>{t('navigation.projectsLoadError')}</p>
            {onRetry && (
              <button
                type="button"
                className="mt-2 font-semibold text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                onClick={onRetry}
              >
                {t('common.retry')}
              </button>
            )}
          </div>
        ) : projects.length === 0 ? (
          <p className="px-3 py-1 text-[11px] text-slate-400 dark:text-gray-500">
            {t('navigation.noProjects')}
          </p>
        ) : (
          <div className="space-y-1">
            {projects.map((project) => {
              const isActive = location.pathname === `/projects/${project.id}`;
              const isPinned = pinnedProjectIds.includes(project.id);
              return (
                <SidebarProjectItem
                  key={project.id}
                  project={project}
                  isActive={isActive}
                  isPinned={isPinned}
                  onTogglePin={onTogglePin}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

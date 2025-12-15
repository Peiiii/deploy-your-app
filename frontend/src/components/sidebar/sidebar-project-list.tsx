import React from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SidebarProjectItem } from './sidebar-project-item';
import { SidebarProjectViewToggle } from './sidebar-project-view-toggle';
import { SidebarProjectListSkeleton } from './sidebar-project-list-skeleton';
import type { Project } from '../../types';

interface SidebarProjectListProps {
  projects: Project[];
  pinnedProjectIds: string[];
  viewType: 'pinned' | 'recent';
  onViewTypeChange: (type: 'pinned' | 'recent') => void;
  onTogglePin: (e: React.MouseEvent, projectId: string) => void;
  pinnedProjects: Project[];
  isLoading?: boolean;
}

export const SidebarProjectList: React.FC<SidebarProjectListProps> = ({
  projects,
  pinnedProjectIds,
  viewType,
  onViewTypeChange,
  onTogglePin,
  pinnedProjects,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5 flex flex-col min-h-0 flex-1">
      <div className="px-2 mb-2 flex items-center justify-between gap-2 flex-shrink-0">
        <p className="text-[10px] font-semibold text-slate-400 dark:text-gray-400 uppercase tracking-wider">
          {t('navigation.myProjects')}
        </p>
        <SidebarProjectViewToggle
          viewType={viewType}
          onViewTypeChange={onViewTypeChange}
          hasPinned={pinnedProjects.length > 0}
        />
      </div>
      <div className="overflow-y-auto flex-1 min-h-0">
        {isLoading ? (
          <SidebarProjectListSkeleton />
        ) : projects.length === 0 ? (
          <p className="px-3 py-1 text-[11px] text-slate-400 dark:text-gray-500">
            {viewType === 'pinned'
              ? t('navigation.noPinnedProjects')
              : t('navigation.noRecentProjects')}
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

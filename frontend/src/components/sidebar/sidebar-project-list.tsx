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
}

export const SidebarProjectList: React.FC<SidebarProjectListProps> = ({
  projects,
  pinnedProjectIds,
  onTogglePin,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5 flex flex-col min-h-0 flex-1">
      <div className="px-5 mb-3 flex items-center justify-between gap-2 flex-shrink-0">
        <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          Projects
        </p>
      </div>
      <div className="overflow-y-auto flex-1 min-h-0">
        {isLoading ? (
          <SidebarProjectListSkeleton />
        ) : projects.length === 0 ? (
          <p className="px-3 py-1 text-[11px] text-slate-400 dark:text-gray-500">
            {t('navigation.noPinnedProjects')}
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

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Pin } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import type { Project } from '../../types';

interface SidebarProjectItemProps {
  project: Project;
  isActive: boolean;
  isPinned: boolean;
  onTogglePin: (e: React.MouseEvent, projectId: string) => void;
}

export const SidebarProjectItem: React.FC<SidebarProjectItemProps> = ({
  project,
  isActive,
  isPinned,
  onTogglePin,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setSidebarOpen } = useUIStore((state) => state.actions);

  const handleClick = () => {
    navigate(`/projects/${project.id}`);
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  return (
    <div
      className={`group flex items-center gap-2 rounded-lg text-xs font-medium transition-all duration-200 w-full px-3 py-2 ${
        isActive
          ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800'
          : 'text-slate-600 dark:text-gray-400 bg-transparent dark:bg-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
      }`}
    >
      <button
        onClick={handleClick}
        className="flex items-center gap-2 flex-1 min-w-0 text-left"
        title={project.name}
      >
        <span className="truncate block">{project.name}</span>
      </button>
      <button
        onClick={(e) => onTogglePin(e, project.id)}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-300 dark:hover:bg-slate-700"
        title={isPinned ? t('navigation.unpinProject') : t('navigation.pinProject')}
      >
        <Pin 
          className={`w-3 h-3 transition-colors ${
            isPinned 
              ? 'text-purple-600 dark:text-purple-400' 
              : 'text-slate-500 dark:text-gray-400'
          }`}
          fill={isPinned ? 'currentColor' : 'none'}
        />
      </button>
    </div>
  );
};

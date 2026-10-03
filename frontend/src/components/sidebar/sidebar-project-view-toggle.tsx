import { IconButton } from '@/components/icon-button';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pin, Clock } from 'lucide-react';

interface SidebarProjectViewToggleProps {
  viewType: 'pinned' | 'recent';
  onViewTypeChange: (type: 'pinned' | 'recent') => void;
  hasPinned: boolean;
}

export const SidebarProjectViewToggle: React.FC<SidebarProjectViewToggleProps> = ({
  viewType,
  onViewTypeChange,
  hasPinned,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-md p-0.5">
      <IconButton tooltipSide="bottom" label={t('navigation.pinnedProjects')} size="auto"
        onClick={() => onViewTypeChange('pinned')}
        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
          viewType === 'pinned'
            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
            : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300'
        } ${!hasPinned ? 'opacity-60' : ''}`}
      >
        <Pin className="w-3 h-3" />
      </IconButton>
      <IconButton tooltipSide="bottom" label={t('navigation.recentProjects')} size="auto"
        onClick={() => onViewTypeChange('recent')}
        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
          viewType === 'recent'
            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
            : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300'
        }`}
      >
        <Clock className="w-3 h-3" />
      </IconButton>
    </div>
  );
};

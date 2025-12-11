import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pin, Clock } from 'lucide-react';

interface SidebarProjectViewToggleProps {
  viewType: 'pinned' | 'recent';
  onViewTypeChange: (type: 'pinned' | 'recent') => void;
  showPinned: boolean;
}

export const SidebarProjectViewToggle: React.FC<SidebarProjectViewToggleProps> = ({
  viewType,
  onViewTypeChange,
  showPinned,
}) => {
  const { t } = useTranslation();

  if (!showPinned) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-md p-0.5">
      <button
        onClick={() => onViewTypeChange('pinned')}
        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
          viewType === 'pinned'
            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
            : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300'
        }`}
        title={t('navigation.pinnedProjects')}
      >
        <Pin className="w-3 h-3" />
      </button>
      <button
        onClick={() => onViewTypeChange('recent')}
        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
          viewType === 'recent'
            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
            : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300'
        }`}
        title={t('navigation.recentProjects')}
      >
        <Clock className="w-3 h-3" />
      </button>
    </div>
  );
};

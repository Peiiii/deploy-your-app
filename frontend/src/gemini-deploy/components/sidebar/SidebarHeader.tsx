import React from 'react';
import { X, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../stores/uiStore';

interface SidebarHeaderProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  collapsed,
  onToggleCollapsed,
}) => {
  const { t } = useTranslation();
  const { setSidebarOpen } = useUIStore((state) => state.actions);

  return (
    <>
      <div className={`p-8 pb-6 flex items-center gap-3 relative ${collapsed ? 'justify-center' : ''}`}>
        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden absolute top-4 right-4 p-1 text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="relative">
          <div className="absolute inset-0 bg-purple-500 blur opacity-40 rounded-lg"></div>
          <div className="relative w-9 h-9 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg border border-white/10">
            <Zap className="text-white w-5 h-5" />
          </div>
        </div>
        {!collapsed && (
          <div>
            <h1 className="font-bold text-lg tracking-tight text-slate-900 dark:text-white leading-none">
              Gemi<span className="text-purple-600 dark:text-purple-400">Go</span>
            </h1>
            <span className="text-[10px] text-slate-500 dark:text-gray-500 font-mono tracking-wider uppercase">
              Magic Edition
            </span>
          </div>
        )}
      </div>

      <button
        onClick={onToggleCollapsed}
        className="hidden md:flex absolute top-4 -right-3 w-6 h-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full items-center justify-center shadow-md hover:shadow-lg transition-all z-50 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
        aria-label={collapsed ? t('ui.expandSidebar') : t('ui.collapseSidebar')}
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>

      {!collapsed && (
        <div className="px-6 mb-2">
          <p className="text-[10px] font-semibold text-slate-400 dark:text-gray-400 uppercase tracking-wider mb-2">
            {t('navigation.myProjects').toUpperCase()}
          </p>
        </div>
      )}
    </>
  );
};

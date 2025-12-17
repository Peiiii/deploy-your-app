import React from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../stores/ui.store';

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
      <div className={`p-6 pb-6 flex items-center gap-3 relative ${collapsed ? 'justify-center' : ''}`}>
        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden absolute top-4 right-4 p-1 text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
        {/* Dev Native Style: Code Brackets */}
        <div className="relative w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center shadow-sm group border border-slate-200 dark:border-slate-700/50">
          <div className="flex items-center gap-[0.5px] font-mono leading-none select-none">
            <span className="text-slate-400 text-xs">&lt;</span>
            <span className="font-black text-slate-900 dark:text-white text-base">G</span>
            <span className="text-brand-600 dark:text-brand-500 text-xs">/&gt;</span>
          </div>
        </div>
        {!collapsed && (
          <div>
            <h1 className="font-bold text-lg tracking-tight text-slate-900 dark:text-white leading-none font-mono">
              GemiGo
            </h1>
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

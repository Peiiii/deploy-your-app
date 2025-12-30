import React from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../stores/ui.store';

interface SidebarHeaderProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

// --- LOGO HELPER ---
const Sector = ({ start, end, color = "currentColor", r = 12, cx = 16, cy = 16 }: { start: number; end: number; color?: string; r?: number, cx?: number, cy?: number }) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(start));
  const y1 = cy + r * Math.sin(toRad(start));
  const x2 = cx + r * Math.cos(toRad(end));
  const y2 = cy + r * Math.sin(toRad(end));
  const largeArcFlag = (end - start) > 180 ? 1 : 0;
  return <path d={`M${cx} ${cy} L${x1} ${y1} A${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`} fill={color} stroke="none" />;
};

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  collapsed,
  onToggleCollapsed,
}) => {
  const { t } = useTranslation();
  const { setSidebarOpen } = useUIStore((state) => state.actions);

  return (
    <>
      <div className={`transition-all duration-300 flex items-center gap-3 relative ${collapsed ? 'p-0 w-full justify-center py-6' : 'p-6 pb-6'}`}>
        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden absolute top-4 right-4 p-1 text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
        {/* Precise 30 Logo (Purple) */}
        {/* Precise 30 Logo (Purple) - Optimized for Collapsed State */}
        <div className={`relative flex items-center justify-center transition-all duration-300 ${collapsed ? 'w-10 h-10' : 'w-10 h-10'}`}>
          <div className={`transition-all duration-300 ${collapsed ? 'w-7 h-7' : 'w-10 h-10'}`}>
            <svg width="100%" height="100%" viewBox="0 0 32 32" fill="none">
              <Sector start={-90} end={-30} color="#a78bfa" />
              <Sector start={0} end={90} color="#7c3aed" />
              <Sector start={90} end={180} color="#5b21b6" />
              <Sector start={180} end={270} color="#8b5cf6" />
            </svg>
          </div>
        </div>
        {!collapsed && (
          <div>
            <h1 className="font-bold text-xl tracking-tight text-slate-900 dark:text-white leading-none font-sans">
              Gemi<span className="text-brand-600 dark:text-brand-400">Go</span>
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
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em] mb-2">
            {t('navigation.myProjects').toUpperCase()}
          </p>
        </div>
      )}
    </>
  );
};

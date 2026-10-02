import React from 'react';
import { Link } from 'react-router-dom';
import { X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
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
      <div className={`transition-colors duration-150 flex items-center gap-3 relative ${collapsed ? 'px-2 py-4 justify-center' : 'px-4 py-4'}`}>
        <button
          onClick={() => setSidebarOpen(false)}
          aria-label={t('common.close')}
          className="md:hidden absolute top-4 right-4 p-1 text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
        {/* Precise 30 Logo (Purple) */}
        {/* Precise 30 Logo (Purple) - Optimized for Collapsed State */}
        <div className={`relative flex items-center justify-center transition-colors duration-150 ${collapsed ? 'w-8 h-8' : 'w-8 h-8'}`}>
          <div className={`transition-colors duration-150 ${collapsed ? 'w-7 h-7' : 'w-8 h-8'}`}>
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
            <Link to="/" className="font-semibold text-lg tracking-tight text-slate-900 dark:text-white leading-none font-sans">
              Gemi<span className="text-brand-600 dark:text-brand-400">Go</span>
            </Link>
          </div>
        )}
      </div>

      <button
        style={collapsed ? { position: 'static', margin: '0 auto 8px' } : undefined}
        onClick={onToggleCollapsed}
        className="icon-button hidden md:flex absolute right-2 top-5"
        aria-label={collapsed ? t('ui.expandSidebar') : t('ui.collapseSidebar')}
      >
        {collapsed ? (
          <PanelLeftOpen className="w-[18px] h-[18px]" />
        ) : (
          <PanelLeftClose className="w-[18px] h-[18px]" />
        )}
      </button>

    </>
  );
};

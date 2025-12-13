import React from 'react';
import { Rocket, Wifi } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../stores/uiStore';
import { SidebarHeader } from './sidebar/SidebarHeader';
import { SidebarNavigation } from './sidebar/SidebarNavigation';
import { SidebarProjectList } from './sidebar/SidebarProjectList';
import { SidebarUserProfile } from './sidebar/SidebarUserProfile';
import { useSidebarProjects } from './sidebar/useSidebarProjects';

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const { setSidebarOpen, toggleSidebarCollapsed } = useUIStore((state) => state.actions);
  
  const {
    userProjects,
    pinnedProjects,
    recentProjects,
    displayedProjects,
    pinnedProjectIds,
    projectViewType,
    setProjectViewType,
    handleTogglePin,
  } = useSidebarProjects();

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <div className={`h-screen fixed left-0 top-0 flex flex-col bg-app-surface border border-app-border border-r-0 z-50 transition-all duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0 md:flex ${
        sidebarCollapsed ? 'w-16 md:w-16' : 'w-64 md:w-64'
      }`}>
        <SidebarHeader
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebarCollapsed}
        />

        <nav className={`flex-1 flex flex-col min-h-0 ${sidebarCollapsed ? 'px-2' : 'px-4'}`}>
          <SidebarNavigation collapsed={sidebarCollapsed} />
          
          {userProjects.length > 0 && !sidebarCollapsed && (
            <SidebarProjectList
              projects={displayedProjects}
              pinnedProjectIds={pinnedProjectIds}
              viewType={projectViewType}
              onViewTypeChange={setProjectViewType}
              onTogglePin={handleTogglePin}
              pinnedProjects={pinnedProjects}
            />
          )}
        </nav>

      {!sidebarCollapsed && (
        <div className="p-4 mx-4 mb-2 rounded-xl bg-gradient-to-b from-slate-100 to-transparent dark:from-white/5 border border-slate-200 dark:border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300 flex items-center justify-center border border-purple-500/20 dark:border-purple-500/30">
              <Rocket className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-900 dark:text-white">{t('ui.theShowcase')}</p>
              <p className="text-[10px] text-slate-500 dark:text-gray-400">{t('ui.proPlan')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Connection Status Indicator */}
      {!sidebarCollapsed && (
        <div className="px-6 py-2">
          <div className="flex items-center justify-between text-[10px] font-mono border border-green-500/30 bg-green-500/5 text-green-600 dark:text-green-400 rounded px-2 py-1.5">
            <span className="flex items-center gap-1.5 font-bold">
              <Wifi className="w-3 h-3" />
              {t('ui.connected')}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
          </div>
        </div>
      )}

        <SidebarUserProfile collapsed={sidebarCollapsed} />
      </div>
    </>
  );
};

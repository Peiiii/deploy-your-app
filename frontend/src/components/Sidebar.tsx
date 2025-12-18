import React from 'react';

import { useTranslation } from 'react-i18next';
import { useUIStore } from '../stores/ui.store';
import { SidebarHeader } from './sidebar/sidebar-header';
import { SidebarNavigation } from './sidebar/sidebar-navigation';
import { SidebarProjectList } from './sidebar/sidebar-project-list';
import { SidebarUserProfile } from './sidebar/sidebar-user-profile';
import { useSidebarProjects } from './sidebar/use-sidebar-projects';

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const { setSidebarOpen, toggleSidebarCollapsed } = useUIStore((state) => state.actions);

  const {
    pinnedProjects,
    displayedProjects,
    pinnedProjectIds,
    projectViewType,
    setProjectViewType,
    handleTogglePin,
    isLoading,
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

      <div className={`h-screen fixed left-0 top-0 flex flex-col bg-app-surface border border-app-border border-r-0 z-50 transition-all duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 md:flex ${sidebarCollapsed ? 'w-16 md:w-16' : 'w-64 md:w-64'
        }`}>
        <SidebarHeader
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebarCollapsed}
        />

        <nav className={`flex-1 flex flex-col min-h-0 ${sidebarCollapsed ? 'px-2' : 'px-4'}`}>
          <SidebarNavigation collapsed={sidebarCollapsed} />

          {!sidebarCollapsed && (
            <SidebarProjectList
              projects={displayedProjects}
              pinnedProjectIds={pinnedProjectIds}
              viewType={projectViewType}
              onViewTypeChange={setProjectViewType}
              onTogglePin={handleTogglePin}
              pinnedProjects={pinnedProjects}
              isLoading={isLoading ?? false}
            />
          )}
        </nav>



        {/* Connection Status Indicator */}


        <SidebarUserProfile collapsed={sidebarCollapsed} />
      </div>
    </>
  );
};

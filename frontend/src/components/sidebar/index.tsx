import { useUIStore } from '@/stores/ui.store';
import React from 'react';
import { SidebarHeader } from './sidebar-header';
import { SidebarNavigation } from './sidebar-navigation';
import { SidebarProjectList } from './sidebar-project-list';
import { SidebarUserProfile } from './sidebar-user-profile';
import { useSidebarProjects } from './use-sidebar-projects';

export const Sidebar: React.FC = () => {
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const { setSidebarOpen, toggleSidebarCollapsed } = useUIStore((state) => state.actions);

  const {
    displayedProjects,
    pinnedProjectIds,
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
              onTogglePin={handleTogglePin}
              isLoading={isLoading ?? false}
            />
          )}
        </nav>

        <SidebarUserProfile collapsed={sidebarCollapsed} />
      </div>
    </>
  );
};

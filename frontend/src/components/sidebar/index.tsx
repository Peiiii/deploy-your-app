import { useUIStore } from '@/stores/ui.store';
import React from 'react';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { Modal } from '@/components/modal';
import { useTranslation } from 'react-i18next';
import { SidebarHeader } from './sidebar-header';
import { SidebarNavigation } from './sidebar-navigation';
import { SidebarProjectList } from './sidebar-project-list';
import { SidebarUserProfile } from './sidebar-user-profile';
import { useSidebarProjects } from './use-sidebar-projects';

export const Sidebar: React.FC = () => {
  const { isMobile } = useBreakpoint();
  const { t } = useTranslation();
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const { setSidebarOpen, toggleSidebarCollapsed } = useUIStore((state) => state.actions);

  const {
    displayedProjects,
    pinnedProjectIds,
    handleTogglePin,
    isLoading,
    hasLoadError,
    retryProjects,
  } = useSidebarProjects();

  const collapsed = !isMobile && sidebarCollapsed;
  const content = (
    <div className={`flex h-[100dvh] flex-col bg-app-sidebar ${collapsed ? 'w-16' : 'w-64'}`}>
      <SidebarHeader collapsed={collapsed} onToggleCollapsed={toggleSidebarCollapsed} />
      <nav aria-label={t('experience.mainNavigation')} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-4 pt-2">
        <SidebarNavigation collapsed={collapsed} />
        {!collapsed && <SidebarProjectList
          projects={displayedProjects} pinnedProjectIds={pinnedProjectIds} onTogglePin={handleTogglePin}
          isLoading={isLoading ?? false} hasLoadError={hasLoadError} onRetry={retryProjects}
        />}
      </nav>
      <SidebarUserProfile collapsed={collapsed} />
    </div>
  );
  return isMobile ? (
    <Modal open={sidebarOpen} onClose={() => setSidebarOpen(false)} titleId="mobile-navigation-title" title={t('experience.mainNavigation')} layout="drawer">
      <div id="mobile-navigation">{content}</div>
    </Modal>
  ) : <aside className="fixed inset-y-0 left-0 z-40 border-r border-app-border">{content}</aside>;

};

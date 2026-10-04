import { useUIStore } from '@/stores/ui.store';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen } from 'lucide-react';
import { IconButton } from '@/components/icon-button';
import { SidebarHeader } from './sidebar-header';
import { SidebarNavigation } from './sidebar-navigation';
import { SidebarProjectList } from './sidebar-project-list';
import { SidebarUserProfile } from './sidebar-user-profile';
import { useSidebarProjects } from './use-sidebar-projects';

export const Sidebar: React.FC = () => {
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

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={`h-screen fixed left-0 top-0 flex flex-col bg-app-surface dark:bg-slate-900 border-r border-app-border dark:border-slate-800/50 z-50 transition-all duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 md:flex ${sidebarCollapsed ? 'w-16 md:w-16' : 'w-64 md:w-64'
        }`}>
        <SidebarHeader
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebarCollapsed}
        />

        <nav className={`flex-1 flex flex-col min-h-0 overflow-y-auto scrollbar-hide py-2 ${sidebarCollapsed ? 'px-2 gap-4' : 'px-3 gap-2'}`}>
          <SidebarNavigation collapsed={sidebarCollapsed} />

          {!sidebarCollapsed && (
            <SidebarProjectList
              projects={displayedProjects}
              pinnedProjectIds={pinnedProjectIds}
              onTogglePin={handleTogglePin}
              isLoading={isLoading ?? false}
              hasLoadError={hasLoadError}
              onRetry={retryProjects}
            />
          )}
        </nav>

        <div className="shrink-0 px-3 py-2 border-t border-app-border dark:border-slate-800">
          <IconButton asChild label={t('ui.developerDocs')} showTooltip={sidebarCollapsed} tooltipSide="right" size="auto">
            <a
              href="https://docs.gemigo.io"
              target="_blank"
              rel="noopener noreferrer"
              className={`w-full min-h-10 gap-3 rounded-xl text-sm text-app-muted hover:text-slate-900 dark:hover:text-white ${sidebarCollapsed ? 'p-2' : '!justify-start px-4 py-2'}`}
            >
              <BookOpen className="w-5 h-5 shrink-0" />
              {!sidebarCollapsed && <span className="whitespace-nowrap">{t('ui.developerDocs')}</span>}
            </a>
          </IconButton>
        </div>
        <SidebarUserProfile collapsed={sidebarCollapsed} />
      </div>
    </>
  );
};

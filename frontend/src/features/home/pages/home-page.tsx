import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { ExploreAppCard } from '@/components/explore-app-card';
import { usePresenter } from '@/contexts/presenter-context';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { useRightPanel } from '@/hooks/use-right-panel';
import { SourceType } from '@/types';
import { HomeDeploySection } from '@/features/home/components/home-deploy-section';
import { HomeExploreSection } from '@/features/home/components/home-explore-section';
import { AppPreviewPanel } from '@/features/home/components/app-preview-panel';

export const Home: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const presenter = usePresenter();
  const user = useAuthStore((s) => s.user);
  const setSidebarCollapsed = useUIStore((state) => state.actions.setSidebarCollapsed);
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const { isDesktop } = useBreakpoint();
  const { openRightPanel, closeRightPanel, isOpen: isPanelOpen } = useRightPanel();

  const requireAuthAnd = (action: () => void) => {
    if (!user) {
      presenter.auth.openAuthModal('login');
      presenter.ui.showToast(t('deployment.signInRequired'), 'info');
      return;
    }
    action();
  };

  const handleQuickDeploy = (sourceType: SourceType) => {
    requireAuthAnd(() => {
      navigate('/deploy', { state: { sourceType } });
    });
  };

  const handleOpenInNewTab = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCardClick = (app: ExploreAppCard) => {
    if (app.url) {
      if (!isDesktop) {
        window.open(app.url, '_blank', 'noopener,noreferrer');
      } else {
        // Open the preview panel using the global service
        openRightPanel(
          <AppPreviewPanel
            app={app}
            onClose={closeRightPanel}
            onOpenInNewTab={handleOpenInNewTab}
          />,
          { closeOnUnmount: true }
        );
        // Collapse sidebar for more space
        if (!sidebarCollapsed) {
          setSidebarCollapsed(true);
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-900 relative flex flex-col">
      <div className="flex-1 flex flex-col">
        {/* Main Content Area */}
        <div
          className={`transition-all duration-500 ease-out pb-8 ${isPanelOpen ? 'w-full' : 'w-full max-w-7xl mx-auto'
            }`}
        >
          {/* Bento Header */}
          <header className="h-20 px-8 flex items-center justify-between sticky top-0 bg-[#f8fafc]/80 dark:bg-slate-900/80 backdrop-blur z-20 border-b border-slate-100 dark:border-slate-800/50">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {t('navigation.home')}
            </h1>
            <button
              onClick={() => navigate('/deploy')}
              className="px-5 py-2.5 bg-brand-600 text-white rounded-full text-sm font-bold hover:bg-brand-700 shadow-lg shadow-brand-500/25 transition-all hover:scale-105 active:scale-95"
            >
              + {t('common.newProject') || 'New Project'}
            </button>
          </header>

          <div className="p-6 md:p-8 pt-6">
            {/* Quick Deploy Title */}
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                {t('home.quickDeploy')}
              </h2>
            </div>

            {/* Deploy Section */}
            <HomeDeploySection
              compact={isPanelOpen}
              onQuickDeploy={handleQuickDeploy}
            />

            <div className={isPanelOpen ? 'h-4' : 'h-8'} />

            {/* Explore Section */}
            <HomeExploreSection
              compact={isPanelOpen}
              onCardClick={handleCardClick}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

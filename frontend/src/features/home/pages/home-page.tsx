import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { ExploreAppCard } from '@/components/explore-app-card';
import { usePresenter } from '@/contexts/presenter-context';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { SourceType } from '@/types';
import { HomeDeploySection } from '@/features/home/components/home-deploy-section';
import { HomeExploreSection } from '@/features/home/components/home-explore-section';
import { AppPreviewPanel } from '@/features/home/components/app-preview-panel';

export const Home: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const presenter = usePresenter();
  const user = useAuthStore((s) => s.user);
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useUIStore((state) => state.actions.setSidebarCollapsed);
  const [selectedApp, setSelectedApp] = useState<ExploreAppCard | null>(null);
  const { isDesktop } = useBreakpoint();

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

  const handleCardClick = (app: ExploreAppCard) => {
    if (app.url) {
      if (!isDesktop) {
        window.open(app.url, '_blank', 'noopener,noreferrer');
      } else {
        setSelectedApp(app);
        if (!sidebarCollapsed) {
          setSidebarCollapsed(true);
        }
      }
    }
  };

  const handleClosePreview = () => {
    setSelectedApp(null);
  };

  const handleOpenInNewTab = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="h-full bg-app-bg relative overflow-hidden">
      <div className={`flex flex-col lg:flex-row gap-4 lg:gap-6 ${selectedApp ? 'max-w-full' : 'max-w-7xl'} mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8 ${selectedApp ? 'h-[calc(100vh-4rem)]' : ''}`}>
        {/* Left Column - App List */}
        <div className={`transition-all duration-500 ease-out ${selectedApp ? 'w-full lg:w-1/2 flex flex-col overflow-hidden' : 'w-full'}`}>
          <div className={`space-y-6 md:space-y-8 transition-all duration-500 ${selectedApp ? 'flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent' : ''}`}>

            {/* Deploy Section - Top */}
            <HomeDeploySection
              compact={!!selectedApp}
              onQuickDeploy={handleQuickDeploy}
            />

            <HomeExploreSection
              compact={!!selectedApp}
              onCardClick={handleCardClick}
            />
          </div>
        </div>

        {/* Right Column - Preview Panel */}
        {selectedApp && (
          <AppPreviewPanel
            app={selectedApp}
            onClose={handleClosePreview}
            onOpenInNewTab={handleOpenInNewTab}
          />
        )}
      </div>
    </div>
  );
};

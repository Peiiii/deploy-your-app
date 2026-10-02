import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { ExploreAppCard } from '@/components/explore-app-card';
import { useAppPreviewPanel } from '@/hooks/use-app-preview-panel';
import { SourceType } from '@/types';
import { HomeDeploySection } from '@/features/home/components/home-deploy-section';
import { HomeExploreSection } from '@/features/home/components/home-explore-section';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { openAppPreview, isPanelOpen } = useAppPreviewPanel();

  const handleQuickDeploy = (sourceType: SourceType) => {
    navigate(`/deploy?source=${sourceType}`);
  };

  const handleCardClick = (app: ExploreAppCard) => {
    openAppPreview(app);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-900 relative flex flex-col">
      <div className="flex-1 flex flex-col">
        {/* Main Content Area */}
        <div
          className={`transition-all duration-500 ease-out pb-8 ${isPanelOpen ? 'w-full' : 'w-full max-w-7xl mx-auto'
            }`}
        >
          <h1 className="sr-only">GemiGo</h1>
          <div className="p-4 md:px-8 md:py-6">
            {/* Deploy Section */}
            <HomeDeploySection
              compact={isPanelOpen}
              onQuickDeploy={handleQuickDeploy}
            />

            <div className={isPanelOpen ? 'h-5' : 'h-6'} />

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

import { PublicInfo } from '@/seo/public-info';
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ExploreAppCard } from '@/components/explore-app-card';
import { useAppPreviewPanel } from '@/hooks/use-app-preview-panel';
import { SourceType } from '@/types';
import { HomeDeploySection } from '@/features/home/components/home-deploy-section';
import { HomeExploreSection } from '@/features/home/components/home-explore-section';

export const Home: React.FC = () => {
  const { t } = useTranslation();
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
          className={`pb-8 ${isPanelOpen ? 'w-full' : 'w-full max-w-7xl mx-auto'
            }`}
        >
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
            <PublicInfo path="/" heading={false} />
            <footer className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-200 pt-5 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
              <span>© GemiGo</span>
              <Link to="/acceptable-use" className="hover:underline">{t('legal.policyTitle')}</Link>
              <Link to="/privacy-policy" className="hover:underline">{t('legal.privacy')}</Link>
              <a href="/acceptable-use#report" className="hover:underline">{t('legal.report')}</a>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
};

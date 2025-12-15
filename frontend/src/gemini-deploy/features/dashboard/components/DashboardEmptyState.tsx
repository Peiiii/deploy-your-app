import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Star, FileText } from 'lucide-react';
import { useDashboardStore } from '@/stores/dashboardStore';

export const DashboardEmptyState: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const showFavoritesOnly = useDashboardStore((s) => s.showFavoritesOnly);
  const searchQuery = useDashboardStore((s) => s.searchQuery);
  const dashboardActions = useDashboardStore((s) => s.actions);

  return (
    <div className="glass-card rounded-xl p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        {searchQuery ? (
          <Search className="w-8 h-8 text-slate-400 dark:text-slate-500" />
        ) : showFavoritesOnly ? (
          <Star className="w-8 h-8 text-slate-400 dark:text-slate-500" />
        ) : (
          <FileText className="w-8 h-8 text-slate-400 dark:text-slate-500" />
        )}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
        {searchQuery
          ? t('dashboard.noProjectsFound')
          : showFavoritesOnly
            ? t('dashboard.noFavoriteProjects')
            : t('dashboard.noProjects')}
      </h3>
      <p className="text-sm text-slate-500 dark:text-gray-400 mb-6">
        {searchQuery
          ? t('dashboard.tryDifferentSearch')
          : showFavoritesOnly
            ? t('dashboard.noFavoriteProjectsDesc')
            : t('dashboard.getStartedDeploy')}
      </p>
      {!searchQuery && !showFavoritesOnly && (
        <button
          onClick={() => navigate('/deploy')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('dashboard.deployApp')}
        </button>
      )}
      {!searchQuery && showFavoritesOnly && (
        <button
          onClick={() => {
            dashboardActions.setShowFavoritesOnly(false);
            dashboardActions.setSearchQuery('');
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg font-medium transition-colors"
        >
          {t('dashboard.viewAllProjects')}
        </button>
      )}
    </div>
  );
};

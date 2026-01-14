import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Star, Rocket } from 'lucide-react';
import { useDashboardStore } from '@/features/dashboard/stores/dashboard.store';

export const DashboardEmptyState: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const showFavoritesOnly = useDashboardStore((s) => s.showFavoritesOnly);
  const searchQuery = useDashboardStore((s) => s.searchQuery);
  const dashboardActions = useDashboardStore((s) => s.actions);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center">
      {/* Decorative background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-purple-500/5 pointer-events-none" />
      <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-gradient-to-br from-brand-500/10 to-purple-500/5 blur-3xl pointer-events-none" />

      <div className="relative">
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center shadow-lg">
          {searchQuery ? (
            <Search className="w-7 h-7 text-slate-500 dark:text-slate-400" />
          ) : showFavoritesOnly ? (
            <Star className="w-7 h-7 text-amber-500" />
          ) : (
            <Rocket className="w-7 h-7 text-brand-500" />
          )}
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          {searchQuery
            ? t('dashboard.noProjectsFound')
            : showFavoritesOnly
              ? t('dashboard.noFavoriteProjects')
              : t('dashboard.noProjects')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
          {searchQuery
            ? t('dashboard.tryDifferentSearch')
            : showFavoritesOnly
              ? t('dashboard.noFavoriteProjectsDesc')
              : t('dashboard.getStartedDeploy')}
        </p>
        {!searchQuery && !showFavoritesOnly && (
          <button
            onClick={() => navigate('/deploy')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 hover:scale-[1.03] active:scale-[0.98]"
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
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-xl font-medium transition-colors"
          >
            {t('dashboard.viewAllProjects')}
          </button>
        )}
      </div>
    </div>
  );
};


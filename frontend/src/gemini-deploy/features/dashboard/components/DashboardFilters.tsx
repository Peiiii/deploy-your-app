import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Star, Clock, ArrowUp, ArrowDown } from 'lucide-react';
import { useDashboardStore } from '@/features/dashboard/stores/dashboardStore';
import { usePresenter } from '@/contexts/PresenterContext';

export const DashboardFilters: React.FC = () => {
  const { t } = useTranslation();
  const presenter = usePresenter();

  const showFavoritesOnly = useDashboardStore((s) => s.showFavoritesOnly);
  const searchQuery = useDashboardStore((s) => s.searchQuery);
  const sortBy = useDashboardStore((s) => s.sortBy);
  const sortDirection = useDashboardStore((s) => s.sortDirection);
  const dashboardActions = useDashboardStore((s) => s.actions);

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
      {/* Search Bar */}
      <div className="relative flex-1 w-full sm:max-w-md group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => dashboardActions.setSearchQuery(e.target.value)}
          placeholder={t('dashboard.searchProjects')}
          className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:bg-white dark:focus:bg-slate-800 transition-all placeholder:text-slate-400"
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* All/Favorites Toggle */}
        <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1 text-xs">
          <button
            type="button"
            onClick={() => dashboardActions.setShowFavoritesOnly(false)}
            className={`px-2 py-1 rounded-md transition-colors ${
              !showFavoritesOnly
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {t('common.all')}
          </button>
          <button
            type="button"
            onClick={() => dashboardActions.setShowFavoritesOnly(true)}
            className={`px-2 py-1 rounded-md inline-flex items-center gap-1 transition-colors ${
              showFavoritesOnly
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Star className="w-3 h-3" />
            {t('common.favorites')}
          </button>
        </div>

        {/* Sort Options */}
        <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1 text-xs">
          <span className="px-2 py-1 text-slate-500 dark:text-slate-400">
            {t('dashboard.sortBy')}:
          </span>
          <button
            type="button"
            onClick={() => presenter.dashboard.handleSort('recent')}
            className={`px-2 py-1 rounded-md inline-flex items-center gap-1 transition-colors ${
              sortBy === 'recent'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Clock className="w-3 h-3" />
            {t('dashboard.recent')}
            {sortBy === 'recent' &&
              (sortDirection === 'desc' ? (
                <ArrowDown className="w-3 h-3" />
              ) : (
                <ArrowUp className="w-3 h-3" />
              ))}
          </button>
          <button
            type="button"
            onClick={() => presenter.dashboard.handleSort('name')}
            className={`px-2 py-1 rounded-md inline-flex items-center gap-1 transition-colors ${
              sortBy === 'name'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {t('dashboard.name')}
            {sortBy === 'name' &&
              (sortDirection === 'desc' ? (
                <ArrowDown className="w-3 h-3" />
              ) : (
                <ArrowUp className="w-3 h-3" />
              ))}
          </button>
          <button
            type="button"
            onClick={() => presenter.dashboard.handleSort('status')}
            className={`px-2 py-1 rounded-md inline-flex items-center gap-1 transition-colors ${
              sortBy === 'status'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {t('dashboard.status')}
            {sortBy === 'status' &&
              (sortDirection === 'desc' ? (
                <ArrowDown className="w-3 h-3" />
              ) : (
                <ArrowUp className="w-3 h-3" />
              ))}
          </button>
        </div>
      </div>
    </div>
  );
};

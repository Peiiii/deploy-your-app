import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Star, AppWindow } from 'lucide-react';
import { useDashboardStore } from '@/features/dashboard/stores/dashboard.store';

export function DashboardEmptyState() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { searchQuery, showFavoritesOnly, statusFilter, actions } = useDashboardStore();
  const filtered = !!(searchQuery.trim() || statusFilter || showFavoritesOnly);
  const onlyFavorites = showFavoritesOnly && !searchQuery.trim() && !statusFilter;
  const Icon = onlyFavorites ? Star : filtered ? Search : AppWindow;
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 px-5 py-14 text-center dark:border-slate-700 dark:bg-slate-900/50">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-950">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
        {t(
          onlyFavorites
            ? 'dashboard.noFavoriteProjects'
            : filtered
              ? 'dashboard.noProjectsFound'
              : 'dashboard.noProjects'
        )}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">
        {t(
          onlyFavorites
            ? 'dashboard.noFavoriteProjectsDesc'
            : filtered
              ? 'dashboard.tryDifferentSearch'
              : 'dashboard.getStartedDeploy'
        )}
      </p>
      <button
        onClick={() => (filtered ? actions.reset() : navigate('/deploy'))}
        className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
      >
        {!filtered && <Plus className="h-4 w-4" aria-hidden="true" />}
        {t(filtered ? 'dashboard.resetFilters' : 'dashboard.deployApp')}
      </button>
    </div>
  );
}

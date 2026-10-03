import { useTranslation } from 'react-i18next';
import { Search, Star, X, LayoutGrid, List } from 'lucide-react';
import { IconButton } from '@/components/icon-button';
import { useDashboardStore } from '@/features/dashboard/stores/dashboard.store';
import type { SortDirection, SortOption } from '@/features/dashboard/stores/dashboard.store';
import type { Project } from '@/types';

export function DashboardFilters({ projects }: { projects: Project[] }) {
  const { t } = useTranslation();
  const { showFavoritesOnly, searchQuery, statusFilter, sortBy, sortDirection, viewMode, actions } =
    useDashboardStore();
  const statuses = [null, 'Live', 'Building', 'Failed', 'Offline'] as const;
  const sorts = [
    ['recent', 'desc', 'newest'],
    ['recent', 'asc', 'oldest'],
    ['name', 'asc', 'nameAsc'],
    ['name', 'desc', 'nameDesc'],
    ['status', 'asc', 'statusFirst'],
  ] as const;
  return (
    <div className="space-y-3">
      <div className="management-toolbar">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label={t('dashboard.searchProjects')}
            value={searchQuery}
            onChange={(event) => actions.setSearchQuery(event.target.value)}
            placeholder={t('dashboard.searchProjects')}
            className="w-full min-w-0 rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          {searchQuery && (
            <IconButton
              label={t('dashboard.clearSearch')}
              size="sm"
              onClick={() => actions.setSearchQuery('')}
              className="absolute right-1.5 top-1 text-slate-400"
            >
              <X className="h-4 w-4" />
            </IconButton>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <IconButton
            label={t('dashboard.favoritesOnly')}
            size="auto"
            aria-pressed={showFavoritesOnly}
            onClick={() => actions.setShowFavoritesOnly(!showFavoritesOnly)}
            className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-xs font-medium ${showFavoritesOnly ? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-950 dark:text-brand-300' : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'}`}
          >
            <Star
              className={`h-4 w-4 ${showFavoritesOnly ? 'fill-brand-500 text-brand-500' : ''}`}
            />
            <span>{t('common.favorites')}</span>
          </IconButton>
          <select
            aria-label={t('dashboard.sortBy')}
            value={`${sortBy}:${sortDirection}`}
            onChange={(event) => {
              const [option, direction] = event.target.value.split(':');
              actions.setSort(option as SortOption, direction as SortDirection);
            }}
            className="min-h-10 min-w-0 max-w-full rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            {sorts.map(([option, direction, label]) => (
              <option key={label} value={`${option}:${direction}`}>
                {t(`dashboard.${label}`)}
              </option>
            ))}
          </select>
          <div
            role="group"
            aria-label={t('dashboard.viewMode')}
            className="inline-flex shrink-0 gap-0.5 rounded-full bg-slate-100 p-1 dark:bg-slate-800"
          >
            {(
              [
                ['grid', LayoutGrid, 'gridView'],
                ['list', List, 'listView'],
              ] as const
            ).map(([view, Icon, label]) => (
              <IconButton
                key={view}
                label={t(`dashboard.${label}`)}
                size="sm"
                variant="plain"
                aria-pressed={viewMode === view}
                onClick={() => actions.setViewMode(view)}
                className={`rounded-full ${viewMode === view ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-700 dark:text-brand-300' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
              >
                <Icon className="h-4 w-4" />
              </IconButton>
            ))}
          </div>
        </div>
      </div>
      <div
        className="management-status flex gap-2 overflow-x-auto py-1 scrollbar-hide"
        role="group"
        aria-label={t('dashboard.filterStatus')}
      >
        {statuses.map((status) => (
          <button
            key={status ?? 'all'}
            type="button"
            aria-pressed={statusFilter === status}
            onClick={() => actions.setStatusFilter(status)}
            className={`inline-flex min-h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === status ? 'bg-brand-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
          >
            <span>{status ? t(`dashboard.appStatus.${status}`) : t('dashboard.allApps')}</span>
            <span className={statusFilter === status ? 'text-white/75' : 'text-slate-400'}>
              {status
                ? projects.filter((project) => project.status === status).length
                : projects.length}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

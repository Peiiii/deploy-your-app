import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Zap, Plus, TrendingUp, AppWindow, Lock } from 'lucide-react';
import { useProjectStore } from '@/stores/project.store';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useAnalyticsStore } from '@/stores/analytics.store';
import { useReactionStore } from '@/stores/reaction.store';
import { useDashboardStore } from '@/features/dashboard/stores/dashboard.store';
import { usePresenter } from '@/contexts/presenter-context';
import { useCopyToClipboardWithKey } from '@/hooks/use-copy-to-clipboard-with-key';
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { StatCard } from '@/features/dashboard/components/stat-card';
import { ProjectCard } from '@/features/dashboard/components/project-card';
import { DashboardLayout } from '@/features/dashboard/components/dashboard-layout';
import { DashboardFilters } from '@/features/dashboard/components/dashboard-filters';
import { DashboardEmptyState } from '@/features/dashboard/components/dashboard-empty-state';
import { selectManagementProjects } from '@/features/dashboard/utils/select-management-projects';

export const Dashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;
  const user = useAuthStore((state) => state.user);
  const isLoadingAuth = useAuthStore((state) => state.isLoading);
  const allProjects = useProjectStore((state) => state.projects);
  const presenter = usePresenter();
  const navigate = useNavigate();
  const analyticsByProject = useAnalyticsStore((s) => s.byProjectId);
  const reactionsByProject = useReactionStore((s) => s.byProjectId);

  // Subscribe to dashboard store
  const showFavoritesOnly = useDashboardStore((s) => s.showFavoritesOnly);
  const searchQuery = useDashboardStore((s) => s.searchQuery);
  const sortBy = useDashboardStore((s) => s.sortBy);
  const sortDirection = useDashboardStore((s) => s.sortDirection);
  const statusFilter = useDashboardStore((s) => s.statusFilter);

  const { copyToClipboard, isCopied } = useCopyToClipboardWithKey();

  // Pagination state
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const pagination = useProjectStore((s) => s.pagination);
  const isLoadingProjects = useProjectStore((s) => s.isLoading);

  const hasLoaded = useProjectStore((s) => s.hasLoaded);
  const loadError = useProjectStore((s) => s.loadError);

  // Pause automatic retries after a failed page request.
  useInfiniteScroll({
    targetRef: sentinelRef,
    onLoadMore: () => presenter.project.loadMore(),
    enabled: !!user && pagination.hasMore && !isLoadingProjects && !loadError,
  });

  const projects = React.useMemo(
    () => (user ? allProjects.filter((p) => p.ownerId === user.id) : []),
    [allProjects, user]
  );

  React.useEffect(() => {
    projects.forEach((project) => {
      presenter.analytics.loadProjectStats(project.id, '7d');
    });
  }, [projects, presenter.analytics]);

  React.useEffect(() => {
    if (user) presenter.reaction.loadFavoritesForCurrentUser();
  }, [user, presenter.reaction]);

  const completeStats = projects.every((project) => {
    const entry = analyticsByProject[project.id];
    return !!entry?.stats && !entry.error;
  });
  const totalViews7d = completeStats
    ? projects.reduce((sum, project) => sum + analyticsByProject[project.id].stats!.views7d, 0)
    : null;
  const filteredAndSortedProjects = React.useMemo(
    () =>
      selectManagementProjects(
        projects,
        { searchQuery, showFavoritesOnly, statusFilter, sortBy, sortDirection },
        new Set(
          Object.keys(reactionsByProject).filter(
            (id) => reactionsByProject[id]?.favoritedByCurrentUser
          )
        ),
        language
      ),
    [
      projects,
      searchQuery,
      showFavoritesOnly,
      statusFilter,
      sortBy,
      sortDirection,
      reactionsByProject,
      language,
    ]
  );
  const ready = hasLoaded && !(!projects.length && loadError);
  const partial = pagination.hasMore;
  const retry = () =>
    pagination.page > 0 ? presenter.project.loadMore() : presenter.project.loadProjects();

  const handleCopyUrl = (url: string, projectId: string) => {
    copyToClipboard(url, projectId);
  };

  if (isLoadingAuth) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto flex items-center justify-center h-full animate-fade-in">
        <div className="glass-card rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center animate-pulse">
            <Lock className="w-6 h-6 text-slate-500 dark:text-slate-300" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {t('common.loading')}
          </h2>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto flex items-center justify-center h-full animate-fade-in">
        <div className="glass-card rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Lock className="w-6 h-6 text-slate-500 dark:text-slate-300" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {t('dashboard.signInToViewProjects')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('dashboard.dashboardPrivate')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => presenter.auth.openAuthModal('login')}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 transition-all min-w-[120px]"
            >
              {t('common.signIn')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout
      actions={
        <button
          onClick={() => navigate('/deploy')}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('dashboard.deployApp')}
        </button>
      }
      summary={
        <div className="grid grid-cols-3 gap-3 sm:gap-6">
          <StatCard
            icon={AppWindow}
            label={t('dashboard.totalProjects')}
            value={ready ? pagination.total.toLocaleString() : '—'}
            sublabel={t('dashboard.ownedApps')}
            iconColor="text-brand-500"
          />
          <StatCard
            icon={Zap}
            label={t('dashboard.activeProjects')}
            value={
              ready
                ? projects.filter((project) => project.status === 'Live').length.toLocaleString()
                : '—'
            }
            sublabel={t(partial ? 'dashboard.loadedApps' : 'dashboard.runningOnEdge')}
            iconColor="text-emerald-500"
          />
          <StatCard
            icon={TrendingUp}
            label={t('dashboard.totalViews')}
            value={ready && totalViews7d !== null ? totalViews7d.toLocaleString() : '—'}
            sublabel={t(partial ? 'dashboard.loadedApps' : 'dashboard.last7Days')}
            iconColor="text-brand-500"
          />
        </div>
      }
    >
      <section className="space-y-5" aria-label={t('dashboard.myProjects')}>
        <DashboardFilters projects={projects} />
        {partial && (
          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            {t('dashboard.loadedScope', { loaded: projects.length, total: pagination.total })}
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            {t('dashboard.myProjects')}{' '}
            <span className="ml-1.5 font-normal tabular-nums text-slate-400">
              {ready ? filteredAndSortedProjects.length : '—'}
            </span>
          </h2>
          {(searchQuery || statusFilter || showFavoritesOnly) && (
            <button
              onClick={() => presenter.dashboard.resetFilters()}
              className="rounded-md text-xs font-medium text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-300"
            >
              {t('dashboard.resetFilters')}
            </button>
          )}
        </div>
        {!hasLoaded && !loadError ? (
          <div role="status" className="management-grid">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-80 motion-safe:animate-pulse rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="h-14 w-20 rounded-xl bg-slate-100 dark:bg-slate-800" />
                <div className="mt-6 h-4 w-2/3 rounded bg-slate-100 dark:bg-slate-800" />
                <div className="mt-4 h-20 rounded bg-slate-50 dark:bg-slate-800/50" />
              </div>
            ))}
            <span className="sr-only">{t('common.loading')}</span>
          </div>
        ) : filteredAndSortedProjects.length > 0 ? (
          <div className="management-grid">
            {filteredAndSortedProjects.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                onCopyUrl={handleCopyUrl}
                isCopied={isCopied}
                priority={index < 3}
              />
            ))}
          </div>
        ) : !loadError ? (
          <DashboardEmptyState />
        ) : null}
        {loadError && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300"
          >
            <p>{t(pagination.page > 0 ? 'dashboard.loadMoreError' : 'dashboard.loadError')}</p>
            <button
              onClick={retry}
              disabled={isLoadingProjects}
              className="rounded-lg px-3 py-2 font-semibold hover:bg-red-100 disabled:opacity-50 dark:hover:bg-red-900/30"
            >
              {t('dashboard.retry')}
            </button>
          </div>
        )}
        <div ref={sentinelRef} className="h-px" />
        {isLoadingProjects && hasLoaded && (
          <p role="status" className="py-4 text-center text-xs text-slate-500">
            {t('common.loading')}
          </p>
        )}
        {pagination.hasMore && !loadError && !isLoadingProjects && (
          <div className="text-center">
            <button
              onClick={() => presenter.project.loadMore()}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              {t('dashboard.loadMore')}
            </button>
          </div>
        )}
      </section>
    </DashboardLayout>
  );
};

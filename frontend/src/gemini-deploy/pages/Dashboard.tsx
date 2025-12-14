import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Zap, Plus, TrendingUp, FileText, Lock } from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';
import { useAuthStore } from '../stores/authStore';
import { useAnalyticsStore } from '../stores/analyticsStore';
import { useReactionStore } from '../stores/reactionStore';
import { useDashboardStore } from '../stores/dashboardStore';
import { usePresenter } from '../contexts/PresenterContext';
import { useCopyToClipboardWithKey } from '../hooks/useCopyToClipboardWithKey';
import { StatCard } from '../components/dashboard/StatCard';
import { ProjectCard } from '../components/dashboard/ProjectCard';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { DashboardFilters } from '../components/dashboard/DashboardFilters';
import { DashboardEmptyState } from '../components/dashboard/DashboardEmptyState';
import { DashboardInspirationSection } from '../components/dashboard/DashboardInspirationSection';

export const Dashboard: React.FC = () => {
  const { t } = useTranslation();
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

  const { copyToClipboard, isCopied } = useCopyToClipboardWithKey();

  const projects = React.useMemo(
    () => (user ? allProjects.filter((p) => p.ownerId === user.id) : []),
    [allProjects, user],
  );

  React.useEffect(() => {
    projects.forEach((project) => {
      presenter.analytics.loadProjectStats(project.id, '7d');
    });
  }, [projects, presenter.analytics]);

  React.useEffect(() => {
    presenter.reaction.loadFavoritesForCurrentUser();
  }, [presenter.reaction]);

  const totalViews7d = React.useMemo(() => {
    return projects.reduce((sum, project) => {
      const entry = analyticsByProject[project.id];
      return sum + (entry?.stats?.views7d ?? 0);
    }, 0);
  }, [projects, analyticsByProject]);

  const filteredAndSortedProjects = React.useMemo(() => {
    const filtered = projects.filter((project) => {
      if (
        showFavoritesOnly &&
        !reactionsByProject[project.id]?.favoritedByCurrentUser
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          project.name.toLowerCase().includes(query) ||
          project.description?.toLowerCase().includes(query) ||
          project.framework.toLowerCase().includes(query) ||
          project.repoUrl.toLowerCase().includes(query)
        );
      }
      return true;
    });

    const statusOrder = { Live: 0, Building: 1, Offline: 2, Failed: 3 };

    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'recent':
          comparison =
            new Date(b.lastDeployed).getTime() -
            new Date(a.lastDeployed).getTime();
          break;
        case 'status':
          comparison =
            (statusOrder[a.status as keyof typeof statusOrder] ?? 999) -
            (statusOrder[b.status as keyof typeof statusOrder] ?? 999);
          break;
      }

      return sortDirection === 'asc' ? -comparison : comparison;
    });

    return sorted;
  }, [
    projects,
    showFavoritesOnly,
    reactionsByProject,
    searchQuery,
    sortBy,
    sortDirection,
  ]);

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
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <DashboardHeader />
        <DashboardFilters />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          icon={Zap}
          label={t('dashboard.activeProjects')}
          value={projects.filter((p) => p.status === 'Live').length.toString()}
          sublabel={t('dashboard.runningOnEdge')}
          color="text-green-600 dark:text-green-400"
          bgColor="bg-green-500/10"
          borderColor="border-green-500/20"
        />
        <StatCard
          icon={TrendingUp}
          label={t('dashboard.totalViews')}
          value={totalViews7d.toLocaleString()}
          sublabel={t('dashboard.last7Days')}
          color="text-purple-600 dark:text-purple-400"
          bgColor="bg-purple-500/10"
          borderColor="border-purple-500/20"
        />
        <StatCard
          icon={FileText}
          label={t('dashboard.systemStatus')}
          value="100%"
          sublabel={t('dashboard.systemsOperational')}
          color="text-orange-600 dark:text-orange-400"
          bgColor="bg-orange-500/10"
          borderColor="border-orange-500/20"
        />
      </div>

      {/* Projects Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            {showFavoritesOnly
              ? t('dashboard.favoriteProjects')
              : t('dashboard.recentCreations')}
            <span className="text-xs bg-slate-200 dark:bg-gray-800 text-slate-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
              {filteredAndSortedProjects.length}
            </span>
          </h3>
        </div>

        {filteredAndSortedProjects.length === 0 ? (
          <DashboardEmptyState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onCopyUrl={handleCopyUrl}
                isCopied={isCopied}
              />
            ))}

            {/* Add New Project Card */}
            <button
              onClick={() => navigate('/deploy')}
              className="rounded-xl border border-dashed border-slate-300 dark:border-gray-800 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 hover:border-brand-500/50 transition-all group flex flex-col items-center justify-center p-6 gap-3 text-slate-500 dark:text-gray-500 hover:text-brand-600 dark:hover:text-brand-400 min-h-[280px]"
            >
              <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-gray-900 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/30 flex items-center justify-center transition-colors">
                <Plus className="w-6 h-6" />
              </div>
              <span className="font-medium">{t('dashboard.deployApp')}</span>
            </button>
          </div>
        )}
      </div>

      {/* What Will You Build Section */}
      <DashboardInspirationSection />
    </div>
  );
};

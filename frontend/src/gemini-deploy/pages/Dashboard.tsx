import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, GitBranch, Clock, FolderArchive, Zap, Plus, TrendingUp, FileText, GraduationCap, Wand2, Briefcase, FileCode, Lock, Star, Search, Copy, Check, ArrowUp, ArrowDown } from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';
import { useAuthStore } from '../stores/authStore';
import { useAnalyticsStore } from '../stores/analyticsStore';
import { useReactionStore } from '../stores/reactionStore';
import { usePresenter } from '../contexts/PresenterContext';
import { URLS } from '../constants';
import { SourceType } from '../types';
import type { Project } from '../types';

type SortOption = 'name' | 'recent' | 'status';
type SortDirection = 'asc' | 'desc';

export const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const allProjects = useProjectStore((state) => state.projects);
  const presenter = usePresenter();
  const navigate = useNavigate();
  const analyticsByProject = useAnalyticsStore((s) => s.byProjectId);
  const reactionsByProject = useReactionStore((s) => s.byProjectId);
  const [showFavoritesOnly, setShowFavoritesOnly] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortBy, setSortBy] = React.useState<SortOption>('recent');
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('desc');
  const [copiedUrl, setCopiedUrl] = React.useState<string | null>(null);

  const projects = React.useMemo(
    () => (user ? allProjects.filter((p) => p.ownerId === user.id) : []),
    [allProjects, user],
  );

  React.useEffect(() => {
    // Load analytics for each of the user's projects (Dashboard view).
    projects.forEach((project) => {
      presenter.analytics.loadProjectStats(project.id, '7d');
    });
  }, [projects, presenter.analytics]);

  React.useEffect(() => {
    // Preload favorites for the current user so the dashboard can filter.
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
      if (showFavoritesOnly && !reactionsByProject[project.id]?.favoritedByCurrentUser) {
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
          comparison = new Date(b.lastDeployed).getTime() - new Date(a.lastDeployed).getTime();
          break;
        case 'status':
          comparison = (statusOrder[a.status as keyof typeof statusOrder] ?? 999) - 
                       (statusOrder[b.status as keyof typeof statusOrder] ?? 999);
          break;
      }
      
      return sortDirection === 'asc' ? -comparison : comparison;
    });

    return sorted;
  }, [projects, showFavoritesOnly, reactionsByProject, searchQuery, sortBy, sortDirection]);

  const handleCopyUrl = async (url: string, projectId: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(projectId);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const handleSort = (option: SortOption) => {
    if (sortBy === option) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(option);
      setSortDirection('desc');
    }
  };

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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">{t('dashboard.myProjects')}</h2>
            <p className="text-slate-500 dark:text-gray-400">{t('dashboard.manageLiveApps')}</p>
          </div>
          <button
            onClick={() => navigate('/deploy')}
            className="bg-green-600 hover:bg-green-500 text-white px-5 py-2.5 rounded-lg font-medium transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] flex items-center gap-2 group border border-green-500/50"
          >
            <Zap className="w-5 h-5" />
            {t('deployment.deployYourApp')}
          </button>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="relative flex-1 w-full sm:max-w-md group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('dashboard.searchProjects')}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:bg-white dark:focus:bg-slate-800 transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1 text-xs">
              <button
                type="button"
                onClick={() => setShowFavoritesOnly(false)}
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
                onClick={() => setShowFavoritesOnly(true)}
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

            <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1 text-xs">
              <span className="px-2 py-1 text-slate-500 dark:text-slate-400">{t('dashboard.sortBy')}:</span>
              <button
                type="button"
                onClick={() => handleSort('recent')}
                className={`px-2 py-1 rounded-md inline-flex items-center gap-1 transition-colors ${
                  sortBy === 'recent'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Clock className="w-3 h-3" />
                {t('dashboard.recent')}
                {sortBy === 'recent' && (
                  sortDirection === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
                )}
              </button>
              <button
                type="button"
                onClick={() => handleSort('name')}
                className={`px-2 py-1 rounded-md inline-flex items-center gap-1 transition-colors ${
                  sortBy === 'name'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {t('dashboard.name')}
                {sortBy === 'name' && (
                  sortDirection === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
                )}
              </button>
              <button
                type="button"
                onClick={() => handleSort('status')}
                className={`px-2 py-1 rounded-md inline-flex items-center gap-1 transition-colors ${
                  sortBy === 'status'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {t('dashboard.status')}
                {sortBy === 'status' && (
                  sortDirection === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
            icon={Zap} 
            label={t('dashboard.activeProjects')} 
            value={projects.filter(p => p.status === 'Live').length.toString()} 
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
            {showFavoritesOnly ? t('dashboard.favoriteProjects') : t('dashboard.recentCreations')}
            <span className="text-xs bg-slate-200 dark:bg-gray-800 text-slate-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
              {filteredAndSortedProjects.length}
            </span>
          </h3>
        </div>
        
        {filteredAndSortedProjects.length === 0 ? (
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
                  setShowFavoritesOnly(false);
                  setSearchQuery('');
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg font-medium transition-colors"
              >
                {t('dashboard.viewAllProjects')}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                analytics={analyticsByProject[project.id]}
                onNavigate={navigate}
                onCopyUrl={handleCopyUrl}
                copiedUrl={copiedUrl}
                t={t}
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
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">{t('dashboard.whatWillYouBuild')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card rounded-xl p-6 group hover:shadow-lg transition-all">
            <div className="w-12 h-12 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{t('dashboard.forStudents')}</h4>
            <p className="text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">{t('dashboard.showcasePortfolio')}</p>
            <p className="text-xs text-slate-500 dark:text-gray-400">{t('dashboard.showcaseDescription')}</p>
          </div>
          
          <div className="glass-card rounded-xl p-6 group hover:shadow-lg transition-all">
            <div className="w-12 h-12 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4">
              <Wand2 className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{t('dashboard.forCreators')}</h4>
            <p className="text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">{t('dashboard.viralContentMachine')}</p>
            <p className="text-xs text-slate-500 dark:text-gray-400">{t('dashboard.viralContentDescription')}</p>
          </div>
          
          <div className="glass-card rounded-xl p-6 group hover:shadow-lg transition-all">
            <div className="w-12 h-12 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-4">
              <Briefcase className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{t('dashboard.forBusiness')}</h4>
            <p className="text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">{t('dashboard.internalTools')}</p>
            <p className="text-xs text-slate-500 dark:text-gray-400">{t('dashboard.internalToolsDescription')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
    icon: React.ElementType;
    label: string;
    value: string;
    sublabel: string;
    color: string;
    bgColor: string;
    borderColor: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, value, sublabel, color, bgColor, borderColor }) => (
    <div className={`glass-card p-5 rounded-xl border ${borderColor} hover:shadow-lg transition-all duration-300`}>
        <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${bgColor} ${color} flex-shrink-0`}>
                <Icon className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-slate-500 dark:text-gray-400 text-sm font-medium truncate">{label}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{value}</p>
                <p className={`text-xs ${color} mt-0.5`}>{sublabel}</p>
            </div>
        </div>
    </div>
);

interface ProjectCardProps {
    project: Project;
    analytics?: { stats?: { views7d?: number } | null };
    onNavigate: (path: string) => void;
    onCopyUrl: (url: string, projectId: string) => void;
    copiedUrl: string | null;
    t: (key: string) => string;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, analytics, onNavigate, onCopyUrl, copiedUrl, t }) => {
    const views7d = analytics?.stats?.views7d ?? 0;
    
    const handleCardClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('a') || target.closest('button')) {
            return;
        }
        onNavigate(`/projects/${encodeURIComponent(project.id)}`);
    };

    const getGitHubUrl = () => {
        if (project.repoUrl.startsWith(URLS.GITHUB_BASE)) {
            return project.repoUrl;
        }
        if (project.sourceType === SourceType.GITHUB && project.repoUrl) {
            return `${URLS.GITHUB_BASE}${project.repoUrl}`;
        }
        return null;
    };

    const githubUrl = getGitHubUrl();
    const displayRepoUrl = project.repoUrl.startsWith(URLS.GITHUB_BASE)
        ? project.repoUrl.replace(URLS.GITHUB_BASE, '')
        : project.repoUrl;
    
    return (
        <div 
            className="glass-card rounded-xl p-6 group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border border-slate-200/50 dark:border-slate-700/50 hover:border-brand-500/30 dark:hover:border-brand-500/20 cursor-pointer"
            onClick={handleCardClick}
        >
            {/* Status Indicator */}
            <div className={`absolute top-4 right-4 flex items-center gap-2 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider z-10 ${
                project.status === 'Live' ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' : 
                project.status === 'Failed' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' :
                'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20'
            }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                    project.status === 'Live' ? 'bg-green-500 dark:bg-green-400 animate-pulse' : 
                    project.status === 'Failed' ? 'bg-red-500 dark:bg-red-400' : 'bg-yellow-500 dark:bg-yellow-400'
                }`}></div>
                {project.status}
            </div>

            <div className="flex items-start gap-4 mb-5">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-inner flex-shrink-0 transition-transform group-hover:scale-110 ${
                    project.framework === 'React' 
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' 
                    : project.framework === 'Next.js'
                    ? 'bg-black/10 text-black dark:text-white border-black/20 dark:border-white/20'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white border-slate-200 dark:border-white/10'
                }`}>
                    <span className="font-bold text-sm tracking-tighter">{project.framework.slice(0, 2).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onNavigate(`/projects/${encodeURIComponent(project.id)}`);
                        }}
                        className="font-bold text-slate-900 dark:text-white text-lg group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors truncate mb-1 block w-full text-left hover:underline decoration-brand-500/50"
                    >
                        {project.name}
                    </button>
                    {githubUrl ? (
                        <a
                            href={githubUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors group/repo"
                        >
                            {project.sourceType === SourceType.ZIP ? (
                                <FolderArchive className="w-3 h-3 flex-shrink-0" />
                            ) : project.sourceType === SourceType.HTML ? (
                                <FileCode className="w-3 h-3 flex-shrink-0" />
                            ) : (
                                <GitBranch className="w-3 h-3 flex-shrink-0 group-hover/repo:text-brand-600 dark:group-hover/repo:text-brand-400" />
                            )}
                            <span className="truncate hover:underline decoration-brand-500/50">
                                {displayRepoUrl}
                            </span>
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover/repo:opacity-100 transition-opacity flex-shrink-0" />
                        </a>
                    ) : (
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-500">
                            {project.sourceType === SourceType.ZIP ? (
                                <FolderArchive className="w-3 h-3 flex-shrink-0" />
                            ) : project.sourceType === SourceType.HTML ? (
                                <FileCode className="w-3 h-3 flex-shrink-0" />
                            ) : (
                                <GitBranch className="w-3 h-3 flex-shrink-0" />
                            )}
                            <span className="truncate">
                                {displayRepoUrl}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {project.description && (
                <p className="text-sm text-slate-600 dark:text-gray-400 mb-4 line-clamp-2">
                    {project.description}
                </p>
            )}

            <div className="space-y-2.5 mb-5">
                {views7d > 0 && (
                    <div className="flex items-center justify-between text-sm py-1.5">
                        <span className="text-slate-500 dark:text-gray-500 flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5" />
                            {t('dashboard.views7d')}
                        </span>
                        <span className="text-slate-700 dark:text-gray-300 font-medium">{views7d.toLocaleString()}</span>
                    </div>
                )}
                <div className="flex items-center justify-between text-sm py-1.5 border-t border-slate-100 dark:border-white/5 pt-2.5">
                    <span className="text-slate-500 dark:text-gray-500">{t('dashboard.lastDeploy')}</span>
                    <span className="text-slate-700 dark:text-gray-300 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> 
                        <span className="text-xs">{project.lastDeployed}</span>
                    </span>
                </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-2">
                    {project.url ? (
                        <>
                            <a
                                href={project.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300 text-sm font-medium flex items-center gap-1 transition-colors hover:underline decoration-green-500/50"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {t('common.visit')} <ExternalLink className="w-3 h-3" />
                            </a>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCopyUrl(project.url!, project.id);
                                }}
                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                                title={copiedUrl === project.id ? t('common.copied') : t('common.copyUrl')}
                            >
                                {copiedUrl === project.id ? (
                                    <Check className="w-3.5 h-3.5 text-green-500" />
                                ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                )}
                            </button>
                        </>
                    ) : (
                        <span className="text-slate-400 dark:text-gray-600 text-sm italic">
                            {t('common.notAccessible')}
                        </span>
                    )}
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onNavigate(`/projects/${encodeURIComponent(project.id)}`);
                    }}
                    className="text-xs text-slate-500 dark:text-gray-400 hover:text-brand-500 dark:hover:text-brand-400 underline-offset-2 hover:underline transition-colors px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                    {t('common.manage')}
                </button>
            </div>
        </div>
    );
};

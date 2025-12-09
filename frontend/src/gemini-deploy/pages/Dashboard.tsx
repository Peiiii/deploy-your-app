import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, GitBranch, Clock, FolderArchive, Zap, Plus, TrendingUp, FileText, GraduationCap, Wand2, Briefcase, FileCode, Lock, Star } from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';
import { useAuthStore } from '../stores/authStore';
import { useAnalyticsStore } from '../stores/analyticsStore';
import { useReactionStore } from '../stores/reactionStore';
import { usePresenter } from '../contexts/PresenterContext';
import { URLS } from '../constants';
import { SourceType } from '../types';

export const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const allProjects = useProjectStore((state) => state.projects);
  const presenter = usePresenter();
  const navigate = useNavigate();
  const analyticsByProject = useAnalyticsStore((s) => s.byProjectId);
  const reactionsByProject = useReactionStore((s) => s.byProjectId);
  const [showFavoritesOnly, setShowFavoritesOnly] = React.useState(false);

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
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">{t('dashboard.myProjects')}</h2>
          <p className="text-slate-500 dark:text-gray-400">{t('dashboard.manageLiveApps')}</p>
          <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1 text-xs">
            <button
              type="button"
              onClick={() => setShowFavoritesOnly(false)}
              className={`px-2 py-1 rounded-full ${
                !showFavoritesOnly
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {t('common.all')}
            </button>
            <button
              type="button"
              onClick={() => setShowFavoritesOnly(true)}
              className={`px-2 py-1 rounded-full inline-flex items-center gap-1 ${
                showFavoritesOnly
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Star className="w-3 h-3" />
              {t('common.favorites')}
            </button>
          </div>
        </div>
        <button
          onClick={() => navigate('/deploy')}
          className="bg-green-600 hover:bg-green-500 text-white px-5 py-2.5 rounded-lg font-medium transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] flex items-center gap-2 group border border-green-500/50"
        >
          <Zap className="w-5 h-5" />
          {t('deployment.deployYourApp')}
        </button>
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
        />
        <StatCard 
            icon={TrendingUp} 
            label={t('dashboard.totalViews')} 
            value={totalViews7d.toLocaleString()} 
            sublabel={t('dashboard.last7Days')} 
            color="text-purple-600 dark:text-purple-400"
            bgColor="bg-purple-500/10"
        />
        <StatCard 
            icon={FileText} 
            label={t('dashboard.systemStatus')} 
            value="100%" 
            sublabel={t('dashboard.systemsOperational')} 
            color="text-orange-600 dark:text-orange-400"
            bgColor="bg-orange-500/10"
        />
      </div>

      {/* Projects Grid */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            {showFavoritesOnly ? t('dashboard.favoriteProjects') : t('dashboard.recentCreations')}{' '}
            <span className="text-xs bg-slate-200 dark:bg-gray-800 text-slate-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
              {projects.filter((p) =>
                showFavoritesOnly
                  ? reactionsByProject[p.id]?.favoritedByCurrentUser
                  : true,
              ).length}
            </span>
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects
              .filter((project) =>
                showFavoritesOnly
                  ? reactionsByProject[project.id]?.favoritedByCurrentUser
                  : true,
              )
              .map((project) => (
            <div key={project.id} className="glass-card rounded-xl p-6 group relative overflow-hidden transition-all duration-300">
                {/* Status Indicator Dot */}
                <div className={`absolute top-4 right-4 flex items-center gap-2 px-2 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
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

                <div className="flex items-start gap-4 mb-6">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-inner ${
                        project.framework === 'React' 
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' 
                        : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white border-slate-200 dark:border-white/10'
                    }`}>
                        <span className="font-bold text-sm tracking-tighter">{project.framework.slice(0, 2).toUpperCase()}</span>
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-lg group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{project.name}</h3>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-500 mt-1">
                            {project.sourceType === SourceType.ZIP ? (
                              <FolderArchive className="w-3 h-3" />
                            ) : project.sourceType === SourceType.HTML ? (
                              <FileCode className="w-3 h-3" />
                            ) : (
                              <GitBranch className="w-3 h-3" />
                            )}
                            <span className="truncate max-w-[150px]">
                              {project.repoUrl.startsWith(URLS.GITHUB_BASE)
                                ? project.repoUrl.replace(URLS.GITHUB_BASE, '')
                                : project.repoUrl}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between text-sm py-2 border-b border-slate-100 dark:border-white/5">
                        <span className="text-slate-500 dark:text-gray-500">{t('dashboard.environment')}</span>
                        <span className="text-slate-700 dark:text-gray-300">{t('dashboard.production')}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm py-2 border-b border-slate-100 dark:border-white/5">
                        <span className="text-slate-500 dark:text-gray-500">{t('dashboard.lastDeploy')}</span>
                        <span className="text-slate-700 dark:text-gray-300 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {project.lastDeployed}
                        </span>
                    </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  {project.url ? (
                    <a
                      href={project.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300 text-sm font-medium flex items-center gap-1 transition-colors hover:underline decoration-green-500/50"
                    >
                      {t('common.visit')} <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-slate-400 dark:text-gray-600 text-sm italic">
                      {t('common.notAccessible')}
                    </span>
                  )}
                  <button
                    onClick={() =>
                      navigate(`/projects/${encodeURIComponent(project.id)}`)
                    }
                    className="text-xs text-slate-500 dark:text-gray-400 hover:text-brand-500 dark:hover:text-brand-400 underline-offset-2 hover:underline"
                  >
                    {t('common.manage')}
                  </button>
                </div>
            </div>
            ))}

            {/* Add New Project Card (Empty State) */}
            <button 
                onClick={() => navigate('/deploy')}
                className="rounded-xl border border-dashed border-slate-300 dark:border-gray-800 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 hover:border-brand-500/50 transition-all group flex flex-col items-center justify-center p-6 gap-3 text-slate-500 dark:text-gray-500 hover:text-brand-600 dark:hover:text-brand-400 min-h-[250px]"
            >
                <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-gray-900 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/30 flex items-center justify-center transition-colors">
                    <Plus className="w-6 h-6" />
                </div>
                <span className="font-medium">{t('dashboard.deployApp')}</span>
            </button>
        </div>
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
}

const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, value, sublabel, color, bgColor }) => (
    <div className="glass-card p-5 rounded-xl flex items-center gap-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${bgColor} ${color}`}>
            <Icon className="w-6 h-6" />
        </div>
        <div>
            <p className="text-slate-500 dark:text-gray-400 text-sm font-medium">{label}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{value}</p>
            <p className={`text-xs ${color} mt-0.5`}>{sublabel}</p>
        </div>
    </div>
);

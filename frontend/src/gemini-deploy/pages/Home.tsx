import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Github,
  FolderArchive,
  FileCode,
  ArrowRight,
  Search,
  TrendingUp,
  Clock,
  X,
  Zap,
  ExternalLink,
} from 'lucide-react';
import type { ExploreAppCard } from '../components/ExploreAppCard';
import { ExploreAppCardView, mapProjectsToApps } from '../components/ExploreAppCard';
import { AuthorBadge } from '../components/AuthorBadge';
import { usePresenter } from '../contexts/PresenterContext';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { fetchExploreProjects } from '../services/http/exploreApi';
import { fetchPublicProfile } from '../services/http/profileApi';
import type { Project } from '../types';
import { SourceType } from '../types';

export type CategoryFilter =
  | 'All Apps'
  | 'Development'
  | 'Image Gen'
  | 'Productivity'
  | 'Marketing'
  | 'Legal'
  | 'Fun'
  | 'Other';

export const CATEGORIES: readonly CategoryFilter[] = [
  'All Apps',
  'Development',
  'Image Gen',
  'Productivity',
  'Marketing',
  'Legal',
  'Fun',
  'Other',
] as const;

interface AppMeta {
  cost: number;
  category: string;
  rating: number;
  installs: string;
  color: string;
}

const APP_META: readonly AppMeta[] = [
  {
    cost: 5,
    category: 'Development',
    rating: 4.8,
    installs: '12k',
    color: 'from-blue-500 to-cyan-400',
  },
  {
    cost: 12,
    category: 'Image Gen',
    rating: 4.9,
    installs: '8.5k',
    color: 'from-purple-500 to-pink-500',
  },
  {
    cost: 8,
    category: 'Productivity',
    rating: 4.6,
    installs: '5k',
    color: 'from-emerald-500 to-teal-400',
  },
  {
    cost: 3,
    category: 'Marketing',
    rating: 4.5,
    installs: '15k',
    color: 'from-orange-500 to-amber-400',
  },
  {
    cost: 20,
    category: 'Legal',
    rating: 4.9,
    installs: '2k',
    color: 'from-slate-600 to-slate-400',
  },
  {
    cost: 10,
    category: 'Development',
    rating: 4.7,
    installs: '4.2k',
    color: 'from-indigo-500 to-violet-500',
  },
] as const;

type AuthorProfileInfo = {
  label: string;
  identifier: string;
};

const authorProfileCache: Record<string, AuthorProfileInfo> = {};

async function loadAuthorProfilesForProjects(
  projects: Project[],
): Promise<Record<string, AuthorProfileInfo>> {
  const byId: Record<string, AuthorProfileInfo> = {};

  const ownerIds = Array.from(
    new Set(
      projects
        .map((p) => p.ownerId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  );

  if (ownerIds.length === 0) {
    return byId;
  }

  const toFetch: string[] = [];
  ownerIds.forEach((ownerId) => {
    const cached = authorProfileCache[ownerId];
    if (cached) {
      byId[ownerId] = cached;
    } else {
      toFetch.push(ownerId);
    }
  });

  if (toFetch.length === 0) {
    return byId;
  }

  const results = await Promise.all(
    toFetch.map(async (ownerId) => {
      try {
        const profile = await fetchPublicProfile(ownerId);
        const handle =
          profile.user.handle && profile.user.handle.trim().length > 0
            ? profile.user.handle.trim()
            : null;
        const identifier = handle ?? profile.user.id;
        const info: AuthorProfileInfo = {
          // We only use the handle as the visible "platform username".
          // When it's missing, we keep label empty so the card can fall back
          // to the GitHub owner name while still having a profile link.
          label: handle ?? '',
          identifier,
        };
        authorProfileCache[ownerId] = info;
        return { ownerId, info };
      } catch (err) {
        // Public profiles are an optional enhancement for the home explore grid.
        // Swallow "not_found" / generic failures so we don't spam console errors.
        if (err instanceof Error) {
          if (
            err.message === 'not_found' ||
            err.message === 'Failed to load public profile'
          ) {
            return null;
          }
        }
        console.warn('Optional author profile lookup failed', ownerId, err);
        return null;
      }
    }),
  );

  results.forEach((entry) => {
    if (entry) {
      byId[entry.ownerId] = entry.info;
    }
  });

  return byId;
}

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ value, onChange }) => {
  const { t } = useTranslation();
  return (
    <div className="relative w-full md:w-96 group">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('explore.searchApps')}
        className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-none rounded-full text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:bg-white dark:focus:bg-slate-800 transition-all shadow-sm hover:shadow-md placeholder:text-slate-400"
      />
    </div>
  );
};

interface CategoryFilterProps {
  activeCategory: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
  onTagReset: () => void;
}

const CategoryFilter: React.FC<CategoryFilterProps> = ({
  activeCategory,
  onCategoryChange,
  onTagReset,
}) => {
  const { t } = useTranslation();
  const handleCategoryClick = (category: CategoryFilter) => {
    onCategoryChange(category);
    onTagReset();
  };

  const getCategoryLabel = (cat: CategoryFilter): string => {
    const categoryMap: Record<CategoryFilter, string> = {
      'All Apps': t('explore.allApps'),
      'Development': t('explore.development'),
      'Image Gen': t('explore.imageGen'),
      'Productivity': t('explore.productivity'),
      'Marketing': t('explore.marketing'),
      'Legal': t('explore.legal'),
      'Fun': t('explore.fun'),
      'Other': t('explore.other'),
    };
    return categoryMap[cat] || cat;
  };

  return (
    <div className="flex gap-2 overflow-x-auto pb-4 pt-2 px-1 scrollbar-hide [mask-image:linear-gradient(to_right,black,black_90%,transparent)]">
      {CATEGORIES.map((cat) => {
        const isActive = cat === activeCategory;
        return (
          <button
            key={cat}
            onClick={() => handleCategoryClick(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 ${isActive
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/30 scale-105'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
          >
            {getCategoryLabel(cat)}
          </button>
        );
      })}
    </div>
  );
};

const ExploreSkeletonGrid: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div
          key={idx}
          className="flex flex-col rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/40 overflow-hidden animate-pulse"
        >
          <div className="h-44 bg-slate-100 dark:bg-slate-800" />
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
              </div>
            </div>
            <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-full" />
            <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-5/6" />
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="w-24 h-3 bg-slate-100 dark:bg-slate-800 rounded" />
              <div className="w-16 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export type SortOption = 'popularity' | 'recent';

export const Home: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const presenter = usePresenter();
  const user = useAuthStore((s) => s.user);
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useUIStore((state) => state.actions.setSidebarCollapsed);
  const [apps, setApps] = useState<ExploreAppCard[]>([]);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All Apps');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('popularity');
  const [isLoadingExplore, setIsLoadingExplore] = useState(false);
  const [selectedApp, setSelectedApp] = useState<ExploreAppCard | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoadingExplore(true);
      try {
        const result = await fetchExploreProjects({
          search: searchQuery.trim() || undefined,
          category: activeCategory !== 'All Apps' ? activeCategory : undefined,
          tag: activeTag,
          sort: sortBy,
          page: 1,
          pageSize: 12,
        });

        if (cancelled) return;

        const projects = result.items;
        const authorProfiles = await loadAuthorProfilesForProjects(projects);
        if (cancelled) return;
        setApps(mapProjectsToApps(projects, APP_META, authorProfiles));

        // Seed aggregated counts into the reaction store so cards can display
        // likes/favorites without extra per-project requests.
        if (result.engagement) {
          const projectsWithCounts = projects.map((p) => {
            const counts = result.engagement?.[p.id];
            return {
              ...p,
              likesCount: counts?.likesCount ?? 0,
              favoritesCount: counts?.favoritesCount ?? 0,
            };
          });
          presenter.reaction.seedCountsFromProjects(projectsWithCounts);
        }

        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          const ids = projects.map((p) => p.id);
          presenter.reaction.loadReactionsForProjectsBulk(ids);
        }
      } catch (error) {
        console.error('Failed to load explore apps for Home', error);
      } finally {
        if (!cancelled) {
          setIsLoadingExplore(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [activeCategory, activeTag, searchQuery, sortBy, presenter.reaction]);

  const requireAuthAnd = (action: () => void) => {
    if (!user) {
      presenter.auth.openAuthModal('login');
      presenter.ui.showToast(t('deployment.signInRequired'), 'warning');
      return;
    }
    action();
  };

  const handleQuickDeploy = (sourceType: SourceType) => {
    requireAuthAnd(() => {
      navigate('/deploy', { state: { sourceType } });
    });
  };

  const handleCardClick = (app: ExploreAppCard) => {
    if (app.url) {
      setSelectedApp(app);
      if (!sidebarCollapsed) {
        setSidebarCollapsed(true);
      }
    }
  };

  const handleClosePreview = () => {
    setSelectedApp(null);
  };

  const handleOpenInNewTab = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="h-full bg-app-bg">
      <div className={`flex gap-6 ${selectedApp ? 'max-w-full' : 'max-w-7xl'} mx-auto px-4 md:px-8 py-6 md:py-8 ${selectedApp ? 'h-[calc(100vh-4rem)]' : ''}`}>
        {/* Left Column - App List */}
        <div className={`transition-all duration-300 ${selectedApp ? 'w-full lg:w-1/2 flex flex-col overflow-hidden' : 'w-full'}`}>
          <div className={`space-y-8 transition-all duration-300 ${selectedApp ? 'flex-1 overflow-y-auto pr-2' : ''}`}>

            {/* Deploy Section - Top */}
            <section className="glass-card rounded-2xl p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    {t('deployment.deployYourApp')}
                  </h2>
                  <p className="text-slate-600 dark:text-gray-400">
                    {t('deployment.chooseDeploymentMethod')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => handleQuickDeploy(SourceType.GITHUB)}
                  className="group relative p-6 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-500 dark:hover:border-purple-500 hover:shadow-lg transition-all text-left"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/40 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/60 transition-colors">
                      <Github className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                    {t('deployment.githubRepository')}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-gray-400">
                    {t('deployment.connectGitHubRepo')}
                  </p>
                </button>

                <button
                  onClick={() => handleQuickDeploy(SourceType.ZIP)}
                  className="group relative p-6 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg transition-all text-left"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/40 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/60 transition-colors">
                      <FolderArchive className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                    {t('deployment.uploadArchive')}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-gray-400">
                    {t('deployment.uploadZipFile')}
                  </p>
                </button>

                <button
                  onClick={() => handleQuickDeploy(SourceType.HTML)}
                  className="group relative p-6 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-green-500 dark:hover:border-green-500 hover:shadow-lg transition-all text-left"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/40 group-hover:bg-green-200 dark:group-hover:bg-green-900/60 transition-colors">
                      <FileCode className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-green-500 group-hover:translate-x-1 transition-all" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                    {t('deployment.inlineHTML')}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-gray-400">
                    {t('deployment.pasteHTML')}
                  </p>
                </button>
              </div>
            </section>

            {/* Explore Section - Bottom */}
            <section>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    {t('explore.exploreApps')}
                  </h2>
                  <p className="text-slate-600 dark:text-gray-400">
                    {t('explore.discoverApps')}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
                  <SearchBar value={searchQuery} onChange={setSearchQuery} />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 dark:text-gray-400">{t('explore.sortBy')}:</span>
                    <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1">
                      <button
                        onClick={() => setSortBy('popularity')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${sortBy === 'popularity'
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                      >
                        <TrendingUp className="w-3 h-3" />
                        {t('explore.sortByPopularity')}
                      </button>
                      <button
                        onClick={() => setSortBy('recent')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${sortBy === 'recent'
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                      >
                        <Clock className="w-3 h-3" />
                        {t('explore.sortByRecent')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <CategoryFilter
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
                onTagReset={() => setActiveTag(null)}
              />

              {isLoadingExplore ? (
                <ExploreSkeletonGrid />
              ) : apps.length > 0 ? (
                <div className={`grid gap-6 ${selectedApp ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                  {apps.map((app) => (
                    <ExploreAppCardView
                      key={app.id}
                      app={app}
                      activeTag={activeTag}
                      setActiveTag={setActiveTag}
                      onCardClick={() => handleCardClick(app)}
                    />
                  ))}
                </div>
              ) : (
                <div className="glass-card rounded-xl p-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Search className="w-8 h-8 text-slate-400" />
                  </div>
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    {t('explore.noAppsFound')}
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-gray-400">
                    {t('explore.adjustSearch')}
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Right Column - Preview Panel */}
        {selectedApp && (
          <div className="hidden lg:flex lg:flex-col w-1/2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex-shrink-0 h-[calc(100vh-4rem-3rem)]">
	            {/* Header */}
	            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br ${selectedApp.color} shrink-0`}>
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                    {selectedApp.name}
                  </h3>
                  <AuthorBadge
                    name={selectedApp.author}
                    identifier={selectedApp.authorProfileIdentifier}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selectedApp.url && (
                  <button
                    onClick={() => handleOpenInNewTab(selectedApp.url!)}
                    className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
                    aria-label={t('common.openInNewTab')}
                    title={t('common.openInNewTab')}
                  >
                    <ExternalLink className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={handleClosePreview}
                  className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
                  aria-label={t('common.close')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Iframe */}
            <div className="flex-1 relative bg-slate-100 dark:bg-slate-950 min-h-0">
              {selectedApp.url ? (
                <iframe
                  src={selectedApp.url}
                  className="w-full h-full border-0"
                  title={selectedApp.name}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-slate-500 dark:text-slate-400">
                    {t('common.notAccessible')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState, useCallback } from 'react';
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
  Sparkles,
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
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      onChange(localValue);
    }, 300);
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [localValue, onChange]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalValue(e.target.value);
    },
    [],
  );

  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <div className="relative w-full md:w-96 group">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
        <Search className="h-4 w-4 text-slate-400 group-focus-within:text-brand-500 transition-all duration-300 group-focus-within:scale-110" />
      </div>
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder={t('explore.searchApps')}
        className="w-full pl-11 pr-4 py-3.5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 rounded-full text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 focus:bg-white dark:focus:bg-slate-800 transition-all duration-300 shadow-sm hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 placeholder:text-slate-400 dark:placeholder:text-slate-500"
      />
      {localValue && (
        <button
          onClick={() => {
            setLocalValue('');
            onChange('');
          }}
          className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};


interface CategoryFilterProps {
  activeCategory: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
  onTagReset: () => void;
  isCompact?: boolean;
}

const CategoryFilter: React.FC<CategoryFilterProps> = ({
  activeCategory,
  onCategoryChange,
  onTagReset,
  isCompact = false,
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
    <div className={`flex gap-2 overflow-x-auto ${isCompact ? 'pb-3 pt-1' : 'pb-4 pt-2'} px-1 scrollbar-hide [mask-image:linear-gradient(to_right,black,black_90%,transparent)]`}>
      {CATEGORIES.map((cat, index) => {
        const isActive = cat === activeCategory;
        return (
          <button
            key={cat}
            onClick={() => handleCategoryClick(cat)}
            style={{ animationDelay: `${index * 30}ms` }}
            className={`rounded-full font-semibold whitespace-nowrap transition-all duration-300 animate-fade-in ${isCompact ? 'px-3 py-1.5 text-xs' : 'px-5 py-2.5 text-sm'} ${isActive
                ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-lg shadow-brand-500/40 scale-105 ring-2 ring-brand-500/20'
                : 'bg-slate-100/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:scale-105 hover:shadow-md backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50'
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
          style={{ animationDelay: `${idx * 100}ms` }}
          className="flex flex-col rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/40 overflow-hidden animate-fade-in"
        >
          <div className="h-44 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 animate-pulse" />
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-800 dark:to-slate-700 rounded w-3/4 animate-pulse" />
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/2 animate-pulse" />
              </div>
            </div>
            <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-full animate-pulse" />
            <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-5/6 animate-pulse" />
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="w-24 h-3 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              <div className="w-16 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
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
      presenter.ui.showToast(t('deployment.signInRequired'), 'info');
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
    <div className="h-full bg-app-bg relative overflow-hidden">
      <div className={`flex flex-col lg:flex-row gap-4 lg:gap-6 ${selectedApp ? 'max-w-full' : 'max-w-7xl'} mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8 ${selectedApp ? 'h-[calc(100vh-4rem)]' : ''}`}>
        {/* Left Column - App List */}
        <div className={`transition-all duration-500 ease-out ${selectedApp ? 'w-full lg:w-1/2 flex flex-col overflow-hidden' : 'w-full'}`}>
          <div className={`space-y-6 md:space-y-8 transition-all duration-500 ${selectedApp ? 'flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent' : ''}`}>

            {/* Deploy Section - Top */}
            <section className={`glass-card rounded-2xl md:rounded-3xl p-5 md:p-8 lg:p-10 relative overflow-hidden group/section ${selectedApp ? 'lg:p-6' : ''}`}>
              <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-purple-500/5 opacity-0 group-hover/section:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className={`flex items-center justify-between ${selectedApp ? 'mb-6' : 'mb-8'}`}>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Sparkles className={`text-brand-500 animate-pulse ${selectedApp ? 'w-5 h-5' : 'w-5 h-5 md:w-6 md:h-6'}`} />
                      <h2 className={`font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-white dark:via-slate-100 dark:to-white bg-clip-text text-transparent ${selectedApp ? 'text-xl md:text-2xl' : 'text-2xl sm:text-3xl md:text-4xl'}`}>
                        {t('deployment.deployYourApp')}
                      </h2>
                    </div>
                    <p className={`text-slate-600 dark:text-slate-400 ${selectedApp ? 'text-xs md:text-sm' : 'text-sm md:text-base'}`}>
                      {t('deployment.chooseDeploymentMethod')}
                    </p>
                  </div>
                </div>

                <div className={`grid gap-4 md:gap-5 ${selectedApp ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                  <button
                    onClick={() => handleQuickDeploy(SourceType.GITHUB)}
                    className={`group relative border-2 border-slate-200/60 dark:border-slate-800/60 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm hover:border-purple-500/60 dark:hover:border-purple-500/60 hover:shadow-2xl hover:shadow-purple-500/20 hover:-translate-y-1 transition-all duration-300 text-left overflow-hidden ${selectedApp ? 'p-4 rounded-xl' : 'p-5 md:p-7 rounded-xl md:rounded-2xl'}`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-purple-500/0 group-hover:from-purple-500/5 group-hover:to-purple-600/5 transition-all duration-300" />
                    <div className="relative z-10">
                      <div className={`flex items-start justify-between ${selectedApp ? 'mb-3' : 'mb-5'}`}>
                        <div className={`rounded-xl bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/50 dark:to-purple-800/50 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-purple-500/20 ${selectedApp ? 'p-3' : 'p-4'}`}>
                          <Github className={`text-purple-600 dark:text-purple-400 ${selectedApp ? 'w-5 h-5' : 'w-7 h-7'}`} />
                        </div>
                        <ArrowRight className={`text-slate-400 group-hover:text-purple-500 group-hover:translate-x-2 transition-all duration-300 ${selectedApp ? 'w-4 h-4' : 'w-5 h-5'}`} />
                      </div>
                      <h3 className={`font-bold text-slate-900 dark:text-white mb-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors ${selectedApp ? 'text-base' : 'text-lg'}`}>
                        {t('deployment.githubRepository')}
                      </h3>
                      <p className={`text-slate-600 dark:text-slate-400 leading-relaxed ${selectedApp ? 'text-xs' : 'text-sm'}`}>
                        {t('deployment.connectGitHubRepo')}
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleQuickDeploy(SourceType.ZIP)}
                    className={`group relative border-2 border-slate-200/60 dark:border-slate-800/60 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm hover:border-blue-500/60 dark:hover:border-blue-500/60 hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-1 transition-all duration-300 text-left overflow-hidden ${selectedApp ? 'p-4 rounded-xl' : 'p-5 md:p-7 rounded-xl md:rounded-2xl'}`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-500/0 group-hover:from-blue-500/5 group-hover:to-blue-600/5 transition-all duration-300" />
                    <div className="relative z-10">
                      <div className={`flex items-start justify-between ${selectedApp ? 'mb-3' : 'mb-5'}`}>
                        <div className={`rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/50 dark:to-blue-800/50 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-blue-500/20 ${selectedApp ? 'p-3' : 'p-4'}`}>
                          <FolderArchive className={`text-blue-600 dark:text-blue-400 ${selectedApp ? 'w-5 h-5' : 'w-7 h-7'}`} />
                        </div>
                        <ArrowRight className={`text-slate-400 group-hover:text-blue-500 group-hover:translate-x-2 transition-all duration-300 ${selectedApp ? 'w-4 h-4' : 'w-5 h-5'}`} />
                      </div>
                      <h3 className={`font-bold text-slate-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors ${selectedApp ? 'text-base' : 'text-lg'}`}>
                        {t('deployment.uploadArchive')}
                      </h3>
                      <p className={`text-slate-600 dark:text-slate-400 leading-relaxed ${selectedApp ? 'text-xs' : 'text-sm'}`}>
                        {t('deployment.uploadZipFile')}
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleQuickDeploy(SourceType.HTML)}
                    className={`group relative border-2 border-slate-200/60 dark:border-slate-800/60 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm hover:border-emerald-500/60 dark:hover:border-emerald-500/60 hover:shadow-2xl hover:shadow-emerald-500/20 hover:-translate-y-1 transition-all duration-300 text-left overflow-hidden ${selectedApp ? 'p-4 rounded-xl' : 'p-5 md:p-7 rounded-xl md:rounded-2xl'}`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-emerald-500/0 group-hover:from-emerald-500/5 group-hover:to-emerald-600/5 transition-all duration-300" />
                    <div className="relative z-10">
                      <div className={`flex items-start justify-between ${selectedApp ? 'mb-3' : 'mb-5'}`}>
                        <div className={`rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/50 dark:to-emerald-800/50 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-emerald-500/20 ${selectedApp ? 'p-3' : 'p-4'}`}>
                          <FileCode className={`text-emerald-600 dark:text-emerald-400 ${selectedApp ? 'w-5 h-5' : 'w-7 h-7'}`} />
                        </div>
                        <ArrowRight className={`text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-2 transition-all duration-300 ${selectedApp ? 'w-4 h-4' : 'w-5 h-5'}`} />
                      </div>
                      <h3 className={`font-bold text-slate-900 dark:text-white mb-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors ${selectedApp ? 'text-base' : 'text-lg'}`}>
                        {t('deployment.inlineHTML')}
                      </h3>
                      <p className={`text-slate-600 dark:text-slate-400 leading-relaxed ${selectedApp ? 'text-xs' : 'text-sm'}`}>
                        {t('deployment.pasteHTML')}
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            </section>

            {/* Explore Section - Bottom */}
            <section className="animate-fade-in">
              <div className={`flex flex-col ${selectedApp ? 'md:flex-col' : 'md:flex-row'} justify-between items-start ${selectedApp ? '' : 'md:items-center'} gap-4 ${selectedApp ? 'md:gap-4' : 'md:gap-6'} ${selectedApp ? 'mb-4 md:mb-6' : 'mb-6 md:mb-8'}`}>
                <div className={`space-y-1 ${selectedApp ? 'md:space-y-1' : 'md:space-y-2'}`}>
                  <h2 className={`font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-white dark:via-slate-100 dark:to-white bg-clip-text text-transparent ${selectedApp ? 'text-xl md:text-2xl' : 'text-2xl sm:text-3xl md:text-4xl'}`}>
                    {t('explore.exploreApps')}
                  </h2>
                  <p className={`text-slate-600 dark:text-slate-400 ${selectedApp ? 'text-xs md:text-sm' : 'text-sm md:text-base'}`}>
                    {t('explore.discoverApps')}
                  </p>
                </div>
                <div className={`flex flex-col ${selectedApp ? 'sm:flex-col' : 'sm:flex-row'} items-start ${selectedApp ? '' : 'sm:items-center'} gap-3 ${selectedApp ? 'w-full' : 'w-full md:w-auto'}`}>
                  <div className={selectedApp ? 'w-full' : ''}>
                    <SearchBar value={searchQuery} onChange={setSearchQuery} />
                  </div>
                  <div className={`flex items-center gap-2 ${selectedApp ? 'w-full' : ''}`}>
                    <span className={`font-medium text-slate-500 dark:text-slate-400 ${selectedApp ? 'text-xs' : 'text-sm'}`}>{t('explore.sortBy')}:</span>
                    <div className={`inline-flex items-center gap-1 rounded-xl bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 ${selectedApp ? 'p-1' : 'p-1.5'}`}>
                      <button
                        onClick={() => setSortBy('popularity')}
                        className={`inline-flex items-center gap-1.5 rounded-lg font-semibold transition-all duration-300 ${selectedApp ? 'px-2.5 py-1.5 text-[10px]' : 'px-4 py-2 text-xs'} ${sortBy === 'popularity'
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md scale-105'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                      >
                        <TrendingUp className={selectedApp ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                        {t('explore.sortByPopularity')}
                      </button>
                      <button
                        onClick={() => setSortBy('recent')}
                        className={`inline-flex items-center gap-1.5 rounded-lg font-semibold transition-all duration-300 ${selectedApp ? 'px-2.5 py-1.5 text-[10px]' : 'px-4 py-2 text-xs'} ${sortBy === 'recent'
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md scale-105'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                      >
                        <Clock className={selectedApp ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
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
                isCompact={!!selectedApp}
              />

              {isLoadingExplore ? (
                <ExploreSkeletonGrid />
              ) : apps.length > 0 ? (
                <div className={`grid ${selectedApp ? 'gap-4' : 'gap-6'} ${selectedApp ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                  {apps.map((app, index) => (
                    <div
                      key={app.id}
                      style={{ animationDelay: `${index * 50}ms` }}
                      className="animate-fade-in"
                    >
                      <ExploreAppCardView
                        app={app}
                        activeTag={activeTag}
                        setActiveTag={setActiveTag}
                        onCardClick={() => handleCardClick(app)}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass-card rounded-2xl p-16 text-center animate-fade-in">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center shadow-lg">
                    <Search className="w-10 h-10 text-slate-400 dark:text-slate-500" />
                  </div>
                  <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                    {t('explore.noAppsFound')}
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                    {t('explore.adjustSearch')}
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Right Column - Preview Panel */}
        {selectedApp && (
          <div className="hidden lg:flex lg:flex-col w-1/2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-3xl border border-slate-200/60 dark:border-slate-800/60 shadow-2xl overflow-hidden flex-shrink-0 h-[calc(100vh-4rem-3rem)] animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-r from-slate-50/80 to-white/80 dark:from-slate-900/80 dark:to-slate-800/80 backdrop-blur-sm flex-shrink-0">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br ${selectedApp.color} shrink-0 shadow-lg ring-2 ring-white/20 dark:ring-slate-700/30`}>
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white truncate mb-1">
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
                    className="p-2.5 rounded-xl hover:bg-slate-200/80 dark:hover:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-all duration-300 hover:scale-110"
                    aria-label={t('common.openInNewTab')}
                    title={t('common.openInNewTab')}
                  >
                    <ExternalLink className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={handleClosePreview}
                  className="p-2.5 rounded-xl hover:bg-slate-200/80 dark:hover:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-all duration-300 hover:scale-110"
                  aria-label={t('common.close')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Iframe */}
            <div className="flex-1 relative bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-950 dark:to-slate-900 min-h-0">
              {selectedApp.url ? (
                <iframe
                  src={selectedApp.url}
                  className="w-full h-full border-0 rounded-b-3xl"
                  title={selectedApp.name}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                      <X className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">
                      {t('common.notAccessible')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

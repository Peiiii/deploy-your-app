import { Play, Search, TrendingUp } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { ExploreAppCard } from '../components/ExploreAppCard';
import { ExploreAppCardView, mapProjectsToApps } from '../components/ExploreAppCard';
import { useAuthStore } from '../stores/authStore';
import { usePresenter } from '../contexts/PresenterContext';
import { fetchExploreProjects } from '../services/http/exploreApi';
const CREATOR_REVENUE_SHARE = 70;

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

interface FeaturedBannerProps {
  onNavigateToDeploy: () => void;
}

const FeaturedBanner: React.FC<FeaturedBannerProps> = ({ onNavigateToDeploy }) => {
  const { t } = useTranslation();
  return (
    <div className="relative rounded-3xl overflow-hidden bg-slate-900 text-white p-8 md:p-16 shadow-2xl shadow-slate-900/20 group">
      {/* Background Effects */}
      <div className="absolute inset-0 opacity-20 mix-blend-soft-light bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent"></div>
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-500/20 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/3 group-hover:bg-brand-400/30 transition-colors duration-700" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-500/20 blur-[100px] rounded-full translate-y-1/3 -translate-x-1/3 group-hover:bg-purple-400/30 transition-colors duration-700" />

      <div className="relative z-10 max-w-3xl">
        <div className="inline-flex items-center gap-2 mb-6 text-brand-300 font-medium px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
          <TrendingUp className="w-4 h-4" />
          <span className="text-sm tracking-wide uppercase">{t('explore.creatorEconomy')}</span>
        </div>
        <h3 className="text-5xl md:text-6xl font-bold mb-6 leading-tight tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white via-white to-slate-400">
          {t('explore.monetizeYour')} <br /> {t('explore.aiModels')}
        </h3>
        <p className="text-slate-300 text-lg md:text-xl mb-10 max-w-xl leading-relaxed">
          {t('explore.publishToMarketplace')}{' '}
          <span className="text-white font-bold">{CREATOR_REVENUE_SHARE}%</span> {t('explore.ofCreditRevenue')}
        </p>
        <button
          onClick={onNavigateToDeploy}
          className="bg-white text-slate-900 px-8 py-4 rounded-full font-bold text-lg hover:bg-brand-50 hover:scale-105 transition-all shadow-xl shadow-brand-500/10 flex items-center gap-2"
        >
          {t('explore.becomeACreator')} <Play className="w-4 h-4 fill-slate-900" />
        </button>
      </div>
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
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              isActive
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

export const ExploreApps: React.FC = () => {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const navigate = useNavigate();
  const [apps, setApps] = useState<ExploreAppCard[]>([]);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All Apps');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const PAGE_SIZE = 12;

  const loadPage = React.useCallback(
    async (pageToLoad: number, append: boolean) => {
      setIsLoading(true);
      try {
        const currentUser = useAuthStore.getState().user;
        const result = await fetchExploreProjects({
          search: searchQuery.trim() || undefined,
          category: activeCategory !== 'All Apps' ? activeCategory : undefined,
          tag: activeTag,
          sort: 'recent',
          page: pageToLoad,
          pageSize: PAGE_SIZE,
        });

        const projects = result.items;
        const pageApps = mapProjectsToApps(projects, APP_META);
        setApps((prev) =>
          append ? [...prev, ...pageApps] : pageApps,
        );
        setPage(result.page);
        setHasMore(result.page * PAGE_SIZE < result.total);

        if (currentUser) {
          const ids = projects.map((p) => p.id);
          presenter.reaction.loadReactionsForProjectsBulk(ids);
        }

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
      } catch (error) {
        console.error('Failed to load explore apps', error);
      } finally {
        setIsLoading(false);
      }
    },
    [searchQuery, activeCategory, activeTag, presenter.reaction],
  );

  React.useEffect(() => {
    void loadPage(1, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNavigateToDeploy = () => {
    navigate('/deploy');
  };

  const handleLoadMore = () => {
    if (!hasMore || isLoading) return;
    void loadPage(page + 1, true);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            {t('explore.exploreApps')}{' '}
            <span className="bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 text-xs px-2 py-1 rounded-full border border-brand-200 dark:border-brand-500/20">
              {t('explore.beta')}
            </span>
          </h2>
          <p className="text-slate-500 dark:text-gray-400 mt-1">
            {t('explore.discoverApps')} {t('explore.spendCreditsSupportCreators')}
          </p>
        </div>
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
      </div>

      <FeaturedBanner onNavigateToDeploy={handleNavigateToDeploy} />

      <CategoryFilter
        activeCategory={activeCategory}
        onCategoryChange={(cat) => {
          setActiveCategory(cat);
          setPage(1);
        }}
        onTagReset={() => setActiveTag(null)}
      />

      {apps.length === 0 && isLoading ? (
        <div className="mt-6">
          {/* Simple skeleton reuse from Home */}
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
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {apps.map((app) => (
              <ExploreAppCardView
                key={app.id}
                app={app}
                activeTag={activeTag}
                setActiveTag={setActiveTag}
              />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center mt-8">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoading}
                className="px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                {isLoading ? t('common.loading') : t('explore.loadMore')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

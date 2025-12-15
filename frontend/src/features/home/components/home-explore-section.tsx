import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Search, TrendingUp, X } from 'lucide-react';
import type { ExploreAppCard } from '@/components/explore-app-card';
import { ExploreAppCardView } from '@/components/explore-app-card';
import { CATEGORIES, type CategoryFilter } from '@/features/home/components/home-explore';
import { useHomeExploreFeed } from '@/features/home/hooks/use-home-explore-feed';

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

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  }, []);

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
    <div
      className={`flex gap-2 overflow-x-auto ${isCompact ? 'pb-3 pt-1' : 'pb-4 pt-2'} px-1 scrollbar-hide [mask-image:linear-gradient(to_right,black,black_90%,transparent)]`}
    >
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

interface HomeExploreSectionProps {
  compact: boolean;
  onCardClick: (app: ExploreAppCard) => void;
}

export const HomeExploreSection: React.FC<HomeExploreSectionProps> = ({
  compact,
  onCardClick,
}) => {
  const { t } = useTranslation();
  const {
    apps,
    activeCategory,
    setActiveCategory,
    activeTag,
    setActiveTag,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    isLoadingExplore,
    isLoadingMore,
    hasMore,
    loadMoreRef,
    handleLoadMoreExplore,
  } = useHomeExploreFeed();

  return (
    <section className="animate-fade-in">
      <div
        className={`flex flex-col ${compact ? 'md:flex-col' : 'md:flex-row'} justify-between items-start ${compact ? '' : 'md:items-center'
          } gap-4 ${compact ? 'md:gap-4' : 'md:gap-6'} ${compact ? 'mb-4 md:mb-6' : 'mb-6 md:mb-8'}`}
      >
        <div className={`space-y-1 ${compact ? 'md:space-y-1' : 'md:space-y-2'}`}>
          <h2
            className={`font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-white dark:via-slate-100 dark:to-white bg-clip-text text-transparent ${compact ? 'text-xl md:text-2xl' : 'text-2xl sm:text-3xl md:text-4xl'
              }`}
          >
            {t('explore.exploreApps')}
          </h2>
          <p className={`text-slate-600 dark:text-slate-400 ${compact ? 'text-xs md:text-sm' : 'text-sm md:text-base'}`}>
            {t('explore.discoverApps')}
          </p>
        </div>
        <div
          className={`flex flex-col ${compact ? 'sm:flex-col' : 'sm:flex-row'} items-start ${compact ? '' : 'sm:items-center'
            } gap-3 ${compact ? 'w-full' : 'w-full md:w-auto'}`}
        >
          <div className={compact ? 'w-full' : ''}>
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
          </div>
          <div className={`flex items-center gap-2 ${compact ? 'w-full' : ''}`}>
            <span className={`font-medium text-slate-500 dark:text-slate-400 ${compact ? 'text-xs' : 'text-sm'}`}>
              {t('explore.sortBy')}:
            </span>
            <div
              className={`inline-flex items-center gap-1 rounded-xl bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 ${compact ? 'p-1' : 'p-1.5'
                }`}
            >
              <button
                onClick={() => setSortBy('popularity')}
                className={`inline-flex items-center gap-1.5 rounded-lg font-semibold transition-all duration-300 ${compact ? 'px-2.5 py-1.5 text-[10px]' : 'px-4 py-2 text-xs'
                  } ${sortBy === 'popularity'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md scale-105'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
              >
                <TrendingUp className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                {t('explore.sortByPopularity')}
              </button>
              <button
                onClick={() => setSortBy('recent')}
                className={`inline-flex items-center gap-1.5 rounded-lg font-semibold transition-all duration-300 ${compact ? 'px-2.5 py-1.5 text-[10px]' : 'px-4 py-2 text-xs'
                  } ${sortBy === 'recent'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md scale-105'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
              >
                <Clock className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
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
        isCompact={compact}
      />

      {isLoadingExplore ? (
        <ExploreSkeletonGrid />
      ) : apps.length > 0 ? (
        <div>
          <div className={`grid ${compact ? 'gap-4' : 'gap-6'} ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
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
                  onCardClick={() => onCardClick(app)}
                />
              </div>
            ))}
          </div>

          <div ref={loadMoreRef} className="h-1" />

          {(hasMore || isLoadingMore) && (
            <div className="flex justify-center mt-8">
              {isLoadingMore ? (
                <div className="px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-500 dark:text-slate-400">
                  {t('common.loading')}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleLoadMoreExplore}
                  className="px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  {t('explore.loadMore')}
                </button>
              )}
            </div>
          )}
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
  );
};

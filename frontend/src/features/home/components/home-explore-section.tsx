import { useAppLanguageStore } from '@/features/explore/stores/app-language.store';
import { AppLanguageFilter } from '@/features/explore/components/app-language-filter';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Search, Sparkles, TrendingUp, X } from 'lucide-react';
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
        className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all shadow-sm"
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
      'Education': t('explore.education'),
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
      className={`flex gap-2 overflow-x-auto ${isCompact ? 'pb-2 pt-1' : 'pb-2 pt-1'} px-1 scrollbar-hide [mask-image:linear-gradient(to_right,black,black_90%,transparent)]`}
    >
      {CATEGORIES.map((cat, index) => {
        const isActive = cat === activeCategory;
        return (
          <button
            key={cat}
            data-event="filter_change" onClick={() => handleCategoryClick(cat)}
            style={{ animationDelay: `${index * 30}ms` }}
            className={`rounded-full font-medium whitespace-nowrap transition-all duration-200 ${isCompact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'} ${isActive
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

interface ExploreSkeletonGridProps {
  compact: boolean;
}

const ExploreSkeletonGrid: React.FC<ExploreSkeletonGridProps> = ({ compact }) => {
  return (
    <div className={`grid ${compact ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'} gap-6`}>
      {Array.from({ length: 6 }).map((_, idx) => (
        <div
          key={idx}
          className="flex flex-col rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/40 overflow-hidden shadow-sm animate-pulse"
        >
          <div className="aspect-video bg-slate-100 dark:bg-slate-800" />
          <div className="p-3 space-y-3">
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800" />
                <div className="w-12 h-2 bg-slate-100 dark:bg-slate-800 rounded" />
              </div>
              <div className="w-6 h-2 bg-slate-100 dark:bg-slate-800 rounded" />
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
    exploreError,
    retryExplore,
    isLoadingMore,
    hasMore,
    loadMoreRef,
    handleLoadMoreExplore,
  } = useHomeExploreFeed();

  return (
    <section className="animate-fade-in text-left">
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-3`}>
        <div className="space-y-1">
          <h2
            className={`font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-white dark:via-slate-100 dark:to-white bg-clip-text text-transparent text-left text-xl md:text-2xl`}
          >
            {t('explore.exploreApps')}
          </h2>
          <p className={`text-slate-600 dark:text-slate-400 text-left ${compact ? 'text-xs md:text-sm' : 'text-sm'}`}>
            {t('explore.discoverApps')}
          </p>
        </div>
        <div className={`w-full ${compact ? 'md:w-auto' : 'md:w-96'}`}>
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>
      </div>

      <div className="mb-3"><AppLanguageFilter /></div>
      <div className={`flex flex-col sm:flex-row items-center gap-2 mb-3`}>
        <div className="flex-1 min-w-0 w-full overflow-hidden">
          <CategoryFilter
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            onTagReset={() => setActiveTag(null)}
            isCompact
          />
        </div>

        <div className="shrink-0 flex w-full sm:w-auto justify-end gap-1 rounded-full bg-slate-100 dark:bg-slate-800 p-1">
          {([
            ['recommended', Sparkles, 'explore.sortByRecommended'],
            ['popularity', TrendingUp, 'explore.sortByPopularity'],
            ['recent', Clock, 'explore.sortByRecent'],
          ] as const).map(([sort, Icon, label]) => (
            <button key={sort} aria-pressed={sortBy === sort} data-event="sort_change" data-dimension={sort}
              onClick={() => setSortBy(sort)}
              className={`inline-flex items-center justify-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium ${sortBy === sort ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
              <Icon className="h-3.5 w-3.5" />{t(label)}
            </button>
          ))}
        </div>
      </div>

      {isLoadingExplore ? (
        <ExploreSkeletonGrid compact={compact} />
      ) : apps.length > 0 ? (
        <div>
          <div className={`grid ${compact ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'} gap-6`}>
            {apps.map((app, index) => (
              <ExploreAppCardView
                key={app.id}
                app={app}
                activeTag={activeTag}
                setActiveTag={setActiveTag}
                imagePriority={index < 3}
                onCardClick={() => onCardClick(app)}
              />
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
                  data-event="load_more" onClick={handleLoadMoreExplore}
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
            {t(exploreError ? 'languages.loadFailed' : 'explore.noAppsFound')}
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            {t('languages.empty')}
          </p>
          <button type="button" onClick={exploreError ? retryExplore : () => useAppLanguageStore.getState().actions.select(null)} className="mt-4 rounded-full bg-brand-600 text-white px-4 py-2 text-sm">{t(exploreError ? 'languages.retry' : 'languages.browseAll')}</button>
        </div>
      )}
    </section>
  );
};

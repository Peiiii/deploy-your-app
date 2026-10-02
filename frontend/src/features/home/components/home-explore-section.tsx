import { useAppLanguageStore } from '@/features/explore/stores/app-language.store';
import { AppLanguageFilter } from '@/features/explore/components/app-language-filter';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Search, Sparkles, TrendingUp, X } from 'lucide-react';
import { ContentSkeleton } from '@/components/loading-state';
import { PageState } from '@/components/page-state';
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
    <div className="relative w-full group">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
        <Search className="h-4 w-4 text-slate-400 group-focus-within:text-brand-500 transition-colors duration-150 group-focus-within:scale-110" />
      </div>
      <input
        type="search" aria-label={t('explore.searchApps')}
        value={localValue}
        onChange={handleChange}
        placeholder={t('explore.searchApps')}
        className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all shadow-sm"
      />
      {localValue && (
        <button
          aria-label={t('experience.resetFilters')}
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
      {CATEGORIES.map((cat) => {
        const isActive = cat === activeCategory;
        return (
          <button
            key={cat} aria-pressed={isActive}
            data-event="filter_change" onClick={() => handleCategoryClick(cat)}
            className={`rounded-full font-medium whitespace-nowrap transition-colors duration-150 ${isCompact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'} ${isActive
              ? 'bg-brand-600 text-white'
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
    error,
    retry,
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
    <section className=" text-left">
      <div className={`flex flex-col ${compact ? '' : 'lg:flex-row lg:items-center'} justify-between items-start gap-3 mb-3`}>
        <div className="space-y-1">
          <h2
            className={`font-semibold text-app-text text-left text-xl md:text-2xl`}
          >
            {t('explore.exploreApps')}
          </h2>
          <p className={`text-slate-600 dark:text-slate-400 text-left ${compact ? 'text-xs md:text-sm' : 'text-sm'}`}>
            {t('explore.discoverApps')}
          </p>
        </div>
        <div className={`flex w-full items-center gap-2 ${compact ? '' : 'lg:w-auto'}`}>
          <div className={`min-w-0 flex-1 ${compact ? '' : 'lg:w-80'}`}><SearchBar value={searchQuery} onChange={setSearchQuery} /></div>
          <AppLanguageFilter />
        </div>
      </div>

      <div className="mb-3 flex flex-col items-center gap-2 xl:flex-row">
        <div className="flex-1 min-w-0 w-full overflow-hidden">
          <CategoryFilter
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            onTagReset={() => setActiveTag(null)}
            isCompact
          />
        </div>

        <div className="shrink-0 flex w-full xl:w-auto justify-end gap-1 rounded-full bg-slate-100 dark:bg-slate-800 p-1">
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

      {error && <PageState title={t('experience.exploreError')} action={<button className="btn-secondary" onClick={retry}>{t('common.retry')}</button>} />}
      {isLoadingExplore && apps.length > 0 && <p role="status" className="mb-3 text-sm text-app-muted">{t('experience.refreshing')}</p>}
      {isLoadingExplore && apps.length === 0 ? (
        <ContentSkeleton shape="apps" />
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

          {!error && (hasMore || isLoadingMore) && (
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
        !error && <PageState title={t('explore.noAppsFound')} description={t('explore.adjustSearch')} action={<button className="btn-secondary" onClick={() => { setActiveCategory('All Apps'); setActiveTag(null); setSearchQuery(''); useAppLanguageStore.getState().actions.select(null); }}>{t('experience.resetFilters')}</button>} />
      )}
    </section>
  );
};

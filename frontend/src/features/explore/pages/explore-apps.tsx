import { useAppLanguageStore } from '@/features/explore/stores/app-language.store';
import { AppLanguageFilter } from '@/features/explore/components/app-language-filter';
import { Search, LayoutGrid, Smartphone } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ExploreAppCardView } from '@/components/explore-app-card';
import { ContentSkeleton } from '@/components/loading-state';
import { PageState } from '@/components/page-state';
import { PageLayout } from '@/components/page-layout';
import { useExploreStore, CATEGORIES, type CategoryFilter } from '@/features/explore/stores/explore.store';
import { useLayoutMode } from '@/hooks/use-layout-mode';
import { usePresenter } from '@/contexts/presenter-context';
import { useAppPreviewPanel } from '@/hooks/use-app-preview-panel';
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { PERFORMANCE_CONFIG } from '@/constants';
import { ExploreFeed } from '../components/explore-feed';



interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ value, onChange }) => {
  const { t } = useTranslation();
  return (
    <div className="relative w-full md:w-96 group">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
        <Search className="h-4 w-4 text-slate-400 group-focus-within:text-brand-500 transition-colors duration-150 group-focus-within:scale-110" />
      </div>
      <input
        type="search" aria-label={t('explore.searchApps')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('explore.searchApps')}
        className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all shadow-sm"
      />
    </div>
  );
};



interface CategoryFilterProps {
  activeCategory: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
}

const CategoryFilterBar: React.FC<CategoryFilterProps> = ({
  activeCategory,
  onCategoryChange,
}) => {
  const { t } = useTranslation();

  const getCategoryLabel = (cat: CategoryFilter): string => {
    const categoryMap: Record<CategoryFilter, string> = {
      'All Apps': t('explore.allApps'),
      Education: t('explore.education'),
      Development: t('explore.development'),
      'Image Gen': t('explore.imageGen'),
      Productivity: t('explore.productivity'),
      Marketing: t('explore.marketing'),
      Legal: t('explore.legal'),
      Fun: t('explore.fun'),
      Other: t('explore.other'),
    };
    return categoryMap[cat] || cat;
  };

  return (
    <div className="flex gap-2 overflow-x-auto pb-4 pt-2 px-1 scrollbar-hide [mask-image:linear-gradient(to_right,black,black_90%,transparent)]">
      {CATEGORIES.map((cat) => {
        const isActive = cat === activeCategory;
        return (
          <button
            key={cat} aria-pressed={isActive}
            data-event="filter_change" onClick={() => onCategoryChange(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors duration-150 ${isActive
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

export const ExploreApps: React.FC = () => {
  const { t } = useTranslation();
  const languages = useAppLanguageStore(s => s.languages);
  const error = useExploreStore(s => s.error);
  const presenter = usePresenter();
  const { openAppPreview } = useAppPreviewPanel();


  // Subscribe to store
  const apps = useExploreStore((s) => s.apps);
  const activeCategory = useExploreStore((s) => s.activeCategory);
  const activeTag = useExploreStore((s) => s.activeTag);
  const searchQuery = useExploreStore((s) => s.searchQuery);
  const hasMore = useExploreStore((s) => s.hasMore);
  const isLoading = useExploreStore((s) => s.isLoading);
  const actions = useExploreStore((s) => s.actions);

  const [viewMode, setViewMode] = useState<'grid' | 'feed'>('grid');
  const loadMoreRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => { presenter.explore.refresh(); }, [languages, presenter.explore]);
  const previousFilters = React.useRef(JSON.stringify([searchQuery, activeCategory, activeTag]));
  React.useEffect(() => {
    const key = JSON.stringify([searchQuery, activeCategory, activeTag]);
    if (previousFilters.current === key) return;
    previousFilters.current = key;
    const timeoutId = setTimeout(() => presenter.explore.refresh(), 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, activeCategory, activeTag, presenter.explore]);



  // Wrapper to match React.Dispatch<SetStateAction> signature
  const handleSetActiveTag = React.useCallback(
    (value: React.SetStateAction<string | null>) => {
      if (typeof value === 'function') {
        const newValue = value(activeTag);
        actions.setActiveTag(newValue);
      } else {
        actions.setActiveTag(value);
      }
    },
    [activeTag, actions],
  );

  const isFeedView = viewMode === 'feed';
  // Detect right panel state to adjust header compactness
  const { isCompact } = useLayoutMode();

  useInfiniteScroll({
    targetRef: loadMoreRef,
    onLoadMore: presenter.explore.loadMore,
    enabled: !isFeedView && hasMore && !isLoading,
    rootMargin: PERFORMANCE_CONFIG.EXPLORE_PRELOAD_ROOT_MARGIN,
  });

  if (isFeedView) {
    return (
      <ExploreFeed
        key={JSON.stringify(languages)}
        apps={apps}
        hasMore={hasMore}
        isLoading={isLoading}
        onLoadMore={presenter.explore.loadMore}
        error={error} onRetry={presenter.explore.retry}
        onToggleView={() => setViewMode('grid')}
      />
    );
  }

  return (
    <PageLayout
      title={
        <div className={`flex items-center gap-3 whitespace-nowrap overflow-hidden shrink-0`}>
          {t('explore.exploreApps')}
          <span className="bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 text-xs px-2 py-1 rounded-full border border-brand-200 dark:border-brand-500/20 font-normal shrink-0">
            {t('explore.beta')}
          </span>
        </div>
      }
      actions={
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
            <button
              onClick={() => setViewMode('feed')}
              className={`flex items-center gap-2 px-3 py-2 md:py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${isFeedView
                ? 'bg-white dark:bg-slate-700 text-brand-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              aria-label={t('explore.feedView')} title={t('explore.feedView')}
            >
              <Smartphone className="w-4 h-4 md:w-3.5 md:h-3.5 shrink-0" />
              {!isCompact && <span className="hidden sm:inline">{t('explore.feedView')}</span>}
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-2 px-3 py-2 md:py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${!isFeedView
                ? 'bg-white dark:bg-slate-700 text-brand-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              aria-label={t('explore.gridView')} title={t('explore.gridView')}
            >
              <LayoutGrid className="w-4 h-4 md:w-3.5 md:h-3.5 shrink-0" />
              {!isCompact && <span className="hidden sm:inline">{t('explore.gridView')}</span>}
            </button>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <AppLanguageFilter />
            <SearchBar value={searchQuery} onChange={actions.setSearchQuery} />
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3 md:gap-4 ">
        {/* Mobile Search Bar - Visible only on small screens */}
        <div className="md:hidden mb-1 flex items-center gap-2">
          <div className="flex-1 min-w-0"><SearchBar value={searchQuery} onChange={actions.setSearchQuery} /></div>
          <AppLanguageFilter />
        </div>

        <p className="hidden md:block text-slate-500 dark:text-gray-400 text-left">
          {t('explore.discoverApps')} {t('explore.spendCreditsSupportCreators')}
        </p>

        <CategoryFilterBar
          activeCategory={activeCategory}
          onCategoryChange={actions.setActiveCategory}
        />

        {error && <PageState title={t('experience.exploreError')} action={<button className="btn-secondary" onClick={presenter.explore.retry}>{t('common.retry')}</button>} />}
        {isLoading && apps.length > 0 && <p role="status" className="text-sm text-app-muted">{t('experience.refreshing')}</p>}
        {!error && apps.length === 0 && isLoading ? <ContentSkeleton shape="apps" /> : !error && apps.length === 0 && !isLoading ? <PageState title={t('explore.noAppsFound')} description={t('explore.adjustSearch')} action={<button className="btn-secondary" onClick={() => { actions.resetFilters(); useAppLanguageStore.getState().actions.select(null); }}>{t('experience.resetFilters')}</button>} /> : (

          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {apps.map((app, index) => (
                <ExploreAppCardView
                  key={app.id}
                  app={app}
                  activeTag={activeTag}
                  setActiveTag={handleSetActiveTag}
                  imagePriority={index < 3}
                  onCardClick={() => openAppPreview(app)}
                />
              ))}
            </div>
            <div ref={loadMoreRef} className="h-1" />

            {!error && (hasMore || (isLoading && apps.length > 0)) && (
              <div className="flex justify-center mt-8">
                {isLoading ? (
                  <div className="px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-500 dark:text-slate-400">
                    {t('common.loading')}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={presenter.explore.loadMore}
                    className="px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    {t('explore.loadMore')}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </PageLayout>
  );
};

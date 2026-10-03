import { AppCardSkeletonGrid } from '@/components/app-card-skeleton-grid';
import { IconButton } from '@/components/icon-button';
import { CATEGORY_LABEL_KEYS } from '@/constants/app-categories';
import { useAppLanguageStore } from '@/features/explore/stores/app-language.store';
import { AppLanguageFilter } from '@/features/explore/components/app-language-filter';
import { Search, LayoutGrid, Smartphone } from 'lucide-react';
import { PublicInfo } from '@/seo/public-info';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ExploreAppCardView } from '@/components/explore-app-card';
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
    <div className="relative w-full min-w-0 group">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
        <Search className="h-4 w-4 text-slate-400 group-focus-within:text-brand-500 transition-all duration-300 group-focus-within:scale-110" />
      </div>
      <input
        type="text"
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
  onCategoryIntent: (category: CategoryFilter) => void;
}

const CategoryFilterBar: React.FC<CategoryFilterProps> = ({
  activeCategory,
  onCategoryChange,
  onCategoryIntent,
}) => {
  const { t } = useTranslation();

  const getCategoryLabel = (cat: CategoryFilter): string => {
    return t(CATEGORY_LABEL_KEYS[cat]);
  };

  return (
    <div className="flex gap-2 overflow-x-auto pb-4 pt-2 px-1 scrollbar-hide [mask-image:linear-gradient(to_right,black,black_90%,transparent)]">
      {CATEGORIES.map((cat) => {
        const isActive = cat === activeCategory;
        return (
          <button
            key={cat}
            data-event="filter_change" onClick={() => onCategoryChange(cat)}
            onPointerEnter={(event) => { if (event.pointerType === 'mouse') onCategoryIntent(cat); }}
            onFocus={() => onCategoryIntent(cat)}
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

  const previousFilters = React.useRef({ languages, searchQuery, activeCategory, activeTag });
  React.useEffect(() => {
    const previous = previousFilters.current;
    previousFilters.current = { languages, searchQuery, activeCategory, activeTag };
    const onlySearchChanged = previous.searchQuery !== searchQuery &&
      previous.languages === languages && previous.activeCategory === activeCategory && previous.activeTag === activeTag;
    if (onlySearchChanged) {
      const timeoutId = setTimeout(() => presenter.explore.refresh(), 300);
      return () => clearTimeout(timeoutId);
    }
    presenter.explore.refresh();
  }, [languages, searchQuery, activeCategory, activeTag, presenter.explore]);



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
        error={error}
        onRetry={presenter.explore.refresh}
        apps={apps}
        hasMore={hasMore}
        isLoading={isLoading}
        onLoadMore={presenter.explore.loadMore}
        onToggleView={() => setViewMode('grid')}
      />
    );
  }

  return (
    <PageLayout
      className="page-layout-container"
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
            <IconButton label={t('explore.feedView')} showTooltip={isCompact} size="auto"
              onClick={() => setViewMode('feed')}
              className={`flex items-center gap-2 px-3 py-2 md:py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${isFeedView
                ? 'bg-white dark:bg-slate-700 text-brand-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
            >
              <Smartphone className="w-4 h-4 md:w-3.5 md:h-3.5 shrink-0" />
              {!isCompact && <span className="hidden sm:inline">{t('explore.feedView')}</span>}
            </IconButton>
            <IconButton label={t('explore.gridView')} showTooltip={isCompact} size="auto"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-2 px-3 py-2 md:py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${!isFeedView
                ? 'bg-white dark:bg-slate-700 text-brand-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
            >
              <LayoutGrid className="w-4 h-4 md:w-3.5 md:h-3.5 shrink-0" />
              {!isCompact && <span className="hidden sm:inline">{t('explore.gridView')}</span>}
            </IconButton>
          </div>
          <div className="explore-wide-filters hidden items-center gap-2">
            <AppLanguageFilter />
            <div className="w-80 min-w-0"><SearchBar value={searchQuery} onChange={actions.setSearchQuery} /></div>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3 md:gap-4 animate-fade-in">
        {/* Keep filters below the title when the page container is narrow. */}
        <div className="explore-narrow-filters mb-1 flex flex-wrap items-center gap-2">
          <div className="flex-1 basis-48 min-w-0 max-w-full"><SearchBar value={searchQuery} onChange={actions.setSearchQuery} /></div>
          <AppLanguageFilter />
        </div>

        <p className="hidden md:block text-slate-500 dark:text-gray-400 text-left">
          {t('explore.discoverApps')} {t('explore.spendCreditsSupportCreators')}
        </p>

        <CategoryFilterBar
          activeCategory={activeCategory}
          onCategoryChange={actions.setActiveCategory}
          onCategoryIntent={presenter.explore.prefetchCategory}
        />

        {!isLoading && (error || apps.length === 0) && <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-8 text-center">
          <p className="text-slate-700 dark:text-slate-200">{t(error ? 'languages.loadFailed' : 'languages.empty')}</p>
          <button type="button" onClick={error ? presenter.explore.refresh : () => useAppLanguageStore.getState().actions.select(null)} className="mt-4 px-4 py-2 rounded-full bg-brand-600 text-white text-sm">{t(error ? 'languages.retry' : 'languages.browseAll')}</button>
        </div>}

        {apps.length === 0 && isLoading ? (
          <div className="mt-6">
            <AppCardSkeletonGrid />
          </div>
        ) : (
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

            {(hasMore || (isLoading && apps.length > 0)) && (
              <div className="flex justify-center mt-8">
                {isLoading ? (
                  <div className="w-full"><AppCardSkeletonGrid count={3} /></div>
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
      <PublicInfo path="/explore" heading={false} />
    </PageLayout>
  );
};

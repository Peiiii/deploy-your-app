import { Search } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { ExploreAppCardView } from '@/components/explore-app-card';
import { PageLayout } from '@/components/page-layout';
import { useExploreStore, CATEGORIES, type CategoryFilter } from '@/features/explore/stores/explore.store';
import { usePresenter } from '@/contexts/presenter-context';



interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ value, onChange }) => {
  const { t } = useTranslation();
  return (
    <div className="relative w-full md:w-96 group">
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
}

const CategoryFilterBar: React.FC<CategoryFilterProps> = ({
  activeCategory,
  onCategoryChange,
}) => {
  const { t } = useTranslation();

  const getCategoryLabel = (cat: CategoryFilter): string => {
    const categoryMap: Record<CategoryFilter, string> = {
      'All Apps': t('explore.allApps'),
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
            key={cat}
            onClick={() => onCategoryChange(cat)}
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
  const presenter = usePresenter();


  // Subscribe to store
  const apps = useExploreStore((s) => s.apps);
  const activeCategory = useExploreStore((s) => s.activeCategory);
  const activeTag = useExploreStore((s) => s.activeTag);
  const searchQuery = useExploreStore((s) => s.searchQuery);
  const hasMore = useExploreStore((s) => s.hasMore);
  const isLoading = useExploreStore((s) => s.isLoading);
  const actions = useExploreStore((s) => s.actions);

  // Load on mount
  React.useEffect(() => {
    presenter.explore.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload when search query or category changes
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      presenter.explore.refresh();
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [searchQuery, activeCategory, presenter.explore]);



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

  return (
    <PageLayout
      title={
        <div className="flex items-center gap-3">
          {t('explore.exploreApps')}
          <span className="bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 text-xs px-2 py-1 rounded-full border border-brand-200 dark:border-brand-500/20 font-normal">
            {t('explore.beta')}
          </span>
        </div>
      }
      actions={
        <div className="hidden md:block">
          <SearchBar value={searchQuery} onChange={actions.setSearchQuery} />
        </div>
      }
    >
      <div className="flex flex-col gap-4 animate-fade-in">
        {/* Mobile Search Bar - Visible only on small screens */}
        <div className="md:hidden">
          <SearchBar value={searchQuery} onChange={actions.setSearchQuery} />
        </div>

        <p className="text-slate-500 dark:text-gray-400 text-left">
          {t('explore.discoverApps')} {t('explore.spendCreditsSupportCreators')}
        </p>



        <CategoryFilterBar
          activeCategory={activeCategory}
          onCategoryChange={actions.setActiveCategory}
        />

        {apps.length === 0 && isLoading ? (
          <div className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="flex flex-col rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/40 overflow-hidden animate-pulse"
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
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {apps.map((app) => (
                <ExploreAppCardView
                  key={app.id}
                  app={app}
                  activeTag={activeTag}
                  setActiveTag={handleSetActiveTag}
                />
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-8">
                <button
                  type="button"
                  onClick={presenter.explore.loadMore}
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
    </PageLayout>
  );
};

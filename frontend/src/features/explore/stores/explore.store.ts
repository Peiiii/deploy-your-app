import { create } from 'zustand';
import type { ExploreAppCard } from '@/components/explore-app-card';

import type { CategoryFilter } from '@/constants/app-categories';
export { CATEGORIES, type CategoryFilter } from '@/constants/app-categories';

interface ExploreState {
  // Data
  apps: ExploreAppCard[];

  // Filter/Sort state
  activeCategory: CategoryFilter;
  activeTag: string | null;
  searchQuery: string;

  // Pagination
  page: number;
  hasMore: boolean;

  // UI state
  isLoading: boolean;
  error: boolean;

  actions: {
    setApps: (apps: ExploreAppCard[]) => void;
    appendApps: (apps: ExploreAppCard[]) => void;
    setActiveCategory: (category: CategoryFilter) => void;
    setActiveTag: (tag: string | null) => void;
    setSearchQuery: (query: string) => void;
    setPage: (page: number) => void;
    setHasMore: (hasMore: boolean) => void;
    setError: (error: boolean) => void;
    setIsLoading: (loading: boolean) => void;
    resetFilters: () => void;
  };
}

const initialState = {
  apps: [] as ExploreAppCard[],
  activeCategory: 'All Apps' as CategoryFilter,
  activeTag: null as string | null,
  searchQuery: '',
  page: 1,
  hasMore: false,
  isLoading: true,
  error: false,
};

export const useExploreStore = create<ExploreState>((set) => ({
  ...initialState,

  actions: {
    setApps: (apps) => set({ apps }),
    appendApps: (apps) =>
      set((state) => ({ apps: [...state.apps, ...apps] })),
    setActiveCategory: (category) =>
      set((state) => state.activeCategory === category && state.activeTag === null
        ? state
        : { activeCategory: category, page: 1, activeTag: null, apps: [], hasMore: false, isLoading: true, error: false }),
    // Filters enter loading before the debounced refresh starts its request.
    setActiveTag: (tag) => set((state) => state.activeTag === tag
      ? state
      : { activeTag: tag, isLoading: true, error: false }),
    setSearchQuery: (query) => set((state) => state.searchQuery === query
      ? state
      : { searchQuery: query, isLoading: true, error: false }),
    setPage: (page) => set({ page }),
    setHasMore: (hasMore) => set({ hasMore }),
    setError: (error) => set({ error }),
    setIsLoading: (loading) => set({ isLoading: loading }),
    resetFilters: () =>
      set({
        activeCategory: 'All Apps',
        activeTag: null,
        searchQuery: '',
        page: 1,
      }),
  },
}));

import { create } from 'zustand';
import type { ExploreAppCard } from '../components/ExploreAppCard';

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

  actions: {
    setApps: (apps: ExploreAppCard[]) => void;
    appendApps: (apps: ExploreAppCard[]) => void;
    setActiveCategory: (category: CategoryFilter) => void;
    setActiveTag: (tag: string | null) => void;
    setSearchQuery: (query: string) => void;
    setPage: (page: number) => void;
    setHasMore: (hasMore: boolean) => void;
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
  isLoading: false,
};

export const useExploreStore = create<ExploreState>((set) => ({
  ...initialState,

  actions: {
    setApps: (apps) => set({ apps }),
    appendApps: (apps) =>
      set((state) => ({ apps: [...state.apps, ...apps] })),
    setActiveCategory: (category) =>
      set({ activeCategory: category, page: 1, activeTag: null }),
    setActiveTag: (tag) => set({ activeTag: tag }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setPage: (page) => set({ page }),
    setHasMore: (hasMore) => set({ hasMore }),
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

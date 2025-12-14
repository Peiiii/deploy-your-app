import { create } from 'zustand';

type SortOption = 'name' | 'recent' | 'status';
type SortDirection = 'asc' | 'desc';

interface DashboardState {
  // Filter/Sort state
  showFavoritesOnly: boolean;
  searchQuery: string;
  sortBy: SortOption;
  sortDirection: SortDirection;

  actions: {
    setShowFavoritesOnly: (value: boolean) => void;
    setSearchQuery: (query: string) => void;
    setSortBy: (option: SortOption) => void;
    setSortDirection: (direction: SortDirection) => void;
    handleSort: (option: SortOption) => void;
    reset: () => void;
  };
}

const initialState = {
  showFavoritesOnly: false,
  searchQuery: '',
  sortBy: 'recent' as SortOption,
  sortDirection: 'desc' as SortDirection,
};

export const useDashboardStore = create<DashboardState>((set) => ({
  ...initialState,

  actions: {
    setShowFavoritesOnly: (value) => set({ showFavoritesOnly: value }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setSortBy: (option) => set({ sortBy: option }),
    setSortDirection: (direction) => set({ sortDirection: direction }),

    handleSort: (option) =>
      set((state) => {
        if (state.sortBy === option) {
          return {
            sortDirection: state.sortDirection === 'asc' ? 'desc' : 'asc',
          };
        }
        return { sortBy: option, sortDirection: 'desc' };
      }),

    reset: () => set(initialState),
  },
}));

export type { SortOption, SortDirection };

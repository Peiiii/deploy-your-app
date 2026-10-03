import { create } from 'zustand';
import type { Project } from '@/types';

type SortOption = 'name' | 'recent' | 'status';
type SortDirection = 'asc' | 'desc';
type ManagementView = 'grid' | 'list';

interface DashboardState {
  viewMode: ManagementView;
  // Filter/Sort state
  showFavoritesOnly: boolean;
  searchQuery: string;
  sortBy: SortOption;
  sortDirection: SortDirection;
  statusFilter: Project['status'] | null;

  actions: {
    setViewMode: (view: ManagementView) => void;
    setShowFavoritesOnly: (value: boolean) => void;
    setSearchQuery: (query: string) => void;
    setStatusFilter: (status: Project['status'] | null) => void;
    setSort: (option: SortOption, direction: SortDirection) => void;
    setSortBy: (option: SortOption) => void;
    setSortDirection: (direction: SortDirection) => void;
    handleSort: (option: SortOption) => void;
    reset: () => void;
  };
}

const initialState = {
  viewMode: 'grid' as ManagementView,
  showFavoritesOnly: false,
  searchQuery: '',
  sortBy: 'recent' as SortOption,
  sortDirection: 'desc' as SortDirection,
  statusFilter: null as Project['status'] | null,
};

export const useDashboardStore = create<DashboardState>((set) => ({
  ...initialState,

  actions: {
    setViewMode: (viewMode) => set({ viewMode }),
    setShowFavoritesOnly: (value) => set({ showFavoritesOnly: value }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setStatusFilter: (statusFilter) => set({ statusFilter }),
    setSort: (sortBy, sortDirection) => set({ sortBy, sortDirection }),
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

    reset: () => set((state) => ({ ...initialState, viewMode: state.viewMode })),
  },
}));

export type { SortOption, SortDirection, ManagementView };

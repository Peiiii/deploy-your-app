import { create } from 'zustand';
import type { Project, PaginatedResponse } from '../types';

interface ProjectState {
  projects: Project[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
  isLoading: boolean;
  hasLoaded: boolean;
  loadError: string | null;
  actions: {
    addProject: (project: Project) => void;
    setProjects: (response: PaginatedResponse<Project>, append?: boolean) => void;
    setIsLoading: (loading: boolean) => void;
    setLoadError: (error: string | null) => void;
    reset: () => void;
  };
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [], // Empty initially
  pagination: {
    page: 0,
    pageSize: 50,
    total: 0,
    hasMore: false,
  },
  isLoading: false,
  hasLoaded: false,
  loadError: null,
  actions: {
    addProject: (project) => set((state) => ({
      projects: [project, ...state.projects],
      pagination: {
        ...state.pagination,
        total: state.pagination.total + 1
      }
    })),
    setProjects: (response, append = false) => set((state) => ({
      projects: append ? [...state.projects, ...response.items] : response.items,
      hasLoaded: true,
      loadError: null,
      pagination: {
        page: response.page,
        pageSize: response.pageSize,
        total: response.total,
        hasMore: response.page * response.pageSize < response.total,
      },
    })),
    setIsLoading: (isLoading) => set({
      isLoading,
      ...(isLoading ? { loadError: null } : {}),
    }),
    setLoadError: (loadError) => set({ loadError }),
    reset: () => set({
      projects: [],
      pagination: { page: 0, pageSize: 50, total: 0, hasMore: false },
      isLoading: false,
      hasLoaded: false,
      loadError: null,
    }),
  },
}));

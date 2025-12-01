import { create } from 'zustand';
import type { Project } from '../types';

interface ProjectState {
  projects: Project[];
  isLoading: boolean;
  actions: {
    addProject: (project: Project) => void;
    setProjects: (projects: Project[]) => void;
    setIsLoading: (loading: boolean) => void;
  };
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [], // Empty initially
  isLoading: false,
  actions: {
    addProject: (project) => set((state) => ({ projects: [project, ...state.projects] })),
    setProjects: (projects) => set({ projects }),
    setIsLoading: (isLoading) => set({ isLoading }),
  },
}));

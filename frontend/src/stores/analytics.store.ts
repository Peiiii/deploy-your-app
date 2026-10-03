import { create } from 'zustand';
import type { ProjectStats } from '../types';

interface AnalyticsEntry {
  range: '7d' | '30d';
  stats: ProjectStats | null;
  isLoading: boolean;
  error?: string;
}

interface AnalyticsState {
  byProjectId: Record<string, AnalyticsEntry>;
  actions: {
    setLoading: (projectId: string, isLoading: boolean, range: '7d' | '30d') => void;
    setStats: (projectId: string, stats: ProjectStats) => void;
    setError: (projectId: string, error?: string) => void;
  };
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  byProjectId: {},
  actions: {
    setLoading: (projectId, isLoading, range) =>
      set((state) => ({
        byProjectId: {
          ...state.byProjectId,
          [projectId]: {
            ...(state.byProjectId[projectId] ?? {
              stats: null,
              error: undefined,
            }),
            range,
            ...(isLoading ? { error: undefined } : {}),
            isLoading,
          },
        },
      })),
    setStats: (projectId, stats) =>
      set((state) => ({
        byProjectId: {
          ...state.byProjectId,
          [projectId]: {
            range: stats.range,
            stats,
            isLoading: false,
            error: undefined,
          },
        },
      })),
    setError: (projectId, error) =>
      set((state) => ({
        byProjectId: {
          ...state.byProjectId,
          [projectId]: {
            ...(state.byProjectId[projectId] ?? {
              range: '7d',
              stats: null,
              isLoading: false,
            }),
            error,
          },
        },
      })),
  },
}));

import { create } from 'zustand';
import type { ProjectReactions } from '../types';

interface ReactionEntry extends ProjectReactions {
  isLoading: boolean;
}

interface ReactionState {
  byProjectId: Record<string, ReactionEntry>;
  actions: {
    setLoading: (projectId: string, isLoading: boolean) => void;
    setReactions: (projectId: string, reactions: ProjectReactions) => void;
    patchReactions: (
      projectId: string,
      patch: Partial<ProjectReactions>,
    ) => void;
  };
}

const DEFAULT_REACTIONS: ProjectReactions = {
  likesCount: 0,
  favoritesCount: 0,
  likedByCurrentUser: false,
  favoritedByCurrentUser: false,
};

export const useReactionStore = create<ReactionState>((set) => ({
  byProjectId: {},
  actions: {
    setLoading: (projectId, isLoading) =>
      set((state) => ({
        byProjectId: {
          ...state.byProjectId,
          [projectId]: {
            ...(state.byProjectId[projectId] ?? {
              ...DEFAULT_REACTIONS,
            }),
            isLoading,
          },
        },
      })),
    setReactions: (projectId, reactions) =>
      set((state) => ({
        byProjectId: {
          ...state.byProjectId,
          [projectId]: {
            ...reactions,
            isLoading: false,
          },
        },
      })),
    patchReactions: (projectId, patch) =>
      set((state) => ({
        byProjectId: {
          ...state.byProjectId,
          [projectId]: {
            ...(state.byProjectId[projectId] ?? {
              ...DEFAULT_REACTIONS,
              isLoading: false,
            }),
            ...patch,
          },
        },
      })),
  },
}));

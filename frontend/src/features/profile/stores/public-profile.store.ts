import { create } from 'zustand';
import type { PublicUserProfile } from '@/types';

interface PublicProfileState {
  // Profile data
  data: PublicUserProfile | null;

  // UI state
  isLoading: boolean;
  error: string | null;

  actions: {
    setData: (data: PublicUserProfile | null) => void;
    setIsLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    reset: () => void;
  };
}

const initialState = {
  data: null as PublicUserProfile | null,
  isLoading: false,
  error: null as string | null,
};

export const usePublicProfileStore = create<PublicProfileState>((set) => ({
  ...initialState,

  actions: {
    setData: (data) => set({ data }),
    setIsLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
    reset: () => set(initialState),
  },
}));

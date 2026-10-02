import { create } from 'zustand';
import type { PublicUserProfile } from '@/types';

interface PublicProfileState {
  // Profile data
  data: PublicUserProfile | null;

  // UI state
  isLoading: boolean;
  requestedId: string | null;
  error: string | null;

  actions: {
    setRequestedId: (id: string) => void;
    setData: (data: PublicUserProfile | null) => void;
    setIsLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    reset: () => void;
  };
}

const initialState = {
  data: null as PublicUserProfile | null,
  isLoading: false,
  requestedId: null as string | null,
  error: null as string | null,
};

export const usePublicProfileStore = create<PublicProfileState>((set) => ({
  ...initialState,

  actions: {
    setRequestedId: (requestedId) => set({ requestedId, data: null, error: null }),
    setData: (data) => set({ data }),
    setIsLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
    reset: () => set(initialState),
  },
}));

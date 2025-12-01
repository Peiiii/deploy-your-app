import { create } from 'zustand';

interface UIState {
  currentView: string;
  theme: 'dark' | 'light';
  actions: {
    setCurrentView: (view: string) => void;
    toggleTheme: () => void;
  };
}

export const useUIStore = create<UIState>((set) => ({
  currentView: 'dashboard',
  theme: 'light', // Default to light
  actions: {
    setCurrentView: (view) => set({ currentView: view }),
    toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
  },
}));
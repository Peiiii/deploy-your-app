import { create } from 'zustand';

interface UIState {
  currentView: string;
  theme: 'dark' | 'light';
  sidebarOpen: boolean;
  actions: {
    setCurrentView: (view: string) => void;
    toggleTheme: () => void;
    toggleSidebar: () => void;
    setSidebarOpen: (open: boolean) => void;
  };
}

export const useUIStore = create<UIState>((set) => ({
  currentView: 'dashboard',
  theme: 'light', // Default to light
  sidebarOpen: false, // Closed by default on mobile
  actions: {
    setCurrentView: (view) => set({ currentView: view }),
    toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
  },
}));
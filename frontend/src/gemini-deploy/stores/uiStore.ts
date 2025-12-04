import { create } from 'zustand';

interface UIState {
  theme: 'dark' | 'light';
  sidebarOpen: boolean;
  actions: {
    toggleTheme: () => void;
    toggleSidebar: () => void;
    setSidebarOpen: (open: boolean) => void;
  };
}

export const useUIStore = create<UIState>((set) => ({
  theme: 'light', // Default to light
  sidebarOpen: false, // Closed by default on mobile
  actions: {
    toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
  },
}));

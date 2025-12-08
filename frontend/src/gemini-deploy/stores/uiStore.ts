import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastState {
  message: string;
  variant: ToastVariant;
}

interface UIState {
  theme: 'dark' | 'light';
  sidebarOpen: boolean;
  toast: ToastState | null;
  actions: {
    toggleTheme: () => void;
    toggleSidebar: () => void;
    setSidebarOpen: (open: boolean) => void;
    showToast: (toast: ToastState) => void;
    clearToast: () => void;
  };
}

export const useUIStore = create<UIState>((set) => ({
  theme: 'light', // Default to light
  sidebarOpen: false, // Closed by default on mobile
  toast: null,
  actions: {
    toggleTheme: () =>
      set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
    toggleSidebar: () =>
      set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    showToast: (toast) => set({ toast }),
    clearToast: () => set({ toast: null }),
  },
}));

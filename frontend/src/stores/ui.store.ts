import type { ReactNode } from 'react';
import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastState {
  message: string;
  variant: ToastVariant;
}

export interface ConfirmDialogState {
  title?: string;
  message: string;
  primaryLabel: string;
  secondaryLabel: string;
}

interface UIState {
  theme: 'dark' | 'light';
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  toast: ToastState | null;
  language: string;
  confirmDialog: ConfirmDialogState | null;
  // Right Panel Service
  rightPanelContent: ReactNode | null;
  rightPanelId: string | null;
  actions: {
    toggleTheme: () => void;
    toggleSidebar: () => void;
    setSidebarOpen: (open: boolean) => void;
    toggleSidebarCollapsed: () => void;
    setSidebarCollapsed: (collapsed: boolean) => void;
    showToast: (toast: ToastState) => void;
    clearToast: () => void;
    setLanguage: (lang: string) => void;
    openConfirmDialog: (dialog: ConfirmDialogState) => void;
    closeConfirmDialog: () => void;
    // Right Panel Service
    openRightPanel: (content: ReactNode, id: string) => void;
    closeRightPanel: (id?: string) => void;
  };
}

const getInitialLanguage = (): string => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('i18nextLng');
    if (stored) return stored;
  }
  return 'en';
};

export const useUIStore = create<UIState>((set) => ({
  theme: 'light',
  sidebarOpen: false,
  sidebarCollapsed: false,
  toast: null,
  language: getInitialLanguage(),
  confirmDialog: null,
  rightPanelContent: null,
  rightPanelId: null,
  actions: {
    toggleTheme: () =>
      set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
    toggleSidebar: () =>
      set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    toggleSidebarCollapsed: () =>
      set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    showToast: (toast) => set({ toast }),
    clearToast: () => set({ toast: null }),
    setLanguage: (lang) => {
      set({ language: lang });
      if (typeof window !== 'undefined') {
        localStorage.setItem('i18nextLng', lang);
      }
    },
    openConfirmDialog: (dialog) => set({ confirmDialog: dialog }),
    closeConfirmDialog: () => set({ confirmDialog: null }),
    openRightPanel: (content, id) => set({ rightPanelContent: content, rightPanelId: id }),
    closeRightPanel: (id) =>
      set((state) => {
        // If no id provided, force close. If id provided, only close if it matches.
        if (!id || state.rightPanelId === id) {
          return { rightPanelContent: null, rightPanelId: null };
        }
        return state;
      }),
  },
}));

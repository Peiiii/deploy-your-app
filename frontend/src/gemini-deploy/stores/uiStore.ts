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
  toast: ToastState | null;
  language: string;
  confirmDialog: ConfirmDialogState | null;
  actions: {
    toggleTheme: () => void;
    toggleSidebar: () => void;
    setSidebarOpen: (open: boolean) => void;
    showToast: (toast: ToastState) => void;
    clearToast: () => void;
    setLanguage: (lang: string) => void;
    openConfirmDialog: (dialog: ConfirmDialogState) => void;
    closeConfirmDialog: () => void;
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
  toast: null,
  language: getInitialLanguage(),
  confirmDialog: null,
  actions: {
    toggleTheme: () =>
      set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
    toggleSidebar: () =>
      set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
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
  },
}));

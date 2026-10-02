import { create } from 'zustand';
import {
  APP_LANGUAGE_KEY,
  browserAppLanguages,
  readLanguagePreference,
} from '@/features/explore/stores/language-preference';

function browserLanguages(): readonly string[] {
  return typeof navigator === 'undefined'
    ? []
    : navigator.languages?.length
      ? navigator.languages
      : [navigator.language];
}

function initialPreference() {
  try {
    return readLanguagePreference(window.localStorage, browserLanguages());
  } catch {
    return readLanguagePreference(undefined, browserLanguages());
  }
}

interface AppLanguageState {
  languages: string[] | null;
  automatic: boolean;
  availableLanguages: string[];
  actions: {
    select: (languages: string[] | null) => void;
    toggle: (code: string) => void;
    resetAutomatic: () => void;
    setAvailable: (languages: string[]) => void;
  };
}

export const useAppLanguageStore = create<AppLanguageState>((set, get) => ({
  ...initialPreference(),
  availableLanguages: ['zh', 'en', 'th'],
  actions: {
    select: (languages) => {
      const selected = languages ? [...new Set(languages)].slice(0, 8) : null;
      if (selected?.length === 0) return;
      try {
        localStorage.setItem(APP_LANGUAGE_KEY, JSON.stringify({ languages: selected }));
      } catch {
        /* Session selection still works. */
      }
      set({ languages: selected, automatic: false });
    },
    toggle: (code) => {
      const selected = get().languages;
      const next = !selected
        ? [code]
        : selected.includes(code)
          ? selected.length > 1
            ? selected.filter((value) => value !== code)
            : selected
          : [...selected, code];
      get().actions.select(next);
    },
    resetAutomatic: () => {
      try {
        localStorage.removeItem(APP_LANGUAGE_KEY);
      } catch {
        /* Session automatic selection still works. */
      }
      set({ languages: browserAppLanguages(browserLanguages()), automatic: true });
    },
    setAvailable: (availableLanguages) => set({ availableLanguages }),
  },
}));

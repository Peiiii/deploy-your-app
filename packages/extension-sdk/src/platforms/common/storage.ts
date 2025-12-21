/**
 * Common Storage Implementation
 *
 * localStorage-based storage that can be used by web and as fallback.
 */

import type { StorageAPI } from '../../types';

const localStoragePrefix = (): string => {
  const origin =
    typeof window === 'undefined' ? 'unknown' : window.location.origin.replace(/[:/]/g, '_');
  return `gemigo:${origin}:`;
};

/**
 * localStorage-based storage implementation.
 * Used by web platform and as fallback for other platforms.
 */
export const localStorageImpl: StorageAPI = {
  get: async <T = unknown>(key: string): Promise<T | null> => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(`${localStoragePrefix()}${key}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  set: async (key: string, value: unknown): Promise<void> => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(`${localStoragePrefix()}${key}`, JSON.stringify(value));
  },

  delete: async (key: string): Promise<void> => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(`${localStoragePrefix()}${key}`);
  },

  clear: async (): Promise<void> => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const prefix = localStoragePrefix();
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const itemKey = window.localStorage.key(i);
      if (itemKey && itemKey.startsWith(prefix)) {
        window.localStorage.removeItem(itemKey);
      }
    }
  },
};

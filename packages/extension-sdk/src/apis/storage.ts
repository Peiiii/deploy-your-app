/**
 * Storage API Implementation
 *
 * Provides persistent key-value storage.
 * Uses chrome.storage in extension, localStorage in web.
 */

import { getHost } from '../core';
import { state, throwNotSupported, SDKError } from './platform';
import type { StorageAPI } from '../types';

// ========== Web Storage (fallback) ==========

const localStoragePrefix = (): string => {
  const origin =
    typeof window === 'undefined' ? 'unknown' : window.location.origin.replace(/[:/]/g, '_');
  return `gemigo:${origin}:`;
};

const webStorage = {
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

// ========== Storage API ==========

export const storageAPI: StorageAPI = {
  get: async <T = unknown>(key: string): Promise<T | null> => {
    if (state.platform === 'extension') {
      const host = await getHost();
      if (typeof host.storageGet !== 'function') {
        return throwNotSupported('storage.get');
      }
      const res = await host.storageGet(key);
      if (!res?.success) return null;
      return (res.value ?? null) as T | null;
    }
    return webStorage.get<T>(key);
  },

  set: async (key: string, value: unknown): Promise<void> => {
    if (state.platform === 'extension') {
      const host = await getHost();
      if (typeof host.storageSet !== 'function') {
        return throwNotSupported('storage.set');
      }
      const res = await host.storageSet(key, value);
      if (!res?.success) {
        throw new SDKError('INTERNAL_ERROR', 'Failed to set storage value.');
      }
      return;
    }
    return webStorage.set(key, value);
  },

  delete: async (key: string): Promise<void> => {
    if (state.platform === 'extension') {
      const host = await getHost();
      if (typeof host.storageDelete !== 'function') {
        return throwNotSupported('storage.delete');
      }
      const res = await host.storageDelete(key);
      if (!res?.success) {
        throw new SDKError('INTERNAL_ERROR', 'Failed to delete storage value.');
      }
      return;
    }
    return webStorage.delete(key);
  },

  clear: async (): Promise<void> => {
    if (state.platform === 'extension') {
      const host = await getHost();
      if (typeof host.storageClear !== 'function') {
        return throwNotSupported('storage.clear');
      }
      const res = await host.storageClear();
      if (!res?.success) {
        throw new SDKError('INTERNAL_ERROR', 'Failed to clear storage.');
      }
      return;
    }
    return webStorage.clear();
  },
};

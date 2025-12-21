/**
 * Storage API
 *
 * Uses host storage if available, otherwise falls back to localStorage.
 */

import { tryGetHost } from '../core';
import { fallbackStorage } from '../fallback';
import type { StorageAPI } from '../types';

class SDKError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'SDKError';
  }
}

export const storageAPI: StorageAPI = {
  get: async <T = unknown>(key: string): Promise<T | null> => {
    const host = await tryGetHost();
    if (host && typeof host.storageGet === 'function') {
      const res = await host.storageGet(key);
      if (!res?.success) return null;
      return (res.value ?? null) as T | null;
    }
    return fallbackStorage.get<T>(key);
  },

  set: async (key: string, value: unknown): Promise<void> => {
    const host = await tryGetHost();
    if (host && typeof host.storageSet === 'function') {
      const res = await host.storageSet(key, value);
      if (!res?.success) {
        throw new SDKError('INTERNAL_ERROR', 'Failed to set storage value.');
      }
      return;
    }
    return fallbackStorage.set(key, value);
  },

  delete: async (key: string): Promise<void> => {
    const host = await tryGetHost();
    if (host && typeof host.storageDelete === 'function') {
      const res = await host.storageDelete(key);
      if (!res?.success) {
        throw new SDKError('INTERNAL_ERROR', 'Failed to delete storage value.');
      }
      return;
    }
    return fallbackStorage.delete(key);
  },

  clear: async (): Promise<void> => {
    const host = await tryGetHost();
    if (host && typeof host.storageClear === 'function') {
      const res = await host.storageClear();
      if (!res?.success) {
        throw new SDKError('INTERNAL_ERROR', 'Failed to clear storage.');
      }
      return;
    }
    return fallbackStorage.clear();
  },
};

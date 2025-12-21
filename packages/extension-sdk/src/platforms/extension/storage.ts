/**
 * Extension Platform - Storage Implementation
 * 
 * Uses Host RPC for chrome.storage access.
 */

import { getHost } from './connection';
import type { StorageAPI } from '../../types';

class SDKError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'SDKError';
  }
}

const throwNotSupported = (feature: string): never => {
  throw new SDKError('NOT_SUPPORTED', `${feature} is not supported.`);
};

export const extensionStorage: StorageAPI = {
  get: async <T = unknown>(key: string): Promise<T | null> => {
    const host = await getHost();
    if (typeof host.storageGet !== 'function') {
      return throwNotSupported('storage.get');
    }
    const res = await host.storageGet(key);
    if (!res?.success) return null;
    return (res.value ?? null) as T | null;
  },

  set: async (key: string, value: unknown): Promise<void> => {
    const host = await getHost();
    if (typeof host.storageSet !== 'function') {
      return throwNotSupported('storage.set');
    }
    const res = await host.storageSet(key, value);
    if (!res?.success) {
      throw new SDKError('INTERNAL_ERROR', res.error || 'Failed to set storage value.');
    }
  },

  delete: async (key: string): Promise<void> => {
    const host = await getHost();
    if (typeof host.storageDelete !== 'function') {
      return throwNotSupported('storage.delete');
    }
    const res = await host.storageDelete(key);
    if (!res?.success) {
      throw new SDKError('INTERNAL_ERROR', res.error || 'Failed to delete storage value.');
    }
  },

  clear: async (): Promise<void> => {
    const host = await getHost();
    if (typeof host.storageClear !== 'function') {
      return throwNotSupported('storage.clear');
    }
    const res = await host.storageClear();
    if (!res?.success) {
      throw new SDKError('INTERNAL_ERROR', res.error || 'Failed to clear storage.');
    }
  },
};

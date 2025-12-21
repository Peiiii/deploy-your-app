/**
 * Extension Storage Adapter
 *
 * Uses Host RPC for storage in browser extension environment.
 */

import { getHost } from '../../../core';
import { throwNotSupported, SDKError } from '../../platform';
import type { StorageAdapter } from './types';

export const extensionStorageAdapter: StorageAdapter = {
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

/**
 * Storage API
 *
 * Uses host storage if available, otherwise falls back to localStorage.
 */

import { createUnifiedAPI } from '../core';
import { fallbackStorage } from '../fallback';
import type { StorageAPI } from '../types';

export const { api: storageAPI } = createUnifiedAPI<StorageAPI>({
  rpc: {
    methods: ['get', 'set', 'delete', 'clear'],
    mapping: {
      get: 'storageGet',
      set: 'storageSet',
      delete: 'storageDelete',
      clear: 'storageClear',
    },
    fallbacks: {
      get: (key: string) => fallbackStorage.get(key),
      set: (key: string, value: unknown) => fallbackStorage.set(key, value),
      delete: (key: string) => fallbackStorage.delete(key),
      clear: () => fallbackStorage.clear(),
    },
  },
});


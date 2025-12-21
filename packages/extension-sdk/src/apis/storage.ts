/**
 * Storage API
 *
 * Uses host storage if available, otherwise falls back to localStorage.
 */

import { createRPCProxy } from '../core';
import { fallbackStorage } from '../fallback';
import type { StorageAPI } from '../types';

export const storageAPI = createRPCProxy<StorageAPI>(
  ['get', 'set', 'delete', 'clear'],
  {
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
  }
);

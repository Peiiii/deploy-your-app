/**
 * Storage API
 *
 * Provides persistent key-value storage.
 * Automatically selects the appropriate adapter based on platform.
 */

import { state } from '../platform';
import { webStorageAdapter, extensionStorageAdapter } from './adapters';
import type { StorageAdapter } from './adapters';
import type { StorageAPI } from '../../types';

/**
 * Get the storage adapter for the current platform.
 */
const getAdapter = (): StorageAdapter => {
  switch (state.platform) {
    case 'extension':
      return extensionStorageAdapter;
    case 'desktop':
      // TODO: implement desktop adapter
      return webStorageAdapter;
    case 'web':
    default:
      return webStorageAdapter;
  }
};

/**
 * Storage API implementation.
 * Delegates to the appropriate platform adapter.
 */
export const storageAPI: StorageAPI = {
  get: <T = unknown>(key: string) => getAdapter().get<T>(key),
  set: (key: string, value: unknown) => getAdapter().set(key, value),
  delete: (key: string) => getAdapter().delete(key),
  clear: () => getAdapter().clear(),
};

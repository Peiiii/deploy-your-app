/**
 * Storage Host Methods
 * 
 * Provides per-app isolated storage using chrome.storage.local.
 */

const storageKey = (appId: string, key: string): string => `app:${appId}:${key}`;

const chromeStorageGet = async (key: string): Promise<unknown | undefined> => {
  const stored = await chrome.storage.local.get([key]);
  return stored[key];
};

const chromeStorageSet = async (key: string, value: unknown): Promise<void> => {
  await chrome.storage.local.set({ [key]: value });
};

const chromeStorageRemove = async (key: string): Promise<void> => {
  await chrome.storage.local.remove([key]);
};

const chromeStorageClearPrefix = async (prefix: string): Promise<void> => {
  const all = await chrome.storage.local.get(null);
  const keysToRemove = Object.keys(all).filter((k) => k.startsWith(prefix));
  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
  }
};

/**
 * Create storage methods for a specific app.
 */
export const createStorageMethods = (appId: string) => ({
  async storageGet(key: string) {
    const value = await chromeStorageGet(storageKey(appId, key));
    return { success: true, value };
  },

  async storageSet(key: string, value: unknown) {
    await chromeStorageSet(storageKey(appId, key), value);
    return { success: true };
  },

  async storageDelete(key: string) {
    await chromeStorageRemove(storageKey(appId, key));
    return { success: true };
  },

  async storageClear() {
    await chromeStorageClearPrefix(`app:${appId}:`);
    return { success: true };
  },
});

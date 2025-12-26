/**
 * Storage API types
 */

/** Storage API for persistent key-value storage */
export interface StorageAPI {
  /**
   * Get a stored value
   * @param key - Storage key
   * @returns The stored value or null if not found
   */
  get<T = unknown>(key: string): Promise<T | null>;

  /**
   * Store a value
   * @param key - Storage key
   * @param value - Value to store (will be JSON serialized)
   */
  set(key: string, value: unknown): Promise<void>;

  /**
   * Delete a stored value
   * @param key - Storage key
   */
  delete(key: string): Promise<void>;

  /**
   * Clear all data for the current app
   */
  clear(): Promise<void>;
}

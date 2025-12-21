/**
 * Storage Adapter Interface
 *
 * Defines the contract for platform-specific storage implementations.
 */

/**
 * Storage adapter interface - implemented by each platform.
 */
export interface StorageAdapter {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Platform Adapter Interface
 *
 * Defines the contract that each platform must implement.
 */

import type {
  StorageAPI,
  NetworkAPI,
  NotifyOptions,
  NotifyResult,
  ExtensionAPI,
  Platform,
  Capabilities,
} from '../../types';

/**
 * Platform adapter - each platform implements this interface.
 */
export interface PlatformAdapter {
  /** Platform identifier */
  readonly platform: Platform;

  /** Available capabilities */
  readonly capabilities: Capabilities;

  /** Storage API */
  readonly storage: StorageAPI;

  /** Network API (may throw NOT_SUPPORTED) */
  readonly network: NetworkAPI;

  /** Notification function */
  notify(options: NotifyOptions): Promise<NotifyResult>;

  /** Extension API (only available on extension platform) */
  readonly extension?: ExtensionAPI;
}

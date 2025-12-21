/**
 * Shared Types for Sidepanel
 */

/**
 * App permission types.
 */
export type AppPermission = 'extension.modify' | 'extension.capture' | 'network';

/**
 * App configuration passed to AppContainer.
 */
export interface AppConfig {
  id: string;
  name: string;
  icon: string;
  url: string;
  permissions?: AppPermission[];
  networkAllowlist?: string[];
}

/**
 * Result type for operations that may fail.
 */
export interface OperationResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

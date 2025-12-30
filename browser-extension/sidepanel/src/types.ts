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
  thumbnailUrl?: string;
}

import type { HostMethods, ChildMethods } from '@gemigo/app-sdk';

/**
 * Result type for operations that may fail.
 */
export interface OperationResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

/**
 * Handlers specifically implemented within the Sidepanel environment.
 */
export type SidepanelHandlers = Pick<HostMethods,
  | 'getProtocolInfo'
  | 'storageGet'
  | 'storageSet'
  | 'storageDelete'
  | 'storageClear'
>;

/**
 * Events that the Sidepanel listens to (from Background/Content) and bridges to the App.
 */
export type SidepanelEvents = Pick<ChildMethods,
  | 'onSelectionChange'
  | 'onContextMenu'
>;


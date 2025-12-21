/**
 * Platforms Module
 *
 * Export platform adapters and common utilities.
 */

export type { PlatformAdapter } from './common';
export { localStorageImpl, webNotifyImpl } from './common';

export { webAdapter } from './web';
export { extensionAdapter, initExtensionPlatform, getHost, initConnection } from './extension';
export type { HostMethods, ChildMethods } from './extension';

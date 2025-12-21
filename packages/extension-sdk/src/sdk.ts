/**
 * GemiGo App SDK (unified)
 *
 * One SDK entry that auto-adapts for web/desktop/extension.
 * - Extension: connects to sidepanel host via penpal (RPC)
 * - Desktop: (reserved) detects injected bridge
 * - Web: fallback with limited capabilities
 */

import {
  webAdapter,
  extensionAdapter,
  desktopAdapter,
  initExtensionPlatform,
} from './platforms';
import type { PlatformAdapter } from './platforms';
import type { GemigoSDK, Platform } from './types';

// ========== Platform Detection ==========

const isProbablyExtensionHost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ancestorOrigins = (window.location as unknown as { ancestorOrigins?: unknown })
    .ancestorOrigins;
  if (!ancestorOrigins) return false;

  const origins: string[] = [];
  if (typeof (ancestorOrigins as { length?: unknown }).length === 'number') {
    const length = (ancestorOrigins as { length: number }).length;
    for (let i = 0; i < length; i += 1) {
      const origin =
        (ancestorOrigins as Record<number, unknown>)[i] ??
        (ancestorOrigins as { item?: (index: number) => unknown }).item?.(i);
      if (typeof origin === 'string') origins.push(origin);
    }
  }
  return origins.some((origin) => origin.startsWith('chrome-extension://'));
};

const hasDesktopBridge = (): boolean => {
  if (typeof window === 'undefined') return false;
  return typeof (window as unknown as { __GEMIGO_DESKTOP_BRIDGE__?: unknown })
    .__GEMIGO_DESKTOP_BRIDGE__ !== 'undefined';
};

const detectPlatform = (): Platform => {
  if (hasDesktopBridge()) return 'desktop';
  if (isProbablyExtensionHost()) return 'extension';
  return 'web';
};

// ========== Select Adapter ==========

const getAdapter = (): PlatformAdapter => {
  const platform = detectPlatform();
  switch (platform) {
    case 'extension':
      return extensionAdapter;
    case 'desktop':
      return desktopAdapter;
    case 'web':
    default:
      return webAdapter;
  }
};

const adapter = getAdapter();

// ========== Stub APIs (not yet implemented) ==========

const notSupportedAsync = <T = never>(feature: string) => async (): Promise<T> => {
  throw new Error(`${feature} is not supported in this environment.`);
};

const notSupportedHandler = <T = never>(feature: string) => (): T => {
  throw new Error(`${feature} is not supported in this environment.`);
};

// ========== Main SDK Object ==========

const sdk: GemigoSDK = {
  // Environment
  get platform() {
    return adapter.platform;
  },
  get capabilities() {
    return adapter.capabilities;
  },

  // Core APIs from adapter
  storage: adapter.storage,
  network: adapter.network,
  notify: adapter.notify as GemigoSDK['notify'],

  // Extension API (only on extension)
  extension: adapter.extension,

  // Stub APIs (not yet implemented)
  onNotificationAction: notSupportedHandler('onNotificationAction') as GemigoSDK['onNotificationAction'],
  ai: {
    chat: notSupportedAsync('ai.chat'),
    summarize: notSupportedAsync('ai.summarize'),
    translate: notSupportedAsync('ai.translate'),
  },
  clipboard: {
    readText: notSupportedAsync('clipboard.readText'),
    writeText: notSupportedAsync('clipboard.writeText'),
    readImage: notSupportedAsync('clipboard.readImage'),
    writeImage: notSupportedAsync('clipboard.writeImage'),
    onChange: notSupportedHandler('clipboard.onChange'),
  },
  dialog: {
    openFile: notSupportedAsync('dialog.openFile'),
    openDirectory: notSupportedAsync('dialog.openDirectory'),
    saveFile: notSupportedAsync('dialog.saveFile'),
    message: notSupportedAsync('dialog.message'),
  },
  onFileDrop: notSupportedHandler('onFileDrop') as GemigoSDK['onFileDrop'],
  file: {
    readText: notSupportedAsync('file.readText'),
    readBinary: notSupportedAsync('file.readBinary'),
    write: notSupportedAsync('file.write'),
    append: notSupportedAsync('file.append'),
    exists: notSupportedAsync('file.exists'),
    stat: notSupportedAsync('file.stat'),
    copy: notSupportedAsync('file.copy'),
    move: notSupportedAsync('file.move'),
    remove: notSupportedAsync('file.remove'),
    list: notSupportedAsync('file.list'),
    mkdir: notSupportedAsync('file.mkdir'),
    persistPermission: notSupportedAsync('file.persistPermission'),
  },
};

// Best-effort eager init for extension apps
if (detectPlatform() === 'extension') {
  initExtensionPlatform();
}

// Re-export error for backwards compatibility
export class SDKError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'SDKError';
  }
}

export type SDKErrorCode =
  | 'NOT_SUPPORTED'
  | 'PERMISSION_DENIED'
  | 'NETWORK_NOT_ALLOWED'
  | 'TIMEOUT'
  | 'INTERNAL_ERROR';

export default sdk;

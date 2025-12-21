/**
 * GemiGo App SDK (unified)
 *
 * One SDK that works across all platforms: Web, Extension, Desktop.
 * Uses Penpal for host communication, with fallbacks for no-host scenarios.
 */

import { tryGetHost, initConnection } from './core';
import {
  storageAPI,
  networkAPI,
  notify,
  extensionAPI,
  childMethods,
  aiAPI,
  clipboardAPI,
  dialogAPI,
  fileAPI,
  onNotificationAction,
  onFileDrop,
} from './apis';
import type {
  GemigoSDK,
  Platform,
  Capabilities,
} from './types';

// ========== SDK Error ==========

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
  | 'INTERNAL_ERROR'
  | 'NOT_CONNECTED';

// ========== State ==========

let hostInfo: { platform: Platform; capabilities: Capabilities } | null = null;

const defaultCapabilities: Capabilities = {
  storage: true,
  network: false,
  scheduler: false,
  fileWatch: false,
  fileWrite: false,
  notification: true,
  clipboard: false,
  ai: false,
  shell: false,
  extension: { read: false, events: false, modify: false, capture: false },
};

// ========== Init ==========

async function initSDK(): Promise<void> {
  initConnection(childMethods, { timeoutMs: 1500 });
  const host = await tryGetHost();
  if (host && typeof host.getProtocolInfo === 'function') {
    try {
      const info = await host.getProtocolInfo();
      hostInfo = { platform: info.platform, capabilities: info.capabilities };
    } catch {
      // Use defaults
    }
  }
}

// ========== SDK Object ==========

const sdk: GemigoSDK = {
  get platform(): Platform {
    return hostInfo?.platform ?? 'web';
  },
  get capabilities(): Capabilities {
    return hostInfo?.capabilities ?? defaultCapabilities;
  },

  // Core APIs
  storage: storageAPI,
  network: networkAPI,
  notify: notify as GemigoSDK['notify'],
  extension: extensionAPI,

  // Stubs
  onNotificationAction: onNotificationAction as GemigoSDK['onNotificationAction'],
  ai: aiAPI,
  clipboard: clipboardAPI,
  dialog: dialogAPI,
  onFileDrop: onFileDrop as GemigoSDK['onFileDrop'],
  file: fileAPI,
};

// Eager init
initSDK();

export default sdk;

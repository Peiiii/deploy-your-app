/**
 * GemiGo App SDK (unified)
 *
 * One SDK that works across all platforms: Web, Extension, Desktop.
 * Uses Penpal for host communication, with fallbacks for no-host scenarios.
 */

import {
  sdkBase,
  extensionChildMethods,
} from './apis';
import { initConnection, tryGetHost } from './core';
import type {
  Capabilities,
  GemigoSDK,
  Platform
} from './types';

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
  initConnection(extensionChildMethods, { timeoutMs: 1500 });
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
  ...sdkBase,
};


// Eager init
initSDK();

export default sdk;

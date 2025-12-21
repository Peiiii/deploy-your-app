/**
 * Extension Platform Adapter
 *
 * Provides full SDK capabilities for browser extension environment.
 */

import type { Capabilities } from '../../types';
import type { PlatformAdapter } from '../common';
import { extensionStorage } from './storage';
import { extensionNetwork } from './network';
import { extensionNotify } from './notify';
import { createExtensionAPI, initExtensionAPI } from './extension-api';
import { getHost } from './connection';

// Will be updated after protocol handshake
let extensionCapabilities: Capabilities = {
  storage: true,
  network: true,
  scheduler: false,
  fileWatch: false,
  fileWrite: false,
  notification: true,
  clipboard: false,
  ai: false,
  shell: false,
  extension: {
    read: true,
    events: true,
    modify: true,
    capture: true,
  },
};

/**
 * Initialize extension platform and get capabilities from host.
 */
export async function initExtensionPlatform(): Promise<void> {
  initExtensionAPI();
  try {
    const host = await getHost();
    if (typeof host.getProtocolInfo === 'function') {
      const info = await host.getProtocolInfo();
      extensionCapabilities = info.capabilities;
    }
  } catch {
    console.debug('[GemiGo SDK] Extension platform init pending...');
  }
}

/**
 * Extension Platform Adapter
 */
export const extensionAdapter: PlatformAdapter = {
  platform: 'extension',
  get capabilities() {
    return extensionCapabilities;
  },
  storage: extensionStorage,
  network: extensionNetwork,
  notify: extensionNotify,
  extension: createExtensionAPI(),
};

// Export connection for backward compatibility
export { getHost, initConnection } from './connection';
export type { HostMethods, ChildMethods } from './connection';

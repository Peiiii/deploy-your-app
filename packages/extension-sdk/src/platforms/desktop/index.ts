/**
 * Desktop Platform Adapter
 *
 * Provides SDK capabilities for Electron/desktop environment.
 * Uses window.__GEMIGO_DESKTOP_BRIDGE__ for native APIs.
 *
 * TODO: Implement when desktop bridge is ready.
 */

import type { Capabilities, NetworkAPI } from '../../types';
import type { PlatformAdapter } from '../common';
import { localStorageImpl, webNotifyImpl } from '../common';

/**
 * Create a "not yet implemented" network API.
 */
const notImplementedNetwork: NetworkAPI = {
  request: async () => {
    throw new Error('network.request is not yet implemented for desktop.');
  },
};

/**
 * Desktop capabilities (to be updated when bridge is ready)
 */
const desktopCapabilities: Capabilities = {
  storage: true,
  network: false, // TODO: implement via bridge
  scheduler: false, // TODO: implement
  fileWatch: false, // TODO: implement
  fileWrite: false, // TODO: implement
  notification: true,
  clipboard: false, // TODO: implement
  ai: false,
  shell: false, // TODO: implement
  extension: {
    read: false,
    events: false,
    modify: false,
    capture: false,
  },
};

/**
 * Desktop Platform Adapter
 *
 * Currently uses web fallbacks. Will be enhanced when
 * __GEMIGO_DESKTOP_BRIDGE__ is implemented.
 */
export const desktopAdapter: PlatformAdapter = {
  platform: 'desktop',
  capabilities: desktopCapabilities,
  storage: localStorageImpl, // TODO: use bridge storage
  network: notImplementedNetwork,
  notify: webNotifyImpl, // TODO: use native notifications
  extension: undefined,
};

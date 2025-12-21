/**
 * Web Platform Adapter
 *
 * Provides limited capabilities for running in a regular web page.
 */

import type { Capabilities, NetworkAPI } from '../../types';
import type { PlatformAdapter } from '../common';
import { localStorageImpl, webNotifyImpl } from '../common';

/**
 * Create a "not supported" network API.
 */
const notSupportedNetwork: NetworkAPI = {
  request: async () => {
    throw new Error('network.request is not supported in web environment.');
  },
};

/**
 * Default web capabilities
 */
const webCapabilities: Capabilities = {
  storage: true,
  network: false,
  scheduler: false,
  fileWatch: false,
  fileWrite: false,
  notification: true,
  clipboard: false,
  ai: false,
  shell: false,
  extension: {
    read: false,
    events: false,
    modify: false,
    capture: false,
  },
};

/**
 * Web Platform Adapter
 */
export const webAdapter: PlatformAdapter = {
  platform: 'web',
  capabilities: webCapabilities,
  storage: localStorageImpl,
  network: notSupportedNetwork,
  notify: webNotifyImpl,
  extension: undefined,
};

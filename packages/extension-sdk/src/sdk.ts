/**
 * GemiGo App SDK (unified)
 *
 * One SDK entry that auto-adapts for web/desktop/extension.
 * - Extension: connects to sidepanel host via penpal (RPC)
 * - Desktop: (reserved) detects injected bridge
 * - Web: fallback with limited capabilities
 */

import {
  state,
  initExtensionConnection,
  extensionAPI,
  storageAPI,
  networkAPI,
  notify,
  aiAPI,
  clipboardAPI,
  dialogAPI,
  fileAPI,
  onNotificationAction,
  onFileDrop,
} from './apis';
import type { GemigoSDK, NotifyResult } from './types';

// Re-export error types
export { SDKError } from './apis';
export type { SDKErrorCode } from './apis';

// ========== Main SDK Object ==========

const sdk: GemigoSDK = {
  // Environment
  get platform() {
    return state.platform;
  },
  get capabilities() {
    return state.capabilities;
  },

  // Core APIs
  storage: storageAPI,
  notify: notify as GemigoSDK['notify'],
  onNotificationAction,
  ai: aiAPI,
  clipboard: clipboardAPI,
  dialog: dialogAPI,
  onFileDrop,
  file: fileAPI,
  network: networkAPI,

  // Extension API
  extension: extensionAPI,
};

// Best-effort eager init for extension apps so event callbacks work immediately.
initExtensionConnection();

export default sdk;

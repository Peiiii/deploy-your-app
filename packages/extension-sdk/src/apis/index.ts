/**
 * API module exports
 */

// Platform detection and state
export {
  state,
  SDKError,
  initExtensionConnection,
} from './platform';
export type { SDKErrorCode } from './platform';

// Core APIs
export { extensionAPI } from './extension';
export { storageAPI } from './storage';
export { networkAPI } from './network';
export { notify } from './notify';

// Stub APIs (not implemented)
export {
  aiAPI,
  clipboardAPI,
  dialogAPI,
  fileAPI,
  onNotificationAction,
  onFileDrop,
} from './stubs';


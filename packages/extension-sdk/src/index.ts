/**
 * GemiGo App SDK (unified)
 * 
 * One SDK that auto-adapts for Web / Desktop / Browser Extension.
 * Main entry point for the SDK library.
 */

import { sdk as gemigo, childMethods, updateHostInfo } from './apis';
import { SDKError } from './types';
import { bootstrapSDK } from './core';


// ========== Centralized Initialization ==========

// Perform bootstrap connection and protocol discovery eagerly
bootstrapSDK(childMethods, { timeoutMs: 1500 }).then((info) => {
    if (info) updateHostInfo(info);
});


// ========== Compatibility ==========

// Attach SDKError for advanced use (optional global access)
(gemigo as unknown as { SDKError?: typeof SDKError }).SDKError = SDKError;

export default gemigo;

// ========== Exports ==========

// Type-only exports (no runtime named exports, so UMD stays compatible)
export type * from './types';
export type { SDKError, SDKErrorCode } from './types';

// Host-side types (for implementing host adapters)
export type { HostMethods, ChildMethods } from './core';

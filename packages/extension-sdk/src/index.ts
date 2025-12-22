/**
 * GemiGo App SDK (unified)
 * 
 * One SDK that auto-adapts for Web / Desktop / Browser Extension.
 * 
 * Usage (CDN):
 *   <script src="https://unpkg.com/@gemigo/app-sdk/dist/gemigo-app-sdk.umd.js"></script>
 *   <script>
 *     gemigo.extension?.getPageInfo().then(console.log);
 *     
 *     gemigo.extension?.onContextMenu((event) => {
 *       console.log('Context menu clicked:', event);
 *     });
 *   </script>
 * 
 * Usage (ES Module):
 *   import gemigo from '@gemigo/app-sdk';
 *   
 *   const pageInfo = await gemigo.extension?.getPageInfo();
 */

import gemigo from './sdk';
import { SDKError } from './types';

// Keep current (browser) usage unchanged:
// - UMD global `gemigo` is the SDK instance (not `{ default: ... }`)
// - Attach `SDKError` for advanced use (optional)
(gemigo as unknown as { SDKError?: typeof SDKError }).SDKError = SDKError;

export default gemigo;

// Type-only exports (no runtime named exports, so UMD stays compatible)
export type * from './types';
export type { SDKError, SDKErrorCode } from './types';


// Host-side types (for implementing host adapters)
export type { HostMethods, ChildMethods } from './core';


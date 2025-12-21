/**
 * GemiGo Extension SDK
 * 
 * SDK for building apps that run inside the GemiGo browser extension.
 * 
 * Usage (CDN):
 *   <script src="https://unpkg.com/@gemigo/extension-sdk/dist/gemigo-extension-sdk.umd.js"></script>
 *   <script>
 *     gemigo.getPageInfo().then(console.log);
 *     
 *     gemigo.extension.onContextMenu((event) => {
 *       console.log('Context menu clicked:', event);
 *     });
 *   </script>
 * 
 * Usage (ES Module):
 *   import gemigo from '@gemigo/extension-sdk';
 *   
 *   const pageInfo = await gemigo.getPageInfo();
 */

// ========== Type Exports ==========
export * from './types';

// ========== SDK Instance ==========
export { default } from './sdk';
export type { SDKInstance } from './sdk';

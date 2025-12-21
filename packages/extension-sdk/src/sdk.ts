/**
 * GemiGo SDK Instance
 * 
 * Assembles all API modules into the final SDK object.
 */

import { getHost, initConnection, getChildMethods } from './core';
import { extensionAPI } from './apis';

/**
 * SDK interface for current implementation
 * (Subset of full GemigoSDK - only extension platform is implemented)
 */
export interface SDKInstance {
  /** Send system notification */
  notify(title: string, message: string): Promise<{ success: boolean }>;

  /** Extension-specific APIs */
  extension: typeof extensionAPI;
}

/**
 * Create the SDK instance
 */
function createSDK(): SDKInstance {
  return {
    // --- Common Methods ---
    notify: (title: string, message: string) =>
      getHost().then(host => host.notify({ title, message })),

    // --- Extension Platform APIs ---
    extension: extensionAPI,
  };
}

// Create singleton instance
const sdk = createSDK();

// Initialize connection with event handlers
initConnection(getChildMethods());

export default sdk;

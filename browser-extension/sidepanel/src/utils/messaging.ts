/**
 * Chrome Runtime Messaging Utilities
 *
 * Provides a generic, type-safe wrapper around chrome.runtime.sendMessage.
 * Completely decoupled from specific API business logic.
 */

import type { HostMethods } from '@gemigo/app-sdk';

/**
 * Message Routing Direction
 */
export type Routing = 'background' | 'content-script';

/**
 * Standard RPC Request Structure
 */
export interface RPCRequest {
  type: keyof HostMethods | string;
  payload?: any[];
  routing?: Routing;
}

/**
 * Send a message to the browser extension environment and wait for response.
 * Completely generic and used by Host Method factories to route calls.
 */
export const sendMessage = <T>(request: RPCRequest): Promise<T> =>
  new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(request, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response as T);
      }
    });
  });

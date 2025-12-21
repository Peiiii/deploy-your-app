/**
 * Chrome Runtime Messaging Utilities
 * 
 * Provides type-safe wrappers around chrome.runtime.sendMessage
 * with proper error handling.
 */

/**
 * Send a message to the service worker and wait for response.
 * Rejects if chrome.runtime.lastError is set.
 */
export const sendMessage = <T>(message: unknown): Promise<T> =>
  new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response as T);
      }
    });
  });

/**
 * Execute a command in the active tab's page context via content script.
 */
export const executeInPage = <T>(
  type: string,
  payload?: Record<string, unknown>
): Promise<T> =>
  sendMessage<T>({
    type: 'EXECUTE_IN_PAGE',
    payload: { type, ...payload },
  });

/**
 * Get info about the current page (URL, title, favicon).
 */
export const getPageInfo = <T>(): Promise<T> =>
  sendMessage<T>({ type: 'GET_PAGE_INFO' });

/**
 * Capture visible tab screenshot.
 */
export const captureVisible = <T>(): Promise<T> =>
  sendMessage<T>({ type: 'CAPTURE_VISIBLE' });

/**
 * Send a network request via service worker proxy.
 */
export const networkRequest = <T>(payload: {
  url: string;
  options?: unknown;
}): Promise<T> =>
  sendMessage<T>({ type: 'NETWORK_REQUEST', payload });

/**
 * Show a notification via service worker.
 */
export const notify = <T>(options: { title: string; message: string }): Promise<T> =>
  sendMessage<T>({ type: 'NOTIFY', ...options });

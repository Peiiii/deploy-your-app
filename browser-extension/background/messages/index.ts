/**
 * Background Messages - Unified Handlers
 *
 * Declarative configuration with simple and special handlers.
 * Strictly implements relevant parts of HostMethods and ChildMethods.
 */

import type { HostMethods, ChildMethods, RPCResult, SelectionRect, ContextMenuEvent } from '@gemigo/app-sdk';
import { getActiveTab } from '../utils/tab';

// ========== Simple Handlers ==========

const simpleHandlers = {
  getPageInfo: async () => {
    const tab = await getActiveTab();
    return tab ? { url: tab.url || '', title: tab.title || '', favIconUrl: tab.favIconUrl } : null;
  },

  // EXECUTE_IN_PAGE is now handled by transparent routing

  captureVisible: async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return { success: false, error: 'No active tab' };
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      return { success: true, dataUrl };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  notify: (payload: { title: string; message: string }) =>
    new Promise<RPCResult<string>>((resolve) => {
      chrome.notifications.create(
        `gemigo-${Date.now()}`,
        {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon48.png'),
          title: payload.title || 'GemiGo',
          message: payload.message || '',
        },
        (notificationId) => resolve({ success: true, data: notificationId })
      );
    }),

  onSelectionChange: (text: string, rect: SelectionRect | null, url?: string) => {
    chrome.runtime.sendMessage({ type: 'onSelectionChange', payload: [text, rect, url] }).catch(() => { });
  },

  onContextMenu: (event: ContextMenuEvent) => {
    chrome.runtime.sendMessage({ type: 'onContextMenu', payload: [event] }).catch(() => { });
  },

  ping: async () => ({ pong: true }),
};

// ========== Network Handler ==========

async function handleNetworkRequest(
  url: string,
  options?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string | object;
    responseType?: 'json' | 'text' | 'arraybuffer';
    timeoutMs?: number;
  }
) {
  const method = options?.method || 'GET';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options?.timeoutMs || 30000);

  try {
    const response = await fetch(url, {
      method,
      headers: options?.headers,
      body: options?.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const headers: Record<string, string> = {};
    response.headers.forEach((v, k) => (headers[k] = v));

    let data;
    if (options?.responseType === 'arraybuffer') {
      data = await response.arrayBuffer();
    } else if (options?.responseType === 'text') {
      data = await response.text();
    } else {
      try {
        data = await response.json();
      } catch {
        data = await response.text();
      }
    }

    return { success: true, status: response.status, headers, data };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (String(err).includes('AbortError')) {
      return { success: false, code: 'TIMEOUT', error: 'Request timed out.' };
    }
    return { success: false, code: 'FETCH_ERROR', error: String(err) };
  }
}

// ========== Context Menu Handler ==========

let pendingContextMenuEvent: ContextMenuEvent | null = null;

export function setPendingContextMenuEvent(event: ContextMenuEvent | null) {
  pendingContextMenuEvent = event;
}

async function handleContextMenuEvent() {
  let event = pendingContextMenuEvent;
  if (!event) {
    const stored = await chrome.storage.local.get(['pendingContextMenuEvent']);
    event = stored.pendingContextMenuEvent;
  }

  // Note: timestamps are handled by the background logic
  if (event) {
    pendingContextMenuEvent = null;
    await chrome.storage.local.remove(['pendingContextMenuEvent']);
    return { success: true, event };
  }
  return { success: true, event: undefined };
}

// ========== Special Handlers ==========

const specialHandlers = {
  networkRequest: handleNetworkRequest,
  getContextMenuEvent: handleContextMenuEvent,
};

// ========== Export ==========

/**
 * Registry of all messages handled by the background script.
 * Strictly typed as a subset of HostMethods and ChildMethods.
 */
export const allMessages: Partial<HostMethods & ChildMethods> = {
  ...simpleHandlers,
  ...specialHandlers,
};

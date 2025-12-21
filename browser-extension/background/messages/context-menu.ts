/**
 * Context Menu Messages
 */

import type { MessageHandlerMap } from '../types';

// State
let pendingContextMenuEvent: {
  menuId: string;
  selectionText?: string;
  pageUrl?: string;
  timestamp: number;
} | null = null;

export function setPendingContextMenuEvent(event: typeof pendingContextMenuEvent) {
  pendingContextMenuEvent = event;
}

export const contextMenuMessages: MessageHandlerMap = {
  GET_CONTEXT_MENU_EVENT: async () => {
    let event = pendingContextMenuEvent;

    if (!event) {
      const stored = await chrome.storage.local.get(['pendingContextMenuEvent']);
      event = stored.pendingContextMenuEvent;
    }

    if (event && Date.now() - event.timestamp < 30000) {
      pendingContextMenuEvent = null;
      await chrome.storage.local.remove(['pendingContextMenuEvent']);
      return { success: true, event };
    }

    return { success: false, event: null };
  },

  SELECTION_CHANGED: (message: { text: string; rect: unknown; url: string }) => {
    chrome.runtime.sendMessage({
      type: 'SELECTION_CHANGED',
      text: message.text,
      rect: message.rect,
      url: message.url,
    }).catch(() => {});
    return undefined;
  },
};

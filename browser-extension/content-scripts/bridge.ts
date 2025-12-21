/**
 * GemiGo Content Script - Page Bridge
 *
 * Entry point that dispatches messages to handlers.
 */

import { allMessages } from './messages';

console.log('[GemiGo] Content script loaded on:', window.location.href);

// Message dispatcher
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = (allMessages as any)[message.type];

  if (handler) {
    try {
      const args = Array.isArray(message.payload) ? message.payload : [];
      const result = (handler as any)(...args, sender);
      if (result instanceof Promise) {
        result.then(sendResponse).catch((e) => sendResponse({ error: String(e) }));
        return true;
      }
      sendResponse(result);
    } catch (e) {
      sendResponse({ error: String(e) });
    }
  } else {
    sendResponse({ error: `Unknown message type: ${message.type}` });
  }

  return true;
});

// Selection change tracking
let selectionTimeout: number | null = null;
let lastSelection = '';

document.addEventListener('selectionchange', () => {
  if (selectionTimeout) {
    clearTimeout(selectionTimeout);
  }

  selectionTimeout = window.setTimeout(() => {
    const sel = window.getSelection();
    const text = sel?.toString() || '';

    if (text !== lastSelection) {
      lastSelection = text;

      let rect = null;
      if (sel && sel.rangeCount > 0 && text.length > 0) {
        const range = sel.getRangeAt(0);
        const domRect = range.getBoundingClientRect();
        if (domRect.width > 0 && domRect.height > 0) {
          rect = {
            x: domRect.x + window.scrollX,
            y: domRect.y + window.scrollY,
            width: domRect.width,
            height: domRect.height,
          };
        }
      }

      chrome.runtime.sendMessage({
        type: 'SELECTION_CHANGED',
        payload: [text, rect, window.location.href],
      });
    }
  }, 300);
});

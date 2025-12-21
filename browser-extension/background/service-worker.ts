/**
 * GemiGo Browser Extension - Service Worker
 *
 * Acting as a transparent gateway for cross-layer communication.
 */

import { allMessages, setPendingContextMenuEvent } from './messages';
import { getActiveTab, executeInPage } from './utils/tab';

// ========== Lifecycle Events ==========

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) chrome.sidePanel.open({ tabId: tab.id });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'gemigo-translate', title: 'Translate with GemiGo', contexts: ['selection'] });
  chrome.contextMenus.create({ id: 'gemigo-summarize', title: 'Summarize with GemiGo', contexts: ['selection', 'page'] });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const event = { menuId: String(info.menuItemId).replace('gemigo-', ''), selectionText: info.selectionText, pageUrl: info.pageUrl, timestamp: Date.now() };
  setPendingContextMenuEvent(event);
  await chrome.storage.local.set({ pendingContextMenuEvent: event });
  if (tab?.id) {
    try { await chrome.sidePanel.open({ tabId: tab.id }); } catch (e) { console.error('[GemiGo] SW open sidepanel failed:', e); }
  }
  chrome.runtime.sendMessage({ type: 'onContextMenuEvent', payload: [event] }).catch(() => {});
});

// ========== Transparent Router ==========

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 1. Content Script Routing - THE TRANSPARENT BRIDGE
  if (message.routing === 'content-script') {
    getActiveTab().then(async (tab) => {
      if (!tab?.id) return sendResponse({ error: 'No active tab' });
      try {
        const res = await executeInPage(tab.id, message);
        sendResponse(res);
      } catch (e) {
        sendResponse({ error: String(e) });
      }
    });
    return true;
  }

  // 2. Local Background Processing
  const handler = (allMessages as any)[message.type];
  if (handler) {
    const args = Array.isArray(message.payload) ? message.payload : [];
    const result = (handler as any)(...args, sender);
    if (result instanceof Promise) {
      result.then(sendResponse).catch(e => sendResponse({ error: String(e) }));
      return true;
    }
    if (result !== undefined) sendResponse(result);
  }

  return true;
});

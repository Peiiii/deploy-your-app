/**
 * GemiGo Browser Extension - Service Worker
 *
 * Entry point that sets up lifecycle events and dispatches messages.
 */

import { allMessages, setPendingContextMenuEvent } from './messages';

// ========== Lifecycle Events ==========

// Open Side Panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Register context menus
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'gemigo-translate',
    title: 'Translate with GemiGo',
    contexts: ['selection'],
  });

  chrome.contextMenus.create({
    id: 'gemigo-summarize',
    title: 'Summarize with GemiGo',
    contexts: ['selection', 'page'],
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const menuId = String(info.menuItemId).replace('gemigo-', '');

  const event = {
    menuId,
    selectionText: info.selectionText,
    pageUrl: info.pageUrl,
    timestamp: Date.now(),
  };

  setPendingContextMenuEvent(event);
  await chrome.storage.local.set({ pendingContextMenuEvent: event });

  if (tab?.id) {
    try {
      await chrome.sidePanel.open({ tabId: tab.id });
    } catch (err) {
      console.error('[GemiGo] Failed to open side panel:', err);
    }
  }

  chrome.runtime.sendMessage({ type: 'CONTEXT_MENU_EVENT', event }).catch(() => {});
});

// ========== Message Dispatcher ==========

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = allMessages[message.type];

  if (handler) {
    const result = handler(message, sender);
    if (result instanceof Promise) {
      result.then(sendResponse).catch((e) => sendResponse({ error: String(e) }));
      return true;
    }
    if (result !== undefined) {
      sendResponse(result);
    }
  }

  return true;
});

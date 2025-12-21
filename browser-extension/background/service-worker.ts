// GemiGo Browser Extension - Service Worker

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

// Store pending context menu events
let pendingContextMenuEvent: {
  menuId: string;
  selectionText?: string;
  pageUrl?: string;
  timestamp: number;
} | null = null;

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const menuId = String(info.menuItemId).replace('gemigo-', '');
  
  const event = {
    menuId,
    selectionText: info.selectionText,
    pageUrl: info.pageUrl,
    timestamp: Date.now(),
  };
  
  // Store the event (both in memory and storage for persistence)
  pendingContextMenuEvent = event;
  
  // Also store in chrome.storage for when Side Panel opens fresh
  await chrome.storage.local.set({ pendingContextMenuEvent });
  
  console.log('[GemiGo] Context menu clicked:', menuId, info.selectionText?.slice(0, 50));
  
  // Open side panel
  if (tab?.id) {
    try {
      await chrome.sidePanel.open({ tabId: tab.id });
      console.log('[GemiGo] Side panel opened for tab:', tab.id);
    } catch (err) {
      console.error('[GemiGo] Failed to open side panel:', err);
    }
  }
  
  // Broadcast event to Side Panel (for real-time updates)
  chrome.runtime.sendMessage({ type: 'CONTEXT_MENU_EVENT', event }).catch(() => {
    // Ignore error if no listeners
  });
});

// Ensure content script is injected
async function ensureContentScript(tabId: number): Promise<boolean> {
  try {
    // Try to ping the content script
    const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    return response?.pong === true;
  } catch {
    // Content script not loaded, inject it
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-scripts/bridge.js'],
      });
      return true;
    } catch (err) {
      console.error('[GemiGo] Failed to inject content script:', err);
      return false;
    }
  }
}

// Execute command in page via content script
async function executeInPage(tabId: number, payload: unknown): Promise<unknown> {
  const injected = await ensureContentScript(tabId);
  if (!injected) {
    return { error: 'Failed to inject content script' };
  }
  
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, payload, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[GemiGo] Message error:', chrome.runtime.lastError);
        resolve({ error: chrome.runtime.lastError.message });
      } else {
        resolve(response);
      }
    });
  });
}

// Listen for messages from Side Panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[GemiGo SW] Message:', message.type, 'from:', sender.id);

  if (message.type === 'GET_PAGE_INFO') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab) {
        sendResponse({
          url: tab.url,
          title: tab.title,
          favIconUrl: tab.favIconUrl,
        });
      } else {
        sendResponse({ error: 'No active tab' });
      }
    });
    return true;
  }

  if (message.type === 'EXECUTE_IN_PAGE') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId) {
        const result = await executeInPage(tabId, message.payload);
        sendResponse(result);
      } else {
        sendResponse({ error: 'No active tab' });
      }
    });
    return true;
  }

  if (message.type === 'SHOW_NOTIFICATION') {
    const { title, message: msg } = message.payload;
    chrome.notifications.create(
      `gemigo-${Date.now()}`,
      {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon48.png'),
        title: title || 'GemiGo',
        message: msg || '',
      },
      (notificationId) => {
        sendResponse({ success: true, notificationId });
      }
    );
    return true;
  }

  if (message.type === 'CAPTURE_VISIBLE') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        sendResponse({ error: 'No active tab' });
        return;
      }
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
          format: 'png',
        });
        sendResponse({ success: true, dataUrl });
      } catch (err) {
        console.error('[GemiGo] Capture error:', err);
        sendResponse({ error: String(err) });
      }
    });
    return true;
  }

  if (message.type === 'GET_CONTEXT_MENU_EVENT') {
    // Use async wrapper
    (async () => {
      // Check memory first, then storage
      let event = pendingContextMenuEvent;
      
      if (!event) {
        // Try to get from storage
        const stored = await chrome.storage.local.get(['pendingContextMenuEvent']);
        event = stored.pendingContextMenuEvent;
      }
      
      if (event && Date.now() - event.timestamp < 30000) {
        // Clear both memory and storage
        pendingContextMenuEvent = null;
        await chrome.storage.local.remove(['pendingContextMenuEvent']);
        sendResponse({ success: true, event });
      } else {
        sendResponse({ success: false, event: null });
      }
    })();
    return true;
  }

  // Forward selection change events from content script to sidepanel
  if (message.type === 'SELECTION_CHANGED') {
    chrome.runtime.sendMessage({
      type: 'SELECTION_CHANGED',
      selection: message.selection,
      url: message.url,
    }).catch(() => {
      // Ignore if no listeners
    });
    return false; // No response needed
  }
});

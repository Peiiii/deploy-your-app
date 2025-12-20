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

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'gemigo-translate' && info.selectionText) {
    console.log('Translate:', info.selectionText);
  }

  if (info.menuItemId === 'gemigo-summarize') {
    console.log('Summarize:', info.selectionText || 'page');
  }
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
});

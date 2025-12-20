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
    // TODO: Send to Side Panel for processing
  }

  if (info.menuItemId === 'gemigo-summarize') {
    console.log('Summarize:', info.selectionText || 'page');
    // TODO: Send to Side Panel for processing
  }
});

// Listen for messages from Side Panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message from:', sender.id, message);

  if (message.type === 'GET_PAGE_INFO') {
    // Get current tab info
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab) {
        sendResponse({
          url: tab.url,
          title: tab.title,
          favIconUrl: tab.favIconUrl,
        });
      }
    });
    return true; // Async response
  }

  if (message.type === 'EXECUTE_IN_PAGE') {
    // Send command to Content Script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId) {
        chrome.tabs.sendMessage(tabId, message.payload, sendResponse);
      }
    });
    return true;
  }
});

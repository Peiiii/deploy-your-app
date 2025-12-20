// GemiGo Browser Extension - Service Worker

// 点击扩展图标时打开 Side Panel
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// 注册右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'gemigo-translate',
    title: '用 GemiGo 翻译',
    contexts: ['selection'],
  });

  chrome.contextMenus.create({
    id: 'gemigo-summarize',
    title: '用 GemiGo 总结',
    contexts: ['selection', 'page'],
  });
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'gemigo-translate' && info.selectionText) {
    console.log('Translate:', info.selectionText);
    // TODO: 发送到 Side Panel 处理
  }

  if (info.menuItemId === 'gemigo-summarize') {
    console.log('Summarize:', info.selectionText || 'page');
    // TODO: 发送到 Side Panel 处理
  }
});

// 监听来自 Side Panel 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message from:', sender.id, message);

  if (message.type === 'GET_PAGE_INFO') {
    // 获取当前标签页信息
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
    return true; // 表示异步响应
  }

  if (message.type === 'EXECUTE_IN_PAGE') {
    // 向 Content Script 发送命令
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId) {
        chrome.tabs.sendMessage(tabId, message.payload, sendResponse);
      }
    });
    return true;
  }
});

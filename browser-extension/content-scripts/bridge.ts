// GemiGo Content Script - 页面桥接脚本

console.log('[GemiGo] Content script loaded');

// 监听来自 Service Worker 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[GemiGo] Received message:', message);

  switch (message.type) {
    case 'GET_PAGE_HTML':
      sendResponse({ html: document.documentElement.outerHTML });
      break;

    case 'GET_PAGE_TEXT':
      sendResponse({ text: document.body.innerText });
      break;

    case 'GET_SELECTION':
      sendResponse({ selection: window.getSelection()?.toString() || '' });
      break;

    case 'HIGHLIGHT_ELEMENT':
      try {
        const elements = document.querySelectorAll(message.selector);
        elements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          htmlEl.style.backgroundColor = message.color || '#fef08a';
          htmlEl.style.transition = 'background-color 0.3s';
        });
        sendResponse({ success: true, count: elements.length });
      } catch (e) {
        sendResponse({ success: false, error: String(e) });
      }
      break;

    default:
      sendResponse({ error: 'Unknown message type' });
  }

  return true; // 异步响应
});

// 监听选区变化（可选，供后续使用）
let selectionTimeout: number | null = null;
document.addEventListener('selectionchange', () => {
  if (selectionTimeout) {
    clearTimeout(selectionTimeout);
  }
  selectionTimeout = window.setTimeout(() => {
    const selection = window.getSelection()?.toString();
    if (selection && selection.length > 0) {
      // 可以发送到 Service Worker
      // chrome.runtime.sendMessage({ type: 'SELECTION_CHANGED', selection });
    }
  }, 300);
});

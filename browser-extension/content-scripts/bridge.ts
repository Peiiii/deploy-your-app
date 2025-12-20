// GemiGo Content Script - Page Bridge

console.log('[GemiGo] Content script loaded on:', window.location.href);

// Listen for messages from Service Worker
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[GemiGo CS] Received message:', message.type);

  switch (message.type) {
    case 'PING':
      sendResponse({ pong: true });
      break;

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

    case 'EXTRACT_ARTICLE':
      try {
        // Simple article extraction logic
        const title = document.title || document.querySelector('h1')?.textContent || '';
        
        // Try to find article content
        const articleSelectors = ['article', 'main', '.article', '.post', '.content', '#content'];
        let content = '';
        for (const selector of articleSelectors) {
          const el = document.querySelector(selector);
          if (el) {
            content = el.textContent?.trim() || '';
            break;
          }
        }
        // Fallback to body text
        if (!content) {
          content = document.body.innerText;
        }
        
        // Create excerpt
        const excerpt = content.slice(0, 300).trim() + (content.length > 300 ? '...' : '');
        
        sendResponse({
          success: true,
          title,
          content,
          excerpt,
          url: window.location.href,
        });
      } catch (e) {
        sendResponse({ success: false, error: String(e) });
      }
      break;

    default:
      sendResponse({ error: 'Unknown message type: ' + message.type });
  }

  return true; // Async response
});

// Listen for selection changes (optional, for future use)
let selectionTimeout: number | null = null;
document.addEventListener('selectionchange', () => {
  if (selectionTimeout) {
    clearTimeout(selectionTimeout);
  }
  selectionTimeout = window.setTimeout(() => {
    const selection = window.getSelection()?.toString();
    if (selection && selection.length > 0) {
      // Can send to Service Worker
      // chrome.runtime.sendMessage({ type: 'SELECTION_CHANGED', selection });
    }
  }, 300);
});

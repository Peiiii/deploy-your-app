// GemiGo Content Script - Page Bridge

console.log('[GemiGo] Content script loaded on:', window.location.href);

// Widget and style registry for cleanup
const widgetRegistry = new Map<string, HTMLElement>();
const styleRegistry = new Map<string, HTMLStyleElement>();
const highlightRegistry = new Map<string, HTMLElement[]>();

// Generate unique IDs
let idCounter = 0;
const generateId = () => `gemigo-${Date.now()}-${++idCounter}`;

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


    case 'GET_SELECTION': {
      const selection = window.getSelection();
      const text = selection?.toString() || '';
      let rect = null;
      
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const domRect = range.getBoundingClientRect();
        if (domRect.width > 0 && domRect.height > 0) {
          // Convert viewport coords to page coords for scroll-following behavior
          rect = {
            x: domRect.x + window.scrollX,
            y: domRect.y + window.scrollY,
            width: domRect.width,
            height: domRect.height,
          };
        }
      }
      
      sendResponse({ text, rect });
      break;
    }

    case 'HIGHLIGHT_ELEMENT': {
      try {
        const highlightId = generateId();
        const elements = document.querySelectorAll(message.selector);
        const highlighted: HTMLElement[] = [];
        
        elements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          // Store original background
          htmlEl.dataset.gemigoOriginalBg = htmlEl.style.backgroundColor;
          htmlEl.style.backgroundColor = message.color || '#fef08a';
          htmlEl.style.transition = 'background-color 0.3s';
          highlighted.push(htmlEl);
        });
        
        highlightRegistry.set(highlightId, highlighted);
        sendResponse({ success: true, count: elements.length, highlightId });
      } catch (e) {
        sendResponse({ success: false, error: String(e) });
      }
      break;
    }

    case 'REMOVE_HIGHLIGHT': {
      try {
        const elements = highlightRegistry.get(message.highlightId);
        if (elements) {
          elements.forEach((el) => {
            el.style.backgroundColor = el.dataset.gemigoOriginalBg || '';
            delete el.dataset.gemigoOriginalBg;
          });
          highlightRegistry.delete(message.highlightId);
        }
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: String(e) });
      }
      break;
    }

    case 'INSERT_WIDGET': {
      try {
        const widgetId = generateId();
        const container = document.createElement('div');
        container.id = widgetId;
        container.className = 'gemigo-widget';
        container.innerHTML = message.html;
        
        // Determine position mode: 'fixed' for viewport, 'absolute' for page
        const positionMode = message.positionMode || 'absolute';
        
        // Apply position styles
        Object.assign(container.style, {
          position: positionMode,
          zIndex: '2147483647', // Max z-index
          pointerEvents: 'auto',
        });
        
        // Handle position
        const pos = message.position;
        if (typeof pos === 'string') {
          // Predefined positions (always use fixed)
          container.style.position = 'fixed';
          const positions: Record<string, { top?: string; bottom?: string; left?: string; right?: string }> = {
            'top-left': { top: '16px', left: '16px' },
            'top-right': { top: '16px', right: '16px' },
            'bottom-left': { bottom: '16px', left: '16px' },
            'bottom-right': { bottom: '16px', right: '16px' },
          };
          Object.assign(container.style, positions[pos] || positions['bottom-right']);
        } else if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
          container.style.left = `${pos.x}px`;
          container.style.top = `${pos.y}px`;
        }
        
        document.body.appendChild(container);
        widgetRegistry.set(widgetId, container);
        
        sendResponse({ success: true, widgetId });
      } catch (e) {
        sendResponse({ success: false, error: String(e) });
      }
      break;
    }

    case 'UPDATE_WIDGET': {
      try {
        const widget = widgetRegistry.get(message.widgetId);
        if (widget) {
          widget.innerHTML = message.html;
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Widget not found' });
        }
      } catch (e) {
        sendResponse({ success: false, error: String(e) });
      }
      break;
    }

    case 'REMOVE_WIDGET': {
      try {
        const widget = widgetRegistry.get(message.widgetId);
        if (widget) {
          widget.remove();
          widgetRegistry.delete(message.widgetId);
        }
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: String(e) });
      }
      break;
    }

    case 'INJECT_CSS': {
      try {
        const styleId = generateId();
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = message.css;
        document.head.appendChild(style);
        styleRegistry.set(styleId, style);
        
        sendResponse({ success: true, styleId });
      } catch (e) {
        sendResponse({ success: false, error: String(e) });
      }
      break;
    }

    case 'REMOVE_CSS': {
      try {
        const style = styleRegistry.get(message.styleId);
        if (style) {
          style.remove();
          styleRegistry.delete(message.styleId);
        }
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: String(e) });
      }
      break;
    }

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

    case 'EXTRACT_LINKS': {
      try {
        const links: { href: string; text: string; title?: string }[] = [];
        document.querySelectorAll('a[href]').forEach((el) => {
          const anchor = el as HTMLAnchorElement;
          // Skip internal anchors and javascript:
          if (anchor.href && !anchor.href.startsWith('javascript:')) {
            links.push({
              href: anchor.href,
              text: anchor.textContent?.trim() || '',
              title: anchor.title || undefined,
            });
          }
        });
        sendResponse({ success: true, links });
      } catch (e) {
        sendResponse({ success: false, error: String(e) });
      }
      break;
    }

    case 'EXTRACT_IMAGES': {
      try {
        const images: { src: string; alt?: string; width?: number; height?: number }[] = [];
        document.querySelectorAll('img[src]').forEach((el) => {
          const img = el as HTMLImageElement;
          if (img.src) {
            images.push({
              src: img.src,
              alt: img.alt || undefined,
              width: img.naturalWidth || undefined,
              height: img.naturalHeight || undefined,
            });
          }
        });
        sendResponse({ success: true, images });
      } catch (e) {
        sendResponse({ success: false, error: String(e) });
      }
      break;
    }

    case 'QUERY_ELEMENT': {
      try {
        const elements = document.querySelectorAll(message.selector);
        const results: { tagName: string; text: string; attributes: Record<string, string> }[] = [];
        
        elements.forEach((el, index) => {
          if (index >= (message.limit || 100)) return;
          
          const attrs: Record<string, string> = {};
          for (const attr of el.attributes) {
            attrs[attr.name] = attr.value;
          }
          
          results.push({
            tagName: el.tagName.toLowerCase(),
            text: el.textContent?.trim().slice(0, 200) || '',
            attributes: attrs,
          });
        });
        
        sendResponse({ success: true, elements: results, count: elements.length });
      } catch (e) {
        sendResponse({ success: false, error: String(e) });
      }
      break;
    }

    default:
      sendResponse({ error: 'Unknown message type: ' + message.type });
  }

  return true; // Async response
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
    
    // Only send if selection changed
    if (text !== lastSelection) {
      lastSelection = text;
      
      // Get selection rect if available
      // Get selection rect if available (page coordinates for scroll-following)
      let rect = null;
      if (sel && sel.rangeCount > 0 && text.length > 0) {
        const range = sel.getRangeAt(0);
        const domRect = range.getBoundingClientRect();
        if (domRect.width > 0 && domRect.height > 0) {
          // Convert viewport coords to page coords for scroll-following behavior
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
        text,
        rect,
        url: window.location.href 
      });
    }
  }, 300);
});

/**
 * Content Script Messages - Unified Handlers
 *
 * Declarative configuration with simple functions and stateful handlers.
 * Strictly implements ExtensionRPCMethods for type safety.
 */

import type { ExtensionRPCMethods } from '@gemigo/app-sdk';

// ========== Registries (stateful) ==========

const widgetRegistry = new Map<string, HTMLElement>();
const styleRegistry = new Map<string, HTMLStyleElement>();
const highlightRegistry = new Map<string, HTMLElement[]>();
let idCounter = 0;
const generateId = () => `gemigo-${Date.now()}-${++idCounter}`;

// ========== Simple Handlers ==========

const simpleHandlers = {
  ping: async () => ({ pong: true }),
  getPageHTML: async () => document.documentElement.outerHTML,
  getPageText: async () => document.body.innerText,

  getSelection: async () => {
    const selection = window.getSelection();
    const text = selection?.toString() || '';
    let rect = null;
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const domRect = range.getBoundingClientRect();
      if (domRect.width > 0 && domRect.height > 0) {
        rect = { x: domRect.x + window.scrollX, y: domRect.y + window.scrollY, width: domRect.width, height: domRect.height };
      }
    }
    return { text, rect };
  },

  extractArticle: async () => {
    try {
      const title = document.title || document.querySelector('h1')?.textContent || '';
      const selectors = ['article', 'main', '.article', '.post', '.content', '#content'];
      let content = '';
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) { content = el.textContent?.trim() || ''; break; }
      }
      if (!content) content = document.body.innerText;
      const excerpt = content.slice(0, 300).trim() + (content.length > 300 ? '...' : '');
      return { success: true, title, content, excerpt, url: window.location.href };
    } catch (e) { return { success: false, error: String(e) }; }
  },

  extractLinks: async () => {
    try {
      const links: { href: string; text: string }[] = [];
      document.querySelectorAll('a[href]').forEach((el) => {
        const a = el as HTMLAnchorElement;
        if (a.href && !a.href.startsWith('javascript:')) {
          links.push({ href: a.href, text: a.textContent?.trim() || '' });
        }
      });
      return { success: true, links };
    } catch (e) { return { success: false, error: String(e) }; }
  },

  extractImages: async () => {
    try {
      const images: { src: string; alt?: string }[] = [];
      document.querySelectorAll('img[src]').forEach((el) => {
        const img = el as HTMLImageElement;
        if (img.src) images.push({ src: img.src, alt: img.alt || undefined });
      });
      return { success: true, images };
    } catch (e) { return { success: false, error: String(e) }; }
  },

  queryElement: async (selector: string, limit = 100) => {
    try {
      const elements = document.querySelectorAll(selector);
      const results: { tagName: string; text: string; attributes: Record<string, string> }[] = [];
      elements.forEach((el, i) => {
        if (i >= limit) return;
        const attrs: Record<string, string> = {};
        for (const attr of el.attributes) attrs[attr.name] = attr.value;
        results.push({ tagName: el.tagName.toLowerCase(), text: el.textContent?.trim().slice(0, 200) || '', attributes: attrs });
      });
      return { success: true, elements: results, count: elements.length };
    } catch (e) { return { success: false, error: String(e) }; }
  },
};

// ========== Stateful Handlers ==========

const statefulHandlers = {
  highlight: async (selector: string, color?: string) => {
    try {
      const highlightId = generateId();
      const elements = document.querySelectorAll(selector);
      const highlighted: HTMLElement[] = [];
      elements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.dataset.gemigoOriginalBg = htmlEl.style.backgroundColor;
        htmlEl.style.backgroundColor = color || '#fef08a';
        htmlEl.style.transition = 'background-color 0.3s';
        highlighted.push(htmlEl);
      });
      highlightRegistry.set(highlightId, highlighted);
      return { success: true, count: elements.length, highlightId };
    } catch (e) { return { success: false, error: String(e) }; }
  },

  removeHighlight: async (highlightId: string) => {
    try {
      const elements = highlightRegistry.get(highlightId);
      if (elements) {
        elements.forEach((el) => { el.style.backgroundColor = el.dataset.gemigoOriginalBg || ''; delete el.dataset.gemigoOriginalBg; });
        highlightRegistry.delete(highlightId);
      }
      return { success: true };
    } catch (e) { return { success: false, error: String(e) }; }
  },

  insertWidget: async (html: string, position: any, positionMode = 'absolute') => {
    try {
      const widgetId = generateId();
      const container = document.createElement('div');
      container.id = widgetId;
      container.className = 'gemigo-widget';
      container.innerHTML = html;
      Object.assign(container.style, { position: positionMode, zIndex: '2147483647', pointerEvents: 'auto' });
      if (typeof position === 'string') {
        container.style.position = 'fixed';
        const positions: Record<string, { top?: string; bottom?: string; left?: string; right?: string }> = {
          'top-left': { top: '16px', left: '16px' }, 'top-right': { top: '16px', right: '16px' },
          'bottom-left': { bottom: '16px', left: '16px' }, 'bottom-right': { bottom: '16px', right: '16px' },
        };
        Object.assign(container.style, positions[position] || positions['bottom-right']);
      } else if (position && typeof position.x === 'number') {
        container.style.left = `${position.x}px`; container.style.top = `${position.y}px`;
      }
      document.body.appendChild(container);
      widgetRegistry.set(widgetId, container);
      return { success: true, widgetId };
    } catch (e) { return { success: false, error: String(e) }; }
  },

  updateWidget: async (widgetId: string, html: string) => {
    try {
      const widget = widgetRegistry.get(widgetId);
      if (widget) { widget.innerHTML = html; return { success: true }; }
      return { success: false, error: 'Widget not found' };
    } catch (e) { return { success: false, error: String(e) }; }
  },

  removeWidget: async (widgetId: string) => {
    try {
      const widget = widgetRegistry.get(widgetId);
      if (widget) { widget.remove(); widgetRegistry.delete(widgetId); }
      return { success: true };
    } catch (e) { return { success: false, error: String(e) }; }
  },

  injectCSS: async (css: string) => {
    try {
      const styleId = generateId();
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = css;
      document.head.appendChild(style);
      styleRegistry.set(styleId, style);
      return { success: true, styleId };
    } catch (e) { return { success: false, error: String(e) }; }
  },

  removeCSS: async (styleId: string) => {
    try {
      const style = styleRegistry.get(styleId);
      if (style) { style.remove(); styleRegistry.delete(styleId); }
      return { success: true };
    } catch (e) { return { success: false, error: String(e) }; }
  },

  getPageInfo: async () => {
    return { url: window.location.href, title: document.title };
  },

  captureVisible: async () => {
    return { success: false, error: 'Capture not supported in content script' };
  },

  getContextMenuEvent: async () => {
    return { success: true, event: undefined };
  },
};

// ========== Export ==========

/**
 * Registry of all messages handled by the content script.
 * Strictly typed to ExtensionRPCMethods.
 */
export const allMessages: Partial<ExtensionRPCMethods> = {
  ...simpleHandlers,
  ...statefulHandlers,
};

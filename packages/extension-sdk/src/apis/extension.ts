/**
 * Extension API
 *
 * Page interaction APIs. Requires host connection.
 */

import { getHost, tryGetHost } from '../core';
import type { ChildMethods } from '../core';
import type {
  ContextMenuEvent,
  HighlightResult,
  WidgetResult,
  ExtensionAPI,
} from '../types';

// ========== Event Bus ==========

type EventHandler = (...args: unknown[]) => void;
const handlers: Map<string, Set<EventHandler>> = new Map();

function on(event: string, handler: EventHandler): () => void {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event)!.add(handler);
  return () => handlers.get(event)?.delete(handler);
}

function emit(event: string, ...args: unknown[]): void {
  handlers.get(event)?.forEach(h => h(...args));
}

/**
 * Child methods for two-way communication with host.
 */
export const childMethods: ChildMethods = {
  onContextMenuEvent: (event: ContextMenuEvent) => emit('contextMenu', event),
  onSelectionChange: (text, rect, url) => emit('selectionChange', text, rect, url),
};

// ========== Extension API ==========

export const extensionAPI: ExtensionAPI = {
  // Page reading
  getPageInfo: () => getHost().then(h => h.getPageInfo()),
  getPageHTML: () => getHost().then(h => h.getPageHTML()),
  getPageText: () => getHost().then(h => h.getPageText()),
  getSelection: () => getHost().then(h => h.getSelection()),

  // Content extraction
  extractArticle: () => getHost().then(h => h.extractArticle()),
  extractLinks: () => getHost().then(h => h.extractLinks()),
  extractImages: () => getHost().then(h => h.extractImages()),
  queryElement: (selector, limit) => getHost().then(h => h.queryElement(selector, limit)),

  // Highlighting
  highlight: (selector, color): Promise<HighlightResult> =>
    getHost().then(h => h.highlight(selector, color)),
  removeHighlight: (highlightId) => getHost().then(h => h.removeHighlight(highlightId)),

  // Widgets
  insertWidget: (html, position): Promise<WidgetResult> =>
    getHost().then(h => h.insertWidget(html, position)),
  updateWidget: (widgetId, html) => getHost().then(h => h.updateWidget(widgetId, html)),
  removeWidget: (widgetId) => getHost().then(h => h.removeWidget(widgetId)),

  // CSS injection
  injectCSS: (css) => getHost().then(h => h.injectCSS(css)),
  removeCSS: (styleId) => getHost().then(h => h.removeCSS(styleId)),

  // Capture
  captureVisible: () => getHost().then(h => h.captureVisible()),

  // Context menu
  getContextMenuEvent: () => getHost().then(h => h.getContextMenuEvent()),
  onContextMenu: (callback) => {
    tryGetHost();
    return on('contextMenu', callback as EventHandler);
  },
  onSelectionChange: (handler) => {
    tryGetHost();
    return on('selectionChange', handler as EventHandler);
  },
};

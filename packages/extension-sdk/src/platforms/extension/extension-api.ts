/**
 * Extension Platform - Extension API
 *
 * Browser extension specific APIs for page interaction.
 */

import { getHost, initConnection } from './connection';
import type {
  ContextMenuEvent,
  HighlightResult,
  WidgetResult,
  WidgetPosition,
  ExtensionAPI,
} from '../../types';

// ========== Event Bus (local) ==========

type EventHandler = (...args: unknown[]) => void;
const handlers: Map<string, Set<EventHandler>> = new Map();

function on(event: string, handler: EventHandler): () => void {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event)!.add(handler);
  return () => handlers.get(event)?.delete(handler);
}

function emit(event: string, ...args: unknown[]): void {
  handlers.get(event)?.forEach(handler => handler(...args));
}

// ========== Child methods for two-way communication ==========

function getChildMethods() {
  return {
    onContextMenuEvent: (event: ContextMenuEvent) => emit('contextMenu', event),
    onSelectionChange: (text: string, rect: { x: number; y: number; width: number; height: number } | null, url?: string) =>
      emit('selectionChange', text, rect, url),
  };
}

// ========== Extension API ==========

export const createExtensionAPI = (): ExtensionAPI => ({
  getPageInfo: () => getHost().then(host => host.getPageInfo()),
  getPageHTML: () => getHost().then(host => host.getPageHTML()),
  getPageText: () => getHost().then(host => host.getPageText()),
  getSelection: () => getHost().then(host => host.getSelection()),

  extractArticle: () => getHost().then(host => host.extractArticle()),
  extractLinks: () => getHost().then(host => host.extractLinks()),
  extractImages: () => getHost().then(host => host.extractImages()),
  queryElement: (selector: string, limit?: number) =>
    getHost().then(host => host.queryElement(selector, limit)),

  highlight: (selector: string, color?: string): Promise<HighlightResult> =>
    getHost().then(host => host.highlight(selector, color)),
  removeHighlight: (highlightId: string) =>
    getHost().then(host => host.removeHighlight(highlightId)),

  insertWidget: (html: string, position?: string | WidgetPosition): Promise<WidgetResult> =>
    getHost().then(host => host.insertWidget(html, position)),
  updateWidget: (widgetId: string, html: string) =>
    getHost().then(host => host.updateWidget(widgetId, html)),
  removeWidget: (widgetId: string) =>
    getHost().then(host => host.removeWidget(widgetId)),

  injectCSS: (css: string) => getHost().then(host => host.injectCSS(css)),
  removeCSS: (styleId: string) => getHost().then(host => host.removeCSS(styleId)),

  captureVisible: () => getHost().then(host => host.captureVisible()),

  getContextMenuEvent: () => getHost().then(host => host.getContextMenuEvent()),
  
  onContextMenu: (callback: (event: ContextMenuEvent) => void) => {
    getHost();
    return on('contextMenu', callback as EventHandler);
  },

  onSelectionChange: (handler) => {
    getHost();
    return on('selectionChange', handler as EventHandler);
  },
});

// Initialize connection with child methods
export function initExtensionAPI(): void {
  initConnection(getChildMethods(), { timeoutMs: 1500 });
}

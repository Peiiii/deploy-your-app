/**
 * Extension API
 *
 * Page interaction APIs using declarative RPC proxy.
 */

import { createRPCProxy, tryGetHost } from '../core';
import type { ChildMethods } from '../core';
import type { ExtensionAPI, ContextMenuEvent } from '../types';

// ========== Event Bus ==========

type EventHandler = (...args: unknown[]) => void;
const handlers: Map<string, Set<EventHandler>> = new Map();

function on(event: string, handler: EventHandler): () => void {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event)!.add(handler);
  return () => handlers.get(event)?.delete(handler);
}

function emit(event: string, ...args: unknown[]): void {
  handlers.get(event)?.forEach((h) => h(...args));
}

export const childMethods: ChildMethods = {
  onContextMenuEvent: (event: ContextMenuEvent) => emit('contextMenu', event),
  onSelectionChange: (text, rect, url) => emit('selectionChange', text, rect, url),
};

// ========== Method List ==========

const rpcMethods = [
  'getPageInfo',
  'getPageHTML',
  'getPageText',
  'getSelection',
  'extractArticle',
  'extractLinks',
  'extractImages',
  'queryElement',
  'highlight',
  'removeHighlight',
  'insertWidget',
  'updateWidget',
  'removeWidget',
  'injectCSS',
  'removeCSS',
  'captureVisible',
  'getContextMenuEvent',
] as const;

// ========== Extension API ==========

export const extensionAPI: ExtensionAPI = {
  ...createRPCProxy<any>(rpcMethods),

  onContextMenu: (callback) => {
    tryGetHost();
    return on('contextMenu', callback as EventHandler);
  },
  onSelectionChange: (handler) => {
    tryGetHost();
    return on('selectionChange', handler as EventHandler);
  },
};

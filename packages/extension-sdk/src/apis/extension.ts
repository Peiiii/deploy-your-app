/**
 * Extension API
 *
 * Page interaction APIs using declarative RPC proxy.
 */

import { createRPCProxy, tryGetHost, createEventPair } from '../core';
import type { ChildMethods } from '../core';
import type { ExtensionAPI, ExtensionRPCMethods } from '../types';

// ========== Event Configuration ==========

const extensionEventConfig = {
  onContextMenuEvent: 'extension:contextMenu',
  onSelectionChange: 'extension:selectionChange',
} as const;

const { emitters, subscribers } = createEventPair(extensionEventConfig, tryGetHost);

// ========== Child Methods (Host → SDK events) ==========

export const childMethods: ChildMethods = emitters;

// ========== RPC Method List ==========

export const extensionRpcMethodNames = [
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

export const extensionCallbackAPI: Pick<ExtensionAPI, 'onContextMenu' | 'onSelectionChange'> = {
  onContextMenu: subscribers.onContextMenuEvent,
  onSelectionChange: subscribers.onSelectionChange,
};

export const extensionHostAPI: ExtensionRPCMethods = createRPCProxy<ExtensionRPCMethods>(extensionRpcMethodNames);

export const extensionAPI: ExtensionAPI = {
  ...extensionHostAPI,
  ...extensionCallbackAPI,
};




/**
 * Extension API
 *
 * Page interaction APIs using declarative configuration.
 */

import type { ChildMethods } from '../core';
import { createUnifiedAPI } from '../core';
import type { ExtensionAPI } from '../types';

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

// ========== Unified API Configuration ==========

export const { api: extensionAPI, childMethods: extensionChildMethods } = createUnifiedAPI<ExtensionAPI, ChildMethods>(
  {

    rpc: {
      methods: extensionRpcMethodNames,
    },
    events: {
      onContextMenu: {
        event: 'extension:contextMenu',
        childMethod: 'onContextMenuEvent',
      },
      onSelectionChange: 'extension:selectionChange',
    },
  },
);





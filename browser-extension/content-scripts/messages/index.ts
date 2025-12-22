/**
 * Content Script Messages - Unified Handlers
 * 
 * Aggregates modular handlers for type-safe RPC invocation.
 */

import type { ExtensionRPCMethods } from '@gemigo/app-sdk';
import { domHandlers } from '../handlers/dom';
import { extractHandlers } from '../handlers/extract';
import { uiHandlers } from '../handlers/ui';

export const allMessages: Partial<ExtensionRPCMethods> = {
  ...domHandlers,
  ...extractHandlers,
  ...uiHandlers,

  // Explicitly unsupported in content scripts
  captureVisible: async () => ({ success: false, error: 'Capture not supported in content script' }),
  getContextMenuEvent: async () => ({ success: true, event: undefined }),
};

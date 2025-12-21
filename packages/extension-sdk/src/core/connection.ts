/**
 * Penpal Connection Management
 * 
 * Handles the iframe-to-parent communication channel using penpal.
 */

import { connectToParent, AsyncMethodReturns } from 'penpal';
import type {
  Capabilities,
  ContextMenuEvent,
  ContextMenuEventResult,
  PageInfo,
  SelectionResult,
  HighlightResult,
  WidgetResult,
  WidgetPosition,
  CSSResult,
  CaptureResult,
  ExtractArticleResult,
  ExtractLinksResult,
  ExtractImagesResult,
  QueryElementResult,
} from '../types';

/**
 * Host methods interface - what the extension provides to apps
 * 
 * This is the Penpal RPC contract. Return types should match types/extension.ts
 */
export interface HostMethods {
  // Handshake / environment info
  getProtocolInfo(): Promise<{
    protocolVersion: number;
    platform: 'extension';
    appId: string;
    capabilities: Capabilities;
  }>;

  // Page info
  getPageInfo(): Promise<PageInfo>;
  
  // Page content
  getPageHTML(): Promise<string>;
  getPageText(): Promise<string>;
  getSelection(): Promise<SelectionResult>;
  
  // Page manipulation - highlight
  highlight(selector: string, color?: string): Promise<HighlightResult>;
  removeHighlight(highlightId: string): Promise<{ success: boolean; error?: string }>;
  
  // Page manipulation - widget
  insertWidget(config: { html: string; position: string | WidgetPosition }): Promise<WidgetResult>;
  updateWidget(widgetId: string, html: string): Promise<{ success: boolean; error?: string }>;
  removeWidget(widgetId: string): Promise<{ success: boolean; error?: string }>;
  
  // Page manipulation - CSS
  injectCSS(css: string): Promise<CSSResult>;
  removeCSS(styleId: string): Promise<{ success: boolean; error?: string }>;
  
  // Notifications
  notify(options: { title: string; message: string }): Promise<{ success: boolean }>;

  // Storage (per-app, namespaced by host)
  storageGet(key: string): Promise<{ success: boolean; value?: unknown }>;
  storageSet(key: string, value: unknown): Promise<{ success: boolean }>;
  storageDelete(key: string): Promise<{ success: boolean }>;
  storageClear(): Promise<{ success: boolean }>;

  // Network proxy (host mediated)
  networkRequest(request: {
    url: string;
    options?: {
      method?: string;
      headers?: Record<string, string>;
      body?: string | object;
      responseType?: 'json' | 'text' | 'arraybuffer';
      timeoutMs?: number;
      maxBytes?: number;
    };
  }): Promise<{
    success: boolean;
    status?: number;
    headers?: Record<string, string>;
    data?: unknown;
    error?: string;
    code?: string;
  }>;
  
  // Screenshot
  captureVisible(): Promise<CaptureResult>;
  
  // Content extraction
  extractArticle(): Promise<ExtractArticleResult>;
  extractLinks(): Promise<ExtractLinksResult>;
  extractImages(): Promise<ExtractImagesResult>;
  queryElement(selector: string, limit?: number): Promise<QueryElementResult>;
  
  // Context menu
  getContextMenuEvent(): Promise<ContextMenuEventResult>;
}

/**
 * Child methods interface - what apps expose to the extension host
 */
export interface ChildMethods {
  onContextMenuEvent(event: ContextMenuEvent): void;
  onSelectionChange?(
    text: string,
    rect: { x: number; y: number; width: number; height: number } | null,
    url?: string
  ): void;
}

// Singleton connection promise
let connectionPromise: Promise<AsyncMethodReturns<HostMethods>> | null = null;
let defaultChildMethods: ChildMethods | undefined;

const DEFAULT_TIMEOUT_MS = 1500;

/**
 * Check if running inside an iframe
 */
function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Get or create connection to parent (extension host)
 * 
 * @param childMethods - Methods to expose to parent
 * @param options - Connection options
 * @returns Promise resolving to host methods
 */
export function getHost(
  childMethods?: ChildMethods,
  options?: { timeoutMs?: number }
): Promise<AsyncMethodReturns<HostMethods>> {
  if (connectionPromise) return connectionPromise;

  if (!isInIframe()) {
    console.warn('[GemiGo SDK] Not running in iframe. SDK calls will not work.');
  }

  const methods: Record<string, (...args: unknown[]) => unknown> = {};
  const resolvedChildMethods = childMethods ?? defaultChildMethods;
  if (resolvedChildMethods) {
    Object.assign(methods, resolvedChildMethods);
  }

  const connection = connectToParent<HostMethods>({
    methods,
    timeout: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  connectionPromise = connection.promise.catch((err) => {
    // Reset so future calls can retry (important for non-extension web iframes).
    connectionPromise = null;
    throw err;
  });
  return connectionPromise;
}

/**
 * Initialize connection immediately (for faster first call)
 */
export function initConnection(
  childMethods?: ChildMethods,
  options?: { timeoutMs?: number }
): void {
  defaultChildMethods = childMethods;
  getHost(childMethods, options).catch(err => {
    console.debug('[GemiGo SDK] Auto-connect waiting...', err);
  });
}

/**
 * Penpal Connection Management
 * 
 * Handles the iframe-to-parent communication channel using penpal.
 */

import { connectToParent, AsyncMethodReturns } from 'penpal';
import type { ContextMenuEvent } from '../types';
import type { Capabilities } from '../types';

/**
 * Host methods interface - what the extension provides to apps
 */
export interface HostMethods {
  // Handshake / environment info
  getProtocolInfo?(): Promise<{
    protocolVersion: number;
    platform: 'extension';
    appId: string;
    capabilities: Capabilities;
  }>;

  // Page info
  getPageInfo(): Promise<{ url: string; title: string; favIconUrl?: string }>;
  
  // Page content
  getPageHTML(): Promise<string>;
  getPageText(): Promise<string>;
  getSelection(): Promise<{
    text: string;
    rect?: { x: number; y: number; width: number; height: number };
  }>;
  
  // Page manipulation - highlight
  highlight(selector: string, color?: string): Promise<{ success: boolean; count?: number; highlightId?: string }>;
  removeHighlight(highlightId: string): Promise<{ success: boolean }>;
  
  // Page manipulation - widget
  insertWidget(config: { html: string; position: string | { x: number; y: number } }): Promise<{ success: boolean; widgetId?: string; error?: string }>;
  updateWidget(widgetId: string, html: string): Promise<{ success: boolean; error?: string }>;
  removeWidget(widgetId: string): Promise<{ success: boolean }>;
  
  // Page manipulation - CSS
  injectCSS(css: string): Promise<{ success: boolean; styleId?: string; error?: string }>;
  removeCSS(styleId: string): Promise<{ success: boolean }>;
  
  // Notifications
  notify(options: { title: string; message: string }): Promise<{ success: boolean }>;

  // Storage (per-app, namespaced by host)
  storageGet?(key: string): Promise<{ success: boolean; value?: unknown }>;
  storageSet?(key: string, value: unknown): Promise<{ success: boolean }>;
  storageDelete?(key: string): Promise<{ success: boolean }>;
  storageClear?(): Promise<{ success: boolean }>;

  // Network proxy (host mediated)
  networkRequest?(request: {
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
  captureVisible(): Promise<{ success: boolean; dataUrl?: string; error?: string }>;
  
  // Article extraction
  extractArticle(): Promise<{
    success: boolean;
    title?: string;
    content?: string;
    excerpt?: string;
    url?: string;
  }>;
  
  // Page data extraction
  extractLinks(): Promise<{
    success: boolean;
    links?: { href: string; text: string; title?: string }[];
    error?: string;
  }>;
  
  extractImages(): Promise<{
    success: boolean;
    images?: { src: string; alt?: string; width?: number; height?: number }[];
    error?: string;
  }>;
  
  queryElement(selector: string, limit?: number): Promise<{
    success: boolean;
    elements?: { tagName: string; text: string; attributes: Record<string, string> }[];
    count?: number;
    error?: string;
  }>;
  
  // Context menu
  getContextMenuEvent(): Promise<{
    success: boolean;
    event?: ContextMenuEvent;
  }>;
}

/**
 * Child methods interface - what apps expose to the extension host
 */
export interface ChildMethods {
  onContextMenuEvent(event: ContextMenuEvent): void;
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

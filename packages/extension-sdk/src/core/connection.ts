/**
 * Penpal Connection Management
 * 
 * Handles the iframe-to-parent communication channel using penpal.
 */

import { connectToParent, AsyncMethodReturns } from 'penpal';
import type { ContextMenuEvent } from '../types';

/**
 * Host methods interface - what the extension provides to apps
 */
export interface HostMethods {
  // Page info
  getPageInfo(): Promise<{ url: string; title: string; favIconUrl?: string }>;
  
  // Page content
  getPageHTML(): Promise<string>;
  getPageText(): Promise<string>;
  getSelection(): Promise<string>;
  
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
 * @returns Promise resolving to host methods
 */
export function getHost(childMethods?: ChildMethods): Promise<AsyncMethodReturns<HostMethods>> {
  if (connectionPromise) return connectionPromise;

  if (!isInIframe()) {
    console.warn('[GemiGo SDK] Not running in iframe. SDK calls will not work.');
  }

  const methods: Record<string, (...args: unknown[]) => unknown> = {};
  if (childMethods) {
    Object.assign(methods, childMethods);
  }

  const connection = connectToParent<HostMethods>({
    methods,
  });

  connectionPromise = connection.promise;
  return connectionPromise;
}

/**
 * Initialize connection immediately (for faster first call)
 */
export function initConnection(childMethods?: ChildMethods): void {
  getHost(childMethods).catch(err => {
    console.debug('[GemiGo SDK] Auto-connect waiting...', err);
  });
}

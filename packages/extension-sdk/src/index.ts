/**
 * GemiGo Extension SDK
 * 
 * SDK for building apps that run inside the GemiGo browser extension.
 * 
 * Usage (CDN):
 *   <script src="https://unpkg.com/@gemigo/extension-sdk/dist/gemigo-extension-sdk.umd.js"></script>
 *   <script>
 *     // No connect() needed - just use the global gemigo object directly
 *     gemigo.getPageInfo().then(console.log);
 *     
 *     gemigo.on('contextMenu', (event) => {
 *       console.log('Context menu clicked:', event);
 *     });
 *   </script>
 * 
 * Usage (ES Module):
 *   import gemigo from '@gemigo/extension-sdk';
 *   
 *   const pageInfo = await gemigo.getPageInfo();
 */

import { connectToParent, Connection, AsyncMethodReturns } from 'penpal';

// Event callback types
type ContextMenuEventHandler = (event: {
  menuId: string;
  selectionText?: string;
  pageUrl?: string;
}) => void;

// Host methods interface (what the extension provides)
interface HostMethods {
  getPageInfo(): Promise<{ url: string; title: string; favIconUrl?: string }>;
  getPageHTML(): Promise<string>;
  getPageText(): Promise<string>;
  getSelection(): Promise<string>;
  highlight(selector: string, color?: string): Promise<{ success: boolean; count?: number }>;
  notify(options: { title: string; message: string }): Promise<{ success: boolean }>;
  captureVisible(): Promise<{ success: boolean; dataUrl?: string; error?: string }>;
  extractArticle(): Promise<{
    success: boolean;
    title?: string;
    content?: string;
    excerpt?: string;
    url?: string;
  }>;
  getContextMenuEvent(): Promise<{
    success: boolean;
    event?: { menuId: string; selectionText?: string; pageUrl?: string };
  }>;
}

// SDK interface (what the app uses)
export interface GemigoSDK {
  /** Get current page information */
  getPageInfo(): Promise<{ url: string; title: string; favIconUrl?: string }>;
  
  /** Get full page HTML */
  getPageHTML(): Promise<string>;
  
  /** Get page text content */
  getPageText(): Promise<string>;
  
  /** Get selected text on page */
  getSelection(): Promise<string>;
  
  /** Highlight elements matching selector */
  highlight(selector: string, color?: string): Promise<{ success: boolean; count?: number }>;
  
  /** Send system notification */
  notify(title: string, message: string): Promise<{ success: boolean }>;
  
  /** Capture visible tab screenshot */
  captureVisible(): Promise<{ success: boolean; dataUrl?: string; error?: string }>;
  
  /** Extract article content from page */
  extractArticle(): Promise<{
    success: boolean;
    title?: string;
    content?: string;
    excerpt?: string;
    url?: string;
  }>;
  
  /** Get pending context menu event (if any) */
  getContextMenuEvent(): Promise<{
    success: boolean;
    event?: { menuId: string; selectionText?: string; pageUrl?: string };
  }>;
  
  /** Register context menu event handler */
  on(event: 'contextMenu', handler: ContextMenuEventHandler): void;
  
  /** Unregister event handler */
  off(event: 'contextMenu', handler?: ContextMenuEventHandler): void;
}

// Event handlers storage
const eventHandlers: {
  contextMenu: ContextMenuEventHandler[];
} = {
  contextMenu: [],
};

// Internal connection promise
let connectionPromise: Promise<AsyncMethodReturns<HostMethods>> | null = null;

/**
 * Validates executing environment (basic check)
 */
function isInIframe() {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true; // Blocked access implies iframe
  }
}

/**
 * Get (or create) the connection to host
 */
function getHost(): Promise<AsyncMethodReturns<HostMethods>> {
  if (connectionPromise) return connectionPromise;

  if (!isInIframe()) {
    console.warn('[GemiGo SDK] Not running in iframe. SDK calls will verify connection forever.');
    // Return a never-resolving promise or mock in dev mode? 
    // For now, let it hang or we could reject if strict.
  }

  const connection = connectToParent<HostMethods>({
    methods: {
      // Handler called by Host when context menu events occur
      onContextMenuEvent(event: { menuId: string; selectionText?: string; pageUrl?: string }) {
        eventHandlers.contextMenu.forEach((handler) => {
          try {
            handler(event);
          } catch (err) {
            console.error('[GemiGo SDK] Error in contextMenu handler:', err);
          }
        });
      },
    },
  });

  connectionPromise = connection.promise;
  return connectionPromise;
}

/**
 * Proxy handler to auto-connect on method calls
 */
const sdkInstance: GemigoSDK = {
  // --- Proxy Methods (Auto-connect) ---
  
  getPageInfo: () => getHost().then(host => host.getPageInfo()),
  getPageHTML: () => getHost().then(host => host.getPageHTML()),
  getPageText: () => getHost().then(host => host.getPageText()),
  getSelection: () => getHost().then(host => host.getSelection()),
  highlight: (selector, color) => getHost().then(host => host.highlight(selector, color)),
  notify: (title, message) => getHost().then(host => host.notify({ title, message })),
  captureVisible: () => getHost().then(host => host.captureVisible()),
  extractArticle: () => getHost().then(host => host.extractArticle()),
  getContextMenuEvent: () => getHost().then(host => host.getContextMenuEvent()),

  // --- Local Methods (No await needed) ---
  
  on(event, handler) {
    getHost(); // Ensure connection starts establishing even if just listening
    if (event === 'contextMenu') {
      eventHandlers.contextMenu.push(handler);
    }
  },
  
  off(event, handler) {
    if (event === 'contextMenu') {
      if (handler) {
        const idx = eventHandlers.contextMenu.indexOf(handler);
        if (idx > -1) eventHandlers.contextMenu.splice(idx, 1);
      } else {
        eventHandlers.contextMenu = [];
      }
    }
  },
};

// Initialize connection immediately
getHost().catch(err => {
  console.debug('[GemiGo SDK] Auto-connect waiting...', err);
});

// Default export for ES modules and CDN global
export default sdkInstance;

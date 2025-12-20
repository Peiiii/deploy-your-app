/**
 * GemiGo Extension SDK
 * 
 * SDK for building apps that run inside the GemiGo browser extension.
 * 
 * Usage (CDN):
 *   <script src="https://unpkg.com/@gemigo/extension-sdk/dist/gemigo-extension-sdk.umd.js"></script>
 *   <script>
 *     GemigoExtensionSDK.connect().then((gemigo) => {
 *       gemigo.getPageInfo().then(console.log);
 *     });
 *   </script>
 * 
 * Usage (ES Module):
 *   import { connect } from '@gemigo/extension-sdk';
 *   const gemigo = await connect();
 *   const pageInfo = await gemigo.getPageInfo();
 */

import { connectToParent, Connection } from 'penpal';

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
  pollContextMenu(callback: ContextMenuEventHandler): Promise<{ check: () => void }>;
}

// SDK instance interface (what the app uses)
export interface GemigoExtension {
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

// Connection instance
let connection: Connection<HostMethods> | null = null;
let hostMethods: HostMethods | null = null;

/**
 * Connect to the GemiGo extension host.
 * Must be called before using any SDK methods.
 * 
 * @returns Promise resolving to the GemiGo SDK instance
 */
export async function connect(): Promise<GemigoExtension> {
  if (hostMethods) {
    return createSDKInstance(hostMethods);
  }

  connection = connectToParent<HostMethods>({
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

  hostMethods = await connection.promise;
  return createSDKInstance(hostMethods);
}

/**
 * Create SDK instance with clean API
 */
function createSDKInstance(host: HostMethods): GemigoExtension {
  return {
    getPageInfo: () => host.getPageInfo(),
    getPageHTML: () => host.getPageHTML(),
    getPageText: () => host.getPageText(),
    getSelection: () => host.getSelection(),
    highlight: (selector, color) => host.highlight(selector, color),
    notify: (title, message) => host.notify({ title, message }),
    captureVisible: () => host.captureVisible(),
    extractArticle: () => host.extractArticle(),
    getContextMenuEvent: () => host.getContextMenuEvent(),
    
    on(event, handler) {
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
}

// Export for CDN usage
export default { connect };

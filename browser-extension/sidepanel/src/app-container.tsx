import { useEffect, useRef } from 'react';
import { connectToChild, Connection } from 'penpal';

interface AppContainerProps {
  app: {
    id: string;
    name: string;
    icon: string;
    url: string;
  };
  onBack: () => void;
}

// SDK methods exposed to App iframe
const createHostMethods = () => ({
  // Get page info
  async getPageInfo() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_PAGE_INFO' }, (response) => {
        resolve(response);
      });
    });
  },

  // Get page HTML
  async getPageHTML() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'EXECUTE_IN_PAGE', payload: { type: 'GET_PAGE_HTML' } },
        (response) => {
          resolve(response?.html || '');
        }
      );
    });
  },

  // Get page text
  async getPageText() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'EXECUTE_IN_PAGE', payload: { type: 'GET_PAGE_TEXT' } },
        (response) => {
          resolve(response?.text || '');
        }
      );
    });
  },

  // Get selection
  async getSelection() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'EXECUTE_IN_PAGE', payload: { type: 'GET_SELECTION' } },
        (response) => {
          resolve(response?.selection || '');
        }
      );
    });
  },

  // Highlight element (returns highlightId for removal)
  async highlight(selector: string, color?: string) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: 'EXECUTE_IN_PAGE',
          payload: { type: 'HIGHLIGHT_ELEMENT', selector, color },
        },
        (response) => {
          resolve(response);
        }
      );
    });
  },

  // Remove highlight
  async removeHighlight(highlightId: string) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: 'EXECUTE_IN_PAGE',
          payload: { type: 'REMOVE_HIGHLIGHT', highlightId },
        },
        (response) => {
          resolve(response);
        }
      );
    });
  },

  // Insert widget in page
  async insertWidget(config: { html: string; position: string | { x: number; y: number } }) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: 'EXECUTE_IN_PAGE',
          payload: { type: 'INSERT_WIDGET', ...config },
        },
        (response) => {
          resolve(response);
        }
      );
    });
  },

  // Update widget content
  async updateWidget(widgetId: string, html: string) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: 'EXECUTE_IN_PAGE',
          payload: { type: 'UPDATE_WIDGET', widgetId, html },
        },
        (response) => {
          resolve(response);
        }
      );
    });
  },

  // Remove widget
  async removeWidget(widgetId: string) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: 'EXECUTE_IN_PAGE',
          payload: { type: 'REMOVE_WIDGET', widgetId },
        },
        (response) => {
          resolve(response);
        }
      );
    });
  },

  // Inject CSS
  async injectCSS(css: string) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: 'EXECUTE_IN_PAGE',
          payload: { type: 'INJECT_CSS', css },
        },
        (response) => {
          resolve(response);
        }
      );
    });
  },

  // Remove injected CSS
  async removeCSS(styleId: string) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: 'EXECUTE_IN_PAGE',
          payload: { type: 'REMOVE_CSS', styleId },
        },
        (response) => {
          resolve(response);
        }
      );
    });
  },

  // Extract all links from page
  async extractLinks() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: 'EXECUTE_IN_PAGE',
          payload: { type: 'EXTRACT_LINKS' },
        },
        (response) => {
          resolve(response);
        }
      );
    });
  },

  // Extract all images from page
  async extractImages() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: 'EXECUTE_IN_PAGE',
          payload: { type: 'EXTRACT_IMAGES' },
        },
        (response) => {
          resolve(response);
        }
      );
    });
  },

  // Query elements by selector
  async queryElement(selector: string, limit?: number) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: 'EXECUTE_IN_PAGE',
          payload: { type: 'QUERY_ELEMENT', selector, limit },
        },
        (response) => {
          resolve(response);
        }
      );
    });
  },

  // Send notification via Service Worker
  async notify(options: { title: string; message: string }) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'SHOW_NOTIFICATION', payload: options },
        (response) => {
          resolve(response);
        }
      );
    });
  },

  // Capture visible tab screenshot
  async captureVisible() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE' }, (response) => {
        resolve(response);
      });
    });
  },

  // Extract article content from page
  async extractArticle() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'EXECUTE_IN_PAGE', payload: { type: 'EXTRACT_ARTICLE' } },
        (response) => {
          resolve(response);
        }
      );
    });
  },

  // Get pending context menu event
  async getContextMenuEvent() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_CONTEXT_MENU_EVENT' }, (response) => {
        resolve(response);
      });
    });
  },

  // Poll for context menu events (for apps to call on mount)
  async pollContextMenu(callback: (event: { menuId: string; selectionText?: string }) => void) {
    const check = async () => {
      const result = await new Promise<{ success: boolean; event?: { menuId: string; selectionText?: string } }>((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_CONTEXT_MENU_EVENT' }, (response) => {
          resolve(response);
        });
      });
      if (result.success && result.event) {
        callback(result.event);
      }
    };
    // Check immediately
    check();
    // Return cleanup function (caller can set up interval if needed)
    return { check };
  },
});

// Note: onContextMenuEvent is now handled by calling child.onContextMenuEvent() directly
// Apps should expose this method via Penpal.connectToParent({ methods: { onContextMenuEvent } })

// Listen for events from Service Worker
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'CONTEXT_MENU_EVENT' && activeChildRef) {
    if (typeof activeChildRef.onContextMenuEvent === 'function') {
      activeChildRef.onContextMenuEvent(message.event);
    }
  }
  if (message.type === 'SELECTION_CHANGED' && activeChildRef) {
    if (typeof activeChildRef.onSelectionChange === 'function') {
      activeChildRef.onSelectionChange(message.selection, message.url);
    }
  }
});

// Reference to currently active App child
let activeChildRef: {
  onContextMenuEvent?: (event: unknown) => void;
  onSelectionChange?: (selection: string, url: string) => void;
} | null = null;

export default function AppContainer({ app, onBack }: AppContainerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const connectionRef = useRef<Connection<object> | null>(null);

  useEffect(() => {
    if (!iframeRef.current) return;

    // Establish penpal connection
    const connection = connectToChild({
      iframe: iframeRef.current,
      methods: createHostMethods(),
    });

    connectionRef.current = connection;

    connection.promise.then((child) => {
      console.log('[GemiGo Host] Connected to app:', app.name);
      // Store child reference for Host → App callbacks
      activeChildRef = child as { onContextMenuEvent?: (event: unknown) => void };
    }).catch((err) => {
      console.error('[GemiGo Host] Connection failed:', err);
    });

    return () => {
      activeChildRef = null;
      connection.destroy();
    };
  }, [app.id, app.name]);

  return (
    <div className="app-container">
      {/* Toolbar */}
      <header className="app-toolbar">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <div className="app-title">
          <span className="app-title-icon">{app.icon}</span>
          <span>{app.name}</span>
        </div>
        <button className="icon-btn" title="More options">
          ⋯
        </button>
      </header>

      {/* App iframe */}
      <iframe
        ref={iframeRef}
        src={app.url}
        className="app-iframe"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        allow="clipboard-write"
      />
    </div>
  );
}

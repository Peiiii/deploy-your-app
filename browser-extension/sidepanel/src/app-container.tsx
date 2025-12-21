import { useEffect, useRef } from 'react';
import { connectToChild, Connection } from 'penpal';

interface AppContainerProps {
  app: {
    id: string;
    name: string;
    icon: string;
    url: string;
    permissions?: Array<'extension.modify' | 'extension.capture' | 'network'>;
    networkAllowlist?: string[];
  };
  onBack: () => void;
}

const hasPermission = (
  app: AppContainerProps['app'],
  permission: NonNullable<AppContainerProps['app']['permissions']>[number],
): boolean => Boolean(app.permissions?.includes(permission));

const isUrlAllowed = (url: string, allowlist: string[] | undefined): boolean => {
  if (!allowlist || allowlist.length === 0) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  return allowlist.some((pattern) => {
    try {
      const normalized = pattern.includes('://') ? pattern : `https://${pattern}`;
      const hasPortWildcard = normalized.includes(':*');
      const normalizedForUrl = hasPortWildcard ? normalized.replace(':*', '') : normalized;
      const patternUrl = new URL(normalizedForUrl);

      if (patternUrl.protocol !== parsed.protocol) return false;

      const patternHost = patternUrl.hostname;
      const isWildcardSubdomain = patternHost.startsWith('*.');
      const matchHost = isWildcardSubdomain
        ? parsed.hostname === patternHost.slice(2) ||
          parsed.hostname.endsWith(`.${patternHost.slice(2)}`)
        : parsed.hostname === patternHost;
      if (!matchHost) return false;

      if (!hasPortWildcard && patternUrl.port && patternUrl.port !== parsed.port) return false;

      return true;
    } catch {
      return false;
    }
  });
};

const storageKey = (appId: string, key: string): string => `app:${appId}:${key}`;

const chromeStorageGet = async (key: string): Promise<unknown | undefined> => {
  const stored = await chrome.storage.local.get([key]);
  return stored[key];
};

const chromeStorageSet = async (key: string, value: unknown): Promise<void> => {
  await chrome.storage.local.set({ [key]: value });
};

const chromeStorageRemove = async (key: string): Promise<void> => {
  await chrome.storage.local.remove([key]);
};

const chromeStorageClearPrefix = async (prefix: string): Promise<void> => {
  const all = await chrome.storage.local.get(null);
  const keysToRemove = Object.keys(all).filter((k) => k.startsWith(prefix));
  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
  }
};

// SDK methods exposed to App iframe (HostMethodsV1)
const createHostMethods = (app: AppContainerProps['app']) => ({
  async getProtocolInfo() {
    const canModify = hasPermission(app, 'extension.modify');
    const canCapture = hasPermission(app, 'extension.capture');
    const canNetwork =
      hasPermission(app, 'network') && (app.networkAllowlist?.length ?? 0) > 0;

    return {
      protocolVersion: 1,
      platform: 'extension' as const,
      appId: app.id,
      capabilities: {
        storage: true,
        network: canNetwork,
        scheduler: false,
        fileWatch: false,
        fileWrite: false,
        notification: true,
        clipboard: false,
        ai: false,
        shell: false,
        extension: {
          read: true,
          events: true,
          modify: canModify,
          capture: canCapture,
        },
      },
    };
  },

  async storageGet(key: string) {
    const value = await chromeStorageGet(storageKey(app.id, key));
    return { success: true, value };
  },

  async storageSet(key: string, value: unknown) {
    await chromeStorageSet(storageKey(app.id, key), value);
    return { success: true };
  },

  async storageDelete(key: string) {
    await chromeStorageRemove(storageKey(app.id, key));
    return { success: true };
  },

  async storageClear() {
    await chromeStorageClearPrefix(`app:${app.id}:`);
    return { success: true };
  },

  async networkRequest(request: { url: string; options?: unknown }) {
    if (!hasPermission(app, 'network')) {
      return {
        success: false,
        code: 'PERMISSION_DENIED',
        error: 'Network permission denied.',
      };
    }

    if (!isUrlAllowed(request.url, app.networkAllowlist)) {
      return {
        success: false,
        code: 'NETWORK_NOT_ALLOWED',
        error: 'URL not in allowlist.',
      };
    }

    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'NETWORK_REQUEST', payload: request },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({
              success: false,
              code: 'INTERNAL_ERROR',
              error: chrome.runtime.lastError.message,
            });
            return;
          }
          resolve(response);
        },
      );
    });
  },

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
          resolve({ text: response?.text || '', rect: response?.rect || null });
        }
      );
    });
  },

  // Highlight element (returns highlightId for removal)
  async highlight(selector: string, color?: string) {
    if (!hasPermission(app, 'extension.modify')) {
      return { success: false, error: 'PERMISSION_DENIED' };
    }
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
    if (!hasPermission(app, 'extension.modify')) {
      return { success: false, error: 'PERMISSION_DENIED' };
    }
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
    if (!hasPermission(app, 'extension.modify')) {
      return { success: false, error: 'PERMISSION_DENIED' };
    }
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
    if (!hasPermission(app, 'extension.modify')) {
      return { success: false, error: 'PERMISSION_DENIED' };
    }
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
    if (!hasPermission(app, 'extension.modify')) {
      return { success: false, error: 'PERMISSION_DENIED' };
    }
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
    if (!hasPermission(app, 'extension.modify')) {
      return { success: false, error: 'PERMISSION_DENIED' };
    }
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
    if (!hasPermission(app, 'extension.modify')) {
      return { success: false, error: 'PERMISSION_DENIED' };
    }
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
    if (!hasPermission(app, 'extension.capture')) {
      return { success: false, error: 'PERMISSION_DENIED' };
    }
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
      activeChildRef.onSelectionChange(message.text, message.rect, message.url);
    }
  }
});

type ActiveChildRef = {
  onContextMenuEvent?: (event: unknown) => void;
  onSelectionChange?: (text: string, rect: { x: number; y: number; width: number; height: number } | null, url: string) => void;
};

// Reference to currently active App child
let activeChildRef: ActiveChildRef | null = null;

export default function AppContainer({ app, onBack }: AppContainerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const connectionRef = useRef<Connection<object> | null>(null);

  useEffect(() => {
    if (!iframeRef.current) return;

    // Establish penpal connection
    const methods = createHostMethods(app);
    const connection = connectToChild({
      iframe: iframeRef.current,
      methods,
    });

    connectionRef.current = connection;

    connection.promise.then((child) => {
      console.log('[GemiGo Host] Connected to app:', app.name);
      // Store child reference for Host → App callbacks
      activeChildRef = child as ActiveChildRef;
    }).catch((err) => {
      console.error('[GemiGo Host] Connection failed:', err);
    });

    return () => {
      activeChildRef = null;
      connection.destroy();
    };
  }, [app]);

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

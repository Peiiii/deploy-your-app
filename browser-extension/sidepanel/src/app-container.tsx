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

  // Highlight element
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

  // Send notification
  async notify(options: { title: string; message: string }) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '/icons/icon48.png',
      title: options.title,
      message: options.message,
    });
    return true;
  },
});

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
      console.log('[GemiGo Host] Connected to app:', app.name, child);
    }).catch((err) => {
      console.error('[GemiGo Host] Connection failed:', err);
    });

    return () => {
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

/**
 * App Container Component
 * 
 * Renders an app in an iframe and establishes Penpal communication.
 */

import { useEffect, useRef } from 'react';
import { connectToChild, Connection } from 'penpal';
import { createHostMethods } from './host-methods';
import type { AppConfig } from './types';

interface AppContainerProps {
  app: AppConfig;
  onBack: () => void;
}

type ActiveChildRef = {
  onContextMenuEvent?: (event: unknown) => void;
  onSelectionChange?: (
    text: string,
    rect: { x: number; y: number; width: number; height: number } | null,
    url?: string
  ) => void;
};

// Reference to currently active App child for event forwarding
let activeChildRef: ActiveChildRef | null = null;

/**
 * Handle SELECTION_CHANGED messages from service worker.
 */
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SELECTION_CHANGED' && activeChildRef?.onSelectionChange) {
    activeChildRef.onSelectionChange(
      message.text || '',
      message.rect || null,
      message.url
    );
  }

  if (message.type === 'CONTEXT_MENU_CLICKED' && activeChildRef?.onContextMenuEvent) {
    activeChildRef.onContextMenuEvent(message.event);
  }
});

export default function AppContainer({ app, onBack }: AppContainerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const connectionRef = useRef<Connection<object> | null>(null);

  useEffect(() => {
    if (!iframeRef.current) return;

    // Create host methods for this app
    const methods = createHostMethods(app);

    // Establish Penpal connection
    const connection = connectToChild({
      iframe: iframeRef.current,
      methods: methods as unknown as Record<string, (...args: unknown[]) => unknown>,
    });

    connectionRef.current = connection;

    connection.promise
      .then((child) => {
        console.log('[GemiGo Host] Connected to app:', app.name);
        activeChildRef = child as ActiveChildRef;
      })
      .catch((err) => {
        console.error('[GemiGo Host] Connection failed:', err);
      });

    return () => {
      activeChildRef = null;
      connection.destroy();
    };
  }, [app]);

  return (
    <div className="app-container">
      <div className="app-header">
        <button className="back-btn" onClick={onBack}>
          ←
        </button>
        <span className="app-icon">{app.icon}</span>
        <span className="app-name">{app.name}</span>
      </div>
      <iframe
        ref={iframeRef}
        src={app.url}
        className="app-iframe"
        sandbox="allow-scripts allow-same-origin allow-forms"
        title={app.name}
      />
    </div>
  );
}

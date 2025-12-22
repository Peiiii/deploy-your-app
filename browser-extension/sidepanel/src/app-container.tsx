/**
 * App Container Component
 *
 * Renders an app in an iframe and establishes Penpal communication.
 */

import { useRef } from 'react';
import { useAppConnection, AppBridgeRegistry } from './hooks/use-app-connection';
import type { AppConfig } from './types';


interface AppContainerProps {
  app: AppConfig;
  onBack: () => void;
}

/**
 * Handle messages from service worker (SELECTION_CHANGED, CONTEXT_MENU_CLICKED).
 */
chrome.runtime.onMessage.addListener((message) => {
  AppBridgeRegistry.dispatch(message);
});


export default function AppContainer({ app, onBack }: AppContainerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Manage Penpal connection via custom hook
  useAppConnection(iframeRef, app);


  return (
    <div className="app-container">
      <div className="app-toolbar">
        <button className="back-btn" onClick={onBack} title="Back to home">
          ←
        </button>
        <div className="app-title">
          <span className="app-title-icon">{app.icon}</span>
          <span className="app-name">{app.name}</span>
        </div>
        <button
          className="refresh-btn"
          onClick={() => {
            if (iframeRef.current) {
              iframeRef.current.src = app.url;
            }
          }}
          title="Reload App"
        >
          ↻
        </button>
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

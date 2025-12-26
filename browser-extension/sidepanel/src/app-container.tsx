/**
 * App Container Component
 *
 * Renders an app in an iframe and establishes Penpal communication.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppConnection, AppBridgeRegistry } from './hooks/use-app-connection';
import type { AppConfig } from './types';
import { sendMessage } from './utils/messaging';


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
  const [activeUrl, setActiveUrl] = useState<string>('');
  const [siteAccess, setSiteAccess] = useState<'unknown' | 'granted' | 'missing' | 'restricted'>(
    'unknown',
  );
  const [siteAccessError, setSiteAccessError] = useState<string>('');

  // Manage Penpal connection via custom hook
  useAppConnection(iframeRef, app);

  const originPattern = useMemo(() => {
    if (!activeUrl) return '';
    try {
      const origin = new URL(activeUrl).origin;
      return `${origin}/*`;
    } catch {
      return '';
    }
  }, [activeUrl]);

  useEffect(() => {
    let cancelled = false;

    const refreshActivePage = async () => {
      try {
        const info = await sendMessage<{ url: string; title: string } | null>({ type: 'getPageInfo' });
        if (cancelled) return;

        const url = info?.url || '';
        setActiveUrl(url);
        setSiteAccessError('');

        if (!url) {
          setSiteAccess('missing');
          return;
        }

        if (url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('about:')) {
          setSiteAccess('restricted');
          return;
        }

        let pattern = '';
        try {
          pattern = `${new URL(url).origin}/*`;
        } catch {
          pattern = '';
        }
        if (!pattern) {
          setSiteAccess('missing');
          return;
        }

        chrome.permissions.contains({ origins: [pattern] }, (has) => {
          if (cancelled) return;
          setSiteAccess(has ? 'granted' : 'missing');
        });
      } catch (e) {
        if (cancelled) return;
        // Keep the last known URL so the UI doesn't flicker when background is briefly unavailable.
        setSiteAccessError(e instanceof Error ? e.message : String(e));
      }
    };

    // Initial refresh + polling so switching tabs updates the banner state.
    setSiteAccess('unknown');
    void refreshActivePage();
    const timer = window.setInterval(() => void refreshActivePage(), 1500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [app.id]);

  const requestSiteAccess = async () => {
    setSiteAccessError('');

    if (!originPattern) {
      setSiteAccessError('No active page URL detected.');
      return;
    }

    const granted = await new Promise<boolean>((resolve) => {
      chrome.permissions.request({ origins: [originPattern] }, (ok) => resolve(Boolean(ok)));
    });

    if (!granted) {
      setSiteAccessError('Permission request was denied.');
      return;
    }

    setSiteAccess('granted');
    // Trigger a ping to ensure the content script is injected and ready.
    try {
      await sendMessage({ type: 'ping', routing: 'content-script' });
    } catch (e) {
      setSiteAccessError(e instanceof Error ? e.message : String(e));
    }
  };

  const requestAllSitesAccess = async () => {
    setSiteAccessError('');

    const granted = await new Promise<boolean>((resolve) => {
      chrome.permissions.request(
        { origins: ['https://*/*', 'http://*/*'] },
        (ok) => resolve(Boolean(ok)),
      );
    });

    if (!granted) {
      setSiteAccessError('Permission request was denied.');
      return;
    }

    // Re-check current origin after granting.
    if (!originPattern) {
      setSiteAccess('granted');
      return;
    }

    chrome.permissions.contains({ origins: [originPattern] }, (has) => {
      setSiteAccess(has ? 'granted' : 'missing');
    });

    try {
      await sendMessage({ type: 'ping', routing: 'content-script' });
    } catch (e) {
      setSiteAccessError(e instanceof Error ? e.message : String(e));
    }
  };

  const retryInject = async () => {
    setSiteAccessError('');
    try {
      const res = await sendMessage<any>({ type: 'ping', routing: 'content-script' });
      if (res?.pong === true) {
        setSiteAccess('granted');
        return;
      }
      if (res?.success === false) {
        setSiteAccessError(res.error || 'Content script not available.');
        setSiteAccess('missing');
        return;
      }
      setSiteAccessError('Content script not available.');
      setSiteAccess('missing');
    } catch (e) {
      setSiteAccessError(e instanceof Error ? e.message : String(e));
      setSiteAccess('missing');
    }
  };

  const accessBadge = (() => {
    if (siteAccess === 'granted') return { text: '已授权', bg: '#dcfce7', fg: '#166534' };
    if (siteAccess === 'missing') return { text: '未授权', bg: '#fee2e2', fg: '#991b1b' };
    if (siteAccess === 'restricted') return { text: '受限', bg: '#e2e8f0', fg: '#334155' };
    return { text: '检测中', bg: '#e2e8f0', fg: '#334155' };
  })();

  if (import.meta.env.DEV) {
    console.debug('[AppContainer] state', { siteAccess, originPattern, activeUrl });
  }

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
      {/* Access bar: always visible so users can always find the entry point */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          fontSize: 12,
          lineHeight: 1.4,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ opacity: 0.9, fontWeight: 600 }}>页面权限</div>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 999,
              background: accessBadge.bg,
              color: accessBadge.fg,
              fontWeight: 600,
            }}
          >
            {accessBadge.text}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="install-btn" onClick={retryInject} title="重试注入/连接 content script">
              重试
            </button>
            <button
              className="install-btn"
              onClick={requestSiteAccess}
              disabled={siteAccess === 'restricted' || !originPattern}
              title={originPattern ? `授权：${originPattern}` : '未检测到可授权的页面'}
            >
              仅授权当前站点
            </button>
            <button
              className="install-btn"
              onClick={requestAllSitesAccess}
              disabled={siteAccess === 'restricted'}
              title="授予所有站点访问权限（可随时在扩展设置中撤销）"
            >
              Power Mode
            </button>
          </div>
        </div>

        <div style={{ opacity: 0.7, marginTop: 4, wordBreak: 'break-all' }}>
          {siteAccess === 'restricted'
            ? '受限页面（例如 chrome://）。Chrome 不允许扩展在此注入脚本。'
            : activeUrl
              ? `当前页面：${activeUrl}`
              : '当前没有检测到可用页面（请切回一个 http/https 网页）。'}
        </div>

        {siteAccessError && (
          <div style={{ marginTop: 6, color: '#ef4444', opacity: 0.95 }}>
            {siteAccessError}
          </div>
        )}
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

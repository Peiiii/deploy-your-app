import { useEffect, useMemo, useState } from 'react';
import AppContainer from './app-container';
import './App.css'; // Ensure CSS is imported
import type { AppConfig } from './types';

type ExploreProject = {
  id: string;
  name: string;
  description?: string;
  url?: string;
  providerUrl?: string;
  status?: string;
  isExtensionSupported?: boolean;
};

type ExploreProjectsResponse = {
  items: ExploreProject[];
  page: number;
  pageSize: number;
  total: number;
};

export interface InstalledApp extends AppConfig {
  description: string;
  iconBg: string;
}

const DEFAULT_API_BASE_URL = 'https://gemigo.io';
const API_BASE_URL_STORAGE_KEY = 'apiBaseUrl';
const DEFAULT_ICON_BG = 'linear-gradient(135deg, #0ea5e9, #6366f1)';
const DEFAULT_PAGE_SIZE = 50;

function pickIcon(projectName: string): string {
  const letter = (projectName || '').trim().charAt(0);
  return letter ? letter.toUpperCase() : '🧩';
}

function getProjectLiveUrl(project: ExploreProject): string | null {
  const candidate = project.url ?? project.providerUrl ?? null;
  if (!candidate) return null;
  const normalized = candidate.trim();
  return normalized.length > 0 ? normalized : null;
}

function isAllowedExtensionFrameUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.gemigo.app');
  } catch {
    return false;
  }
}

function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'apps' | 'explore'>('home');
  const [activeApp, setActiveApp] = useState<InstalledApp | null>(null);
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [apiBaseUrl, setApiBaseUrl] = useState<string>(DEFAULT_API_BASE_URL);
  const [exploreProjects, setExploreProjects] = useState<ExploreProject[]>([]);
  const [exploreQuery, setExploreQuery] = useState<string>('');
  const [exploreStatus, setExploreStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [exploreError, setExploreError] = useState<string>('');

  // Load installed apps + API base URL (Phase 1: no built-in demo apps)
  useEffect(() => {
    chrome.storage.local.get(['installedApps', API_BASE_URL_STORAGE_KEY], (result) => {
      setInstalledApps(result.installedApps || []);
      const storedBase = result[API_BASE_URL_STORAGE_KEY];
      if (typeof storedBase === 'string' && storedBase.length > 0) {
        setApiBaseUrl(storedBase);
      }
    });
  }, []);

  // Save to storage when apps change
  const saveApps = (apps: InstalledApp[]) => {
    setInstalledApps(apps);
    chrome.storage.local.set({ installedApps: apps });
  };

  const saveApiBaseUrl = (url: string) => {
    setApiBaseUrl(url);
    chrome.storage.local.set({ [API_BASE_URL_STORAGE_KEY]: url });
  };

  const exploreApps = useMemo(() => {
    return exploreProjects
      .filter((p) => (p.isExtensionSupported ?? false))
      .filter((p) => p.status === 'Live')
      .map((p) => {
        const url = getProjectLiveUrl(p);
        if (!url) return null;
        if (!isAllowedExtensionFrameUrl(url)) return null;
        return {
          id: p.id,
          name: p.name,
          description: p.description || '',
          icon: pickIcon(p.name),
          iconBg: DEFAULT_ICON_BG,
          url,
        } satisfies InstalledApp;
      })
      .filter((v): v is InstalledApp => Boolean(v));
  }, [exploreProjects]);

  const refreshExplore = async () => {
    setExploreStatus('loading');
    setExploreError('');
    try {
      const base = apiBaseUrl.replace(/\/+$/, '');
      const query = new URLSearchParams();
      query.set('is_extension_supported', '1');
      query.set('page', '1');
      query.set('pageSize', String(DEFAULT_PAGE_SIZE));
      query.set('sort', 'recent');
      if (exploreQuery.trim().length > 0) {
        query.set('search', exploreQuery.trim());
      }

      const url = `${base}/api/v1/projects/explore?${query.toString()}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load explore apps (${response.status})`);
      }
      const data = (await response.json()) as ExploreProjectsResponse;
      setExploreProjects(Array.isArray(data.items) ? data.items : []);
      setExploreStatus('ready');
    } catch (e) {
      setExploreProjects([]);
      setExploreStatus('error');
      setExploreError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    if (activeTab !== 'explore') return;
    if (exploreStatus !== 'idle') return;
    void refreshExplore();
  }, [activeTab, exploreStatus]);

  const handleInstallFromExplore = (app: InstalledApp) => {
    if (installedApps.some((installed) => installed.url === app.url)) return;

    const newApp: InstalledApp = { ...app, id: `project-${encodeURIComponent(app.id)}` };
    saveApps([...installedApps, newApp]);
    setActiveTab('home');
  };

  // Remove app
  const handleRemoveApp = (appId: string) => {
    saveApps(installedApps.filter((app) => app.id !== appId));
  };

  // Show app container if an app is active
  if (activeApp) {
    return <AppContainer app={activeApp} onBack={() => setActiveApp(null)} />;
  }

  return (
    <div className="sidepanel">
      {/* Header */}
      <header className="header">
        <div className="logo">
          <div className="logo-icon" />
          <span>
            Gemi<span style={{ color: '#8b5cf6' }}>Go</span>
          </span>
        </div>
        <div className="header-actions">
          <button className="icon-btn" title="Notifications">
            🔔
          </button>
          <button className="icon-btn" title="Settings">
            ⚙️
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="tabs">
        <button
          className={`tab ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
        >
          Home
        </button>
        <button
          className={`tab ${activeTab === 'apps' ? 'active' : ''}`}
          onClick={() => setActiveTab('apps')}
        >
          Apps
        </button>
        <button
          className={`tab ${activeTab === 'explore' ? 'active' : ''}`}
          onClick={() => setActiveTab('explore')}
        >
          Explore
        </button>
      </nav>

      {/* Content */}
      {activeTab === 'home' && (
        <>
          <div className="section-title">Installed Apps</div>
          <div className="app-list">
            {installedApps.length === 0 && (
              <div className="app-item-manage">
                <div className="app-info">
                  <div className="app-name">No apps installed</div>
                  <div className="app-desc">Go to Explore to install extension-compatible apps.</div>
                </div>
              </div>
            )}
            {installedApps.map((app) => (
              <div key={app.id} className="app-item" onClick={() => setActiveApp(app)}>
                <div className="app-icon" style={{ background: app.iconBg }}>
                  {app.icon}
                </div>
                <div className="app-info">
                  <div className="app-name">{app.name}</div>
                  <div className="app-desc">{app.description}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'apps' && (
        <>
          <div className="section-title">Manage Apps</div>
          <div className="app-list">
            {installedApps.map((app) => (
              <div key={app.id} className="app-item-manage">
                <div className="app-icon" style={{ background: app.iconBg }}>
                  {app.icon}
                </div>
                <div className="app-info">
                  <div className="app-name">{app.name}</div>
                  <div className="app-desc">{app.url}</div>
                </div>
                <button
                  className="remove-btn"
                  onClick={() => handleRemoveApp(app.id)}
                  title="Remove app"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'explore' && (
        <>
          <div className="section-title">Explore (Extension-compatible)</div>
          <div className="app-list">
            <div className="app-item-manage" style={{ alignItems: 'flex-start' }}>
              <div className="app-info" style={{ width: '100%' }}>
                <div className="app-name">API Base URL</div>
                <div className="app-desc">
                  Phase 1 reuses the platform Explore API and filters by <code>is_extension_supported=1</code>.
                </div>
                <input
                  style={{ width: '100%', marginTop: 8 }}
                  value={apiBaseUrl}
                  onChange={(e) => saveApiBaseUrl(e.target.value)}
                  placeholder={DEFAULT_API_BASE_URL}
                />
                <input
                  style={{ width: '100%', marginTop: 8 }}
                  value={exploreQuery}
                  onChange={(e) => setExploreQuery(e.target.value)}
                  placeholder="Search…"
                />
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button
                    className="install-btn"
                    onClick={refreshExplore}
                    disabled={exploreStatus === 'loading'}
                  >
                    {exploreStatus === 'loading' ? 'Loading…' : 'Refresh'}
                  </button>
                </div>
                {exploreStatus === 'error' && (
                  <div className="app-desc" style={{ marginTop: 8, color: '#ef4444' }}>
                    Failed to load explore apps: {exploreError}
                  </div>
                )}
              </div>
            </div>

            {exploreStatus === 'ready' && exploreApps.length === 0 && (
              <div className="app-item-manage">
                <div className="app-info">
                  <div className="app-name">No extension apps</div>
                  <div className="app-desc">
                    No projects matched the extension filter (or they are not Live / not under <code>*.gemigo.app</code>).
                  </div>
                </div>
              </div>
            )}

            {exploreApps.map((app) => {
              const isInstalled = installedApps.some((installed) => installed.url === app.url);
              return (
                <div key={app.id} className="app-item-market">
                  <div className="app-icon" style={{ background: app.iconBg || DEFAULT_ICON_BG }}>
                    {app.icon}
                  </div>
                  <div className="app-info">
                    <div className="app-name">{app.name}</div>
                    <div className="app-desc">{app.description}</div>
                    <div className="app-meta">
                      <span className="app-category">extension</span>
                    </div>
                  </div>
                  <button
                    className={`install-btn ${isInstalled ? 'installed' : ''}`}
                    onClick={() => !isInstalled && handleInstallFromExplore(app)}
                    disabled={isInstalled}
                  >
                    {isInstalled ? 'Installed' : 'Install'}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default App;

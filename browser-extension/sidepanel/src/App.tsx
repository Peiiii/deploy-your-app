import { useState, useEffect } from 'react';
import AppContainer from './app-container';
import { marketApps, MarketApp } from './market-apps';
import AddAppModal from './add-app-modal';
import './App.css'; // Ensure CSS is imported

export interface InstalledApp {
  id: string;
  name: string;
  description: string;
  icon: string;
  iconBg: string;
  url: string;
  permissions?: Array<'extension.modify' | 'extension.capture' | 'network'>;
  networkAllowlist?: string[];
}

// Default apps for demo
const defaultApps: InstalledApp[] = [
  {
    id: 'demo-1',
    name: 'Demo App',
    description: 'Demo application',
    icon: '🎯',
    iconBg: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    url: 'https://example.com',
    permissions: [],
    networkAllowlist: [],
  },
];

function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'apps' | 'explore'>('home');
  const [activeApp, setActiveApp] = useState<InstalledApp | null>(null);
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  // Load installed apps from storage and sync with market
  useEffect(() => {
    chrome.storage.local.get(['installedApps'], (result) => {
      let apps = result.installedApps || [];
      
      if (apps.length === 0) {
        apps = defaultApps;
      }

      // Sync with market apps (update URLs/meta if changed)
      const syncedApps = apps.map((app: InstalledApp) => {
        // Find matching market app by ID (stripping any timestamp suffix if necessary, 
        // but market installs use unique IDs like 'app-TIMESTAMP' currently. 
        // Actually, we should check if the app *originated* from a market app ID.
        // For simplicity, let's match by URL or Name if ID is dynamic.
        // Better yet: Let's assume for now we perform a URL match update if found in market.
        
        const marketMatch = marketApps.find(m => m.url === app.url || m.name === app.name);
        if (marketMatch) {
            return {
                ...app,
                name: marketMatch.name,
                description: marketMatch.description,
                icon: marketMatch.icon,
                iconBg: marketMatch.iconBg,
                url: marketMatch.url,
                permissions: marketMatch.permissions ?? app.permissions ?? [],
                networkAllowlist: marketMatch.networkAllowlist ?? app.networkAllowlist ?? [],
            };
        }
        return app;
      });

      setInstalledApps(syncedApps);
      // Persist the synced version back to storage
      if (JSON.stringify(syncedApps) !== JSON.stringify(result.installedApps)) {
        chrome.storage.local.set({ installedApps: syncedApps });
      }
    });
  }, []);

  // Save to storage when apps change
  const saveApps = (apps: InstalledApp[]) => {
    setInstalledApps(apps);
    chrome.storage.local.set({ installedApps: apps });
  };

  // Add new app
  const handleAddApp = (app: Omit<InstalledApp, 'id'>) => {
    if (installedApps.some((installed) => installed.url === app.url)) return;

    const newApp: InstalledApp = {
      ...app,
      id: `custom-${encodeURIComponent(app.url)}`,
      permissions: app.permissions ?? [],
      networkAllowlist: app.networkAllowlist ?? [],
    };
    saveApps([...installedApps, newApp]);
    setShowAddModal(false);
  };

  // Install from market
  const handleInstallFromMarket = (marketApp: MarketApp) => {
    // Check if URL already installed
    if (installedApps.some(app => app.url === marketApp.url)) return;

    const newApp: InstalledApp = {
      id: `market-${encodeURIComponent(marketApp.url)}`,
      name: marketApp.name,
      description: marketApp.description,
      icon: marketApp.icon,
      iconBg: marketApp.iconBg,
      url: marketApp.url,
      permissions: marketApp.permissions ?? [],
      networkAllowlist: marketApp.networkAllowlist ?? [],
    };
    saveApps([...installedApps, newApp]);
    setActiveTab('home'); // Switch to home to show new app
  };

  // Remove app
  const handleRemoveApp = (appId: string) => {
    saveApps(installedApps.filter(app => app.id !== appId));
  };

  // Show app container if an app is active
  if (activeApp) {
    return (
      <AppContainer
        app={activeApp}
        onBack={() => setActiveApp(null)}
      />
    );
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
            {installedApps.map((app) => (
              <div
                key={app.id}
                className="app-item"
                onClick={() => setActiveApp(app)}
              >
                <div
                  className="app-icon"
                  style={{ background: app.iconBg }}
                >
                  {app.icon}
                </div>
                <div className="app-info">
                  <div className="app-name">{app.name}</div>
                  <div className="app-desc">{app.description}</div>
                </div>
              </div>
            ))}

            {/* Add App Button */}
            <div
              className="app-item add-app-btn"
              onClick={() => setShowAddModal(true)}
            >
              <div className="app-icon add-icon">
                +
              </div>
              <div className="app-info">
                <div className="app-name">Add Custom App</div>
                <div className="app-desc">Enter URL to add test app</div>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'apps' && (
        <>
          <div className="section-title">Manage Apps</div>
          <div className="app-list">
            {installedApps.map((app) => (
              <div key={app.id} className="app-item-manage">
                <div
                  className="app-icon"
                  style={{ background: app.iconBg }}
                >
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
          <div className="section-title">Discover Apps</div>
          <div className="app-list">
            {marketApps.map((app) => {
              const isInstalled = installedApps.some(installed => installed.url === app.url);
              
              return (
                <div key={app.id} className="app-item-market">
                  <div
                    className="app-icon"
                    style={{ background: app.iconBg }}
                  >
                    {app.icon}
                  </div>
                  <div className="app-info">
                    <div className="app-name">{app.name}</div>
                    <div className="app-desc">{app.description}</div>
                    <div className="app-meta">
                      <span className="app-category">{app.category}</span>
                      <span className="app-author">by {app.author}</span>
                    </div>
                  </div>
                  <button
                    className={`install-btn ${isInstalled ? 'installed' : ''}`}
                    onClick={() => !isInstalled && handleInstallFromMarket(app)}
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

      {/* Add App Modal */}
      {showAddModal && (
        <AddAppModal
          onAdd={handleAddApp}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

export default App;

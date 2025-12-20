import { useState, useEffect } from 'react';
import AppContainer from './app-container';
import AddAppModal from './add-app-modal';

export interface InstalledApp {
  id: string;
  name: string;
  description: string;
  icon: string;
  iconBg: string;
  url: string;
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
  },
];

function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'apps' | 'explore'>('home');
  const [activeApp, setActiveApp] = useState<InstalledApp | null>(null);
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  // Load installed apps from storage
  useEffect(() => {
    chrome.storage.local.get(['installedApps'], (result) => {
      if (result.installedApps && result.installedApps.length > 0) {
        setInstalledApps(result.installedApps);
      } else {
        setInstalledApps(defaultApps);
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
    const newApp: InstalledApp = {
      ...app,
      id: `custom-${Date.now()}`,
    };
    saveApps([...installedApps, newApp]);
    setShowAddModal(false);
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
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <h3>Explore</h3>
          <p>Discover more apps on the platform</p>
        </div>
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

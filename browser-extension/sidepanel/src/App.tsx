import { useState } from 'react';

interface InstalledApp {
  id: string;
  name: string;
  description: string;
  icon: string;
  iconBg: string;
}

const mockApps: InstalledApp[] = [
  {
    id: '1',
    name: 'AI 翻译助手',
    description: '选中文字即时翻译',
    icon: '🌐',
    iconBg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
  },
  {
    id: '2',
    name: '写作优化器',
    description: '优化你的文字表达',
    icon: '✍️',
    iconBg: 'linear-gradient(135deg, #10b981, #059669)',
  },
  {
    id: '3',
    name: '代码助手',
    description: '解释和生成代码',
    icon: '💻',
    iconBg: 'linear-gradient(135deg, #f59e0b, #d97706)',
  },
];

function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'apps' | 'explore'>('home');
  const [activeAppId, setActiveAppId] = useState<string | null>(null);

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
          <button className="icon-btn" title="通知">
            🔔
          </button>
          <button className="icon-btn" title="设置">
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
          首页
        </button>
        <button
          className={`tab ${activeTab === 'apps' ? 'active' : ''}`}
          onClick={() => setActiveTab('apps')}
        >
          我的应用
        </button>
        <button
          className={`tab ${activeTab === 'explore' ? 'active' : ''}`}
          onClick={() => setActiveTab('explore')}
        >
          探索
        </button>
      </nav>

      {/* Content */}
      {activeTab === 'home' && (
        <>
          <div className="section-title">已安装应用</div>
          <div className="app-list">
            {mockApps.map((app) => (
              <div
                key={app.id}
                className={`app-item ${activeAppId === app.id ? 'active' : ''}`}
                onClick={() => setActiveAppId(app.id)}
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
          </div>
        </>
      )}

      {activeTab === 'apps' && (
        <div className="empty-state">
          <div className="empty-state-icon">📦</div>
          <h3>我的应用</h3>
          <p>管理你安装的应用</p>
        </div>
      )}

      {activeTab === 'explore' && (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <h3>探索</h3>
          <p>发现更多有趣的应用</p>
        </div>
      )}
    </div>
  );
}

export default App;

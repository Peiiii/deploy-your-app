import React from 'react';
import { LayoutDashboard, Settings, Github, Rocket, Wifi, Database, X, Zap, Sparkles, Package } from 'lucide-react';
import { useUIStore } from '../stores/uiStore';
import { usePresenter } from '../contexts/PresenterContext';
import { APP_CONFIG } from '../constants';

export const Sidebar: React.FC = () => {
  const currentView = useUIStore((state) => state.currentView);
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const { setSidebarOpen } = useUIStore((state) => state.actions);
  const presenter = usePresenter();

  const navItems = [
    { id: 'deploy', label: 'Deploy App', icon: Package },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'explore', label: 'Explore Apps', icon: Sparkles },
    { id: 'integrations', label: 'Integrations', icon: Github },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const isMockMode = APP_CONFIG.USE_MOCK_ADAPTER;

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <div className={`w-64 h-screen fixed left-0 top-0 flex flex-col glass border-r-0 z-50 transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0 md:flex`}>
        <div className="p-8 pb-6 flex items-center gap-3 relative">
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden absolute top-4 right-4 p-1 text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        <div className="relative">
            <div className="absolute inset-0 bg-purple-500 blur opacity-40 rounded-lg"></div>
            <div className="relative w-9 h-9 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg border border-white/10">
                <Zap className="text-white w-5 h-5" />
            </div>
        </div>
        <div>
            <h1 className="font-bold text-lg tracking-tight text-slate-900 dark:text-white leading-none">Gemi<span className="text-purple-600 dark:text-purple-400">Go</span></h1>
            <span className="text-[10px] text-slate-500 dark:text-gray-500 font-mono tracking-wider uppercase">Magic Edition</span>
        </div>
      </div>

      <div className="px-6 mb-2">
         <p className="text-[10px] font-semibold text-slate-400 dark:text-gray-400 uppercase tracking-wider mb-2">MY PROJECTS</p>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                presenter.ui.navigateTo(item.id);
                // Close sidebar on mobile after navigation
                if (window.innerWidth < 768) {
                  setSidebarOpen(false);
                }
              }}
              className={`group w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 relative overflow-hidden ${
                isActive
                  ? 'text-slate-900 dark:text-white bg-slate-100/50 dark:bg-white/5'
                  : 'text-slate-500 dark:text-gray-400 bg-transparent dark:bg-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5'
              }`}
            >
              {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 dark:from-purple-500/20 to-transparent opacity-100"></div>
              )}
              <item.icon className={`w-5 h-5 transition-colors ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 group-hover:text-slate-600 dark:text-gray-500 dark:group-hover:text-gray-300'}`} />
              <span className="relative z-10">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 mx-4 mb-2 rounded-xl bg-gradient-to-b from-slate-100 to-transparent dark:from-white/5 border border-slate-200 dark:border-white/5">
        <div className="flex items-center gap-3">
           <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300 flex items-center justify-center border border-purple-500/20 dark:border-purple-500/30">
              <Rocket className="w-4 h-4" />
           </div>
           <div>
              <p className="text-xs font-medium text-slate-900 dark:text-white">The Showcase</p>
              <p className="text-[10px] text-slate-500 dark:text-gray-400">Pro Plan (Coming Soon)</p>
           </div>
        </div>
      </div>

      {/* Connection Status Indicator */}
      <div className="px-6 py-2">
        <div className={`flex items-center justify-between text-[10px] font-mono border rounded px-2 py-1.5 ${
            isMockMode 
            ? 'border-yellow-500/30 bg-yellow-500/5 text-yellow-600 dark:text-yellow-400' 
            : 'border-green-500/30 bg-green-500/5 text-green-600 dark:text-green-400'
        }`}>
            <span className="flex items-center gap-1.5 font-bold">
                {isMockMode ? <Database className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
                {isMockMode ? 'MOCK DATA' : 'CONNECTED'}
            </span>
            <span className={`w-1.5 h-1.5 rounded-full ${
                isMockMode ? 'bg-yellow-500' : 'bg-green-500 animate-pulse'
            }`}></span>
        </div>
      </div>

      <div className="p-4 border-t border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-black/20">
        <button className="flex items-center gap-3 w-full bg-transparent dark:bg-transparent hover:bg-slate-200/50 dark:hover:bg-white/5 p-2 rounded-lg transition-colors group">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 ring-2 ring-white dark:ring-slate-800 group-hover:ring-purple-500/50 dark:group-hover:ring-purple-400/50 transition-all"></div>
          <div className="text-left">
            <p className="text-sm font-medium text-slate-900 dark:text-white">Indie Hacker</p>
            <p className="text-xs text-slate-500 dark:text-gray-400">The Playground</p>
          </div>
        </button>
      </div>
      </div>
    </>
  );
};

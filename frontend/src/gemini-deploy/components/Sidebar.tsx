import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Rocket, Wifi, X, Zap, Sparkles, Package, Home, ChevronLeft, ChevronRight } from 'lucide-react';
import { useUIStore } from '../stores/uiStore';

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const { setSidebarOpen, toggleSidebarCollapsed } = useUIStore((state) => state.actions);
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/', label: t('navigation.home'), icon: Home },
    { path: '/explore', label: t('navigation.exploreApps'), icon: Sparkles },
    { path: '/deploy', label: t('navigation.deployApp'), icon: Package },
    { path: '/dashboard', label: t('navigation.dashboard'), icon: LayoutDashboard },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <div className={`h-screen fixed left-0 top-0 flex flex-col glass border-r-0 z-50 transition-all duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0 md:flex ${
        sidebarCollapsed ? 'w-16 md:w-16' : 'w-64 md:w-64'
      }`}>
        <div className={`p-8 pb-6 flex items-center gap-3 relative ${sidebarCollapsed ? 'justify-center' : ''}`}>
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
        {!sidebarCollapsed && (
          <div>
            <h1 className="font-bold text-lg tracking-tight text-slate-900 dark:text-white leading-none">Gemi<span className="text-purple-600 dark:text-purple-400">Go</span></h1>
            <span className="text-[10px] text-slate-500 dark:text-gray-500 font-mono tracking-wider uppercase">Magic Edition</span>
          </div>
        )}
        </div>

        {/* Collapse Toggle Button */}
        <button
          onClick={toggleSidebarCollapsed}
          className="hidden md:flex absolute top-4 -right-3 w-6 h-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full items-center justify-center shadow-md hover:shadow-lg transition-all z-50 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          aria-label={sidebarCollapsed ? t('ui.expandSidebar') : t('ui.collapseSidebar')}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>

        {!sidebarCollapsed && (
          <div className="px-6 mb-2">
            <p className="text-[10px] font-semibold text-slate-400 dark:text-gray-400 uppercase tracking-wider mb-2">{t('navigation.myProjects').toUpperCase()}</p>
          </div>
        )}

        <nav className={`flex-1 space-y-1 ${sidebarCollapsed ? 'px-2' : 'px-4'}`}>
        {navItems.map((item) => {
          const isActive = item.path === '/' 
            ? location.pathname === '/' 
            : location.pathname.startsWith(item.path);
          return (
            <button
              key={item.path}
              onClick={() => {
                navigate(item.path);
                // Close sidebar on mobile after navigation
                if (window.innerWidth < 768) {
                  setSidebarOpen(false);
                }
              }}
              className={`group flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200 relative overflow-hidden ${
                sidebarCollapsed ? 'w-10 h-10 justify-center p-0 mx-auto' : 'w-full min-h-[44px] px-4 py-3'
              } ${
                isActive
                  ? 'text-slate-900 dark:text-white bg-slate-100/50 dark:bg-white/5'
                  : 'text-slate-500 dark:text-gray-400 bg-transparent dark:bg-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5'
              }`}
            >
              {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 dark:from-purple-500/20 to-transparent opacity-100"></div>
              )}
              <item.icon className={`flex-shrink-0 transition-colors ${sidebarCollapsed ? 'w-5 h-5' : 'w-5 h-5'} ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 group-hover:text-slate-600 dark:text-gray-500 dark:group-hover:text-gray-300'}`} />
              {!sidebarCollapsed && (
                <span className="relative z-10 whitespace-nowrap flex-shrink-0">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {!sidebarCollapsed && (
        <div className="p-4 mx-4 mb-2 rounded-xl bg-gradient-to-b from-slate-100 to-transparent dark:from-white/5 border border-slate-200 dark:border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300 flex items-center justify-center border border-purple-500/20 dark:border-purple-500/30">
              <Rocket className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-900 dark:text-white">{t('ui.theShowcase')}</p>
              <p className="text-[10px] text-slate-500 dark:text-gray-400">{t('ui.proPlan')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Connection Status Indicator */}
      {!sidebarCollapsed && (
        <div className="px-6 py-2">
          <div className="flex items-center justify-between text-[10px] font-mono border border-green-500/30 bg-green-500/5 text-green-600 dark:text-green-400 rounded px-2 py-1.5">
            <span className="flex items-center gap-1.5 font-bold">
              <Wifi className="w-3 h-3" />
              {t('ui.connected')}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
          </div>
        </div>
      )}

      <div className={`p-4 border-t border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-black/20 ${sidebarCollapsed ? 'flex justify-center' : ''}`}>
        <button className={`flex items-center gap-3 w-full bg-transparent dark:bg-transparent hover:bg-slate-200/50 dark:hover:bg-white/5 p-2 rounded-lg transition-colors group ${sidebarCollapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 ring-2 ring-white dark:ring-slate-800 group-hover:ring-purple-500/50 dark:group-hover:ring-purple-400/50 transition-all shrink-0"></div>
          {!sidebarCollapsed && (
            <div className="text-left">
              <p className="text-sm font-medium text-slate-900 dark:text-white">{t('ui.indieHacker')}</p>
              <p className="text-xs text-slate-500 dark:text-gray-400">{t('ui.thePlayground')}</p>
            </div>
          )}
        </button>
      </div>
      </div>
    </>
  );
};

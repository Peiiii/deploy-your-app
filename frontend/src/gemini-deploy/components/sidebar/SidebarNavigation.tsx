import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Sparkles, Package, Home, User } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { useBreakpoint } from '../../hooks/useBreakpoint';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const SidebarNavigation: React.FC<{ collapsed: boolean }> = ({ collapsed }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { setSidebarOpen } = useUIStore((state) => state.actions);
  const authUser = useAuthStore((s) => s.user);
  const { isMobile } = useBreakpoint();

  const navItems: NavItem[] = [
    { path: '/', label: t('navigation.home'), icon: Home },
    { path: '/explore', label: t('navigation.exploreApps'), icon: Sparkles },
    { path: '/deploy', label: t('navigation.deployApp'), icon: Package },
    ...(authUser
      ? [
          { path: '/dashboard', label: t('navigation.dashboard'), icon: LayoutDashboard },
          { path: '/me', label: t('navigation.profile'), icon: User },
        ]
      : []),
  ];

  return (
    <div className="space-y-1 flex-shrink-0">
      {navItems.map((item) => {
        const isActive = item.path === '/' 
          ? location.pathname === '/' 
          : location.pathname.startsWith(item.path);
        const isHome = item.path === '/';
        return (
          <button
            key={item.path}
            onClick={() => {
              navigate(item.path);
              if (isMobile) {
                setSidebarOpen(false);
              }
            }}
            className={`group items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200 relative overflow-hidden ${
              isHome ? 'hidden md:flex' : 'flex'
            } ${
              collapsed ? 'w-10 h-10 justify-center p-0 mx-auto' : 'w-full min-h-[44px] px-4 py-3'
            } ${
              isActive
                ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800'
                : 'text-slate-500 dark:text-gray-400 bg-transparent dark:bg-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <item.icon className={`flex-shrink-0 transition-colors ${collapsed ? 'w-5 h-5' : 'w-5 h-5'} ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 group-hover:text-slate-600 dark:text-gray-500 dark:group-hover:text-gray-300'}`} />
            {!collapsed && (
              <span className="relative z-10 whitespace-nowrap flex-shrink-0">{item.label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

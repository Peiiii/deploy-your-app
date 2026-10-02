import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Sparkles, Package, Home, User, MessagesSquare } from 'lucide-react';
import { useUIStore } from '../../stores/ui.store';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { preloadRoute } from '@/route-loader';
import { useBreakpoint } from '../../hooks/use-breakpoint';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const SidebarNavigation: React.FC<{ collapsed: boolean }> = ({ collapsed }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { setSidebarOpen } = useUIStore((state) => state.actions);
  const authUser = useAuthStore((s) => s.user);
  const { isMobile } = useBreakpoint();

  const navItems: NavItem[] = [
    { path: '/', label: t('navigation.home'), icon: Home },
    { path: '/explore', label: t('navigation.exploreApps'), icon: Sparkles },
    { path: '/community', label: t('navigation.community'), icon: MessagesSquare },
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
        return (
          <Link
            to={item.path}
            onPointerEnter={() => { void preloadRoute(item.path); }}
            onFocus={() => { void preloadRoute(item.path); }}
            key={item.path}
            aria-current={isActive ? 'page' : undefined}
            aria-label={item.label}
            title={collapsed ? item.label : undefined}
            data-event="navigation_click"
            onClick={() => {
              if (isMobile) {
                setSidebarOpen(false);
              }
            }}
            className={`group flex items-center gap-3 rounded-lg text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 relative overflow-hidden ${collapsed ? 'w-10 h-10 justify-center p-0 mx-auto' : 'w-full min-h-10 px-3 py-2'
              } ${isActive
                ? 'font-medium text-app-text bg-app-surfaceHighlight'
                : 'font-medium text-slate-600 dark:text-slate-400 bg-transparent hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-white/5'
              }`}
          >
            <item.icon className={`flex-shrink-0  ${collapsed ? 'w-5 h-5' : 'w-5 h-5'} ${isActive ? 'text-app-text' : 'text-app-muted'}`} />
            {!collapsed && (
              <span className="relative z-10 whitespace-nowrap flex-shrink-0">{item.label}</span>
            )}

          </Link>
        );
      })}
    </div>
  );
};

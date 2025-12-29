import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Sparkles, Package, Home, User } from 'lucide-react';
import { useUIStore } from '../../stores/ui.store';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useBreakpoint } from '../../hooks/use-breakpoint';

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
        return (
          <button
            key={item.path}
            onClick={() => {
              navigate(item.path);
              if (isMobile) {
                setSidebarOpen(false);
              }
            }}
            className={`group flex items-center gap-3 rounded-xl text-[15px] transition-all duration-300 relative overflow-hidden ${collapsed ? 'w-10 h-10 justify-center p-0 mx-auto' : 'w-full min-h-[44px] px-4 py-2.5'
              } ${isActive
                ? 'font-bold text-brand-600 dark:text-white bg-brand-50/50 dark:bg-white/10'
                : 'font-medium text-slate-500 dark:text-slate-400 bg-transparent hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-white/5'
              }`}
          >
            <item.icon className={`flex-shrink-0 transition-transform duration-300 group-hover:scale-110 ${collapsed ? 'w-5 h-5' : 'w-5 h-5'} ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-slate-500'}`} />
            {!collapsed && (
              <span className="relative z-10 whitespace-nowrap flex-shrink-0">{item.label}</span>
            )}
            {isActive && !collapsed && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand-600 dark:bg-brand-400 rounded-r-full" />
            )}
          </button>
        );
      })}
    </div>
  );
};

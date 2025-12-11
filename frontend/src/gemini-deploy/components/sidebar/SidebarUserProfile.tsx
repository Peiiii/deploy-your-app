import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { usePresenter } from '../../contexts/PresenterContext';

interface SidebarUserProfileProps {
  collapsed: boolean;
}

export const SidebarUserProfile: React.FC<SidebarUserProfileProps> = ({ collapsed }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const { setSidebarOpen } = useUIStore((state) => state.actions);
  const presenter = usePresenter();

  const handleClick = () => {
    if (authUser) {
      navigate('/me');
    } else {
      presenter.auth.openAuthModal('login');
    }
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className={`p-4 border-t border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-black/20 ${collapsed ? 'flex justify-center' : ''}`}>
      <button
        type="button"
        onClick={handleClick}
        className={`flex items-center gap-3 w-full bg-transparent dark:bg-transparent hover:bg-slate-200/50 dark:hover:bg-white/5 p-2 rounded-lg transition-colors group ${collapsed ? 'justify-center' : ''}`}
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 ring-2 ring-white dark:ring-slate-800 group-hover:ring-purple-500/50 dark:group-hover:ring-purple-400/50 transition-all shrink-0 flex items-center justify-center text-xs font-semibold text-white">
          {(authUser?.displayName || authUser?.email || 'U')
            .toUpperCase()
            .charAt(0)}
        </div>
        {!collapsed && (
          <div className="text-left">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {authUser?.displayName || authUser?.email || t('ui.indieHacker')}
            </p>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              {t('profile.publicProfile')}
            </p>
          </div>
        )}
      </button>
    </div>
  );
};

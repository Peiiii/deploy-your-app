import React from 'react';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '@/stores/ui.store';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { usePresenter } from '@/contexts/presenter-context';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Bell, HelpCircle, Sun, Moon, Menu } from 'lucide-react';
import { Crisp } from 'crisp-sdk-web';

export const Header: React.FC = () => {
    const { t } = useTranslation();
    const theme = useUIStore((state) => state.theme);
    const presenter = usePresenter();
    const user = useAuthStore((state) => state.user);

    const handleOpenChat = () => {
        const websiteId = import.meta.env.VITE_CRISP_WEBSITE_ID;
        if (!websiteId) {
            console.warn('Crisp is not configured.');
            return;
        }
        try {
            Crisp.chat.open();
            Crisp.chat.show();
        } catch (error) {
            console.error('Failed to open Crisp chat:', error);
        }
    };

    return (
        <header className="h-16 border-b border-app-border bg-app-bg/50 backdrop-blur relative z-40 flex items-center justify-between px-4 md:px-8">
            <div className="flex items-center gap-3">
                <button
                    onClick={presenter.ui.toggleSidebar}
                    className="md:hidden p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-200/50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5 rounded-lg transition-all"
                    title={t('ui.toggleMenu')}
                >
                    <Menu className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-gray-500">
                    <span className="hover:text-slate-800 dark:hover:text-gray-300 transition-colors cursor-pointer">
                        {t('navigation.organization')}
                    </span>
                    <span>/</span>
                    <span className="text-slate-900 dark:text-gray-200 font-medium">
                        {t('navigation.personalProjects')}
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
                <button
                    onClick={presenter.ui.toggleTheme}
                    className="p-2 text-slate-400 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5 rounded-full transition-all"
                    title={t('ui.toggleTheme')}
                >
                    {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <LanguageSwitcher />
                <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-1 hidden md:block" />
                <button
                    onClick={handleOpenChat}
                    className="p-2 text-slate-400 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5 rounded-full transition-all hidden md:block"
                    title={t('ui.help')}
                >
                    <HelpCircle className="w-5 h-5" />
                </button>
                <button
                    className="p-2 text-slate-400 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5 rounded-full transition-all relative hidden md:block"
                    title={t('ui.notifications')}
                >
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 dark:bg-red-400 rounded-full border-2 border-app-bg dark:border-slate-900" />
                </button>
                {user ? (
                    <div className="flex items-center gap-2">
                        <div
                            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                            title={user.email || user.displayName || t('ui.account')}
                        >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-500 to-purple-600 border border-slate-200 dark:border-white/10 flex items-center justify-center text-xs font-semibold text-white">
                                {(user.displayName || user.email || 'U').toUpperCase().charAt(0)}
                            </div>
                            <span className="hidden md:inline text-xs text-slate-700 dark:text-slate-200 max-w-[140px] truncate">
                                {user.displayName || user.email || t('ui.account')}
                            </span>
                        </div>
                        <button
                            onClick={() => presenter.auth.logout()}
                            className="hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-all"
                        >
                            <span>{t('common.signOut')}</span>
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => presenter.auth.openAuthModal('login')}
                        className="hidden md:inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white text-sm font-semibold hover:from-slate-800 hover:to-slate-700 dark:from-white dark:to-slate-100 dark:text-slate-900 dark:hover:from-slate-100 dark:hover:to-white shadow-lg shadow-slate-900/20 dark:shadow-white/10 hover:shadow-xl hover:shadow-slate-900/30 dark:hover:shadow-white/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                    >
                        {t('common.signIn')}
                    </button>
                )}
            </div>
        </header>
    );
};

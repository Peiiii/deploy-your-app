import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '@/stores/ui.store';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { usePresenter } from '@/contexts/presenter-context';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Bell, HelpCircle, Sun, Moon, Menu, User, LogOut, ChevronDown } from 'lucide-react';
import { Crisp } from 'crisp-sdk-web';

export const Header: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const theme = useUIStore((state) => state.theme);
    const presenter = usePresenter();
    const user = useAuthStore((state) => state.user);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        };
        if (isUserMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isUserMenuOpen]);

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

    const handleNavigateToProfile = () => {
        setIsUserMenuOpen(false);
        navigate('/me');
    };

    const handleLogout = () => {
        setIsUserMenuOpen(false);
        presenter.auth.logout();
    };

    return (
        <header className="h-16 shrink-0 border-b border-app-border bg-app-bg/50 backdrop-blur relative z-40 flex items-center justify-between px-4 md:px-8">
            <div className="flex items-center gap-3">
                <button
                    onClick={presenter.ui.toggleSidebar}
                    className="md:hidden p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-200/50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5 rounded-lg transition-all"
                    title={t('ui.toggleMenu')}
                >
                    <Menu className="w-5 h-5" />
                </button>

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
                    <div className="relative" ref={userMenuRef}>
                        <button
                            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
                            title={user.email || user.displayName || t('ui.account')}
                        >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-500 to-purple-600 border border-slate-200 dark:border-white/10 flex items-center justify-center text-xs font-semibold text-white">
                                {(user.displayName || user.email || 'U').toUpperCase().charAt(0)}
                            </div>
                            <span className="hidden md:inline text-xs text-slate-700 dark:text-slate-200 max-w-[140px] truncate">
                                {user.displayName || user.email || t('ui.account')}
                            </span>
                            <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isUserMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg z-50 overflow-hidden py-1">
                                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                        {user.displayName || t('ui.account')}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                        {user.email}
                                    </p>
                                </div>
                                <button
                                    onClick={handleNavigateToProfile}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    <User className="w-4 h-4" />
                                    {t('navigation.profile')}
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                >
                                    <LogOut className="w-4 h-4" />
                                    {t('common.signOut')}
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <button
                        onClick={() => presenter.auth.openAuthModal('login')}
                        className="hidden md:inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 shadow-lg shadow-brand-500/25 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                    >
                        {t('common.signIn')}
                    </button>
                )}
            </div>
        </header>
    );
};


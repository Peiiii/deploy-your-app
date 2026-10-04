import { IconButton } from '@/components/icon-button';
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '@/stores/ui.store';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { usePresenter } from '@/contexts/presenter-context';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Bell, BookOpen, Github, HelpCircle, Sun, Moon, Menu, User, LogOut, ChevronDown } from 'lucide-react';
import { Crisp } from 'crisp-sdk-web';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { URLS } from '@/constants';

export const Header: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const theme = useUIStore((state) => state.theme);
    const presenter = usePresenter();
    const user = useAuthStore((state) => state.user);
    const { isBelow } = useBreakpoint();
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
        <header className="h-16 shrink-0 border-b border-app-border bg-app-bg/50 backdrop-blur sticky top-0 z-40 flex items-center justify-between gap-2 px-4 md:px-8">
            <div className="flex shrink-0 items-center gap-2 md:gap-3">
                <IconButton tooltipSide="bottom" label={t('ui.toggleMenu')} size="auto"
                    onClick={presenter.ui.toggleSidebar}
                    className="md:hidden p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-200/50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5 rounded-lg transition-all"
                >
                    <Menu className="w-5 h-5" />
                </IconButton>
                <IconButton tooltipSide="bottom" asChild size="auto" label={t('ui.developerDocs')} showTooltip={isBelow('md')}>
                    <a
                        href="https://docs.gemigo.io"
                        className="p-2 text-app-muted hover:text-slate-900 dark:hover:text-white md:px-0"
                    >
                        <BookOpen className="w-5 h-5 md:hidden" />
                        <span className="hidden md:inline text-sm whitespace-nowrap">{t('ui.developerDocs')}</span>
                    </a>
                </IconButton>
            </div>
            <div className="flex shrink-0 items-center gap-2 xl:gap-4">
                <IconButton tooltipSide="bottom" label={t('ui.toggleTheme')} size="auto"
                    onClick={presenter.ui.toggleTheme}
                    className="p-2 text-slate-400 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5 rounded-full transition-all"
                >
                    {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </IconButton>
                <LanguageSwitcher />
                <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-1 hidden xl:block" />
                <IconButton tooltipSide="bottom" asChild size="auto" label={t('ui.openSourceOnGitHub')}>
                    <a
                        href={URLS.GITHUB_REPOSITORY}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden lg:inline-flex p-2 text-slate-400 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5 rounded-full transition-all"
                    >
                        <Github className="w-5 h-5" />
                    </a>
                </IconButton>
                <IconButton tooltipSide="bottom" label={t('ui.help')} size="auto"
                    data-event="help_open" onClick={handleOpenChat}
                    className="p-2 text-slate-400 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5 rounded-full transition-all hidden xl:block"
                >
                    <HelpCircle className="w-5 h-5" />
                </IconButton>
                <IconButton tooltipSide="bottom" label={t('ui.notifications')} size="auto"
                    className="p-2 text-slate-400 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5 rounded-full transition-all relative hidden xl:block"
                >
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 dark:bg-red-400 rounded-full border-2 border-app-bg dark:border-slate-900" />
                </IconButton>
                {user ? (
                    <div className="relative" ref={userMenuRef}>
                        <IconButton tooltipSide="bottom" label={t('ui.account')} showTooltip={isBelow('xl')} size="auto"
                            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                            aria-expanded={isUserMenuOpen}
                            className="flex items-center gap-2 p-1 md:px-3 md:py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
                        >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-500 to-purple-600 border border-slate-200 dark:border-white/10 flex items-center justify-center text-xs font-semibold text-white">
                                {(user.displayName || user.email || 'U').toUpperCase().charAt(0)}
                            </div>
                            <span className="hidden xl:inline text-xs text-slate-700 dark:text-slate-200 max-w-[140px] truncate">
                                {user.displayName || user.email || t('ui.account')}
                            </span>
                            <ChevronDown className={`hidden md:block w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                        </IconButton>

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

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { HelpCircle, Sun, Moon, Menu, User, LogOut, ChevronDown } from 'lucide-react';
import { useUIStore } from '@/stores/ui.store';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { usePresenter } from '@/contexts/presenter-context';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Popover } from '@/components/popover';
import { openSupportChat } from '@/components/crisp-chat';

export const Header = () => {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const theme = useUIStore((s) => s.theme);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const user = useAuthStore((s) => s.user);
  const sessionError = useAuthStore((s) => s.sessionError);
  const authLoading = useAuthStore((s) => s.isLoading);
  return (
    <header className="flex h-14 shrink-0 items-center justify-between px-4 md:px-8 bg-app-bg">
      <div className="flex shrink-0 items-center gap-2">
        <button onClick={presenter.ui.toggleSidebar} className="icon-button md:hidden" aria-label={t('ui.toggleMenu')} aria-expanded={sidebarOpen} aria-controls="mobile-navigation">
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/" className="text-sm font-semibold text-app-text md:hidden">GemiGo</Link>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={presenter.ui.toggleTheme} className="icon-button" title={t('ui.toggleTheme')} aria-label={t('ui.toggleTheme')}>
          {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>
        <LanguageSwitcher />
        <button data-event="help_open" onClick={() => { void openSupportChat().catch(() => presenter.ui.showErrorToast(t('experience.supportError'))); }} className="icon-button" title={t('ui.help')} aria-label={t('ui.help')}>
          <HelpCircle className="h-[18px] w-[18px]" />
        </button>
        {authLoading ? <div aria-hidden="true" className="skeleton ml-2 h-8 w-8 rounded-full" /> : user ? (
          <Popover className="relative ml-2" triggerTitle={t('ui.account')}
            triggerClassName="flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm text-app-text hover:bg-app-surfaceHighlight"
            trigger={<><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-medium text-white">{(user.displayName || user.email || 'U').toUpperCase().charAt(0)}</span><span className="hidden max-w-32 truncate lg:inline">{user.displayName || t('ui.account')}</span><ChevronDown className="h-3.5 w-3.5 text-app-muted" /></>}
            panelClassName="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-app-border bg-app-surface p-1.5 shadow-lg">
            {(close) => <><div className="px-3 py-2.5"><p className="truncate text-sm font-medium">{user.displayName}</p><p className="truncate text-xs text-app-muted">{user.email}</p></div>
              <Link to="/me" onClick={close} className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm text-app-text hover:bg-app-surfaceHighlight"><User className="h-4 w-4" />{t('navigation.profile')}</Link>
              <button onClick={() => { close(); void presenter.auth.logout(); }} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-sm text-app-muted hover:bg-app-surfaceHighlight"><LogOut className="h-4 w-4" />{t('common.signOut')}</button></>}
          </Popover>
        ) : sessionError ? <button className="btn-secondary ml-2 shrink-0 whitespace-nowrap" onClick={() => { void presenter.auth.loadCurrentUser(); }}>{t('common.retry')}</button> : <button onClick={() => presenter.auth.openAuthModal('login')} className="btn-primary ml-2 shrink-0 whitespace-nowrap">{t('common.signIn')}</button>}
      </div>
    </header>
  );
};

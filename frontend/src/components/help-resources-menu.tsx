import { BookOpen, ExternalLink, FileArchive, FileCode, Github, HelpCircle, MessageCircle } from 'lucide-react';
import { Crisp } from 'crisp-sdk-web';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Popover } from '@/components/popover';
import { URLS } from '@/constants';
import { usePresenter } from '@/contexts/presenter-context';

const itemClassName = 'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-200 dark:hover:bg-slate-800';

export function HelpResourcesMenu() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const presenter = usePresenter();

  const openSupport = () => {
    if (import.meta.env.VITE_CRISP_WEBSITE_ID) {
      try {
        Crisp.chat.open();
        Crisp.chat.show();
        return;
      } catch (error) {
        console.error('Failed to open Crisp chat:', error);
      }
    }
    presenter.ui.showToast(t('ui.supportFallback'), 'info');
    navigate('/community');
  };

  return (
    <Popover
      key={pathname}
      className="static"
      triggerLabel={t('ui.helpResources')}
      triggerClassName="h-11 w-11 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
      trigger={<HelpCircle className="h-5 w-5" />}
      panelClassName="absolute left-4 right-4 top-full md:left-auto md:right-8 md:w-72 max-w-[calc(100%-2rem)] mt-2 max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900 z-50"
    >
      {(close) => (
        <nav aria-label={t('ui.helpResources')}>
          <p className="px-3 pb-1 pt-2 text-xs font-medium text-slate-500 dark:text-slate-400">{t('ui.usageHelp')}</p>
          <Link to="/guides/publish-html" onClick={close} className={itemClassName}>
            <FileCode className="h-4 w-4 shrink-0" />{t('ui.htmlGuide')}
          </Link>
          <Link to="/guides/publish-zip" onClick={close} className={itemClassName}>
            <FileArchive className="h-4 w-4 shrink-0" />{t('ui.zipGuide')}
          </Link>
          <button type="button" data-event="help_open" onClick={() => { close(); openSupport(); }} className={itemClassName}>
            <MessageCircle className="h-4 w-4 shrink-0" />{t('ui.contactSupport')}
          </button>
          <div className="my-2 border-t border-slate-100 dark:border-slate-800" />
          <p className="px-3 pb-1 text-xs font-medium text-slate-500 dark:text-slate-400">{t('ui.developerResources')}</p>
          <a href="https://docs.gemigo.io" target="_blank" rel="noopener noreferrer" onClick={close} className={itemClassName}>
            <BookOpen className="h-4 w-4 shrink-0" />{t('ui.developerDocs')}
            <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-400" />
          </a>
          <a href={URLS.GITHUB_REPOSITORY} target="_blank" rel="noopener noreferrer" onClick={close} className={itemClassName}>
            <Github className="h-4 w-4 shrink-0" />{t('ui.projectSource')}
            <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-400" />
          </a>
        </nav>
      )}
    </Popover>
  );
}

import { track } from '@/analytics/collector';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { useUIStore } from '../stores/ui.store';
import { AppLanguageFilter } from '@/features/explore/components/app-language-filter';
import { Popover } from '@/components/popover';

export const LanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation();
  const setLanguage = useUIStore((state) => state.actions.setLanguage);
  const currentLanguage = i18n.resolvedLanguage?.startsWith('zh') ? 'zh-CN' : 'en';
  const change = (code: string) => {
    void i18n.changeLanguage(code);
    track('language_change', { dimension: code.startsWith('zh') ? 'zh' : 'en' });
    setLanguage(code);
  };
  return (
    <Popover
      triggerAriaLabel="语言设置 / Language settings"
      triggerTitle="语言设置 / Language settings"
      triggerClassName="min-h-9 px-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
      trigger={
        <>
          <Languages className="w-4 h-4" />
          <span className="hidden text-xs font-medium sm:inline">
            {currentLanguage === 'zh-CN' ? '中文' : 'English'}
          </span>
        </>
      }
      panelClassName="fixed left-4 right-4 top-16 md:absolute md:left-auto md:right-0 md:top-full md:w-[340px] mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 p-4 space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {t('languages.siteLanguage')}
        </span>
        <div
          className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1"
          role="group"
          aria-label={t('languages.siteLanguage')}
        >
          {[
            ['zh-CN', '中文'],
            ['en', 'English'],
          ].map(([code, label]) => (
            <button
              key={code}
              type="button"
              lang={code}
              aria-pressed={currentLanguage === code}
              onClick={() => change(code)}
              className={`min-h-9 px-3 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${currentLanguage === code ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <AppLanguageFilter compact />
    </Popover>
  );
};

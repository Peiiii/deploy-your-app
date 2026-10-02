import { track } from '@/analytics/collector';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { useUIStore } from '../stores/ui.store';
import { Popover } from '@/components/popover';

export const LanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation();
  const language = useUIStore((state) => state.language);
  const setLanguage = useUIStore((state) => state.actions.setLanguage);

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'zh-CN', label: '中文' },
  ];

  const handleLanguageChange = (langCode: string) => {
    void i18n.changeLanguage(langCode);
    track('language_change', { dimension: langCode.startsWith('zh') ? 'zh' : 'en' });
    setLanguage(langCode);
  };

  const currentLanguage = languages.find((lang) => lang.code === language) || languages[0];

  return (
    <Popover
      triggerClassName="p-2 text-slate-400 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5 rounded-full transition-all bg-transparent dark:bg-transparent hidden md:flex items-center gap-1.5"
      triggerTitle={t('ui.changeLanguage') || 'Change Language'}
      trigger={
        <>
          <Languages className="w-4 h-4" />
          <span className="text-xs">{currentLanguage.label}</span>
        </>
      }
      panelClassName="absolute right-0 top-full mt-2 w-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg z-50 overflow-hidden"
    >
      {(close) => (
        <>
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                handleLanguageChange(lang.code);
                close();
              }}
              className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                language === lang.code
                  ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </>
      )}
    </Popover>
  );
};

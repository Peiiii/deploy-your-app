import { track } from '@/analytics/collector';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { useUIStore } from '../stores/ui.store';
import { AppLanguageFilter } from '@/features/explore/components/app-language-filter';

export const LanguageSwitcher: React.FC = () => {
  const { i18n, t } = useTranslation();
  const setLanguage = useUIStore((state) => state.actions.setLanguage);
  const [isOpen, setIsOpen] = React.useState(false);
  const container = React.useRef<HTMLDivElement>(null);
  const currentLanguage = i18n.resolvedLanguage?.startsWith('zh') ? 'zh-CN' : 'en';

  React.useEffect(() => {
    if (!isOpen) return;
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [isOpen]);

  const change = (code: string) => {
    void i18n.changeLanguage(code);
    track('language_change', { dimension: code.startsWith('zh') ? 'zh' : 'en' });
    setLanguage(code);
  };

  return (
    <div className="relative" ref={container}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="语言设置 / Language settings"
        className="min-h-9 px-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
      >
        <Languages className="w-4 h-4" />
        <span className="text-xs font-medium">
          {currentLanguage === 'zh-CN' ? '中文' : 'English'}
        </span>
      </button>
      {isOpen && (
        <div className="fixed left-4 right-4 top-16 md:absolute md:left-auto md:right-0 md:top-full md:w-[340px] mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="site-language"
              className="text-sm font-semibold text-slate-800 dark:text-slate-100"
            >
              {t('languages.siteLanguage')}
            </label>
            <select
              id="site-language"
              value={currentLanguage}
              onChange={(event) => change(event.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 min-h-9 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100"
            >
              <option value="zh-CN">中文</option>
              <option value="en">English</option>
            </select>
          </div>
          <AppLanguageFilter compact />
        </div>
      )}
    </div>
  );
};

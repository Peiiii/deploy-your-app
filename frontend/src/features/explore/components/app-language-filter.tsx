import { Popover } from '@/components/popover';
import { Languages, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppLanguageStore } from '@/features/explore/stores/app-language.store';
import { appLanguageLabel } from '@/features/explore/stores/language-preference';

export function AppLanguageFilter({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { languages, automatic, availableLanguages, actions } = useAppLanguageStore();
  const choices = [
    ...new Set([
      'zh',
      'en',
      'th',
      ...(languages || []).filter((code) => code !== 'und' && code !== 'zxx'),
    ]),
  ];
  const others = availableLanguages.filter((code) => !choices.includes(code) && code !== 'zxx');
  const buttonStyle = (active: boolean) =>
    `min-h-9 rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${active ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`;
  const panel = (
    <section
      aria-label={t('languages.appLanguage')}
      className={`rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 ${compact ? 'p-3' : 'p-4'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <Languages className="h-4 w-4 text-brand-600" />
          {t('languages.appLanguage')}
        </span>
        <button
          type="button"
          onClick={actions.resetAutomatic}
          aria-pressed={automatic}
          className="text-xs text-brand-600 dark:text-brand-400 hover:underline min-h-8"
        >
          {automatic ? t('languages.automaticActive') : t('languages.automatic')}
        </button>
      </div>
      <div className="flex flex-wrap gap-2 max-h-[45vh] overflow-y-auto">
        {choices.map((code) => (
          <button
            type="button"
            key={code}
            lang={code}
            aria-pressed={!!languages?.includes(code)}
            className={buttonStyle(!!languages?.includes(code))}
            onClick={() => actions.toggle(code)}
          >
            {appLanguageLabel(code)}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={languages === null}
          className={buttonStyle(languages === null)}
          onClick={() => actions.select(null)}
        >
          {t('languages.all')}
        </button>
        {others.map(code => (
          <button type="button" key={code} aria-pressed={!!languages?.includes(code)}
            className={buttonStyle(!!languages?.includes(code))} onClick={() => actions.toggle(code)}>
            {code === 'und' ? t('languages.unknown') : appLanguageLabel(code)}
          </button>
        ))}
      </div>
      {!compact && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">{t('languages.hint')}</p>
      )}
    </section>
  );
  if (compact) return panel;
  const selected = languages === null ? t('languages.all') : languages.map(code => code === 'und' ? t('languages.unknown') : appLanguageLabel(code)).join('、');
  return (
    <Popover
      triggerAriaLabel={`${t('languages.contentLanguage')}：${selected}`}
      triggerTitle={t('languages.appLanguage')}
      triggerClassName="min-h-10 px-3 rounded-full flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm whitespace-nowrap"
      trigger={<><Languages className="h-4 w-4 shrink-0" /><span className="hidden xl:inline">{t('languages.contentLanguage')}：</span><span className="max-w-28 truncate">{selected}</span><ChevronDown className="h-3.5 w-3.5 shrink-0" /></>}
      panelClassName="absolute right-0 top-full mt-2 w-[min(360px,calc(100vw-2rem))] rounded-2xl bg-white dark:bg-slate-900 shadow-xl z-50"
    >
      {panel}
    </Popover>
  );
}

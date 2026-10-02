import { Languages } from 'lucide-react';
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
  return (
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
      <div className="flex flex-wrap gap-2">
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
        {others.length > 0 && (
          <select
            aria-label={t('languages.more')}
            value={languages?.length === 1 && others.includes(languages[0]) ? languages[0] : ''}
            className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 text-sm min-h-9"
            onChange={(event) => {
              if (event.target.value) actions.select([event.target.value]);
            }}
          >
            <option value="" disabled>
              {t('languages.more')}
            </option>
            {others.map((code) => (
              <option key={code} value={code}>
                {code === 'und' ? t('languages.unknown') : appLanguageLabel(code)}
              </option>
            ))}
          </select>
        )}
      </div>
      {!compact && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">{t('languages.hint')}</p>
      )}
    </section>
  );
}

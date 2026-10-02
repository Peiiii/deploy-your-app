import { Popover } from '@/components/popover';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePresenter } from '@/contexts/presenter-context';
import type { Project } from '@/types';
import { appLanguageLabel } from '@/features/explore/stores/language-preference';

export function ProjectAppLanguages({ project }: { project: Project }) {
  const { t } = useTranslation();
  const presenter = usePresenter();
  const savedLanguages = (project.appLanguage?.languages || []).join(',');
  const [selected, setSelected] = useState(savedLanguages.split(',').filter(Boolean));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    setSelected(savedLanguages.split(',').filter(Boolean));
    setMessage('');
  }, [project.id, savedLanguages]);
  const choices = [
    ...new Set([
      'zh',
      'en',
      'th',
      'ja',
      'ko',
      'es',
      'fr',
      'de',
      'pt',
      'ru',
      'ar',
      'hi',
      'vi',
      'id',
      ...selected,
      'zxx',
    ]),
  ];
  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      await presenter.project.updateProject(project.id, { appLanguages: selected });
      setMessage(t('languages.saved'));
    } catch {
      setMessage(t('languages.saveFailed'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="space-y-3 border-t border-slate-200 dark:border-slate-700 pt-5">
      <div className="flex flex-wrap justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          {t('languages.appLanguage')}
        </h3>
        <span className="text-xs text-slate-500">
          {t(
            project.appLanguage?.source === 'author'
              ? 'languages.declared'
              : project.appLanguage?.languages.length
                ? 'languages.detected'
                : 'languages.unknown'
          )}
        </span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{t('languages.authorHint')}</p>
      <div className="flex flex-wrap gap-2">
        {choices.map((code) => (
          <button
            key={code}
            type="button"
            disabled={saving || (!selected.includes(code) && selected.length >= 8)}
            aria-pressed={selected.includes(code)}
            onClick={() =>
              setSelected((current) =>
                current.includes(code)
                  ? current.filter((value) => value !== code)
                  : [...current, code]
              )
            }
            className={`rounded-full px-3 py-2 text-xs border ${selected.includes(code) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
          >
            {code === 'zxx' ? t('languages.independent') : appLanguageLabel(code)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Popover
          trigger={t('languages.more')}
          triggerClassName="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm text-slate-700 dark:text-slate-200"
          panelClassName="absolute bottom-full left-0 mb-2 w-56 max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl z-50 p-1"
        >
          {(close) =>
            [
              'it',
              'nl',
              'pl',
              'tr',
              'uk',
              'bn',
              'ta',
              'ur',
              'fa',
              'ms',
              'fil',
              'sv',
              'da',
              'fi',
              'he',
              'el',
              'cs',
              'ro',
              'hu',
              'bg',
              'sk',
              'no',
              'sw',
            ]
              .filter((code) => !selected.includes(code))
              .map((code) => (
                <button
                  key={code}
                  type="button"
                  disabled={saving || selected.length >= 8}
                  onClick={() => {
                    setSelected((current) => [...new Set([...current, code])]);
                    close();
                  }}
                  className="w-full text-left rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-brand-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  {appLanguageLabel(code)}
                </button>
              ))
          }
        </Popover>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-full bg-brand-600 text-white px-4 py-2 text-sm disabled:opacity-50"
        >
          {saving ? t('common.saving') : t('languages.save')}
        </button>
      </div>
      {message && (
        <p role="status" className="text-sm text-slate-600 dark:text-slate-300">
          {message}
        </p>
      )}
    </section>
  );
}

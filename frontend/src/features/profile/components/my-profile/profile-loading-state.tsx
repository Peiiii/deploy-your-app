import { useTranslation } from 'react-i18next';

export function ProfileLoadingState() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-label={t('common.loading')}
      className="mx-auto w-full max-w-6xl space-y-8 p-4 sm:p-6 lg:p-8"
    >
      <span className="sr-only">{t('common.loading')}</span>
      <div
        aria-hidden="true"
        className="overflow-hidden rounded-3xl border border-slate-200 bg-white motion-safe:animate-pulse dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="h-28 bg-brand-100 dark:bg-brand-950 sm:h-36" />
        <div className="space-y-4 p-6">
          <div className="h-20 w-20 rounded-3xl bg-slate-100 dark:bg-slate-800" />
          <div className="h-8 w-48 rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-4 w-2/3 rounded-lg bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
      <div aria-hidden="true" className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="aspect-video rounded-2xl bg-slate-100 motion-safe:animate-pulse dark:bg-slate-800"
          />
        ))}
      </div>
    </div>
  );
}

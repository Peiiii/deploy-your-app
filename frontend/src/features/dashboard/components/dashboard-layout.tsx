import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AppWindow } from 'lucide-react';
import '@/features/dashboard/components/app-management.css';

export function DashboardLayout({
  children,
  actions,
  summary,
}: {
  children: ReactNode;
  actions?: ReactNode;
  summary?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="app-management mx-auto w-full max-w-6xl space-y-7 p-4 sm:p-6 lg:p-8 animate-fade-in">
      <section className="management-intro overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
              <AppWindow className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                {t('ui.dashboard')}
              </h1>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400 sm:text-sm">
                {t('dashboard.manageLiveApps')}
              </p>
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
        {summary && (
          <div className="mt-6 border-t border-slate-200/70 pt-5 dark:border-slate-800">
            {summary}
          </div>
        )}
      </section>
      {children}
    </div>
  );
}

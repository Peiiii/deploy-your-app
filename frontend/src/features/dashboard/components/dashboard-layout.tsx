import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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
    <div className="app-management mx-auto w-full max-w-7xl p-4 md:px-8 md:py-6">
      <header className="management-header mb-5">
        <div className="management-heading min-w-0">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white md:text-2xl">
            {t('ui.dashboard')}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t('dashboard.manageLiveApps')}
          </p>
          {summary && <div className="management-summary mt-2">{summary}</div>}
        </div>
        {actions}
      </header>
      {children}
    </div>
  );
}

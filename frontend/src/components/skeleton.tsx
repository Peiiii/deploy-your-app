import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`motion-safe:animate-pulse rounded bg-slate-100 dark:bg-slate-700/60 ${className}`}
    />
  );
}

export function LoadingStatus({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-label={t('common.loading')} className={className}>
      <div aria-hidden="true">{children}</div>
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
}

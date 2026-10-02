import { useTranslation } from 'react-i18next';

export const UsageNotice = ({ compact = false }: { compact?: boolean }) => {
  const { t } = useTranslation();

  return (
    <p className={`text-xs leading-5 ${compact ? 'text-slate-500 dark:text-slate-400' : 'text-slate-600 dark:text-slate-400'}`}>
      {t(compact ? 'legal.homeNotice' : 'legal.notice')}{compact ? ' · ' : ' '}
      <a
        href="/acceptable-use"
        target="_blank"
        rel="noopener noreferrer"
        className={compact
          ? 'rounded-sm underline-offset-2 hover:text-slate-700 hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:hover:text-slate-200'
          : 'font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200'}
      >
        {t(compact ? 'legal.policyTitle' : 'legal.readPolicy')}
      </a>
    </p>
  );
};

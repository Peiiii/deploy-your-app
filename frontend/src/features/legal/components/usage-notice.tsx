import { useTranslation } from 'react-i18next';

export const UsageNotice = () => {
  const { t } = useTranslation();

  return (
    <p className="text-xs leading-5 text-slate-600 dark:text-slate-400">
      {t('legal.notice')}{' '}
      <a
        href="/acceptable-use"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200"
      >
        {t('legal.readPolicy')}
      </a>
    </p>
  );
};

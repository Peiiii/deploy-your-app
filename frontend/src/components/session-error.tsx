import { useTranslation } from 'react-i18next';
import { usePresenter } from '@/contexts/presenter-context';
import { PageState } from '@/components/page-state';

export const SessionError = () => {
  const { t } = useTranslation();
  const presenter = usePresenter();
  return <PageState title={t('experience.sessionError')} description={t('experience.sessionErrorDescription')} action={<button className="btn-primary" onClick={() => { void presenter.auth.loadCurrentUser(); }}>{t('common.retry')}</button>} />;
};

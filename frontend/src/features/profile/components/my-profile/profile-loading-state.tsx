import { useTranslation } from 'react-i18next';
import { PageSkeleton } from '@/components/loading-state';
export const ProfileLoadingState = () => {
  const { t } = useTranslation();
  return <PageSkeleton title={t('profile.myProfile')} shape="profile" />;
};

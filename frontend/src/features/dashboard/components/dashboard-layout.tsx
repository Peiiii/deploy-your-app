import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PageLayout } from '@/components/page-layout';
export const DashboardLayout = ({ children, actions }: { children: ReactNode; actions?: ReactNode }) => {
  const { t } = useTranslation();
  return <PageLayout title={t('ui.dashboard')} actions={actions}>{children}</PageLayout>;
};

import { Component, Suspense, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { PageSkeleton, type SkeletonShape } from '@/components/loading-state';
import { PageState } from '@/components/page-state';

class RouteErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export const RouteBoundary = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const section = pathname.split('/')[1];
  const titles: Record<string, string> = {
    dashboard: 'ui.dashboard', explore: 'explore.exploreApps', deploy: 'deployment.publishHeading',
    community: 'community.title', me: 'profile.myProfile', projects: 'common.settings', u: 'profile.publicProfile',
  };
  const shape: SkeletonShape = section === 'projects' || section === 'deploy' ? 'details' : section === 'me' || section === 'u' ? 'profile' : section === 'community' ? 'list' : section === 'explore' ? 'apps' : 'projects';
  return (
    <RouteErrorBoundary key={pathname} fallback={<div className="mx-auto max-w-3xl p-6"><PageState title={t('experience.pageError')} description={t('experience.pageErrorDescription')} action={<button className="btn-primary" onClick={() => window.location.reload()}>{t('common.retry')}</button>} /></div>}>
      <Suspense fallback={<PageSkeleton title={t(titles[section] || 'common.loading')} shape={shape} />}>{children}</Suspense>
    </RouteErrorBoundary>
  );
};

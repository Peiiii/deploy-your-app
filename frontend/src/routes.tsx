import { DiscussionPage } from '@/features/notifications/pages/discussion-page';
import { LibraryPage } from '@/features/notifications/pages/library-page';
import { useSearchParams } from 'react-router-dom';
import { NotificationsPage } from '@/features/notifications/pages/notifications-page';
import { NotificationSettings } from '@/features/notifications/pages/notification-settings';
import { WalletPage } from '@/features/points/points-pages';
import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PublicCatalog } from '@/seo/public-catalog';
import { PublicInfo } from '@/seo/public-info';
import { Home } from '@/features/home/pages/home-page';
import { Dashboard } from '@/features/dashboard/pages/dashboard';
import { NewDeployment } from '@/features/deployment/pages/new-deployment';
import { ExploreApps } from '@/features/explore/pages/explore-apps';
import { ProjectSettings } from '@/features/project-settings/pages/project-settings';
import { MyProfile } from '@/features/profile/pages/my-profile';
import { PublicProfile } from '@/features/profile/pages/public-profile';
import { AdminProjectsPage } from '@/features/admin/pages/admin-projects';
import { BrandingDesignPage } from '@/features/design/pages/branding-design-page';
import { PrivacyPolicyPage } from '@/features/legal/pages/privacy-policy';
import { AcceptableUsePage } from '@/features/legal/pages/acceptable-use';
import { CommunityPage } from '@/features/community/pages/community-page';

const AdminRedirect = () => {
  useEffect(() => { window.location.replace('https://admin.gemigo.io'); }, []);
  return <a href="https://admin.gemigo.io">GemiGo Admin ↗</a>;
};

const ProfileEntry = () => {
  const [query] = useSearchParams();
  return ['favorites', 'following', 'followers', 'publications'].includes(
    query.get('tab') ?? ''
  ) ? (
    <LibraryPage />
  ) : (
    <MyProfile />
  );
};

export const AppRoutes = () => (
    <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/deploy" element={<NewDeployment />} />
        <Route path="/about" element={<PublicInfo />} />
        <Route path="/guides/publish-html" element={<PublicInfo />} />
        <Route path="/guides/publish-zip" element={<PublicInfo />} />
        <Route path="/catalog" element={<PublicCatalog />} />
        <Route path="/explore" element={<ExploreApps />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/notifications/settings" element={<NotificationSettings />} />
        <Route path="/apps/:id/discussion" element={<DiscussionPage />} />
        <Route path="/community" element={<CommunityPage />} />
        <Route path="/projects/:id" element={<ProjectSettings />} />
        <Route path="/admin" element={<AdminRedirect />} />
        <Route path="/admin/projects" element={<AdminProjectsPage />} />
        <Route path="/design/branding" element={<BrandingDesignPage />} />
        <Route path="/me" element={<ProfileEntry />} />
        <Route path="/u/:id" element={<PublicProfile />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/acceptable-use" element={<AcceptableUsePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
);

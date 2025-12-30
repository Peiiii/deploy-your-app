import { Routes, Route, Navigate } from 'react-router-dom';
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

export const AppRoutes = () => (
    <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/deploy" element={<NewDeployment />} />
        <Route path="/explore" element={<ExploreApps />} />
        <Route path="/projects/:id" element={<ProjectSettings />} />
        <Route path="/admin" element={<Navigate to="/admin/projects" replace />} />
        <Route path="/admin/projects" element={<AdminProjectsPage />} />
        <Route path="/design/branding" element={<BrandingDesignPage />} />
        <Route path="/me" element={<MyProfile />} />
        <Route path="/u/:id" element={<PublicProfile />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
);

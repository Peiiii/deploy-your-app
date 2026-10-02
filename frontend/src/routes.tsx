import { lazy, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { routeLoaders } from '@/route-loader';
import { RouteBoundary } from '@/components/route-boundary';
import { Home } from '@/features/home/pages/home-page';

const Dashboard = lazy(routeLoaders.dashboard);

const NewDeployment = lazy(routeLoaders.deploy);

const ExploreApps = lazy(routeLoaders.explore);

const CommunityPage = lazy(routeLoaders.community);

const ProjectSettings = lazy(routeLoaders.projects);

const MyProfile = lazy(routeLoaders.me);

const PublicProfile = lazy(routeLoaders.publicProfile);

const AdminProjectsPage = lazy(routeLoaders.admin);

const BrandingDesignPage = lazy(routeLoaders.branding);

const PrivacyPolicyPage = lazy(routeLoaders.privacy);
const AcceptableUsePage = lazy(routeLoaders.acceptableUse);

const AdminRedirect = () => {
  useEffect(() => { window.location.replace('https://admin.gemigo.io'); }, []);
  return <a href="https://admin.gemigo.io">GemiGo Admin ↗</a>;
};

export const AppRoutes = () => (
    <RouteBoundary><Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/deploy" element={<NewDeployment />} />
        <Route path="/explore" element={<ExploreApps />} />
        <Route path="/community" element={<CommunityPage />} />
        <Route path="/projects/:id" element={<ProjectSettings />} />
        <Route path="/admin" element={<AdminRedirect />} />
        <Route path="/admin/projects" element={<AdminProjectsPage />} />
        <Route path="/design/branding" element={<BrandingDesignPage />} />
        <Route path="/me" element={<MyProfile />} />
        <Route path="/u/:id" element={<PublicProfile />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/acceptable-use" element={<AcceptableUsePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></RouteBoundary>
);

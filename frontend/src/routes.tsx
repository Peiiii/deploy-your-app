import { Routes, Route, Navigate } from 'react-router-dom';
import { Home } from '@/features/home/pages/HomePage';
import { Dashboard } from '@/features/dashboard/pages/Dashboard';
import { NewDeployment } from '@/features/deployment/pages/NewDeployment';
import { ExploreApps } from '@/features/explore/pages/ExploreApps';
import { ProjectSettings } from '@/features/project-settings/pages/ProjectSettings';
import { MyProfile } from '@/features/profile/pages/MyProfile';
import { PublicProfile } from '@/features/profile/pages/PublicProfile';

export const AppRoutes = () => (
    <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/deploy" element={<NewDeployment />} />
        <Route path="/explore" element={<ExploreApps />} />
        <Route path="/projects/:id" element={<ProjectSettings />} />
        <Route path="/me" element={<MyProfile />} />
        <Route path="/u/:id" element={<PublicProfile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
);

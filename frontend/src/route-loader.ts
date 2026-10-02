// Shared by navigation prefetch and React.lazy: code only, never private API data.
export const routeLoaders = {
  dashboard: () => import('@/features/dashboard/pages/dashboard').then((m) => ({ default: m.Dashboard })),
  deploy: () => import('@/features/deployment/pages/new-deployment').then((m) => ({ default: m.NewDeployment })),
  explore: () => import('@/features/explore/pages/explore-apps').then((m) => ({ default: m.ExploreApps })),
  community: () => import('@/features/community/pages/community-page').then((m) => ({ default: m.CommunityPage })),
  projects: () => import('@/features/project-settings/pages/project-settings').then((m) => ({ default: m.ProjectSettings })),
  me: () => import('@/features/profile/pages/my-profile').then((m) => ({ default: m.MyProfile })),
  publicProfile: () => import('@/features/profile/pages/public-profile').then((m) => ({ default: m.PublicProfile })),
  admin: () => import('@/features/admin/pages/admin-projects').then((m) => ({ default: m.AdminProjectsPage })),
  branding: () => import('@/features/design/pages/branding-design-page').then((m) => ({ default: m.BrandingDesignPage })),
  acceptableUse: () => import('@/features/legal/pages/acceptable-use').then((m) => ({ default: m.AcceptableUsePage })),
  privacy: () => import('@/features/legal/pages/privacy-policy').then((m) => ({ default: m.PrivacyPolicyPage })),
  sdk: () => import('@/features/sdk-auth/pages/sdk-auth-broker').then((m) => ({ default: m.SdkAuthBrokerPage })),
  cli: () => import('@/features/cli-auth/pages/cli-login-page').then((m) => ({ default: m.CliLoginPage })),
  cliSuccess: () => import('@/features/cli-auth/pages/cli-login-page').then((m) => ({ default: m.CliLoginSuccessPage })),
};

export const preloadRoute = (path: string) => {
  const section = path.split('/')[1];
  switch (section) {
    case 'dashboard': return routeLoaders.dashboard().catch(() => {});
    case 'deploy': return routeLoaders.deploy().catch(() => {});
    case 'explore': return routeLoaders.explore().catch(() => {});
    case 'community': return routeLoaders.community().catch(() => {});
    case 'me': return routeLoaders.me().catch(() => {});
    case 'projects': return routeLoaders.projects().catch(() => {});
  }
};

import { useAuthStore } from '@/features/auth/stores/auth.store';
import i18n from '@/i18n/config';
import { NotificationsManager } from '@/features/notifications/managers/notifications.manager';
import { DeploymentManager } from '@/features/deployment/managers/deployment.manager';
import { ProjectManager } from './managers/project.manager';
import { UIManager } from './managers/ui.manager';
import { AuthManager } from '@/features/auth/managers/auth.manager';
import { AnalyticsManager } from './managers/analytics.manager';
import { ReactionManager } from './managers/reaction.manager';
import { ProjectSettingsManager } from '@/features/project-settings/managers/project-settings.manager';
import { MyProfileManager } from '@/features/profile/managers/my-profile.manager';
import { DashboardManager } from '@/features/dashboard/managers/dashboard.manager';
import { PublicProfileManager } from '@/features/profile/managers/public-profile.manager';
import { ExploreManager } from '@/features/explore/managers/explore.manager';
import { CommunityManager } from '@/features/community/managers/community.manager';
import { ServiceFactory } from './services/service-factory';

// The Presenter now uses the Factory to get dependencies.
// This decouples the Presenter from specific implementations (Mock vs Real).

export class Presenter {
  ui: UIManager;
  project: ProjectManager;
  deployment: DeploymentManager;
  auth: AuthManager;
  analytics: AnalyticsManager;
  reaction: ReactionManager;
  projectSettings: ProjectSettingsManager;
  myProfile: MyProfileManager;
  dashboard: DashboardManager;
  publicProfile: PublicProfileManager;
  explore: ExploreManager;
  community: CommunityManager;
  notifications: NotificationsManager;

  constructor() {
    // 1. Get Providers via Factory (Configuration driven)
    const projectProvider = ServiceFactory.getProjectProvider();
    const deploymentProvider = ServiceFactory.getDeploymentProvider();
    const analyticsProvider = ServiceFactory.getAnalyticsProvider();
    const reactionProvider = ServiceFactory.getReactionProvider();

    // 2. Initialize Managers with dependencies
    this.ui = new UIManager();
    this.project = new ProjectManager(projectProvider);
    this.deployment = new DeploymentManager(deploymentProvider, this.project);
    this.auth = new AuthManager();
    this.analytics = new AnalyticsManager(analyticsProvider);
    this.reaction = new ReactionManager(reactionProvider, () =>
      this.ui.showToast(i18n.t('common.error'), 'error')
    );
    this.projectSettings = new ProjectSettingsManager(
      this.project,
      this.deployment,
      this.ui,
      this.auth,
      this.reaction,
      this.analytics
    );
    this.myProfile = new MyProfileManager(this.auth, this.ui);
    this.dashboard = new DashboardManager(this.ui, this.auth);
    this.publicProfile = new PublicProfileManager(this.auth, this.reaction);
    this.explore = new ExploreManager(this.auth, this.ui, this.reaction);
    this.community = new CommunityManager(this.auth, this.ui);
    this.notifications = new NotificationsManager();
    this.auth.beforeLogout = this.notifications.detachDevice;
    this.notifications.start(useAuthStore.getState().user?.id ?? null);
    useAuthStore.subscribe((state, previous) => {
      if (state.user?.id !== previous.user?.id) this.notifications.start(state.user?.id ?? null);
    });
  }
}

// Global instance
export const presenter = new Presenter();

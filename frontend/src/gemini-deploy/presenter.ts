import { DeploymentManager } from './managers/DeploymentManager';
import { ProjectManager } from './managers/ProjectManager';
import { UIManager } from './managers/UIManager';
import { AuthManager } from './managers/AuthManager';
import { AnalyticsManager } from './managers/AnalyticsManager';
import { ReactionManager } from './managers/ReactionManager';
import { ProjectSettingsManager } from './managers/ProjectSettingsManager';
import { ServiceFactory } from './services/ServiceFactory';

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

  constructor() {
    // 1. Get Providers via Factory (Configuration driven)
    const projectProvider = ServiceFactory.getProjectProvider();
    const deploymentProvider = ServiceFactory.getDeploymentProvider();
    const analyticsProvider = ServiceFactory.getAnalyticsProvider();
    const reactionProvider = ServiceFactory.getReactionProvider();

    // 2. Initialize Managers with dependencies
    this.ui = new UIManager();
    this.project = new ProjectManager(projectProvider);
    this.deployment = new DeploymentManager(
      deploymentProvider,
      this.project,
      this.ui,
    );
    this.auth = new AuthManager();
    this.analytics = new AnalyticsManager(analyticsProvider);
    this.reaction = new ReactionManager(reactionProvider);
    this.projectSettings = new ProjectSettingsManager(
      this.project,
      this.deployment,
      this.ui,
      this.auth,
      this.reaction,
      this.analytics,
    );
  }
}

// Global instance
export const presenter = new Presenter();


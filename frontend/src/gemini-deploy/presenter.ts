import { DeploymentManager } from "./managers/DeploymentManager";
import { ProjectManager } from "./managers/ProjectManager";
import { UIManager } from "./managers/UIManager";
import { AuthManager } from "./managers/AuthManager";
import { AnalyticsManager } from "./managers/AnalyticsManager";
import { ServiceFactory } from "./services/ServiceFactory";

// The Presenter now uses the Factory to get dependencies.
// This decouples the Presenter from specific implementations (Mock vs Real).

export class Presenter {
  ui: UIManager;
  project: ProjectManager;
  deployment: DeploymentManager;
  auth: AuthManager;
  analytics: AnalyticsManager;

  constructor() {
    // 1. Get Providers via Factory (Configuration driven)
    const projectProvider = ServiceFactory.getProjectProvider();
    const deploymentProvider = ServiceFactory.getDeploymentProvider();
    const analyticsProvider = ServiceFactory.getAnalyticsProvider();

    // 2. Initialize Managers with dependencies
    this.ui = new UIManager();
    this.project = new ProjectManager(projectProvider);
    this.deployment = new DeploymentManager(deploymentProvider);
    this.auth = new AuthManager();
    this.analytics = new AnalyticsManager(analyticsProvider);
  }
}

// Global instance
export const presenter = new Presenter();

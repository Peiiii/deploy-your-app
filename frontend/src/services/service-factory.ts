import type {
  IProjectProvider,
  IDeploymentProvider,
  IAnalyticsProvider,
  IReactionProvider,
} from './interfaces';
import { HttpProjectProvider } from './http/http-project-provider';
import { HttpDeploymentProvider } from './http/http-deployment-provider';
import { HttpAnalyticsProvider } from './http/http-analytics-provider';
import { HttpReactionProvider } from './http/http-reaction-provider';

export class ServiceFactory {
  static getProjectProvider(): IProjectProvider {
    return new HttpProjectProvider();
  }

  static getDeploymentProvider(): IDeploymentProvider {
    return new HttpDeploymentProvider();
  }

  static getAnalyticsProvider(): IAnalyticsProvider {
    return new HttpAnalyticsProvider();
  }

  static getReactionProvider(): IReactionProvider {
    return new HttpReactionProvider();
  }
}

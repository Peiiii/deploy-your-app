import type {
  IProjectProvider,
  IDeploymentProvider,
  IAnalyticsProvider,
  IReactionProvider,
} from './interfaces';
import { HttpProjectProvider } from './http/HttpProjectProvider';
import { HttpDeploymentProvider } from './http/HttpDeploymentProvider';
import { HttpAnalyticsProvider } from './http/HttpAnalyticsProvider';
import { HttpReactionProvider } from './http/HttpReactionProvider';

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

import type { IProjectProvider, IDeploymentProvider } from './interfaces';
import { HttpProjectProvider } from './http/HttpProjectProvider';
import { HttpDeploymentProvider } from './http/HttpDeploymentProvider';

export class ServiceFactory {
  static getProjectProvider(): IProjectProvider {
    return new HttpProjectProvider();
  }

  static getDeploymentProvider(): IDeploymentProvider {
    return new HttpDeploymentProvider();
  }
}

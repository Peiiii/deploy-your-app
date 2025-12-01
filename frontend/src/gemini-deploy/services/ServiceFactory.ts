import { APP_CONFIG } from '../constants';
import type { IProjectProvider, IDeploymentProvider } from './interfaces';

import { IndexedDBProjectProvider } from './mock/IndexedDBProjectProvider';
import { LocalDeploymentProvider } from './mock/LocalDeploymentProvider';
import { HttpProjectProvider } from './http/HttpProjectProvider';
import { HttpDeploymentProvider } from './http/HttpDeploymentProvider';

export class ServiceFactory {
  
  static getProjectProvider(): IProjectProvider {
    if (APP_CONFIG.USE_MOCK_ADAPTER) {
      return new IndexedDBProjectProvider();
    }
    return new HttpProjectProvider();
  }

  static getDeploymentProvider(): IDeploymentProvider {
    if (APP_CONFIG.USE_MOCK_ADAPTER) {
      return new LocalDeploymentProvider();
    }
    return new HttpDeploymentProvider();
  }
}

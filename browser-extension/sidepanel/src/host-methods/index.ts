/**
 * Host Methods Index
 * 
 * Combines all host method modules into a single createHostMethods function.
 */

import type { AppConfig } from '../types';
import type { HostMethods } from '@gemigo/app-sdk';

// Core methods
import { createProtocolMethods } from './protocol';
import { createStorageMethods } from './storage';
import { createNetworkMethods } from './network';
import { createNotifyMethods } from './notify';

// Extension API methods
import { createExtensionMethods } from './extension';

/**
 * Create all host methods for an app.
 * This is the main entry point exposed to the SDK via Penpal.
 * 
 * Returns an object that satisfies the HostMethods interface from SDK.
 */
export const createHostMethods = (app: AppConfig): HostMethods => ({
  // Core
  ...createProtocolMethods(app),
  ...createStorageMethods(app.id),
  ...createNetworkMethods(app),
  ...createNotifyMethods(),

  // Extension API
  ...createExtensionMethods(app),
});

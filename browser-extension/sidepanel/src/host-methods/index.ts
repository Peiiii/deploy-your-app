/**
 * Host Methods Index
 * 
 * Combines all host method modules into a single createHostMethods function.
 */

import type { AppConfig } from '../types';
import { createProtocolMethods } from './protocol';
import { createStorageMethods } from './storage';
import { createNetworkMethods } from './network';
import { createPageReadMethods } from './page-read';
import { createPageModifyMethods } from './page-modify';
import { createCaptureMethods } from './capture';
import { createNotifyMethods } from './notify';
import { createContextMenuMethods } from './context-menu';

/**
 * Create all host methods for an app.
 * This is the main entry point exposed to the SDK via Penpal.
 */
export const createHostMethods = (app: AppConfig) => ({
  ...createProtocolMethods(app),
  ...createStorageMethods(app.id),
  ...createNetworkMethods(app),
  ...createPageReadMethods(),
  ...createPageModifyMethods(app),
  ...createCaptureMethods(app),
  ...createNotifyMethods(),
  ...createContextMenuMethods(),
});

export type HostMethods = ReturnType<typeof createHostMethods>;

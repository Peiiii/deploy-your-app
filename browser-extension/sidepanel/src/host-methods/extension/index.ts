/**
 * Extension API Host Methods
 * 
 * Page interaction methods: read, modify, capture, context menu.
 */

import type { AppConfig } from '../../types';
import { createPageReadMethods } from './page-read';
import { createPageModifyMethods } from './page-modify';
import { createCaptureMethods } from './capture';
import { createContextMenuMethods } from './context-menu';

/**
 * Create all extension API methods for an app.
 */
export const createExtensionMethods = (app: AppConfig) => ({
  ...createPageReadMethods(),
  ...createPageModifyMethods(app),
  ...createCaptureMethods(app),
  ...createContextMenuMethods(),
});

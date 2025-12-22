/**
 * Sidepanel Host Router
 * 
 * Replaces the static createHostMethods factory.
 * Routes requests to either Local Controller or External Extension (Background/Content).
 */

import type { HostMethods } from '@gemigo/app-sdk';
import type { AppConfig } from '../types';
import { sendMessage } from '../utils/messaging';
import { requirePermission } from '../utils/response';
import { isUrlAllowed } from '../utils/permissions';
import { fail } from '../utils/response';
import { sidepanelController } from '../sidepanel-controller';

type Routing = 'background' | 'content-script';

interface MethodConfig {
  routing?: Routing;
  permission?: 'extension.modify' | 'extension.capture' | 'network';
  // Local execution is now delegated to the controller
  isLocal?: boolean;
}

// Configuration Map
const ROUTE_CONFIG: Partial<Record<keyof HostMethods, MethodConfig>> = {
  // Local Controller Methods
  getProtocolInfo: { isLocal: true },
  storageGet: { isLocal: true },
  storageSet: { isLocal: true },
  storageDelete: { isLocal: true },
  storageClear: { isLocal: true },

  // Network (Special case: check allowlist then route)
  networkRequest: {
    routing: 'background',
    permission: 'network',
    // We handle allowlist check as a "middleware" or "pre-check" here, 
    // or we could implement it as a local handler that eventually forwards?
    // Let's keep the existing logic: check permission -> check allowlist -> route.
  },

  // Notifications
  notify: { routing: 'background' },

  // Extension Context
  getPageInfo: { routing: 'background' },
  getContextMenuEvent: { routing: 'background' },

  // Content Script Methods
  getPageHTML: { routing: 'content-script' },
  getPageText: { routing: 'content-script' },
  getSelection: { routing: 'content-script' },
  extractArticle: { routing: 'content-script' },
  extractLinks: { routing: 'content-script' },
  extractImages: { routing: 'content-script' },
  queryElement: { routing: 'content-script' },

  // Content Script with Permission
  highlight: { routing: 'content-script', permission: 'extension.modify' },
  removeHighlight: { routing: 'content-script', permission: 'extension.modify' },
  insertWidget: { routing: 'content-script', permission: 'extension.modify' },
  updateWidget: { routing: 'content-script', permission: 'extension.modify' },
  removeWidget: { routing: 'content-script', permission: 'extension.modify' },
  injectCSS: { routing: 'content-script', permission: 'extension.modify' },
  removeCSS: { routing: 'content-script', permission: 'extension.modify' },
  captureVisible: { routing: 'background', permission: 'extension.capture' },
};

/**
 * Creates the host methods object for a given app.
 */
export const createHostMethods = (app: AppConfig): HostMethods => {
  const methods: any = {};

  Object.entries(ROUTE_CONFIG).forEach(([name, config]) => {
    methods[name] = async (...args: any[]) => {
      // 1. Permission Check
      if (config.permission) {
        const denied = requirePermission(app, config.permission);
        if (denied) return denied;
      }

      // 2. Special Logic: Network Allowlist
      if (name === 'networkRequest') {
        const url = args[0];
        if (!isUrlAllowed(url, app.networkAllowlist)) {
          return fail('URL not allowed', 'NETWORK_NOT_ALLOWED');
        }
      }

      // 3. Local Execution via Controller
      if (config.isLocal) {
        const result = await sidepanelController.executeLocalHandler(name as keyof HostMethods, app, args);
        if (result !== undefined) return result;
      }

      // 4. Routing to External Contexts
      if (config.routing) {
        return sendMessage({
          type: name,
          payload: args,
          routing: config.routing,
        });
      }
    };
  });

  return methods as HostMethods;
};

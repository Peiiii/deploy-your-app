/**
 * GemiGo Sidepanel - Unified Host Methods
 *
 * Full declarative configuration for all methods exposed to the App SDK.
 */

import type { HostMethods } from '@gemigo/app-sdk';
import type { AppConfig } from '../types';
import { sendMessage } from '../utils/messaging';
import { ok, okWith, fail, requirePermission } from '../utils/response';
import { hasPermission, isUrlAllowed } from '../utils/permissions';

// ========== Types & Helpers ==========

type Routing = 'background' | 'content-script';

interface MethodConfig {
  routing?: Routing;
  permission?: 'extension.modify' | 'extension.capture' | 'network';
  local?: (app: AppConfig, ...args: any[]) => any;
}



// ========== Complete Method Configuration ==========

const CONFIG: Record<string, MethodConfig> = {
  // Protocol (Discovery)
  getProtocolInfo: {
    local: (app) => ({
      protocolVersion: 1, platform: 'extension', appId: app.id,
      capabilities: { 
        storage: true, notification: true, 
        network: hasPermission(app, 'network') && (app.networkAllowlist?.length ?? 0) > 0,
        extension: { 
          read: true, events: true, 
          modify: hasPermission(app, 'extension.modify'), 
          capture: hasPermission(app, 'extension.capture') 
        } 
      }
    }),
  },

  // Storage
  storageGet: { local: (app, key) => chrome.storage.local.get([`app:${app.id}:${key}`]).then(s => okWith({ value: s[`app:${app.id}:${key}`] })) },
  storageSet: { local: (app, key, value) => chrome.storage.local.set({ [`app:${app.id}:${key}`]: value }).then(() => ok()) },
  storageDelete: { local: (app, key) => chrome.storage.local.remove([`app:${app.id}:${key}`]).then(() => ok()) },
  storageClear: {
    local: async (app) => {
      const all = await chrome.storage.local.get(null);
      const keys = Object.keys(all).filter(k => k.startsWith(`app:${app.id}:`));
      if (keys.length > 0) await chrome.storage.local.remove(keys);
      return ok();
    }
  },

  // Network
  networkRequest: {
    routing: 'background',
    permission: 'network',
    local: (app, url) => !isUrlAllowed(url, app.networkAllowlist) ? fail('URL not allowed', 'NETWORK_NOT_ALLOWED') : null
  },

  // Notifications
  notify: { routing: 'background' },

  // Extension Context
  getPageInfo: { routing: 'background' },
  getContextMenuEvent: { routing: 'background' },

  // Content Script Methods (All passthrough)
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

// ========== Factory ==========

export const createHostMethods = (app: AppConfig): HostMethods => {
  const methods: any = {};

  Object.entries(CONFIG).forEach(([name, config]) => {
    methods[name] = async (...args: any[]) => {
      // 1. Permission Check
      if (config.permission) {
        const denied = requirePermission(app, config.permission);
        if (denied) return denied;
      }

      // 2. Local Pre-processing / Implementation
      if (config.local) {
        const localResult = await config.local(app, ...args);
        if (localResult !== null && (config.routing === undefined || localResult !== undefined)) {
          return localResult;
        }
      }

      // 3. Routing
      if (config.routing) {
        return sendMessage({
          type: name, // Use identical name as type
          payload: args, // Always send as an array of arguments
          routing: config.routing,
        });
      }
    };
  });

  return methods as HostMethods;
};

/**
 * Network Host Methods
 * 
 * Proxied network requests via service worker.
 * Require 'network' permission and URL allowlist.
 */

import { networkRequest as sendNetworkRequest } from '../utils/messaging';
import { hasPermission, isUrlAllowed } from '../utils/permissions';
import type { AppConfig } from '../types';

export const createNetworkMethods = (app: AppConfig) => ({
  async networkRequest(request: { url: string; options?: unknown }) {
    if (!hasPermission(app, 'network')) {
      return {
        success: false,
        code: 'PERMISSION_DENIED',
        error: 'Network permission denied.',
      };
    }

    if (!isUrlAllowed(request.url, app.networkAllowlist)) {
      return {
        success: false,
        code: 'NETWORK_NOT_ALLOWED',
        error: 'URL not in allowlist.',
      };
    }

    try {
      return await sendNetworkRequest<{
        success: boolean;
        status?: number;
        headers?: Record<string, string>;
        data?: unknown;
        error?: string;
        code?: string;
      }>(request);
    } catch (err) {
      return {
        success: false,
        code: 'INTERNAL_ERROR',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
});

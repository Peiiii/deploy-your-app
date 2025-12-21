/**
 * Network Host Methods
 * 
 * Proxied network requests via service worker.
 * Require 'network' permission and URL allowlist.
 */

import { networkRequest as sendNetworkRequest } from '../utils/messaging';
import { hasPermission, isUrlAllowed } from '../utils/permissions';
import { fail } from '../utils/response';
import type { AppConfig } from '../types';

export const createNetworkMethods = (app: AppConfig) => ({
  async networkRequest(request: { url: string; options?: unknown }) {
    if (!hasPermission(app, 'network')) {
      return fail('Network permission denied.', 'PERMISSION_DENIED');
    }

    if (!isUrlAllowed(request.url, app.networkAllowlist)) {
      return fail('URL not in allowlist.', 'NETWORK_NOT_ALLOWED');
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
      return fail(err instanceof Error ? err.message : String(err), 'INTERNAL_ERROR');
    }
  },
});

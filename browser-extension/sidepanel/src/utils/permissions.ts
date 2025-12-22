/**
 * Permission Utilities
 *
 * Handles permission checking and URL allowlist matching.
 */

import type { AppPermission, AppConfig } from '../types';

/**
 * Check if an app has a specific permission.
 */
export const hasPermission = (app: AppConfig, permission: AppPermission): boolean =>
  Boolean(app.permissions?.includes(permission));

/**
 * Check if a URL matches the app's network allowlist.
 * Supports:
 * - Exact match: 'https://api.github.com'
 * - Wildcard subdomain: '*.example.com'
 * - Wildcard port: 'http://localhost:*'
 */
export const isUrlAllowed = (url: string, allowlist: string[] | undefined): boolean => {
  if (!allowlist || allowlist.length === 0) return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  return allowlist.some((pattern) => {
    try {
      const normalized = pattern.includes('://') ? pattern : `https://${pattern}`;
      const hasPortWildcard = normalized.includes(':*');
      const normalizedForUrl = hasPortWildcard ? normalized.replace(':*', '') : normalized;
      const patternUrl = new URL(normalizedForUrl);

      // Protocol must match
      if (patternUrl.protocol !== parsed.protocol) return false;

      // Hostname matching (supports *.example.com)
      const patternHost = patternUrl.hostname;
      const isWildcardSubdomain = patternHost.startsWith('*.');
      const matchHost = isWildcardSubdomain
        ? parsed.hostname === patternHost.slice(2) ||
          parsed.hostname.endsWith(`.${patternHost.slice(2)}`)
        : parsed.hostname === patternHost;
      if (!matchHost) return false;

      // Port matching (skip if wildcard)
      if (!hasPortWildcard && patternUrl.port && patternUrl.port !== parsed.port) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  });
};

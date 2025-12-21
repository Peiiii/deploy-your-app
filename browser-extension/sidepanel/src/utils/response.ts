/**
 * Host Response Utilities
 *
 * Helpers for creating consistent RPC responses.
 */

import { hasPermission as checkPermission } from './permissions';
import type { AppConfig, AppPermission } from '../types';

// ========== Response Helpers ==========

/**
 * Success response without data.
 */
export const ok = () => ({ success: true as const });

/**
 * Success response with data.
 */
export const okWith = <T extends object>(data: T) => ({ success: true as const, ...data });

/**
 * Failure response.
 */
export const fail = (error: string, code?: string) => ({
  success: false as const,
  error,
  ...(code ? { code } : {}),
});

/**
 * Permission denied response.
 */
export const permissionDenied = () => fail('PERMISSION_DENIED', 'PERMISSION_DENIED');

// ========== Permission Check ==========

/**
 * Check permission and return denied response if not allowed.
 * Returns null if permission granted.
 */
export const requirePermission = (app: AppConfig, permission: AppPermission) => {
  if (!checkPermission(app, permission)) {
    return permissionDenied();
  }
  return null;
};

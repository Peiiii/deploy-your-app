/**
 * Common Notify Implementation
 *
 * Uses Web Notifications API. Can be used by web and as fallback.
 */

import type { NotifyOptions, NotifyResult } from '../../types';

/**
 * Web Notification API implementation.
 * Used by web platform and as fallback for other platforms.
 */
export const webNotifyImpl = async (options: NotifyOptions): Promise<NotifyResult> => {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return { success: false, reason: 'not_supported' };
  }

  if (Notification.permission !== 'granted') {
    return { success: false, reason: 'permission_not_granted' };
  }

  try {
    new Notification(options.title, { body: options.body, icon: options.icon });
    return { success: true };
  } catch {
    return { success: false, reason: 'failed_to_notify' };
  }
};

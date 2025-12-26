/**
 * Fallback Notify Implementation
 *
 * Uses Web Notifications API when no host is available.
 */

import type { NotifyOptions, NotifyResult } from '../types';

export const fallbackNotify = async (options: NotifyOptions): Promise<NotifyResult> => {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return { success: false, reason: 'not_supported' };
  }

  if (Notification.permission !== 'granted') {
    return { success: false, reason: 'permission_not_granted' };
  }

  try {
    new Notification(options.title, { body: options.message, icon: options.icon });
    return { success: true };
  } catch {
    return { success: false, reason: 'failed_to_notify' };
  }
};

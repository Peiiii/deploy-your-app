/**
 * Notify API Implementation
 *
 * Send system notifications.
 * Uses chrome.notifications in extension, Notification API in web.
 */

import { getHost } from '../core';
import { state, isProbablyExtensionHost, ensureExtensionProtocol } from './platform';
import type { NotifyOptions, NotifyResult } from '../types';

// ========== Web Notification (fallback) ==========

const notifyWeb = async (options: NotifyOptions): Promise<NotifyResult> => {
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

// ========== Notify API ==========

export const notify = async (...args: unknown[]): Promise<NotifyResult> => {
  const options: NotifyOptions =
    typeof args[0] === 'string'
      ? { title: String(args[0]), body: String(args[1] ?? '') }
      : (args[0] as NotifyOptions);

  if (state.platform === 'extension' || isProbablyExtensionHost()) {
    try {
      await ensureExtensionProtocol();
      const host = await getHost();
      const res = await host.notify({ title: options.title, message: options.body ?? '' });
      return { success: Boolean(res?.success) };
    } catch {
      // fall through to web notify
    }
  }

  return notifyWeb(options);
};

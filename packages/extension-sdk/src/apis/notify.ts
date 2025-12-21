/**
 * Notify API
 *
 * Uses host notify if available, otherwise falls back to Web Notifications.
 */

import { tryGetHost } from '../core';
import { fallbackNotify } from '../fallback';
import type { NotifyOptions, NotifyResult } from '../types';

export const notify = async (options: NotifyOptions): Promise<NotifyResult> => {
  const host = await tryGetHost();
  if (host && typeof host.notify === 'function') {
    try {
      const res = await host.notify({ title: options.title, message: options.body ?? '' });
      return { success: Boolean(res?.success) };
    } catch {
      // Fallback on error
    }
  }
  return fallbackNotify(options);
};

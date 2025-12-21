/**
 * Notify API
 *
 * Uses host notify if available, otherwise falls back to Web Notifications.
 */

import { callHost } from '../core';
import { fallbackNotify } from '../fallback';
import type { NotifyOptions, NotifyResult } from '../types';

export const notify = async (options: NotifyOptions): Promise<NotifyResult> => {
  try {
    // callHost will return the notification ID from Host side (string)
    await callHost<string>(
      'notify',
      [{ title: options.title, message: options.body || '' }]
    );
    return { success: true };
  } catch {
    return fallbackNotify(options);
  }
};

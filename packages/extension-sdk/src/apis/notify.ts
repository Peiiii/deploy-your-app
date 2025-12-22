/**
 * Notify API
 *
 * Uses host notify if available, otherwise falls back to Web Notifications.
 */

import { callHost, withFallback } from '../core';
import { fallbackNotify } from '../fallback';
import type { NotifyOptions, NotifyResult } from '../types';

// ========== Primary Implementation ==========

const hostNotify = async (options: NotifyOptions): Promise<NotifyResult> => {
  await callHost<string>('notify', [{ title: options.title, message: options.body || '' }]);
  return { success: true };
};

// ========== Notify Function ==========

/**
 * Send a notification
 */
export const notify = withFallback(hostNotify, fallbackNotify);

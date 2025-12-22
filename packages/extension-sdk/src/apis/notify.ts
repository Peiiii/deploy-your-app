/**
 * Notify API
 *
 * Uses host notify if available, otherwise falls back to Web Notifications.
 */

import { createUnifiedAPI, callHost } from '../core';
import { fallbackNotify } from '../fallback';
import type { NotifyOptions, NotifyResult } from '../types';

// ========== Unified API Configuration ==========

const { api } = createUnifiedAPI<{ notify(options: NotifyOptions): Promise<NotifyResult> }>({
  rpc: {
    methods: ['notify'],
    fallbacks: {
      notify: fallbackNotify,
    },
  },
});

/**
 * Send a notification
 */
export const notify = async (options: NotifyOptions): Promise<NotifyResult> => {
  try {
    // We do a manual call here to handle the { title, body } -> { title, message } transformation
    await callHost('notify', [{ title: options.title, message: options.body || '' }]);
    return { success: true };
  } catch {
    return fallbackNotify(options);
  }
};


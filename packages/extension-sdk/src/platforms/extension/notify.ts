/**
 * Extension Platform - Notify Implementation
 *
 * Uses Host RPC for chrome.notifications.
 */

import { getHost } from './connection';
import { webNotifyImpl } from '../common';
import type { NotifyOptions, NotifyResult } from '../../types';

export const extensionNotify = async (options: NotifyOptions): Promise<NotifyResult> => {
  try {
    const host = await getHost();
    const res = await host.notify({ title: options.title, message: options.body ?? '' });
    return { success: Boolean(res?.success) };
  } catch {
    // Fallback to web notification
    return webNotifyImpl(options);
  }
};

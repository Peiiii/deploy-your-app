/**
 * Capture Messages
 */

import type { MessageHandlerMap } from '../types';
import { getActiveTab } from '../utils/tab';

export const captureMessages: MessageHandlerMap = {
  CAPTURE_VISIBLE: async () => {
    const tab = await getActiveTab();
    if (!tab?.id) {
      return { error: 'No active tab' };
    }

    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      return { success: true, dataUrl };
    } catch (err) {
      console.error('[GemiGo] Capture error:', err);
      return { error: String(err) };
    }
  },

  SHOW_NOTIFICATION: (message: { payload: { title: string; message: string } }) => {
    return new Promise((resolve) => {
      chrome.notifications.create(
        `gemigo-${Date.now()}`,
        {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon48.png'),
          title: message.payload.title || 'GemiGo',
          message: message.payload.message || '',
        },
        (notificationId) => {
          resolve({ success: true, notificationId });
        }
      );
    });
  },
};

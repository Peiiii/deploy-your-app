/**
 * Common Background Handlers
 * 
 * Logic for environment, browser UI, and notifications.
 */

import type { HostMethods } from '@gemigo/app-sdk';
import { getActiveTab } from '../utils/tab';

export type CommonHandlers = Pick<HostMethods, 'ping' | 'getPageInfo' | 'captureVisible' | 'notify'>;

export const commonHandlers: CommonHandlers = {
    ping: async () => ({ pong: true }),

    getPageInfo: async () => {
        const tab = await getActiveTab();
        return tab ? { url: tab.url || '', title: tab.title || '', favIconUrl: tab.favIconUrl } : null;
    },

    captureVisible: async () => {
        const tab = await getActiveTab();
        if (!tab?.id) return { success: false, error: 'No active tab' };
        try {
            const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
            return { success: true, dataUrl };
        } catch (err) {
            return { success: false, error: String(err) };
        }
    },

    notify: (payload: { title: string; message: string }) =>
        new Promise((resolve) => {
            chrome.notifications.create(
                `gemigo-${Date.now()}`,
                {
                    type: 'basic',
                    iconUrl: chrome.runtime.getURL('icons/icon48.png'),
                    title: payload.title || 'GemiGo',
                    message: payload.message || '',
                },
                (id) => resolve({ success: true, data: id })
            );
        }),
};

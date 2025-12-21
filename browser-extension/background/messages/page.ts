/**
 * Page Messages
 */

import type { MessageHandlerMap } from '../types';
import { getActiveTab, executeInPage } from '../utils/tab';

export const pageMessages: MessageHandlerMap = {
  GET_PAGE_INFO: async () => {
    const tab = await getActiveTab();
    if (tab) {
      return { url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl };
    }
    return { error: 'No active tab' };
  },

  EXECUTE_IN_PAGE: async (message: { payload: unknown }) => {
    const tab = await getActiveTab();
    if (tab?.id) {
      return executeInPage(tab.id, message.payload);
    }
    return { error: 'No active tab' };
  },
};

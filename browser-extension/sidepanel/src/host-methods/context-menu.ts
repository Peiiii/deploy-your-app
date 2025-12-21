/**
 * Context Menu Host Methods
 * 
 * Handle context menu events from service worker.
 */

import { sendMessage } from '../utils/messaging';

export const createContextMenuMethods = () => ({
  async getContextMenuEvent() {
    try {
      return await sendMessage<{
        success: boolean;
        event?: { menuId: string; selectionText?: string };
      }>({ type: 'GET_CONTEXT_MENU_EVENT' });
    } catch {
      return { success: false };
    }
  },

  pollContextMenu(callback: (event: { menuId: string; selectionText?: string }) => void) {
    const check = async () => {
      const result = await sendMessage<{
        success: boolean;
        event?: { menuId: string; selectionText?: string };
      }>({ type: 'GET_CONTEXT_MENU_EVENT' });
      if (result?.success && result.event) {
        callback(result.event);
      }
    };
    
    // Check immediately and set up interval
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  },
});

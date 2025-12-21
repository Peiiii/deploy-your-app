/**
 * Notification Host Methods
 * 
 * Send notifications using Chrome Notifications API.
 */

export const createNotifyMethods = () => ({
  async notify(options: { title: string; message: string }) {
    return new Promise<{ success: boolean }>((resolve) => {
      const notificationId = `gemigo-${Date.now()}`;
      chrome.notifications.create(
        notificationId,
        {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon128.png'),
          title: options.title,
          message: options.message,
        },
        () => {
          if (chrome.runtime.lastError) {
            console.error('[GemiGo] Notification error:', chrome.runtime.lastError);
            resolve({ success: false });
          } else {
            resolve({ success: true });
          }
        }
      );
    });
  },
});


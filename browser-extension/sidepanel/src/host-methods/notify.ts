/**
 * Notification Host Methods
 * 
 * Send notifications using Chrome Notifications API.
 */

export const createNotifyMethods = () => ({
  async notify(options: { title: string; message: string }) {
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      if (!options?.title || !options?.message) {
        resolve({ success: false, error: 'Missing title or message' });
        return;
      }

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
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve({ success: true });
          }
        }
      );
    });
  },
});

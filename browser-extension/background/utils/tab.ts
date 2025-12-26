/**
 * Active Tab Utilities
 */

export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

export async function ensureContentScript(tabId: number, retries = 3): Promise<boolean> {
  const ping = async () => {
    return new Promise<boolean>((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: 'ping' }, (response) => {
        if (chrome.runtime.lastError) {
          resolve(false);
        } else {
          resolve(response?.pong === true);
        }
      });
    });
  };

  // 1. Get tab info for logging
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  const url = tab?.url || 'unknown';
  console.debug(`[GemiGo] Health check for tab ${tabId} (${url})`);

  // 2. Try pinging first
  if (await ping()) {
    console.debug(`[GemiGo] Content script already active on tab ${tabId}`);
    return true;
  }

  // 3. Not responding, try injecting
  if (url.startsWith('chrome://') || url.startsWith('about:') || url.startsWith('edge://')) {
    console.warn(`[GemiGo] Cannot inject content script into restricted page: ${url}`);
    return false;
  }

  try {
    console.debug(`[GemiGo] Injecting content script into tab ${tabId}...`);
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-scripts/loader.js'],
    });
    console.debug(`[GemiGo] Injection command sent for tab ${tabId}`);

    // 4. Retry ping a few times with delay to wait for initialization
    for (let i = 0; i < retries; i++) {
      const delay = 150 * (i + 1);
      await new Promise(r => setTimeout(r, delay));
      if (await ping()) {
        console.debug(`[GemiGo] Content script initialized on tab ${tabId} after ${i + 1} retries`);
        return true;
      }
      console.debug(`[GemiGo] Retry ${i + 1}/${retries} failed for tab ${tabId}`);
    }

    console.error(`[GemiGo] Content script failed to initialize on tab ${tabId} after injection`);
    return false;
  } catch (err) {
    console.error(`[GemiGo] Failed to inject content script into tab ${tabId}:`, err);
    return false;
  }
}

export async function executeInPage(tabId: number, payload: any): Promise<unknown> {
  const isHealthy = await ensureContentScript(tabId);
  if (!isHealthy) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    const url = tab?.url || '';
    const errorMsg = url
      ? `Content script not available on ${url}. Please grant site access in the extension (Enable on this site / Power Mode) and retry.`
      : `Content script not available on tab ${tabId}. Please grant site access in the extension and retry.`;
    console.warn(`[GemiGo] ${errorMsg} for message:`, payload.type);
    return { success: false, error: errorMsg, code: 'CONTENT_SCRIPT_NOT_AVAILABLE' };
  }

  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, payload, (response) => {
      if (chrome.runtime.lastError) {
        const msg = chrome.runtime.lastError.message;
        console.error(`[GemiGo] Runtime error sending to tab ${tabId}:`, msg);
        resolve({ success: false, error: msg });
      } else {
        resolve(response);
      }
    });
  });
}

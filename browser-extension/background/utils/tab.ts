/**
 * Active Tab Utilities
 */

export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

export async function ensureContentScript(tabId: number): Promise<boolean> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'ping' });
    return response?.pong === true;
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-scripts/bridge.js'],
      });
      return true;
    } catch (err) {
      console.error('[GemiGo] Failed to inject content script:', err);
      return false;
    }
  }
}

export async function executeInPage(tabId: number, payload: unknown): Promise<unknown> {
  const injected = await ensureContentScript(tabId);
  if (!injected) {
    return { error: 'Failed to inject content script' };
  }

  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, payload, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ error: chrome.runtime.lastError.message });
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Content Script Message Router
 * 
 * Handles incoming RPC calls from the Background script.
 */

import { allMessages } from './messages';

export const initRouter = () => {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        const handler = (allMessages as any)[message.type];

        if (handler) {
            dispatchToHandler(handler, message, sender, sendResponse);
            return true; // Keep channel open for async response
        }

        // Explicitly do not return true if not handled to avoid blocking other listeners
        return false;
    });
};

/**
 * Dispatches a message to the appropriate handler and manages the response lifecycle.
 */
const dispatchToHandler = async (
    handler: (...args: any[]) => any,
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (res: any) => void
) => {
    try {
        const args = Array.isArray(message.payload) ? message.payload : [];
        const result = handler(...args, sender);

        if (result instanceof Promise) {
            const resolvedValue = await result;
            sendResponse(resolvedValue);
        } else {
            sendResponse(result);
        }
    } catch (e) {
        console.error(`[GemiGo] Handler error [${message.type}]:`, e);
        sendResponse({ success: false, error: String(e) });
    }
};

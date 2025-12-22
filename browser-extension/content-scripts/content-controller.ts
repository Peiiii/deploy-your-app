/**
 * Content Script Controller
 * 
 * Orchestrates message routing and DOM observation.
 */

import type { ContentHandlers } from './types';


class GemiGoContentController {
    private handlers: ContentHandlers = {} as ContentHandlers;

    /**
     * Registers message handlers.
     */
    public provideHandlers = (handlers: ContentHandlers) => {
        this.handlers = { ...this.handlers, ...handlers };
    };

    /**
     * Starts content script services.
     */
    public start = () => {
        this.initObserver();
        this.initRouter();
        console.log('[GemiGo] Content script initialized on:', window.location.href);
    };

    private initObserver = () => {
        let selectionTimeout: number | null = null;
        let lastSelection = '';

        document.addEventListener('selectionchange', () => {
            if (selectionTimeout) {
                clearTimeout(selectionTimeout);
            }

            selectionTimeout = window.setTimeout(() => {
                const sel = window.getSelection();
                const text = sel?.toString() || '';

                if (text !== lastSelection) {
                    lastSelection = text;

                    let rect = null;
                    if (sel && sel.rangeCount > 0 && text.length > 0) {
                        const range = sel.getRangeAt(0);
                        const domRect = range.getBoundingClientRect();
                        if (domRect.width > 0 && domRect.height > 0) {
                            rect = {
                                x: domRect.x + window.scrollX,
                                y: domRect.y + window.scrollY,
                                width: domRect.width,
                                height: domRect.height,
                            };
                        }
                    }

                    // Standardized SDK event name and payload
                    chrome.runtime.sendMessage({
                        type: 'onSelectionChange',
                        payload: [text, rect, window.location.href],
                    }).catch(() => { });
                }
            }, 300);
        });
    };

    private initRouter = () => {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            const handler = (this.handlers as any)[message.type];

            if (handler) {
                this.dispatchToHandler(handler, message, sender, sendResponse);
                return true; // Keep channel open
            }
            return false;
        });
    };

    private dispatchToHandler = async (
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
}

export const contentController = new GemiGoContentController();

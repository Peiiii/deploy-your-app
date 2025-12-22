import { BaseExtensionController } from '../core/base-controller';
import type { ContentEvents, ContentHandlers } from './types';

class GemiGoContentController extends BaseExtensionController<ContentHandlers, ContentEvents> {

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

                    // Use inherited events proxy
                    this.events.onSelectionChange(text, rect, window.location.href);

                }
            }, 300);
        });
    };

    private initRouter = () => {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            // Use inherited handleMessage
            return this.handleMessage(message, sender, sendResponse);
        });
    };
}

export const contentController = new GemiGoContentController();


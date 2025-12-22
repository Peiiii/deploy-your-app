/**
 * Content Script DOM Observer
 * 
 * Tracks window/document events (selection, scroll, etc.) 
 * and notifies the background/sidepanel.
 */

export const initObserver = () => {
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
                });
            }
        }, 300);
    });
};

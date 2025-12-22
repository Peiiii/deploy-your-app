/**
 * DOM Core Handlers
 */

import type { SelectionResult, ElementInfo, QueryElementResult } from '@gemigo/app-sdk';

export const domHandlers = {
    ping: async () => ({ pong: true }),
    getPageHTML: async () => document.documentElement.outerHTML,
    getPageText: async () => document.body.innerText,

    getSelection: async (): Promise<SelectionResult> => {
        const selection = window.getSelection();
        const text = selection?.toString() || '';
        let rect = null;
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
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
        return { text, rect };
    },

    queryElement: async (selector: string, limit = 100): Promise<QueryElementResult> => {
        try {
            const elements = document.querySelectorAll(selector);
            const results: ElementInfo[] = [];
            elements.forEach((el, i) => {
                if (i >= limit) return;
                const attrs: Record<string, string> = {};
                for (const attr of el.attributes) attrs[attr.name] = attr.value;
                results.push({
                    tagName: el.tagName.toLowerCase(),
                    text: el.textContent?.trim().slice(0, 200) || '',
                    attributes: attrs,
                });
            });
            return { success: true, elements: results, count: elements.length };
        } catch (e) {
            return { success: false, error: String(e) };
        }
    },

    getPageInfo: async () => {
        return { url: window.location.href, title: document.title };
    },
};

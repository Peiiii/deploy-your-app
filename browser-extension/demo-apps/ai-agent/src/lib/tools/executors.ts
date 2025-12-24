/**
 * Tool executor implementations for the Agent Alchemist.
 * Covers all GemiGo SDK APIs for complete browser agent capabilities.
 */

import type { ToolExecutor } from '@agent-labs/agent-chat';
import {
    getGemigoSDK,
    type NetworkRequestOptions,
    type WidgetPosition,
} from '../gemigo-sdk';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Safely evaluate a mathematical expression.
 */
function safeEvaluate(expression: string): number {
    const sanitized = expression.replace(/\s+/g, '');
    if (!/^[0-9+\-*/().]+$/.test(sanitized)) {
        throw new Error('Only basic arithmetic is allowed.');
    }
    const result = Function(`"use strict"; return (${expression});`)();
    if (Number.isNaN(result) || !Number.isFinite(result)) {
        throw new Error('Expression did not produce a finite number.');
    }
    return result;
}

// ============================================================================
// Argument Types
// ============================================================================

type HighlightArgs = { selector?: string; color?: string };
type RemoveHighlightArgs = { highlightId?: string };
type InsertWidgetArgs = { html?: string; position?: WidgetPosition };
type RemoveWidgetArgs = { widgetId?: string };
type InjectCSSArgs = { css?: string };
type RemoveCSSArgs = { styleId?: string };
type QueryElementArgs = { selector?: string; limit?: number };
type NetworkRequestArgs = {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    responseType?: string;
};
type StorageGetArgs = { key?: string };
type StorageSetArgs = { key?: string; value?: unknown };
type StorageRemoveArgs = { key?: string };
type NotifyArgs = { title?: string; body?: string };
type CalculateArgs = { expression?: string };

// ============================================================================
// Tool Executors
// ============================================================================

const toolExecutors: Record<string, ToolExecutor> = {
    // --- Page Information ---
    getPageInfo: async () => {
        const gemigo = getGemigoSDK();
        if (!gemigo?.extension?.getPageInfo) {
            throw new Error('getPageInfo is unavailable.');
        }
        return await gemigo.extension.getPageInfo();
    },

    getPageHTML: async () => {
        const gemigo = getGemigoSDK();
        if (!gemigo?.extension?.getPageHTML) {
            throw new Error('getPageHTML is unavailable.');
        }
        const html = await gemigo.extension.getPageHTML();
        return { success: true, length: html.length, html };
    },

    getSelection: async () => {
        const gemigo = getGemigoSDK();
        if (!gemigo?.extension?.getSelection) {
            throw new Error('getSelection is unavailable.');
        }
        return { success: true, data: await gemigo.extension.getSelection() };
    },

    // --- Visual Modification ---
    highlight: async (args) => {
        const { selector, color } = (args || {}) as HighlightArgs;
        if (!selector) throw new Error('selector is required.');
        const gemigo = getGemigoSDK();
        if (!gemigo?.extension?.highlight) {
            throw new Error('highlight is unavailable.');
        }
        return await gemigo.extension.highlight(selector, color);
    },

    removeHighlight: async (args) => {
        const { highlightId } = (args || {}) as RemoveHighlightArgs;
        if (!highlightId) throw new Error('highlightId is required.');
        const gemigo = getGemigoSDK();
        if (!gemigo?.extension?.removeHighlight) {
            throw new Error('removeHighlight is unavailable.');
        }
        return await gemigo.extension.removeHighlight(highlightId);
    },

    insertWidget: async (args) => {
        const { html, position } = (args || {}) as InsertWidgetArgs;
        if (!html) throw new Error('html is required.');
        const gemigo = getGemigoSDK();
        if (!gemigo?.extension?.insertWidget) {
            throw new Error('insertWidget is unavailable.');
        }
        return await gemigo.extension.insertWidget(html, position);
    },

    removeWidget: async (args) => {
        const { widgetId } = (args || {}) as RemoveWidgetArgs;
        if (!widgetId) throw new Error('widgetId is required.');
        const gemigo = getGemigoSDK();
        if (!gemigo?.extension?.removeWidget) {
            throw new Error('removeWidget is unavailable.');
        }
        return await gemigo.extension.removeWidget(widgetId);
    },

    injectCSS: async (args) => {
        const { css } = (args || {}) as InjectCSSArgs;
        if (!css) throw new Error('css is required.');
        const gemigo = getGemigoSDK();
        if (!gemigo?.extension?.injectCSS) {
            throw new Error('injectCSS is unavailable.');
        }
        return await gemigo.extension.injectCSS(css);
    },

    removeCSS: async (args) => {
        const { styleId } = (args || {}) as RemoveCSSArgs;
        if (!styleId) throw new Error('styleId is required.');
        const gemigo = getGemigoSDK();
        if (!gemigo?.extension?.removeCSS) {
            throw new Error('removeCSS is unavailable.');
        }
        return await gemigo.extension.removeCSS(styleId);
    },

    // --- Content Extraction ---
    captureVisible: async () => {
        const gemigo = getGemigoSDK();
        if (!gemigo?.extension?.captureVisible) {
            throw new Error('captureVisible is unavailable.');
        }
        return await gemigo.extension.captureVisible();
    },

    extractArticle: async () => {
        const gemigo = getGemigoSDK();
        if (!gemigo?.extension?.extractArticle) {
            throw new Error('extractArticle is unavailable.');
        }
        return await gemigo.extension.extractArticle();
    },

    extractLinks: async () => {
        const gemigo = getGemigoSDK();
        if (!gemigo?.extension?.extractLinks) {
            throw new Error('extractLinks is unavailable.');
        }
        return await gemigo.extension.extractLinks();
    },

    extractImages: async () => {
        const gemigo = getGemigoSDK();
        if (!gemigo?.extension?.extractImages) {
            throw new Error('extractImages is unavailable.');
        }
        return await gemigo.extension.extractImages();
    },

    queryElement: async (args) => {
        const { selector, limit = 10 } = (args || {}) as QueryElementArgs;
        if (!selector) throw new Error('selector is required.');
        const gemigo = getGemigoSDK();
        if (!gemigo?.extension?.queryElement) {
            throw new Error('queryElement is unavailable.');
        }
        return await gemigo.extension.queryElement(selector, limit);
    },

    // --- Network ---
    networkRequest: async (args) => {
        const { url, method, headers, body, responseType } = (args || {}) as NetworkRequestArgs;
        if (!url) throw new Error('url is required.');
        const gemigo = getGemigoSDK();
        if (!gemigo?.network?.request) {
            throw new Error('network.request is unavailable.');
        }
        return await gemigo.network.request(url, {
            method: method as NetworkRequestOptions['method'],
            headers,
            body,
            responseType: responseType as 'json' | 'text' | 'arraybuffer',
        });
    },

    // --- Storage ---
    storageGet: async (args) => {
        const { key } = (args || {}) as StorageGetArgs;
        if (!key) throw new Error('key is required.');
        const gemigo = getGemigoSDK();
        if (!gemigo?.storage?.get) {
            throw new Error('storage.get is unavailable.');
        }
        const value = await gemigo.storage.get(key);
        return { success: true, key, value };
    },

    storageSet: async (args) => {
        const { key, value } = (args || {}) as StorageSetArgs;
        if (!key) throw new Error('key is required.');
        const gemigo = getGemigoSDK();
        if (!gemigo?.storage?.set) {
            throw new Error('storage.set is unavailable.');
        }
        await gemigo.storage.set(key, value);
        return { success: true, key };
    },

    storageRemove: async (args) => {
        const { key } = (args || {}) as StorageRemoveArgs;
        if (!key) throw new Error('key is required.');
        const gemigo = getGemigoSDK();
        if (!gemigo?.storage?.remove) {
            throw new Error('storage.remove is unavailable.');
        }
        await gemigo.storage.remove(key);
        return { success: true, key };
    },

    storageClear: async () => {
        const gemigo = getGemigoSDK();
        if (!gemigo?.storage?.clear) {
            throw new Error('storage.clear is unavailable.');
        }
        await gemigo.storage.clear();
        return { success: true };
    },

    // --- Notifications ---
    notify: async (args) => {
        const { title, body } = (args || {}) as NotifyArgs;
        if (!title || !body) throw new Error('title and body are required.');
        const gemigo = getGemigoSDK();
        if (!gemigo?.notify) {
            throw new Error('notify is unavailable.');
        }
        return await gemigo.notify({ title, body });
    },

    // --- Utility ---
    calculate: async (args) => {
        const { expression } = (args || {}) as CalculateArgs;
        if (!expression) throw new Error('expression is required.');
        return { success: true, result: safeEvaluate(expression) };
    },
};

/**
 * Get a copy of the tool executors map.
 */
export function getToolExecutors(): Record<string, ToolExecutor> {
    return { ...toolExecutors };
}

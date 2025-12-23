/**
 * Tool executor implementations for the Agent Alchemist.
 * Each executor handles a specific tool call from the AI.
 */

import type { ToolExecutor } from '@agent-labs/agent-chat';
import { getGemigoSDK } from '../gemigo-sdk';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Safely evaluate a mathematical expression.
 * Only allows basic arithmetic to prevent code injection.
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
// Tool Executors
// ============================================================================

type HighlightArgs = { selector?: string; color?: string };
type NetworkRequestArgs = {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    responseType?: string;
};
type CalculateArgs = { expression?: string };

const toolExecutors: Record<string, ToolExecutor> = {
    calculate: async (args) => {
        const { expression } = (args || {}) as CalculateArgs;
        return { success: true, value: safeEvaluate(String(expression ?? '')) };
    },

    getPageHTML: async () => {
        const gemigo = getGemigoSDK();
        if (!gemigo?.extension?.getPageHTML) {
            throw new Error('getPageHTML is unavailable.');
        }
        return { success: true, data: await gemigo.extension.getPageHTML() };
    },

    getSelection: async () => {
        const gemigo = getGemigoSDK();
        if (!gemigo?.extension?.getSelection) {
            throw new Error('getSelection is unavailable.');
        }
        return { success: true, data: await gemigo.extension.getSelection() };
    },

    highlight: async (args) => {
        const { selector, color } = (args || {}) as HighlightArgs;
        if (!selector) {
            throw new Error('selector is required for highlight.');
        }
        const gemigo = getGemigoSDK();
        if (!gemigo?.extension?.highlight) {
            throw new Error('highlight is unavailable.');
        }
        return await gemigo.extension.highlight(selector, color);
    },

    captureVisible: async () => {
        const gemigo = getGemigoSDK();
        if (!gemigo?.extension?.captureVisible) {
            throw new Error('captureVisible is unavailable.');
        }
        return await gemigo.extension.captureVisible();
    },

    networkRequest: async (args) => {
        const { url, method, headers, body, responseType } = (args || {}) as NetworkRequestArgs;
        if (!url) {
            throw new Error('url is required for networkRequest.');
        }
        const gemigo = getGemigoSDK();
        if (!gemigo?.network?.request) {
            throw new Error('network.request is unavailable.');
        }
        return await gemigo.network.request(url, { method, headers, body, responseType: responseType as 'json' | 'text' | 'arraybuffer' });
    },
};

/**
 * Get a copy of the tool executors map.
 */
export function getToolExecutors(): Record<string, ToolExecutor> {
    return { ...toolExecutors };
}

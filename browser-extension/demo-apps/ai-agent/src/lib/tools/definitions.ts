/**
 * Tool definitions for the Agent Alchemist.
 * Covers all GemiGo SDK APIs for complete browser agent capabilities.
 */

import type { ToolDefinition } from '@agent-labs/agent-chat';

export const AGENT_TOOL_DEFS: ToolDefinition[] = [
    // ============================================================================
    // Page Information
    // ============================================================================
    {
        name: 'getPageInfo',
        description: 'Get basic page information including URL, title, and favicon.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
        name: 'getPageHTML',
        description: 'Get the full HTML content of the current page for analysis.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
        name: 'getSelection',
        description: 'Get the currently selected text on the page.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
    },

    // ============================================================================
    // Visual Modification
    // ============================================================================
    {
        name: 'highlight',
        description: 'Highlight elements on the page matching a CSS selector.',
        parameters: {
            type: 'object',
            properties: {
                selector: { type: 'string', description: 'CSS selector to highlight' },
                color: { type: 'string', description: 'Highlight color (CSS value, e.g., "yellow", "#ff0")' },
            },
            required: ['selector'],
            additionalProperties: false,
        },
    },
    {
        name: 'removeHighlight',
        description: 'Remove a previously created highlight.',
        parameters: {
            type: 'object',
            properties: {
                highlightId: { type: 'string', description: 'ID of the highlight to remove' },
            },
            required: ['highlightId'],
            additionalProperties: false,
        },
    },
    {
        name: 'insertWidget',
        description: 'Insert a floating widget (HTML) on the page.',
        parameters: {
            type: 'object',
            properties: {
                html: { type: 'string', description: 'HTML content of the widget' },
                position: {
                    type: 'string',
                    enum: ['top-left', 'top-right', 'top-center', 'bottom-left', 'bottom-right', 'bottom-center', 'center'],
                    description: 'Position of the widget on the page',
                },
            },
            required: ['html'],
            additionalProperties: false,
        },
    },
    {
        name: 'removeWidget',
        description: 'Remove a previously inserted widget.',
        parameters: {
            type: 'object',
            properties: {
                widgetId: { type: 'string', description: 'ID of the widget to remove' },
            },
            required: ['widgetId'],
            additionalProperties: false,
        },
    },
    {
        name: 'injectCSS',
        description: 'Inject custom CSS styles into the page.',
        parameters: {
            type: 'object',
            properties: {
                css: { type: 'string', description: 'CSS code to inject' },
            },
            required: ['css'],
            additionalProperties: false,
        },
    },
    {
        name: 'removeCSS',
        description: 'Remove previously injected CSS.',
        parameters: {
            type: 'object',
            properties: {
                styleId: { type: 'string', description: 'ID of the style to remove' },
            },
            required: ['styleId'],
            additionalProperties: false,
        },
    },

    // ============================================================================
    // Content Extraction
    // ============================================================================
    {
        name: 'captureVisible',
        description: 'Capture a screenshot of the visible portion of the page.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
        name: 'extractArticle',
        description: 'Extract the main article content from the page using Readability.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
        name: 'extractLinks',
        description: 'Extract all links from the page.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
        name: 'extractImages',
        description: 'Extract all images from the page.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
        name: 'queryElement',
        description: 'Query elements matching a CSS selector and return their info.',
        parameters: {
            type: 'object',
            properties: {
                selector: { type: 'string', description: 'CSS selector to query' },
                limit: { type: 'number', description: 'Maximum number of elements to return (default: 10)' },
            },
            required: ['selector'],
            additionalProperties: false,
        },
    },

    // ============================================================================
    // Network
    // ============================================================================
    {
        name: 'networkRequest',
        description: 'Make an HTTP request from the extension (bypasses CORS).',
        parameters: {
            type: 'object',
            properties: {
                url: { type: 'string', description: 'Full request URL' },
                method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], default: 'GET' },
                headers: { type: 'object', description: 'Request headers' },
                body: { type: ['string', 'object'], description: 'Request body' },
                responseType: { type: 'string', enum: ['json', 'text', 'arraybuffer'], default: 'json' },
            },
            required: ['url'],
            additionalProperties: false,
        },
    },

    // ============================================================================
    // Storage
    // ============================================================================
    {
        name: 'storageGet',
        description: 'Get a value from extension storage.',
        parameters: {
            type: 'object',
            properties: {
                key: { type: 'string', description: 'Storage key' },
            },
            required: ['key'],
            additionalProperties: false,
        },
    },
    {
        name: 'storageSet',
        description: 'Set a value in extension storage.',
        parameters: {
            type: 'object',
            properties: {
                key: { type: 'string', description: 'Storage key' },
                value: { description: 'Value to store (any JSON-serializable value)' },
            },
            required: ['key', 'value'],
            additionalProperties: false,
        },
    },
    {
        name: 'storageRemove',
        description: 'Remove a value from extension storage.',
        parameters: {
            type: 'object',
            properties: {
                key: { type: 'string', description: 'Storage key to remove' },
            },
            required: ['key'],
            additionalProperties: false,
        },
    },
    {
        name: 'storageClear',
        description: 'Clear all extension storage.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
    },

    // ============================================================================
    // Notifications
    // ============================================================================
    {
        name: 'notify',
        description: 'Show a browser notification.',
        parameters: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Notification title' },
                body: { type: 'string', description: 'Notification body text' },
            },
            required: ['title', 'body'],
            additionalProperties: false,
        },
    },

    // ============================================================================
    // Utility
    // ============================================================================
    {
        name: 'calculate',
        description: 'Evaluate a basic mathematical expression.',
        parameters: {
            type: 'object',
            properties: {
                expression: { type: 'string', description: 'Math expression to evaluate (e.g., "2 + 2 * 3")' },
            },
            required: ['expression'],
            additionalProperties: false,
        },
    },
];

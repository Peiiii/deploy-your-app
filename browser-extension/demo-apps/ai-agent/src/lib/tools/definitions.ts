/**
 * Tool definitions for the Agent Alchemist.
 * Each tool maps to a GemiGo SDK method or local utility.
 */

import type { ToolDefinition } from '@agent-labs/agent-chat';

export const AGENT_TOOL_DEFS: ToolDefinition[] = [
    {
        name: 'getPageHTML',
        description: 'Get the full HTML content of the current visible page to analyze structure and content.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
        name: 'getSelection',
        description: 'Get the currently selected text on the page.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
        name: 'highlight',
        description: 'Highlight elements on the page that match a CSS selector.',
        parameters: {
            type: 'object',
            properties: {
                selector: { type: 'string', description: 'CSS selector to highlight' },
                color: { type: 'string', description: 'Highlight color (CSS value)' },
            },
            required: ['selector'],
            additionalProperties: false,
        },
    },
    {
        name: 'captureVisible',
        description: 'Capture a screenshot of the visible portion of the current tab.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
        name: 'networkRequest',
        description: 'Make an external network request from the extension background.',
        parameters: {
            type: 'object',
            properties: {
                url: { type: 'string', description: 'Full request URL' },
                method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'], default: 'GET' },
                headers: { type: 'object', description: 'Optional request headers' },
                body: { type: ['string', 'object'], description: 'Request body for non-GET verbs' },
                responseType: {
                    type: 'string',
                    enum: ['json', 'text', 'arraybuffer'],
                    description: 'How the response should be parsed',
                },
            },
            required: ['url'],
            additionalProperties: false,
        },
    },
    {
        name: 'calculate',
        description: 'Evaluate a basic mathematical expression (for quick sanity checks).',
        parameters: {
            type: 'object',
            properties: {
                expression: { type: 'string', description: 'The math expression to evaluate (e.g., "2 + 2 * 3")' },
            },
            required: ['expression'],
            additionalProperties: false,
        },
    },
];

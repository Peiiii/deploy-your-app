/**
 * Content Script Types
 * 
 * Centralized type definitions for content script handlers.
 */

import type { HostMethods } from '@gemigo/app-sdk';

/**
 * Core DOM manipulation handlers
 */
export type DomHandlers = Pick<HostMethods,
    | 'ping'
    | 'getPageHTML'
    | 'getPageText'
    | 'getSelection'
    | 'queryElement'
    | 'getPageInfo'
>;

/**
 * Content extraction handlers
 */
export type ExtractHandlers = Pick<HostMethods,
    | 'extractArticle'
    | 'extractLinks'
    | 'extractImages'
>;

/**
 * UI injection and manipulation handlers
 */
export type UiHandlers = Pick<HostMethods,
    | 'highlight'
    | 'removeHighlight'
    | 'insertWidget'
    | 'updateWidget'
    | 'removeWidget'
    | 'injectCSS'
    | 'removeCSS'
>;

/**
 * Complete set of handlers supported by the content script
 */
export type ContentHandlers = DomHandlers & ExtractHandlers & UiHandlers;


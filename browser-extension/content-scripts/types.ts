/**
 * Content Script Types
 * 
 * Centralized type definitions for content script handlers.
 */

import type { HostMethods, ChildMethods } from '@gemigo/app-sdk';

/**
 * Events derived from SDK definitions
 */
export type ContentEvents = Pick<ChildMethods, 'onSelectionChange'>;


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


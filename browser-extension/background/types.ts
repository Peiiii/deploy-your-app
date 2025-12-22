/**
 * Background Script Types
 * 
 * Centralized type definitions for background script handlers.
 */

import type { HostMethods, ChildMethods } from '@gemigo/app-sdk';

/**
 * Common background handlers (lifecycle, query, notify, etc.)
 */
export type CommonHandlers = Pick<HostMethods,
    | 'ping'
    | 'getPageInfo'
    | 'captureVisible'
    | 'notify'
>;

/**
 * Network request handling
 */
export type NetworkHandlers = Pick<HostMethods,
    | 'networkRequest'
>;
/**
 * Handlers explicitly implemented strictly within the controller/background logic
 */
export type InternalHandlers = Pick<HostMethods,
    | 'getContextMenuEvent'
>;

/**
 * Events explicitly emitted by the background script (not including transparent proxies)
 */
export type BackgroundEvents = Pick<ChildMethods, 'onContextMenu'>;

/**
 * Complete set of handlers managed by the Background Controller
 */
export type BackgroundHandlers = CommonHandlers & NetworkHandlers & InternalHandlers;



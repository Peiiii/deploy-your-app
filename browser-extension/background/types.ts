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
 * Bridge/Transparent handlers falling back to sidepanel events
 */
export type BridgeHandlers = Pick<ChildMethods,
    | 'onSelectionChange'
>;


/**
 * Handlers explicitly implemented strictly within the controller/background logic
 */
export type InternalHandlers = Pick<HostMethods,
    | 'getContextMenuEvent'
>;

/**
 * Complete set of handlers managed by the Background Controller
 */
export type BackgroundHandlers = CommonHandlers & NetworkHandlers & BridgeHandlers & InternalHandlers;

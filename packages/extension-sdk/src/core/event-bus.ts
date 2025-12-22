/**
 * EventBus - SDK-level event management
 *
 * A simple, type-safe event bus for managing subscriptions and emissions.
 */

import { ExtensionAPI } from "../types";

export type EventHandler<T extends unknown[] = unknown[]> = (...args: T) => void;

export interface EventBus<TEvents extends Record<string, unknown[]>> {
    /**
     * Subscribe to an event
     * @returns Unsubscribe function
     */
    on<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): () => void;

    /**
     * Emit an event to all subscribers
     */
    emit<K extends keyof TEvents>(event: K, ...args: TEvents[K]): void;

    /**
     * Remove all subscribers for an event (or all events)
     */
    off<K extends keyof TEvents>(event?: K): void;
}

/**
 * Create a type-safe event bus
 */
export function createEventBus<TEvents extends Record<string, unknown[]>>(): EventBus<TEvents> {
    const handlers = new Map<keyof TEvents, Set<EventHandler<any>>>();

    return {
        on<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): () => void {
            if (!handlers.has(event)) {
                handlers.set(event, new Set());
            }
            handlers.get(event)!.add(handler);
            return () => handlers.get(event)?.delete(handler);
        },

        emit<K extends keyof TEvents>(event: K, ...args: TEvents[K]): void {
            handlers.get(event)?.forEach((h) => h(...args));
        },

        off<K extends keyof TEvents>(event?: K): void {
            if (event) {
                handlers.delete(event);
            } else {
                handlers.clear();
            }
        },
    };
}

// ========== SDK Shared Event Bus ==========

/**
 * SDK-level event types
 * Add new event types here as the SDK grows
 */
export type SDKEvents = {
    // Extension events
    'onContextMenu': Parameters<Parameters<ExtensionAPI["onContextMenu"]>[0]>;
    'onSelectionChange': Parameters<Parameters<ExtensionAPI["onSelectionChange"]>[0]>;
    // Add more SDK-wide events here as needed
};


/**
 * Shared SDK event bus instance
 * Use this for SDK-wide event communication
 */
export const sdkEventBus = createEventBus<SDKEvents>();

// ========== Callback Handler Factory ==========

/**
 * Create a callback handler that subscribes to the SDK event bus.
 * Useful for building callback APIs like onContextMenu, onSelectionChange, etc.
 *
 * @param eventName - The SDK event to subscribe to
 * @param ensureConnection - Optional function to ensure host connection (e.g., tryGetHost)
 * @returns A function that accepts a callback and returns an unsubscribe function
 *
 * @example
 * const onContextMenu = createCallbackHandler('extension:contextMenu', tryGetHost);
 */
export function createCallbackHandler<K extends keyof SDKEvents>(
    eventName: K,
    ensureConnection?: () => void
): (callback: EventHandler<SDKEvents[K]>) => () => void {
    return (callback) => {
        ensureConnection?.();
        return sdkEventBus.on(eventName, callback);
    };
}

// ========== Event Pair Factory ==========

/**
 * Create both emitter (for childMethods) and subscriber (for callbackAPI) from a single config.
 * This ensures event names and signatures stay in sync.
 *
 * @param config - Map of local method names to SDK event names
 * @param ensureConnection - Optional function to ensure host connection
 * @returns Object with emitters and subscribers
 *
 * @example
 * const { emitters, subscribers } = createEventPair({
 *   onContextMenuEvent: 'extension:contextMenu',
 *   onSelectionChange: 'extension:selectionChange',
 * }, tryGetHost);
 *
 * // Use emitters in childMethods
 * export const childMethods = emitters;
 *
 * // Use subscribers in callbackAPI
 * export const callbackAPI = {
 *   onContextMenu: subscribers.onContextMenuEvent,
 *   onSelectionChange: subscribers.onSelectionChange,
 * };
 */
export function createEventPair<
    TConfig extends Record<string, keyof SDKEvents>
>(
    config: TConfig,
    ensureConnection?: () => void
): {
    emitters: { [K in keyof TConfig]: (...args: SDKEvents[TConfig[K]]) => void };
    subscribers: { [K in keyof TConfig]: (callback: EventHandler<SDKEvents[TConfig[K]]>) => () => void };
} {
    const emitters = {} as { [K in keyof TConfig]: (...args: SDKEvents[TConfig[K]]) => void };
    const subscribers = {} as { [K in keyof TConfig]: (callback: EventHandler<SDKEvents[TConfig[K]]>) => () => void };

    for (const [methodName, eventName] of Object.entries(config) as [keyof TConfig, keyof SDKEvents][]) {
        // Emitter: triggers event on the bus
        emitters[methodName] = ((...args: unknown[]) => {
            sdkEventBus.emit(eventName, ...(args as SDKEvents[typeof eventName]));
        }) as typeof emitters[typeof methodName];

        // Subscriber: listens to event on the bus
        subscribers[methodName] = ((callback: EventHandler<SDKEvents[typeof eventName]>) => {
            ensureConnection?.();
            return sdkEventBus.on(eventName, callback);
        }) as typeof subscribers[typeof methodName];
    }

    return { emitters, subscribers };
}



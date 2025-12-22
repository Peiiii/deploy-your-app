/**
 * API Factory - Unified declarative API creation
 *
 * Consolidates RPC and event-based APIs into a single declarative configuration.
 */

import { createRPCProxy, HostMethods, tryGetHost } from './connection';
import { sdkEventBus, SDKEvents, EventHandler } from './event-bus';

export interface APIConfig<TAPI extends object> {
    /** RPC methods mapping to host functions */
    rpc?: {
        methods: readonly (keyof TAPI)[];
        mapping?: Partial<Record<keyof TAPI, keyof HostMethods>>;
        fallbacks?: Partial<Record<keyof TAPI, (...args: any[]) => any>>;
    };
    /** Event methods mapping to SDK event bus */
    events?: {
        [K in keyof TAPI]?:
        | keyof SDKEvents
        | { event: keyof SDKEvents; childMethod?: string };
    };
}

/**
 * Create a unified API instance from a declarative configuration.
 *
 * @param config - API configuration
 * @returns Object with generated API instance and child methods for host injection
 */
export function createUnifiedAPI<TAPI extends object, TChild extends object = Record<string, any>>(
    config: APIConfig<TAPI>,
): { api: TAPI; childMethods: TChild } {
    const ensureConnection = tryGetHost;
    const api = {} as any;
    const childMethods = {} as any;

    // 1. Process RPC methods
    if (config.rpc) {
        const rpcProxy = createRPCProxy<any>(config.rpc.methods as unknown as string[], {
            mapping: config.rpc.mapping as any,
            fallbacks: config.rpc.fallbacks as any,
        });
        Object.assign(api, rpcProxy);
    }

    // 2. Process Event methods
    if (config.events) {
        for (const [sdkMethod, eventCfg] of Object.entries(config.events)) {
            if (!eventCfg) continue;

            const cfg = eventCfg as (keyof SDKEvents | { event: keyof SDKEvents; childMethod?: string });
            const eventName = typeof cfg === 'string' ? cfg : cfg.event;
            const childMethodName = typeof cfg === 'object' && 'childMethod' in cfg && cfg.childMethod
                ? cfg.childMethod
                : sdkMethod;

            // Subscriber (App listens to events)
            api[sdkMethod] = (callback: EventHandler<any>) => {
                ensureConnection?.();
                return sdkEventBus.on(eventName, callback);
            };

            // Emitter (Host triggers events)
            childMethods[childMethodName] = (...args: any[]) => {
                sdkEventBus.emit(eventName, ...args as any);
            };
        }
    }

    return { api: api as TAPI, childMethods };
}

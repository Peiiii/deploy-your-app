/**
 * API Factory - Unified declarative API creation
 *
 * Consolidates RPC and event-based APIs into a single declarative configuration.
 */

import { createRPCProxy, HostMethods, tryGetHost, callHost } from './connection';
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

/**
 * Create a standalone RPC action with argument transformation and fallback handling.
 *
 * @param methodName - Host method name to call
 * @param config - Action configuration
 * @returns An async function that handles the full RPC cycle
 */
export function createRPCAction<TArgs extends any[], TResult, THostResult = any>(
    methodName: keyof HostMethods,
    config: {
        /** Transform input arguments for host method */
        transform?: (...args: TArgs) => any[];
        /** Fallback if host fails */
        fallback: (...args: TArgs) => TResult | Promise<TResult>;
        /** Process host result */
        onSuccess?: (result: THostResult) => TResult;
    }
): (...args: TArgs) => Promise<TResult> {
    return async (...args: TArgs): Promise<TResult> => {
        try {
            const hostArgs = config.transform ? config.transform(...args) : args;
            const result = await callHost<THostResult>(methodName, hostArgs);
            if (config.onSuccess) return config.onSuccess(result);
            return result as unknown as TResult;
        } catch {
            return config.fallback(...args);
        }
    };
}

/**
 * Master SDK Action Configuration
 */
export interface ActionConfig<TFunc extends (...args: any[]) => any> {
    method: keyof HostMethods;
    /** Transform input arguments for host method */
    transform?: (...args: Parameters<TFunc>) => any[];
    /** Fallback if host fails */
    fallback: TFunc;
    /** Process host result */
    onSuccess?: (
        result: any
    ) => ReturnType<TFunc> extends Promise<infer R> ? R : ReturnType<TFunc>;
}

/**
 * Master SDK Factory - Create the entire SDK and child methods from a single config.
 */
export function createSDK<
    TSDK extends object,
    TChild extends object = Record<string, any>
>(config: {
    /** Sub-modules (e.g., storage, extension) */
    modules?: {
        [K in keyof TSDK]?: any;
    };
    /** Standalone functions (e.g., notify) */
    actions?: {
        [K in keyof TSDK]?: TSDK[K] extends (...args: any[]) => any
        ? ActionConfig<TSDK[K]>
        : never;
    };
    /** Dynamic getter properties (e.g., platform, capabilities) */
    getters?: {
        [K in keyof TSDK]?: () => TSDK[K];
    };
    /** Static values or stubs (e.g., platform, ai) */
    statics?: {
        [K in keyof TSDK]?: TSDK[K];
    };
}): { sdk: TSDK; childMethods: TChild } {
    const sdk = (config.statics ? { ...config.statics } : {}) as any;
    const mergedChildMethods = {} as any;

    // 1. Create Modules
    if (config.modules) {
        for (const [name, modConfig] of Object.entries(config.modules)) {
            const { api, childMethods } = createUnifiedAPI(modConfig as any);
            sdk[name] = api;
            Object.assign(mergedChildMethods, childMethods);
        }
    }

    // 2. Create Actions
    if (config.actions) {
        for (const [name, actionConfig] of Object.entries(config.actions)) {
            const cfg = actionConfig as any;
            sdk[name] = createRPCAction(cfg.method, cfg);
        }
    }

    // 3. Apply Getters
    if (config.getters) {
        for (const [name, getter] of Object.entries(config.getters)) {
            Object.defineProperty(sdk, name, {
                get: getter as () => any,
                enumerable: true,
                configurable: true,
            });
        }
    }

    return { sdk: sdk as TSDK, childMethods: mergedChildMethods as TChild };
}

/**
 * Bootstrap the SDK connection and discover host protocol info.
 */
export async function bootstrapSDK(
    childMethods: any,
    options: { timeoutMs?: number } = {}
): Promise<any> {
    const { initConnection } = await import('./connection');
    initConnection(childMethods, options);
    const host = await tryGetHost();
    if (host && typeof host.getProtocolInfo === 'function') {
        try {
            return await host.getProtocolInfo();
        } catch {
            return null;
        }
    }
    return null;
}


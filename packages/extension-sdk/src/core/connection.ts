/**
 * Penpal Connection Management
 *
 * Handles iframe-to-parent communication using Penpal.
 * Works for all platforms: Extension, Desktop, Web.
 */

import { connectToParent, AsyncMethodReturns } from 'penpal';
import type {
  Capabilities,
  ContextMenuEvent,
  ExtensionRPCMethods,
  RPCResult,
  Platform,
} from '../types';

// ========== RPC Method Interfaces ==========

export interface ProtocolRPCMethods {
  getProtocolInfo(): Promise<{
    protocolVersion: number;
    platform: Platform;
    appId: string;
    capabilities: Capabilities;
  }>;
  ping(): Promise<{ pong: boolean }>;
}

export interface StorageRPCMethods {
  storageGet(key: string): Promise<{ success: boolean; data?: unknown }>;
  storageSet(key: string, value: unknown): Promise<RPCResult>;
  storageDelete(key: string): Promise<RPCResult>;
  storageClear(): Promise<RPCResult>;
}

export interface NetworkRPCMethods {
  networkRequest(
    url: string,
    options?: {
      method?: string;
      headers?: Record<string, string>;
      body?: string | object;
      responseType?: 'json' | 'text' | 'arraybuffer';
      timeoutMs?: number;
    }
  ): Promise<{
    success: boolean;
    status?: number;
    headers?: Record<string, string>;
    data?: any;
    error?: string;
    code?: string;
  }>;
}

export interface NotifyRPCMethods {
  notify(payload: { title: string; message: string }): Promise<RPCResult<string>>;
}

/**
 * Host methods interface - what the host provides to apps.
 * Same interface for all platforms.
 */
export interface HostMethods extends
  ExtensionRPCMethods,
  ProtocolRPCMethods,
  StorageRPCMethods,
  NetworkRPCMethods,
  NotifyRPCMethods { }

/**
 * Child methods interface - what apps expose to the host
 */
export interface ChildMethods {
  onContextMenuEvent(event: ContextMenuEvent): void;
  onSelectionChange?(
    text: string,
    rect: { x: number; y: number; width: number; height: number } | null,
    url?: string
  ): void;
}

// ========== Connection State ==========

let connectionPromise: Promise<AsyncMethodReturns<HostMethods> | null> | null = null;
let resolvedHost: AsyncMethodReturns<HostMethods> | null = null;
let connectionFailed = false;
let defaultChildMethods: ChildMethods | undefined;

const DEFAULT_TIMEOUT_MS = 1500;

function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Get or create connection to parent (host).
 * Returns null if connection failed or not in iframe.
 */
export async function tryGetHost(
  childMethods?: ChildMethods,
  options?: { timeoutMs?: number }
): Promise<AsyncMethodReturns<HostMethods> | null> {
  if (resolvedHost) return resolvedHost;
  if (connectionFailed) return null;

  if (!isInIframe()) {
    connectionFailed = true;
    return null;
  }

  if (!connectionPromise) {
    const methods: Record<string, (...args: unknown[]) => unknown> = {};
    const resolved = childMethods ?? defaultChildMethods;
    if (resolved) {
      Object.assign(methods, resolved);
    }

    const connection = connectToParent<HostMethods>({
      methods,
      timeout: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });

    connectionPromise = connection.promise
      .then((host) => {
        resolvedHost = host;
        return host;
      })
      .catch(() => {
        connectionFailed = true;
        connectionPromise = null;
        return null;
      });
  }

  return connectionPromise as Promise<AsyncMethodReturns<HostMethods> | null>;
}

/**
 * Get host connection (throws if not available).
 */
export async function getHost(): Promise<AsyncMethodReturns<HostMethods>> {
  const host = await tryGetHost();
  if (!host) {
    throw new Error('Not connected to host. SDK may be running outside of a supported environment.');
  }
  return host;
}

/**
 * Check if connected to host.
 */
export function isConnected(): boolean {
  return resolvedHost !== null;
}

/**
 * Check if connection failed.
 */
export function hasConnectionFailed(): boolean {
  return connectionFailed;
}

/**
 * Initialize connection immediately.
 */
export function initConnection(
  childMethods?: ChildMethods,
  options?: { timeoutMs?: number }
): void {
  defaultChildMethods = childMethods;
  tryGetHost(childMethods, options);
}

/**
 * Generic host call with optional fallback.
 */
export async function callHost<T>(
  methodName: keyof HostMethods,
  args: any[] = [],
  fallback?: (...args: any[]) => T | Promise<T>
): Promise<T> {
  const host = await tryGetHost();
  if (host && typeof (host as any)[methodName] === 'function') {
    const res = await (host as any)[methodName](...args);
    // Success/Value unwrapping (matches Host side ok/okWith)
    if (res?.success !== false) {
      // Prioritize .data (standard RPCResult), then .value (legacy), then res itself
      const val = res?.data !== undefined ? res.data : (res?.value !== undefined ? res.value : res);
      return val as T;
    }
    // If explicitly failed and there's a fallback, use it. Otherwise throw.
    if (fallback) return fallback(...args);
    throw new Error(res?.error || `Host method ${String(methodName)} failed`);
  }

  if (fallback) return fallback(...args);
  throw new Error(`Method ${String(methodName)} not supported in this environment`);
}

/**
 * Create a simple RPC proxy for a set of methods.
 */
export function createRPCProxy<T extends Record<string, any>>(
  methodNames: readonly string[],
  config: {
    mapping?: Record<string, keyof HostMethods>;
    fallbacks?: Record<string, (...args: any[]) => any>;
  } = {}
): T {
  const proxy: any = {};
  for (const name of methodNames) {
    const hostMethod = config.mapping?.[name] || (name as keyof HostMethods);
    const fallback = config.fallbacks?.[name];
    proxy[name] = (...args: any[]) => callHost(hostMethod, args, fallback);
  }
  return proxy as T;
}

/**
 * Wrap an async function with a fallback.
 * If the primary function throws, the fallback is called with the same arguments.
 */
export function withFallback<TArgs extends unknown[], TResult>(
  primary: (...args: TArgs) => Promise<TResult>,
  fallback: (...args: TArgs) => TResult | Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    try {
      return await primary(...args);
    } catch {
      return fallback(...args);
    }
  };
}


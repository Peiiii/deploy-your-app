/**
 * Penpal Connection Management
 * 
 * Handles the iframe-to-parent communication channel using penpal.
 */

import { connectToParent, AsyncMethodReturns } from 'penpal';
import type {
  Capabilities,
  ContextMenuEvent,
  ExtensionRPCMethods,
  RPCResult,
} from '../types';

// ========== RPC Method Interfaces (modular) ==========

/**
 * Protocol handshake methods
 */
export interface ProtocolRPCMethods {
  getProtocolInfo(): Promise<{
    protocolVersion: number;
    platform: 'extension';
    appId: string;
    capabilities: Capabilities;
  }>;
}

/**
 * Storage RPC methods
 * Returns { success, value? } for consistency with Host implementation.
 */
export interface StorageRPCMethods {
  storageGet(key: string): Promise<{ success: boolean; value?: unknown }>;
  storageSet(key: string, value: unknown): Promise<RPCResult>;
  storageDelete(key: string): Promise<RPCResult>;
  storageClear(): Promise<RPCResult>;
}

/**
 * Network RPC methods
 * Returns { success, status?, headers?, data?, error?, code? }
 */
export interface NetworkRPCMethods {
  networkRequest(request: {
    url: string;
    options?: {
      method?: string;
      headers?: Record<string, string>;
      body?: string | object;
      responseType?: 'json' | 'text' | 'arraybuffer';
      timeoutMs?: number;
      maxBytes?: number;
    };
  }): Promise<{
    success: boolean;
    status?: number;
    headers?: Record<string, string>;
    data?: unknown;
    error?: string;
    code?: string;
  }>;
}

/**
 * Notification RPC methods
 */
export interface NotifyRPCMethods {
  notify(options: { title: string; message: string }): Promise<RPCResult>;
}

// ========== Combined Host Methods ==========

/**
 * Host methods interface - what the extension provides to apps
 *
 * Composed from modular RPC method interfaces for extensibility.
 */
export interface HostMethods extends 
  ExtensionRPCMethods,
  ProtocolRPCMethods,
  StorageRPCMethods,
  NetworkRPCMethods,
  NotifyRPCMethods {}

// ========== Child Methods ==========

/**
 * Child methods interface - what apps expose to the extension host
 */
export interface ChildMethods {
  onContextMenuEvent(event: ContextMenuEvent): void;
  onSelectionChange?(
    text: string,
    rect: { x: number; y: number; width: number; height: number } | null,
    url?: string
  ): void;
}

// ========== Connection Management ==========

let connectionPromise: Promise<AsyncMethodReturns<HostMethods>> | null = null;
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
 * Get or create connection to parent (extension host)
 */
export function getHost(
  childMethods?: ChildMethods,
  options?: { timeoutMs?: number }
): Promise<AsyncMethodReturns<HostMethods>> {
  if (connectionPromise) return connectionPromise;

  if (!isInIframe()) {
    console.warn('[GemiGo SDK] Not running in iframe. SDK calls will not work.');
  }

  const methods: Record<string, (...args: unknown[]) => unknown> = {};
  const resolvedChildMethods = childMethods ?? defaultChildMethods;
  if (resolvedChildMethods) {
    Object.assign(methods, resolvedChildMethods);
  }

  const connection = connectToParent<HostMethods>({
    methods,
    timeout: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  connectionPromise = connection.promise.catch((err) => {
    connectionPromise = null;
    throw err;
  });
  return connectionPromise;
}

/**
 * Initialize connection immediately (for faster first call)
 */
export function initConnection(
  childMethods?: ChildMethods,
  options?: { timeoutMs?: number }
): void {
  defaultChildMethods = childMethods;
  getHost(childMethods, options).catch(err => {
    console.debug('[GemiGo SDK] Auto-connect waiting...', err);
  });
}

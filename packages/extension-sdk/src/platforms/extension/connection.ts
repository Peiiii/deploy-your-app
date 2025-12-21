/**
 * Extension Platform - Penpal Connection
 *
 * Handles iframe-to-parent communication using Penpal.
 * Moved from core/connection.ts for platform organization.
 */

import { connectToParent, AsyncMethodReturns } from 'penpal';
import type {
  Capabilities,
  ContextMenuEvent,
  ExtensionRPCMethods,
  RPCResult,
} from '../../types';

// ========== RPC Method Interfaces ==========

export interface ProtocolRPCMethods {
  getProtocolInfo(): Promise<{
    protocolVersion: number;
    platform: 'extension';
    appId: string;
    capabilities: Capabilities;
  }>;
}

export interface StorageRPCMethods {
  storageGet(key: string): Promise<{ success: boolean; value?: unknown }>;
  storageSet(key: string, value: unknown): Promise<RPCResult>;
  storageDelete(key: string): Promise<RPCResult>;
  storageClear(): Promise<RPCResult>;
}

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

export interface NotifyRPCMethods {
  notify(options: { title: string; message: string }): Promise<RPCResult>;
}

export interface HostMethods extends 
  ExtensionRPCMethods,
  ProtocolRPCMethods,
  StorageRPCMethods,
  NetworkRPCMethods,
  NotifyRPCMethods {}

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

export function initConnection(
  childMethods?: ChildMethods,
  options?: { timeoutMs?: number }
): void {
  defaultChildMethods = childMethods;
  getHost(childMethods, options).catch(err => {
    console.debug('[GemiGo SDK] Auto-connect waiting...', err);
  });
}

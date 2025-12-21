/**
 * Platform Detection and State Management
 *
 * Handles runtime platform detection and SDK state.
 */

import { getHost, initConnection, getChildMethods } from '../core';
import type { Capabilities } from '../types';

// ========== Error Types ==========

export type SDKErrorCode =
  | 'NOT_SUPPORTED'
  | 'PERMISSION_DENIED'
  | 'NETWORK_NOT_ALLOWED'
  | 'TIMEOUT'
  | 'INTERNAL_ERROR';

export class SDKError extends Error {
  code: SDKErrorCode;

  constructor(code: SDKErrorCode, message: string) {
    super(message);
    this.name = 'SDKError';
    this.code = code;
  }
}

// ========== Platform Detection ==========

export const isProbablyExtensionHost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ancestorOrigins = (window.location as unknown as { ancestorOrigins?: unknown })
    .ancestorOrigins;
  if (!ancestorOrigins) return false;

  const origins: string[] = [];

  if (Array.isArray(ancestorOrigins)) {
    ancestorOrigins.forEach((origin) => {
      if (typeof origin === 'string') origins.push(origin);
    });
  } else if (typeof (ancestorOrigins as { length?: unknown }).length === 'number') {
    const length = (ancestorOrigins as { length: number }).length;
    for (let i = 0; i < length; i += 1) {
      const origin =
        (ancestorOrigins as Record<number, unknown>)[i] ??
        (ancestorOrigins as { item?: (index: number) => unknown }).item?.(i);
      if (typeof origin === 'string') origins.push(origin);
    }
  } else if (typeof (ancestorOrigins as { [Symbol.iterator]?: unknown })[Symbol.iterator] === 'function') {
    for (const origin of ancestorOrigins as Iterable<unknown>) {
      if (typeof origin === 'string') origins.push(origin);
    }
  }

  if (origins.length === 0) return false;
  return origins.some((origin) => origin.startsWith('chrome-extension://'));
};

export const hasDesktopBridge = (): boolean => {
  if (typeof window === 'undefined') return false;
  return typeof (window as unknown as { __GEMIGO_DESKTOP_BRIDGE__?: unknown })
    .__GEMIGO_DESKTOP_BRIDGE__ !== 'undefined';
};

// ========== Default Capabilities ==========

export const defaultWebCapabilities: Capabilities = {
  storage: true,
  network: false,
  scheduler: false,
  fileWatch: false,
  fileWrite: false,
  notification: true,
  clipboard: false,
  ai: false,
  shell: false,
  extension: {
    read: false,
    events: false,
    modify: false,
    capture: false,
  },
};

// ========== SDK State ==========

export type ProtocolInfo = {
  protocolVersion: number;
  platform: 'extension';
  appId: string;
  capabilities: Capabilities;
};

type InternalState = {
  platform: 'web' | 'desktop' | 'extension';
  capabilities: Capabilities;
  protocolInfo: ProtocolInfo | null;
  protocolPromise: Promise<ProtocolInfo> | null;
};

export const state: InternalState = {
  platform: hasDesktopBridge() ? 'desktop' : isProbablyExtensionHost() ? 'extension' : 'web',
  capabilities: defaultWebCapabilities,
  protocolInfo: null,
  protocolPromise: null,
};

// ========== Protocol Handshake ==========

const CONNECTION_TIMEOUT_MS = 1500;

export const ensureExtensionProtocol = async (): Promise<ProtocolInfo> => {
  if (state.protocolInfo) return state.protocolInfo;
  if (state.protocolPromise) return state.protocolPromise;

  state.protocolPromise = (async () => {
    initConnection(getChildMethods(), { timeoutMs: CONNECTION_TIMEOUT_MS });
    const host = await getHost(undefined, { timeoutMs: CONNECTION_TIMEOUT_MS });
    if (typeof host.getProtocolInfo !== 'function') {
      throw new SDKError(
        'NOT_SUPPORTED',
        'Extension host does not support getProtocolInfo().',
      );
    }
    const info = (await host.getProtocolInfo()) as ProtocolInfo;
    state.protocolInfo = info;
    state.platform = 'extension';
    state.capabilities = info.capabilities;
    return info;
  })().catch((err) => {
    // If not running inside our extension host, downgrade to web.
    state.platform = hasDesktopBridge() ? 'desktop' : 'web';
    state.capabilities = defaultWebCapabilities;
    state.protocolInfo = null;
    state.protocolPromise = null;
    throw err;
  });

  return state.protocolPromise;
};

// ========== Helper for Unsupported APIs ==========

export const throwNotSupported = (feature: string): never => {
  throw new SDKError('NOT_SUPPORTED', `${feature} is not supported in this environment.`);
};

export const notSupportedAsync =
  <T = never>(feature: string) =>
  async (): Promise<T> =>
    throwNotSupported(feature);

export const notSupportedHandler =
  <T = never>(feature: string) =>
  (): T =>
    throwNotSupported(feature);

// ========== Eager Init ==========

export const initExtensionConnection = (): void => {
  if (state.platform === 'extension') {
    initConnection(getChildMethods(), { timeoutMs: CONNECTION_TIMEOUT_MS });
  }
};

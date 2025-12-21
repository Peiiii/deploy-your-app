/**
 * GemiGo App SDK (unified)
 *
 * One SDK entry that auto-adapts for web/desktop/extension.
 * - Extension: connects to sidepanel host via penpal (RPC)
 * - Desktop: (reserved) detects injected bridge
 * - Web: fallback with limited capabilities
 */

import { getHost, initConnection, getChildMethods } from './core';
import { extensionAPI } from './apis';
import type {
  Capabilities,
  NotifyOptions,
  NotifyResult,
  GemigoSDK,
} from './types';

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

const isProbablyExtensionHost = (): boolean => {
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

const hasDesktopBridge = (): boolean => {
  if (typeof window === 'undefined') return false;
  return typeof (window as unknown as { __GEMIGO_DESKTOP_BRIDGE__?: unknown })
    .__GEMIGO_DESKTOP_BRIDGE__ !== 'undefined';
};

const defaultWebCapabilities: Capabilities = {
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

type ProtocolInfo = {
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

const state: InternalState = {
  platform: hasDesktopBridge() ? 'desktop' : isProbablyExtensionHost() ? 'extension' : 'web',
  capabilities: defaultWebCapabilities,
  protocolInfo: null,
  protocolPromise: null,
};

const ensureExtensionProtocol = async (): Promise<ProtocolInfo> => {
  if (state.protocolInfo) return state.protocolInfo;
  if (state.protocolPromise) return state.protocolPromise;

  state.protocolPromise = (async () => {
    initConnection(getChildMethods(), { timeoutMs: 1500 });
    const host = await getHost(undefined, { timeoutMs: 1500 });
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
    // If this is not actually running inside our extension host, downgrade to web.
    state.platform = hasDesktopBridge() ? 'desktop' : 'web';
    state.capabilities = defaultWebCapabilities;
    state.protocolInfo = null;
    state.protocolPromise = null;
    throw err;
  });

  return state.protocolPromise;
};

const throwNotSupported = (feature: string): never => {
  throw new SDKError('NOT_SUPPORTED', `${feature} is not supported in this environment.`);
};

const notSupportedAsync =
  <T = never>(feature: string) =>
  async (): Promise<T> =>
    throwNotSupported(feature);

const notSupportedHandler =
  <T = never>(feature: string) =>
  (): T =>
    throwNotSupported(feature);

const localStoragePrefix = (): string => {
  // For web fallback: best-effort isolation by origin.
  const origin =
    typeof window === 'undefined' ? 'unknown' : window.location.origin.replace(/[:/]/g, '_');
  return `gemigo:${origin}:`;
};

const webStorage = {
  get: async <T = unknown>(key: string): Promise<T | null> => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(`${localStoragePrefix()}${key}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  set: async (key: string, value: unknown): Promise<void> => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(`${localStoragePrefix()}${key}`, JSON.stringify(value));
  },
  delete: async (key: string): Promise<void> => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(`${localStoragePrefix()}${key}`);
  },
  clear: async (): Promise<void> => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const prefix = localStoragePrefix();
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const itemKey = window.localStorage.key(i);
      if (itemKey && itemKey.startsWith(prefix)) {
        window.localStorage.removeItem(itemKey);
      }
    }
  },
};

const notifyWeb = async (options: NotifyOptions): Promise<NotifyResult> => {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return { success: false, reason: 'not_supported' };
  }

  if (Notification.permission !== 'granted') {
    return { success: false, reason: 'permission_not_granted' };
  }

  try {
    new Notification(options.title, { body: options.body, icon: options.icon });
    return { success: true };
  } catch {
    return { success: false, reason: 'failed_to_notify' };
  }
};

const sdk: GemigoSDK = {
  get platform() {
    return state.platform;
  },
  get capabilities() {
    return state.capabilities;
  },

  storage: {
    get: async <T = unknown>(key: string): Promise<T | null> => {
      if (state.platform === 'extension') {
        const host = await getHost();
        if (typeof host.storageGet !== 'function') {
          return throwNotSupported('storage.get');
        }
        const res = await host.storageGet(key);
        if (!res?.success) return null;
        return (res.value ?? null) as T | null;
      }
      return webStorage.get<T>(key);
    },
    set: async (key: string, value: unknown): Promise<void> => {
      if (state.platform === 'extension') {
        const host = await getHost();
        if (typeof host.storageSet !== 'function') {
          return throwNotSupported('storage.set');
        }
        const res = await host.storageSet(key, value);
        if (!res?.success) {
          throw new SDKError('INTERNAL_ERROR', 'Failed to set storage value.');
        }
        return;
      }
      return webStorage.set(key, value);
    },
    delete: async (key: string): Promise<void> => {
      if (state.platform === 'extension') {
        const host = await getHost();
        if (typeof host.storageDelete !== 'function') {
          return throwNotSupported('storage.delete');
        }
        const res = await host.storageDelete(key);
        if (!res?.success) {
          throw new SDKError('INTERNAL_ERROR', 'Failed to delete storage value.');
        }
        return;
      }
      return webStorage.delete(key);
    },
    clear: async (): Promise<void> => {
      if (state.platform === 'extension') {
        const host = await getHost();
        if (typeof host.storageClear !== 'function') {
          return throwNotSupported('storage.clear');
        }
        const res = await host.storageClear();
        if (!res?.success) {
          throw new SDKError('INTERNAL_ERROR', 'Failed to clear storage.');
        }
        return;
      }
      return webStorage.clear();
    },
  },

  notify: (async (...args: unknown[]): Promise<NotifyResult> => {
    const options: NotifyOptions =
      typeof args[0] === 'string'
        ? { title: String(args[0]), body: String(args[1] ?? '') }
        : (args[0] as NotifyOptions);

    if (state.platform === 'extension' || isProbablyExtensionHost()) {
      try {
        await ensureExtensionProtocol();
        const host = await getHost();
        const res = await host.notify({ title: options.title, message: options.body ?? '' });
        return { success: Boolean(res?.success) };
      } catch {
        // fall through to web notify
      }
    }

    return notifyWeb(options);
  }) as GemigoSDK['notify'],

  onNotificationAction: notSupportedHandler('onNotificationAction') as GemigoSDK['onNotificationAction'],

  ai: {
    chat: notSupportedAsync('ai.chat'),
    summarize: notSupportedAsync('ai.summarize'),
    translate: notSupportedAsync('ai.translate'),
  },

  clipboard: {
    readText: notSupportedAsync('clipboard.readText'),
    writeText: notSupportedAsync('clipboard.writeText'),
    readImage: notSupportedAsync('clipboard.readImage'),
    writeImage: notSupportedAsync('clipboard.writeImage'),
    onChange: notSupportedHandler('clipboard.onChange'),
  },

  dialog: {
    openFile: notSupportedAsync('dialog.openFile'),
    openDirectory: notSupportedAsync('dialog.openDirectory'),
    saveFile: notSupportedAsync('dialog.saveFile'),
    message: notSupportedAsync('dialog.message'),
  },

  onFileDrop: notSupportedHandler('onFileDrop') as GemigoSDK['onFileDrop'],

  file: {
    readText: notSupportedAsync('file.readText'),
    readBinary: notSupportedAsync('file.readBinary'),
    write: notSupportedAsync('file.write'),
    append: notSupportedAsync('file.append'),
    exists: notSupportedAsync('file.exists'),
    stat: notSupportedAsync('file.stat'),
    copy: notSupportedAsync('file.copy'),
    move: notSupportedAsync('file.move'),
    remove: notSupportedAsync('file.remove'),
    list: notSupportedAsync('file.list'),
    mkdir: notSupportedAsync('file.mkdir'),
    persistPermission: notSupportedAsync('file.persistPermission'),
  },

  network: {
    request: async <T = unknown>(
      url: string,
      options?: {
        method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
        headers?: Record<string, string>;
        body?: string | object;
        responseType?: 'json' | 'text' | 'arraybuffer';
      },
    ) => {
      if (state.platform !== 'extension') {
        return throwNotSupported('network.request');
      }

      const protocol = await ensureExtensionProtocol();
      if (!protocol.capabilities.network) {
        throw new SDKError('PERMISSION_DENIED', 'Network capability is not granted.');
      }

      const host = await getHost();
      if (typeof host.networkRequest !== 'function') {
        return throwNotSupported('network.request');
      }

      const res = await host.networkRequest({ url, options });
      if (!res.success) {
        const code =
          res.code === 'NETWORK_NOT_ALLOWED'
            ? 'NETWORK_NOT_ALLOWED'
            : res.code === 'PERMISSION_DENIED'
              ? 'PERMISSION_DENIED'
              : 'INTERNAL_ERROR';
        throw new SDKError(code, res.error || 'Network request failed.');
      }

      return {
        status: res.status ?? 0,
        data: (res.data ?? null) as T,
        headers: res.headers ?? {},
      };
    },
  },

  extension: extensionAPI,
};

// Best-effort eager init for extension apps so event callbacks work immediately.
if (state.platform === 'extension') {
  initConnection(getChildMethods(), { timeoutMs: 1500 });
}

export default sdk;

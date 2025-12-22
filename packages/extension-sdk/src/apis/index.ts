/**
 * APIs Module
 *
 * Consolidated SDK creation using the master createSDK factory.
 * This module defines the SDK structure and maintains runtime state.
 */

import { createSDK } from '../core';
import type { ChildMethods } from '../core';
import { fallbackStorage, fallbackNetwork, fallbackNotify } from '../fallback';
import type {
  NotifyOptions,
  NotifyResult,
  GemigoSDK,
  Platform,
  Capabilities,
} from '../types';
import { SDKError } from '../types';

// ========== Environment State ==========

let hostInfo: { platform: Platform; capabilities: Capabilities } | null = null;

const defaultCapabilities: Capabilities = {
  storage: true,
  network: false,
  scheduler: false,
  fileWatch: false,
  fileWrite: false,
  notification: true,
  clipboard: false,
  ai: false,
  shell: false,
  extension: { read: false, events: false, modify: false, capture: false },
};

/**
 * Update the SDK's host environment information.
 */
export const updateHostInfo = (info: { platform: Platform; capabilities: Capabilities } | null) => {
  hostInfo = info;
};

// ========== Stubs ==========

const throwNotSupported = (feature: string): never => {
  throw new SDKError('NOT_SUPPORTED', `${feature} is not supported in this environment.`);
};

const stubAsync = <T = never>(feature: string) => async (): Promise<T> =>
  throwNotSupported(feature);
const stubHandler = <T = never>(feature: string) => (): T => throwNotSupported(feature);

const aiAPI = {
  chat: stubAsync('ai.chat'),
  summarize: stubAsync('ai.summarize'),
  translate: stubAsync('ai.translate'),
};

const clipboardAPI = {
  readText: stubAsync('clipboard.readText'),
  writeText: stubAsync('clipboard.writeText'),
  readImage: stubAsync('clipboard.readImage'),
  writeImage: stubAsync('clipboard.writeImage'),
  onChange: stubHandler('clipboard.onChange'),
};

const dialogAPI = {
  openFile: stubAsync('dialog.openFile'),
  openDirectory: stubAsync('dialog.openDirectory'),
  saveFile: stubAsync('dialog.saveFile'),
  message: stubAsync('dialog.message'),
};

const fileAPI = {
  readText: stubAsync('file.readText'),
  readBinary: stubAsync('file.readBinary'),
  write: stubAsync('file.write'),
  append: stubAsync('file.append'),
  exists: stubAsync('file.exists'),
  stat: stubAsync('file.stat'),
  copy: stubAsync('file.copy'),
  move: stubAsync('file.move'),
  remove: stubAsync('file.remove'),
  list: stubAsync('file.list'),
  mkdir: stubAsync('file.mkdir'),
  persistPermission: stubAsync('file.persistPermission'),
};

const onNotificationAction = stubHandler('onNotificationAction');
const onFileDrop = stubHandler('onFileDrop');

// ========== SDK Configuration ==========

const extensionRpcMethodNames = [
  'getPageInfo',
  'getPageHTML',
  'getPageText',
  'getSelection',
  'extractArticle',
  'extractLinks',
  'extractImages',
  'queryElement',
  'highlight',
  'removeHighlight',
  'insertWidget',
  'updateWidget',
  'removeWidget',
  'injectCSS',
  'removeCSS',
  'captureVisible',
  'getContextMenuEvent',
] as const;

/**
 * Ultimate SDK Creation
 * Consolidates modules, actions, getters, and stubs into a single factory call.
 */
export const { sdk, childMethods } = createSDK<GemigoSDK, ChildMethods>({
  getters: {
    platform: () => hostInfo?.platform ?? 'web',
    capabilities: () => hostInfo?.capabilities ?? defaultCapabilities,
  },
  modules: {
    storage: {
      rpc: {
        methods: ['get', 'set', 'delete', 'clear'],
        mapping: { get: 'storageGet', set: 'storageSet', delete: 'storageDelete', clear: 'storageClear' },
        fallbacks: {
          get: fallbackStorage.get,
          set: fallbackStorage.set,
          delete: fallbackStorage.delete,
          clear: fallbackStorage.clear,
        },
      },
    },
    network: {
      rpc: {
        methods: ['request'],
        mapping: { request: 'networkRequest' },
        fallbacks: { request: fallbackNetwork.request },
      },
    },
    extension: {
      rpc: { methods: extensionRpcMethodNames },
      events: {
        onContextMenu: { event: 'extension:contextMenu', childMethod: 'onContextMenuEvent' },
        onSelectionChange: 'extension:selectionChange',
      },
    },
  },
  actions: {
    notify: {
      method: 'notify',
      fallback: fallbackNotify,
    },
  },
  statics: {
    ai: aiAPI,
    clipboard: clipboardAPI,
    dialog: dialogAPI,
    file: fileAPI,
    onNotificationAction,
    onFileDrop,
  },
});


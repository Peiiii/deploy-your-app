/**
 * Stub APIs
 *
 * Placeholder implementations for APIs not yet available
 * on the current platform.
 */

import { notSupportedAsync, notSupportedHandler } from './platform';
import type {
  AIAPI,
  ClipboardAPI,
  DialogAPI,
  FileAPI,
  FileEntry,
} from '../types';

// ========== AI API (not implemented) ==========

export const aiAPI: AIAPI = {
  chat: notSupportedAsync('ai.chat'),
  summarize: notSupportedAsync('ai.summarize'),
  translate: notSupportedAsync('ai.translate'),
};

// ========== Clipboard API (not implemented) ==========

export const clipboardAPI: ClipboardAPI = {
  readText: notSupportedAsync('clipboard.readText'),
  writeText: notSupportedAsync('clipboard.writeText'),
  readImage: notSupportedAsync('clipboard.readImage'),
  writeImage: notSupportedAsync('clipboard.writeImage'),
  onChange: notSupportedHandler('clipboard.onChange'),
};

// ========== Dialog API (not implemented) ==========

export const dialogAPI: DialogAPI = {
  openFile: notSupportedAsync('dialog.openFile'),
  openDirectory: notSupportedAsync('dialog.openDirectory'),
  saveFile: notSupportedAsync('dialog.saveFile'),
  message: notSupportedAsync('dialog.message'),
};

// ========== File API (not implemented) ==========

export const fileAPI: FileAPI = {
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
};

// ========== Event Handlers (not implemented) ==========

export const onNotificationAction = notSupportedHandler('onNotificationAction') as (
  actionId: string,
  callback: () => void
) => () => void;

export const onFileDrop = notSupportedHandler('onFileDrop') as (
  callback: (files: FileEntry[]) => void
) => () => void;

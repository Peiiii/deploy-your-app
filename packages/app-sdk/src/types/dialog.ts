/**
 * Dialog API types
 */

import type { FileEntry } from './common';

/** File filter for save dialog */
export interface FileFilter {
  name: string;
  extensions: string[];
}

/** Open file dialog options */
export interface OpenFileOptions {
  /** MIME type filter, e.g. 'image/*' */
  accept?: string;
  /** Allow multiple file selection */
  multiple?: boolean;
}

/** Save file dialog options */
export interface SaveFileOptions {
  /** Default file name */
  defaultName?: string;
  /** File type filters */
  filters?: FileFilter[];
}

/** Message dialog options */
export interface MessageOptions {
  /** Dialog title */
  title: string;
  /** Dialog message */
  message: string;
  /** Message type */
  type?: 'info' | 'warning' | 'error';
  /** Button labels */
  buttons?: string[];
}

/** Dialog API */
export interface DialogAPI {
  /**
   * Open file selection dialog
   * @param options - Dialog options
   * @returns Selected file(s) or null if cancelled
   */
  openFile(options?: OpenFileOptions): Promise<FileEntry | FileEntry[] | null>;

  /**
   * Open directory selection dialog
   * @returns Selected directory path or null if cancelled
   */
  openDirectory(): Promise<{ path: string } | null>;

  /**
   * Open save file dialog
   * @param options - Dialog options
   * @returns Selected save path or null if cancelled
   */
  saveFile(options?: SaveFileOptions): Promise<{ path: string } | null>;

  /**
   * Show a message dialog
   * @param options - Message options
   * @returns Index of clicked button
   */
  message(options: MessageOptions): Promise<number>;
}

/** File drop callback */
export type FileDropCallback = (files: FileEntry[]) => void;

/** File drop handler (top-level API) */
export type FileDropHandler = (callback: FileDropCallback) => () => void;

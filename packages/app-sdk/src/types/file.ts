/**
 * File API types
 */

import type { FileEntry, FileStat } from './common';

/** Mkdir options */
export interface MkdirOptions {
  /** Create parent directories if they don't exist */
  recursive?: boolean;
}

/** File API for file system operations */
export interface FileAPI {
  // ========== Read/Write Operations ==========

  /**
   * Read text file (UTF-8)
   * @param path - File path
   * @returns File content as text
   */
  readText(path: string): Promise<string>;

  /**
   * Read binary file
   * @param path - File path
   * @returns File content as ArrayBuffer
   */
  readBinary(path: string): Promise<ArrayBuffer>;

  /**
   * Write to file
   * @param path - File path
   * @param data - Content to write
   */
  write(path: string, data: string | ArrayBuffer): Promise<void>;

  /**
   * Append to file
   * @param path - File path
   * @param data - Content to append
   */
  append(path: string, data: string | ArrayBuffer): Promise<void>;

  // ========== File Operations ==========

  /**
   * Check if path exists
   * @param path - File path
   * @returns True if exists
   */
  exists(path: string): Promise<boolean>;

  /**
   * Get file/directory stats
   * @param path - File path
   * @returns File stat information
   */
  stat(path: string): Promise<FileStat>;

  /**
   * Copy file
   * @param src - Source path
   * @param dest - Destination path
   */
  copy(src: string, dest: string): Promise<void>;

  /**
   * Move/rename file
   * @param src - Source path
   * @param dest - Destination path
   */
  move(src: string, dest: string): Promise<void>;

  /**
   * Remove file or directory
   * @param path - Path to remove
   */
  remove(path: string): Promise<void>;

  // ========== Directory Operations ==========

  /**
   * List directory contents
   * @param path - Directory path
   * @returns Array of file entries
   */
  list(path: string): Promise<FileEntry[]>;

  /**
   * Create directory
   * @param path - Directory path
   * @param options - Creation options
   */
  mkdir(path: string, options?: MkdirOptions): Promise<void>;

  // ========== Permission Management ==========

  /**
   * Persist permission for a user-selected path
   * @param path - Path to persist permission for
   */
  persistPermission(path: string): Promise<void>;
}

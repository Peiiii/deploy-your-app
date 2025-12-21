/**
 * Common types used across the GemiGo SDK
 */

/** Current platform type */
export type Platform = 'web' | 'desktop' | 'extension';

/** Environment capabilities */
export interface Capabilities {
  scheduler: boolean;
  fileWatch: boolean;
  fileWrite: boolean;
  notification: boolean;
  clipboard: boolean;
  ai: boolean;
  shell: boolean;
  network: boolean;
}

/** File entry information */
export interface FileEntry {
  /** File name */
  name: string;
  /** Full path */
  path: string;
  /** Whether this is a file */
  isFile: boolean;
  /** Whether this is a directory */
  isDirectory: boolean;
  /** File size in bytes */
  size: number;
  /** Last modification timestamp */
  mtime: number;
}

/** File stat information */
export interface FileStat {
  size: number;
  mtime: number;
  ctime: number;
  isFile: boolean;
  isDirectory: boolean;
}

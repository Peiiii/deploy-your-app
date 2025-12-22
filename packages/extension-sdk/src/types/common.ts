/**
 * Common types used across the GemiGo SDK
 */

/** Current platform type */
export type Platform = 'web' | 'desktop' | 'extension';

/** SDK Error Codes */
export type SDKErrorCode =
  | 'NOT_SUPPORTED'
  | 'PERMISSION_DENIED'
  | 'NETWORK_NOT_ALLOWED'
  | 'TIMEOUT'
  | 'INTERNAL_ERROR'
  | 'NOT_CONNECTED';

/** Unified SDK Error class */
export class SDKError extends Error {
  constructor(public code: SDKErrorCode, message: string) {
    super(message);
    this.name = 'SDKError';
    // Ensure properly prototype chain for instanceof
    Object.setPrototypeOf(this, SDKError.prototype);
  }
}


/** Environment capabilities */
export interface Capabilities {
  /** Persistent key-value storage */
  storage: boolean;
  /** Cross-origin/network proxy capability (host mediated) */
  network: boolean;

  scheduler: boolean;
  fileWatch: boolean;
  fileWrite: boolean;
  notification: boolean;
  clipboard: boolean;
  ai: boolean;
  shell: boolean;

  /** Extension-specific capability breakdown */
  extension?: {
    read: boolean;
    events: boolean;
    modify: boolean;
    capture: boolean;
  };
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

// ========== RPC Result Types ==========

/**
 * Base RPC result structure.
 * All RPC methods that can fail should return this structure.
 */
export interface RPCResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * RPC result with required data (for successful operations).
 */
export type RPCResultWithData<T> = RPCResult<T> & { data: T };


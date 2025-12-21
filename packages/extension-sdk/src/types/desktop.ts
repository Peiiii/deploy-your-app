/**
 * Desktop-only API types
 * These APIs are only available when gemigo.platform === 'desktop'
 */

import type { NotifyOptions } from './notify';

// ========== Scheduler API ==========

/** Scheduler task configuration */
export interface SchedulerConfig {
  /** Unique task ID */
  id: string;
  /** Interval (e.g. '30m', '1h', '2h', '1d') */
  interval: string;
  /** Start time (e.g. '08:00') */
  startTime?: string;
  /** End time (e.g. '22:00') */
  endTime?: string;
  /** Notification to show when task runs */
  notification?: NotifyOptions;
}

/** Scheduler operation result */
export interface SchedulerResult {
  success: boolean;
  reason?: string;
}

/** Scheduler API for background tasks */
export interface SchedulerAPI {
  /**
   * Register a background scheduled task
   * @param config - Task configuration
   */
  register(config: SchedulerConfig): Promise<SchedulerResult>;

  /**
   * Update an existing task
   * @param id - Task ID
   * @param config - Updated configuration
   */
  update(id: string, config: Partial<Omit<SchedulerConfig, 'id'>>): Promise<SchedulerResult>;

  /**
   * Cancel a scheduled task
   * @param id - Task ID
   */
  cancel(id: string): Promise<void>;

  /**
   * List all scheduled tasks for this app
   */
  list(): Promise<SchedulerConfig[]>;
}

// ========== FileWatch API ==========

/** File watch event type */
export type FileWatchEventType = 'create' | 'modify' | 'delete';

/** File watch configuration */
export interface FileWatchConfig {
  /** Unique watch ID */
  id: string;
  /** Path to watch (e.g. '~/Downloads') */
  path: string;
  /** Glob pattern (e.g. '*.png') */
  pattern?: string;
  /** Events to watch for */
  events: FileWatchEventType[];
  /** Action to perform */
  action: {
    type: 'callback';
    callback: string;
  };
}

/** File watch event */
export interface FileWatchEvent {
  /** Watch ID */
  id: string;
  /** Changed file path */
  path: string;
  /** Event type */
  event: FileWatchEventType;
}

/** FileWatch API for monitoring file system changes */
export interface FileWatchAPI {
  /**
   * Register a file watch
   * @param config - Watch configuration
   */
  register(config: FileWatchConfig): Promise<{ success: boolean }>;

  /**
   * Cancel a file watch
   * @param id - Watch ID
   */
  cancel(id: string): Promise<void>;
}

/** File watch callback handler */
export type FileWatchHandler = (callbackId: string, handler: (event: FileWatchEvent) => void) => void;

// ========== Shell API ==========

/** Shell API for system integration */
export interface ShellAPI {
  /**
   * Open URL in system default browser
   * @param url - URL to open
   */
  openExternal(url: string): Promise<void>;

  /**
   * Show file in Finder/Explorer
   * @param path - File path
   */
  showItemInFolder(path: string): Promise<void>;

  /**
   * Open file with system default application
   * @param path - File path
   */
  openPath(path: string): Promise<void>;
}

// ========== GlobalShortcut API ==========

/** GlobalShortcut API for system-level keyboard shortcuts */
export interface GlobalShortcutAPI {
  /**
   * Register a global shortcut
   * @param accelerator - Key combination (e.g. 'Cmd+Shift+X', 'Ctrl+Alt+P')
   * @param callback - Handler function
   * @returns True if registration succeeded
   */
  register(accelerator: string, callback: () => void): Promise<boolean>;

  /**
   * Unregister a global shortcut
   * @param accelerator - Key combination
   */
  unregister(accelerator: string): Promise<void>;

  /**
   * Unregister all shortcuts for this app
   */
  unregisterAll(): Promise<void>;
}

// ========== Autostart API ==========

/** Autostart API for managing app launch on system startup */
export interface AutostartAPI {
  /**
   * Enable auto-start on system boot
   */
  enable(): Promise<void>;

  /**
   * Disable auto-start
   */
  disable(): Promise<void>;

  /**
   * Check if auto-start is enabled
   */
  isEnabled(): Promise<boolean>;
}

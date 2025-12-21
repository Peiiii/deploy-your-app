/**
 * GemiGo SDK Types
 * 
 * Complete TypeScript type definitions for the GemiGo SDK API.
 */

// Common types
export type { Platform, Capabilities, FileEntry, FileStat } from './common';

// Storage API
export type { StorageAPI } from './storage';

// Notify API
export type {
  NotifyAction,
  NotifyOptions,
  NotifyResult,
  NotifyAPI,
  NotificationActionHandler,
} from './notify';

// AI API
export type {
  ChatMessage,
  ChatResponse,
  TranslateOptions,
  TranslateResult,
  AIAPI,
} from './ai';

// Clipboard API
export type {
  ClipboardContent,
  ClipboardChangeCallback,
  ClipboardAPI,
} from './clipboard';

// Dialog API
export type {
  FileFilter,
  OpenFileOptions,
  SaveFileOptions,
  MessageOptions,
  DialogAPI,
  FileDropCallback,
  FileDropHandler,
} from './dialog';

// File API
export type { MkdirOptions, FileAPI } from './file';

// Network API
export type {
  HttpMethod,
  ResponseType,
  RequestOptions,
  RequestResponse,
  NetworkAPI,
} from './network';

// Desktop APIs
export type {
  // Scheduler
  SchedulerConfig,
  SchedulerResult,
  SchedulerAPI,
  // FileWatch
  FileWatchEventType,
  FileWatchConfig,
  FileWatchEvent,
  FileWatchAPI,
  FileWatchHandler,
  // Shell
  ShellAPI,
  // GlobalShortcut
  GlobalShortcutAPI,
  // Autostart
  AutostartAPI,
} from './desktop';

// Extension API
export type {
  PageInfo,
  SelectionRect,
  SelectionResult,
  ElementInfo,
  ArticleContent,
  LinkInfo,
  ImageInfo,
  HighlightOptions,
  WidgetPosition,
  WidgetConfig,
  WidgetHandle,
  CaptureFullOptions,
  ContextMenuEvent,
  ContextMenuEventResult,
  CaptureResult,
  HighlightResult,
  WidgetResult,
  CSSResult,
  ExtractArticleResult,
  ExtractLinksResult,
  ExtractImagesResult,
  QueryElementResult,
  ExtensionAPI,
} from './extension';

// Manifest
export type {
  AppType,
  PlatformType,
  PermissionType,
  FileScope,
  ContextMenuContext,
  ContextMenuItem,
  SelectionAction,
  SidePanelConfig,
  UIConfig,
  BackgroundCapability,
  BackgroundConfig,
  FileConfig,
  ExtensionConfig,
  AppManifest,
} from './manifest';

// ========== Main SDK Interface ==========

import type { Platform, Capabilities } from './common';
import type { StorageAPI } from './storage';
import type { NotifyOptions, NotifyResult } from './notify';
import type { AIAPI } from './ai';
import type { ClipboardAPI } from './clipboard';
import type { DialogAPI } from './dialog';
import type { FileEntry } from './common';
import type { FileAPI } from './file';
import type { NetworkAPI } from './network';
import type {
  SchedulerAPI,
  FileWatchAPI,
  FileWatchEvent,
  ShellAPI,
  GlobalShortcutAPI,
  AutostartAPI,
} from './desktop';
import type { ExtensionAPI } from './extension';

/**
 * Complete GemiGo SDK interface
 * 
 * Available APIs depend on the current platform:
 * - `web`: Common APIs only
 * - `desktop`: Common + Desktop APIs
 * - `extension`: Common + Extension APIs
 */
export interface GemigoSDK {
  // ========== Environment ==========

  /** Current platform: 'web' | 'desktop' | 'extension' */
  readonly platform: Platform;

  /** Available capabilities for current environment */
  readonly capabilities: Capabilities;

  // ========== Common APIs ==========

  /** Persistent key-value storage */
  storage: StorageAPI;

  /**
   * Send system notification
   * @param options - Notification options
   */
  notify(options: NotifyOptions): Promise<NotifyResult>;

  /**
   * Listen for notification action button clicks
   * @param actionId - Action ID from notification
   * @param callback - Handler function
   * @returns Unsubscribe function
   */
  onNotificationAction(actionId: string, callback: () => void): () => void;

  /** AI/LLM integration */
  ai: AIAPI;

  /** Clipboard access */
  clipboard: ClipboardAPI;

  /** File/folder dialogs */
  dialog: DialogAPI;

  /**
   * Listen for files dropped onto the app
   * @param callback - Drop handler
   * @returns Unsubscribe function
   */
  onFileDrop(callback: (files: FileEntry[]) => void): () => void;

  /** File system operations */
  file: FileAPI;

  /** Cross-origin HTTP requests */
  network: NetworkAPI;

  // ========== Desktop-only APIs ==========
  // Available when platform === 'desktop'

  /** Background scheduled tasks */
  scheduler?: SchedulerAPI;

  /** File system change monitoring */
  fileWatch?: FileWatchAPI;

  /**
   * Listen for file watch events
   * @param callbackId - Callback ID from registration
   * @param handler - Event handler
   */
  onFileWatch?(callbackId: string, handler: (event: FileWatchEvent) => void): void;

  /** System shell integration */
  shell?: ShellAPI;

  /** Global keyboard shortcuts */
  globalShortcut?: GlobalShortcutAPI;

  /** Auto-start on system boot */
  autostart?: AutostartAPI;

  // ========== Extension-only APIs ==========
  // Available when platform === 'extension'

  /** Browser extension page interaction */
  extension?: ExtensionAPI;
}

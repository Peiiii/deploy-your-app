/**
 * App Manifest types
 */

/** Application type */
export type AppType = 'ui' | 'hybrid' | 'service';

/** Platform type */
export type PlatformType = 'web' | 'desktop' | 'extension';

/** Permission types */
export type PermissionType =
  | 'storage'
  | 'notify'
  | 'scheduler'
  | 'fileWatch'
  | 'fileWrite'
  | 'ai'
  | 'clipboard'
  | 'shell'
  | 'network'
  | 'extension.modify'
  | 'extension.capture'
  | 'extension.shortcuts';

/** File scope paths */
export type FileScope = '$DOWNLOAD' | '$DOCUMENT' | '$PICTURE' | '$DESKTOP' | '$APP_DATA' | '$TEMP';

/** Context menu context types */
export type ContextMenuContext = 'selection' | 'page' | 'image';

/** Context menu item configuration */
export interface ContextMenuItem {
  id: string;
  title: string;
  contexts: ContextMenuContext[];
}

/** Selection action configuration */
export interface SelectionAction {
  id: string;
  label: string;
  icon?: string;
}

/** Side panel configuration */
export interface SidePanelConfig {
  enabled: boolean;
  icon?: string;
  title?: string;
}

/** UI entry points */
export interface UIConfig {
  /** Main UI HTML file */
  main: string;
  /** Settings UI HTML file (for hybrid/service apps) */
  settings?: string;
}

/** Background capabilities */
export type BackgroundCapability = 'scheduler' | 'fileWatch';

/** Background configuration */
export interface BackgroundConfig {
  enabled: boolean;
  capabilities?: BackgroundCapability[];
}

/** File permission configuration */
export interface FileConfig {
  scope?: FileScope[];
}

/** Extension-specific configuration */
export interface ExtensionConfig {
  sidePanel?: SidePanelConfig;
  contextMenu?: ContextMenuItem[];
  selectionAction?: SelectionAction;
}

/**
 * Application manifest definition
 * The manifest.json file that configures app metadata and permissions
 */
export interface AppManifest {
  // ========== Basic Metadata ==========

  /** App name (required) */
  name: string;
  /** Version string (required) */
  version: string;
  /** App description (required) */
  description: string;
  /** App icon relative path (required) */
  icon: string;
  /** Author name */
  author?: string;

  // ========== App Configuration ==========

  /** App type (default: 'ui') */
  type?: AppType;
  /** Supported platforms */
  platforms?: PlatformType[];
  /** Required permissions */
  permissions?: PermissionType[];

  // ========== Entry Points ==========

  /** UI entry configuration */
  ui?: UIConfig;
  /** Installation script */
  onInstall?: string;

  // ========== Feature Configuration ==========

  /** File permission scopes */
  file?: FileConfig;
  /** Background task configuration */
  background?: BackgroundConfig;
  /** Browser extension configuration */
  extension?: ExtensionConfig;
}

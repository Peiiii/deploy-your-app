// Config type definitions for the backend. Kept in a separate module so that
// other files can import types without pulling in config side‑effects.

export type DeployTarget = 'local' | 'cloudflare';

export interface PlatformAIConfig {
  provider: string;
  model: string;
  apiKey: string;
}

export interface CloudflareConfig {
  accountId: string;
  apiToken: string;
  pagesProjectPrefix: string;
}

export interface PathsConfig {
  // Base data directory - all other paths are subdirectories of this
  dataDir: string;
  // Subdirectories automatically created under dataDir
  buildsRoot: string;
  staticRoot: string;
  projectsFile: string;
}

export interface AppConfig {
  deployTarget: DeployTarget;
  platformAI: PlatformAIConfig;
  cloudflare: CloudflareConfig;
  paths: PathsConfig;
}


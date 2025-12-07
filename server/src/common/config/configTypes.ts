// Config type definitions for the backend. Kept in a separate module so that
// other files can import types without pulling in config side-effects.

// Where user apps are ultimately served from.
// - 'local'      : static files are copied to the Node server's /apps/<slug> directory
// - 'cloudflare' : legacy Cloudflare Pages deployment flow (kept for backwards compat)
// - 'r2'         : build on Aliyun, upload to Cloudflare R2, serve via Worker gateway
export type DeployTarget = 'local' | 'cloudflare' | 'r2';

// Storage backend type for application data (projects, users, etc.).
// - 'file' : store data in local JSON files (data/projects.json, etc.)
// - 'd1'   : store data in Cloudflare D1 database
export type StorageType = 'file' | 'd1';

export interface PlatformAIConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
}

export interface CloudflareConfig {
  accountId: string;
  apiToken: string;
  pagesProjectPrefix: string;
}

export interface CloudflareD1Config {
  accountId: string;
  databaseId: string;
  apiToken: string;
}

// Configuration for Cloudflare R2 object storage used as the static asset source.
export interface R2Config {
  // Cloudflare account id – usually the same as CLOUDFLARE_ACCOUNT_ID.
  accountId: string;
  // S3-compatible access key / secret for R2.
  accessKeyId: string;
  secretAccessKey: string;
  // Bucket name that holds all built app assets.
  bucketName: string;
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
  // Cloudflare R2 object storage configuration for the "r2" deploy target.
  r2: R2Config;
  cloudflareD1?: CloudflareD1Config | null;
  // Storage backend type for application data: 'file' (local JSON) or 'd1' (Cloudflare D1)
  storageType: StorageType;
  // Apex/root domain for user apps, e.g. "gemigo.app".
  appsRootDomain: string;
  paths: PathsConfig;
}

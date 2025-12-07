import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type {
  AppConfig,
  DeployTarget,
  PlatformAIConfig,
  CloudflareConfig,
  R2Config,
  PathsConfig,
} from './configTypes.js';
import { getEnv, getEnvOrDefault, loadBackendEnv } from './env.js';

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

// Re-export types so callers can still import from './config'
export type {
  AppConfig,
  CloudflareConfig,
  DeployTarget,
  PathsConfig,
  PlatformAIConfig,
} from './configTypes.js';

// ---------------------------------------------------------------------------
// Environment initialization
// ---------------------------------------------------------------------------

// Ensure the backend sees values from the repo-root .env file
// both in dev (TS sources) and prod (compiled JS), without extra deps.
loadBackendEnv();

// ---------------------------------------------------------------------------
// Configuration parsing functions
// ---------------------------------------------------------------------------

function parseDeployTarget(raw: string | undefined): DeployTarget {
  if (raw === 'cloudflare') return 'cloudflare';
  if (raw === 'r2') return 'r2';
  // Default + fallback: keep product usable if env is misconfigured.
  return 'local';
}

function parsePlatformAIConfig(): PlatformAIConfig {
  return {
    provider: getEnvOrDefault('PLATFORM_AI_PROVIDER', 'dashscope'),
    model: getEnvOrDefault('PLATFORM_AI_MODEL', 'qwen3-max'),
    // 我们平台自己的 DashScope Key，用于平台 AI 能力（不是用户自己的 key）
    apiKey:
      getEnv('DASHSCOPE_API_KEY') ??
      getEnv('DASHSCOPE_APIKEY') ??
      '',
    baseUrl: getEnvOrDefault(
      'PLATFORM_AI_BASE_URL',
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
    ),
  };
}

function parseCloudflareConfig(): CloudflareConfig {
  return {
    accountId: getEnvOrDefault('CLOUDFLARE_ACCOUNT_ID', ''),
    apiToken: getEnvOrDefault('CLOUDFLARE_PAGES_API_TOKEN', ''),
    pagesProjectPrefix: getEnvOrDefault(
      'CLOUDFLARE_PAGES_PROJECT_PREFIX',
      'deploy-your-app',
    ),
  };
}

function parseR2Config(): R2Config {
  // For most setups the R2 account id is the same as the Cloudflare account id.
  const accountId =
    getEnv('R2_ACCOUNT_ID') ??
    getEnv('CLOUDFLARE_ACCOUNT_ID') ??
    '';

  return {
    accountId,
    accessKeyId: getEnvOrDefault('R2_ACCESS_KEY_ID', ''),
    secretAccessKey: getEnvOrDefault('R2_SECRET_ACCESS_KEY', ''),
    bucketName: getEnvOrDefault('R2_BUCKET_NAME', ''),
  };
}

function parseAppsRootDomain(): string {
  // Root domain for user apps, e.g. "gemigo.app".
  // If not provided, fall back to a placeholder so that URLs are still valid
  // in dev environments.
  return getEnvOrDefault('APPS_ROOT_DOMAIN', 'example.com');
}

/**
 * Calculate the root directory of the monorepo.
 * - When running from TS in /server, __dirname is "<root>/server"
 * - When running from compiled JS in /server/dist, __dirname is "<root>/server/dist"
 * In both cases, going two levels up lands at the repo root.
 */
function getRootDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, '..', '..');
}

function resolveFromRoot(relOrAbs: string, rootDir: string): string {
  if (path.isAbsolute(relOrAbs)) return relOrAbs;
  return path.join(rootDir, relOrAbs);
}

function parsePathsConfig(rootDir: string): PathsConfig {
  // Only configure one base data directory - all other paths are subdirectories
  const dataDirEnv = getEnvOrDefault('DATA_DIR', 'data');
  const dataDir = resolveFromRoot(dataDirEnv, rootDir);

  // All subdirectories are automatically created under dataDir
  const buildsRoot = path.join(dataDir, 'builds');
  const staticRoot = path.join(dataDir, 'apps');
  const projectsFile = path.join(dataDir, 'projects.json');

  return {
    dataDir,
    buildsRoot,
    staticRoot,
    projectsFile,
  };
}

// ---------------------------------------------------------------------------
// Central configuration object
// ---------------------------------------------------------------------------

/**
 * Central, typed configuration object.
 * All other exports below are convenience aliases for existing call sites.
 */
const rootDir = getRootDir();
const pathsConfig = parsePathsConfig(rootDir);

// Ensure base data directory and all subdirectories exist
fs.mkdirSync(pathsConfig.dataDir, { recursive: true });
fs.mkdirSync(pathsConfig.buildsRoot, { recursive: true });
fs.mkdirSync(pathsConfig.staticRoot, { recursive: true });

export const CONFIG: AppConfig = Object.freeze({
  deployTarget: parseDeployTarget(getEnv('DEPLOY_TARGET')),
  platformAI: parsePlatformAIConfig(),
  cloudflare: parseCloudflareConfig(),
  r2: parseR2Config(),
  appsRootDomain: parseAppsRootDomain(),
  paths: pathsConfig,
});

// ---------------------------------------------------------------------------
// Backwards-compatible named exports
// ---------------------------------------------------------------------------

// Platform AI configuration
export const PLATFORM_AI_PROVIDER = CONFIG.platformAI.provider;
export const PLATFORM_AI_MODEL = CONFIG.platformAI.model;
export const DASHSCOPE_API_KEY = CONFIG.platformAI.apiKey;
export const PLATFORM_AI_BASE_URL = CONFIG.platformAI.baseUrl;

// Deployment target
// - 'local': copy static assets to /apps/<slug>/ and serve from the Node server
// - 'cloudflare': deploy to Cloudflare Pages (requires Cloudflare credentials)
// - 'r2': upload build artifacts to Cloudflare R2, served via Worker gateway
export const DEPLOY_TARGET: DeployTarget = CONFIG.deployTarget;

// Cloudflare configuration
// Account / token for Pages API or wrangler CLI (future use).
export const CLOUDFLARE_ACCOUNT_ID = CONFIG.cloudflare.accountId;
export const CLOUDFLARE_PAGES_API_TOKEN = CONFIG.cloudflare.apiToken;
// Prefix for auto-generated Cloudflare Pages project names.
// Final project name will be: <prefix>-<slug>
export const CLOUDFLARE_PAGES_PROJECT_PREFIX =
  CONFIG.cloudflare.pagesProjectPrefix;

// Cloudflare R2 configuration (for the "r2" deploy target).
export const R2_ACCOUNT_ID = CONFIG.r2.accountId;
export const R2_ACCESS_KEY_ID = CONFIG.r2.accessKeyId;
export const R2_SECRET_ACCESS_KEY = CONFIG.r2.secretAccessKey;
export const R2_BUCKET_NAME = CONFIG.r2.bucketName;

// Root domain where apps are exposed, e.g. "gemigo.app".
export const APPS_ROOT_DOMAIN = CONFIG.appsRootDomain;

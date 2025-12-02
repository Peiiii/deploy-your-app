import type {
  AppConfig,
  DeployTarget,
  PlatformAIConfig,
  CloudflareConfig,
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
  };
}

function parseCloudflareConfig(): CloudflareConfig {
  return {
    accountId: getEnvOrDefault('CLOUDFLARE_ACCOUNT_ID', ''),
    apiToken: getEnvOrDefault('CLOUDFLARE_API_TOKEN', ''),
    pagesProjectPrefix: getEnvOrDefault(
      'CLOUDFLARE_PAGES_PROJECT_PREFIX',
      'deploy-your-app',
    ),
  };
}

// ---------------------------------------------------------------------------
// Central configuration object
// ---------------------------------------------------------------------------

/**
 * Central, typed configuration object.
 * All other exports below are convenience aliases for existing call sites.
 */
export const CONFIG: AppConfig = Object.freeze({
  deployTarget: parseDeployTarget(getEnv('DEPLOY_TARGET')),
  platformAI: parsePlatformAIConfig(),
  cloudflare: parseCloudflareConfig(),
});

// ---------------------------------------------------------------------------
// Backwards-compatible named exports
// ---------------------------------------------------------------------------

// Platform AI configuration
export const PLATFORM_AI_PROVIDER = CONFIG.platformAI.provider;
export const PLATFORM_AI_MODEL = CONFIG.platformAI.model;
export const DASHSCOPE_API_KEY = CONFIG.platformAI.apiKey;

// Deployment target
// - 'local': copy static assets to /apps/<slug>/ and serve from the Node server
// - 'cloudflare': deploy to Cloudflare Pages (requires Cloudflare credentials)
export const DEPLOY_TARGET: DeployTarget = CONFIG.deployTarget;

// Cloudflare configuration
// Account / token for Pages API or wrangler CLI (future use).
export const CLOUDFLARE_ACCOUNT_ID = CONFIG.cloudflare.accountId;
export const CLOUDFLARE_API_TOKEN = CONFIG.cloudflare.apiToken;
// Prefix for auto-generated Cloudflare Pages project names.
// Final project name will be: <prefix>-<slug>
export const CLOUDFLARE_PAGES_PROJECT_PREFIX =
  CONFIG.cloudflare.pagesProjectPrefix;

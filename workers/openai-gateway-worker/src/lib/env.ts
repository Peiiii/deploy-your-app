export interface Env {
  PROVIDER: string;
  TARGET_BASE_URL: string;
  DEFAULT_MODEL: string;
  UPSTREAM_API_KEY?: string;
  OPENAI_API_KEY?: string;
}

const PROVIDER_BASE_URLS: Record<string, string> = {
  openai_compatible: 'https://api.openai.com',
  openai: 'https://api.openai.com',
  deepseek: 'https://api.deepseek.com',
};

export function getTargetBaseUrl(env: Env): string {
  if (env.TARGET_BASE_URL && env.TARGET_BASE_URL.trim().length > 0) {
    return env.TARGET_BASE_URL.trim().replace(/\/+$/, '');
  }
  const fallback = PROVIDER_BASE_URLS[env.PROVIDER] || PROVIDER_BASE_URLS.openai_compatible;
  return fallback.replace(/\/+$/, '');
}

export function getChatCompletionsUrl(env: Env): string {
  const baseUrl = getTargetBaseUrl(env);
  if (baseUrl.endsWith('/v1')) {
    return `${baseUrl}/chat/completions`;
  }
  return `${baseUrl}/v1/chat/completions`;
}

export function getUpstreamApiKeyOrThrow(env: Env): string {
  const key = env.UPSTREAM_API_KEY || env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('UPSTREAM_API_KEY is not configured');
  }
  return key;
}


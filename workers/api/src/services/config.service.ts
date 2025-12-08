import type { ApiWorkerEnv } from '../types/env';

class ConfigService {
  getAppsRootDomain(env: ApiWorkerEnv): string {
    return env.APPS_ROOT_DOMAIN?.trim() || 'gemigo.app';
  }

  getDeployTarget(env: ApiWorkerEnv): 'cloudflare' | 'local' | 'r2' {
    const raw = env.DEPLOY_TARGET?.toLowerCase();
    if (raw === 'cloudflare' || raw === 'local' || raw === 'r2') {
      return raw;
    }
    return 'r2';
  }

  getPlatformAiBaseUrl(env: ApiWorkerEnv): string {
    return (
      env.PLATFORM_AI_BASE_URL?.trim() ||
      'https://dashscope.aliyuncs.com/compatible-mode/v1'
    );
  }

  getPlatformAiModel(env: ApiWorkerEnv): string {
    return env.PLATFORM_AI_MODEL?.trim() || 'qwen3-max';
  }

  getDashscopeApiKey(env: ApiWorkerEnv): string {
    return env.DASHSCOPE_API_KEY?.trim() || '';
  }

  getDeployServiceBaseUrl(env: ApiWorkerEnv): string {
    const raw = env.DEPLOY_SERVICE_BASE_URL?.trim();
    if (raw && raw.length > 0) {
      return raw.replace(/\/+$/, '');
    }
    return 'http://127.0.0.1:4173/api/v1';
  }

  getPasswordSalt(env: ApiWorkerEnv): string {
    return env.PASSWORD_SALT?.trim() || 'local-dev-salt-change-me';
  }

  getAuthRedirectBase(env: ApiWorkerEnv): string {
    return env.AUTH_REDIRECT_BASE?.trim() || 'https://gemigo.io';
  }

  getGoogleClientId(env: ApiWorkerEnv): string | null {
    return env.GOOGLE_CLIENT_ID?.trim() || null;
  }

  getGoogleClientSecret(env: ApiWorkerEnv): string | null {
    return env.GOOGLE_CLIENT_SECRET?.trim() || null;
  }

  getGithubClientId(env: ApiWorkerEnv): string | null {
    return env.GITHUB_CLIENT_ID?.trim() || null;
  }

  getGithubClientSecret(env: ApiWorkerEnv): string | null {
    return env.GITHUB_CLIENT_SECRET?.trim() || null;
  }

  getGoogleOAuthEnabled(env: ApiWorkerEnv): boolean {
    return !!(
      this.getGoogleClientId(env) && this.getGoogleClientSecret(env)
    );
  }

  getGithubOAuthEnabled(env: ApiWorkerEnv): boolean {
    return !!(
      this.getGithubClientId(env) && this.getGithubClientSecret(env)
    );
  }
}

export const configService = new ConfigService();

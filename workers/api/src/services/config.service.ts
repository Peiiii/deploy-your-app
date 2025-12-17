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

  getDeployServiceBaseUrl(env: ApiWorkerEnv): string {
    const raw = env.DEPLOY_SERVICE_BASE_URL?.trim();
    if (raw && raw.length > 0) {
      return raw.replace(/\/+$/, '');
    }
    return 'http://127.0.0.1:4173/api/v1';
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
}

export const configService = new ConfigService();

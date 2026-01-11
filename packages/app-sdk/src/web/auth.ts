import type { AuthAPI, AuthLoginOptions, AuthTokenResponse, AuthScope } from '../types/auth';
import { SDKError } from '../types/common';

let currentToken: AuthTokenResponse | null = null;
let currentApiBaseUrl: string | null = null;

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const btoaFn = (globalThis as unknown as { btoa?: (data: string) => string }).btoa;
  if (!btoaFn) throw new Error('base64 encoder not available');
  const base64 = btoaFn(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomString(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base64UrlEncode(buf);
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

function deriveDefaultAppId(): string {
  if (typeof window === 'undefined') return 'unknown';
  const host = window.location.hostname.toLowerCase();
  if (host.endsWith('.gemigo.app')) {
    return host.replace(/\.gemigo\.app$/, '');
  }
  return host;
}

function normalizeScopes(scopes?: AuthScope[]): string[] {
  const list = (scopes ?? ['identity:basic'])
    .map((s) => String(s).trim())
    .filter(Boolean);
  return list.length > 0 ? list : ['identity:basic'];
}

function buildBrokerUrl(options: Required<Pick<AuthLoginOptions, 'platformOrigin'>> & {
  appId: string;
  scopes: string[];
  state: string;
  codeChallenge: string;
  openerOrigin: string;
}): string {
  const url = new URL('/sdk/broker', options.platformOrigin);
  url.searchParams.set('app_id', options.appId);
  url.searchParams.set('scope', options.scopes.join(' '));
  url.searchParams.set('state', options.state);
  url.searchParams.set('code_challenge', options.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('origin', options.openerOrigin);
  return url.toString();
}

async function exchangeCode(
  apiBaseUrl: string,
  code: string,
  codeVerifier: string,
): Promise<AuthTokenResponse> {
  const res = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}/sdk/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, codeVerifier }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Failed to exchange code');
  }
  return (await res.json()) as AuthTokenResponse;
}

export function getWebApiBaseUrl(): string {
  return currentApiBaseUrl || 'https://gemigo.io/api/v1';
}

export const webAuth: AuthAPI = {
  async login(options: AuthLoginOptions = {}): Promise<AuthTokenResponse> {
    if (typeof window === 'undefined') {
      throw new SDKError('NOT_SUPPORTED', 'auth.login is only supported in browser environments.');
    }

    const platformOrigin = options.platformOrigin?.trim() || 'https://gemigo.io';
    const apiBaseUrl = options.apiBaseUrl?.trim() || `${platformOrigin.replace(/\/+$/, '')}/api/v1`;
    const appId = options.appId?.trim() || deriveDefaultAppId();
    const scopes = normalizeScopes(options.scopes);
    const timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : 2 * 60 * 1000;

    const state = randomString(16);
    const codeVerifier = randomString(48); // => ~64 chars base64url-ish, PKCE valid
    const openerOrigin = window.location.origin;

    const width = 520;
    const height = 720;
    const left = Math.max(0, (window.screen.width - width) / 2);
    const top = Math.max(0, (window.screen.height - height) / 2);

    // IMPORTANT:
    // To avoid popup blockers, open the window synchronously inside the user gesture
    // (this function is typically called in a click handler). Computing PKCE
    // challenge uses async crypto.subtle APIs and can break user activation.
    const popup = window.open(
      'about:blank',
      'gemigo_sdk_auth',
      `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
    );
    if (!popup) {
      throw new Error('Popup blocked. Please allow popups and retry.');
    }

    try {
      popup.document.title = 'GemiGo Auth';
      popup.document.body.innerHTML =
        '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;">Loading…</div>';
    } catch {
      // ignore cross-origin/document access issues
    }

    const codeChallenge = await sha256Base64Url(codeVerifier);
    const brokerUrl = buildBrokerUrl({
      platformOrigin,
      appId,
      scopes,
      state,
      codeChallenge,
      openerOrigin,
    });
    try {
      popup.location.href = brokerUrl;
    } catch {
      // If navigation fails (rare), fall back to opening a new popup.
      const retry = window.open(brokerUrl, 'gemigo_sdk_auth');
      if (!retry) {
        throw new Error('Popup navigation failed. Please allow popups and retry.');
      }
    }

    const result = await new Promise<{ code: string }>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error('Login timeout.'));
      }, timeoutMs);

      const cleanup = () => {
        window.clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        try {
          popup.close();
        } catch {
          // ignore
        }
      };

      const onMessage = (event: MessageEvent) => {
        if (event.origin !== new URL(platformOrigin).origin) return;
        const data = event.data as any;
        if (!data || typeof data !== 'object') return;
        if (data.state !== state) return;

        if (data.type === 'gemigo:sdk-auth-error') {
          cleanup();
          reject(new Error(String(data.error || 'auth_error')));
          return;
        }

        if (data.type === 'gemigo:sdk-auth-code' && typeof data.code === 'string') {
          cleanup();
          resolve({ code: data.code });
        }
      };

      window.addEventListener('message', onMessage);
    });

    const token = await exchangeCode(apiBaseUrl, result.code, codeVerifier);
    currentToken = token;
    currentApiBaseUrl = apiBaseUrl;
    return token;
  },

  getAccessToken(): string | null {
    return currentToken?.accessToken ?? null;
  },

  logout(): void {
    currentToken = null;
  },
};

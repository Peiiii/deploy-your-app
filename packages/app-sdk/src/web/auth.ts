import type {
  AuthAPI,
  AuthLoginOptions,
  AuthPersistMode,
  AuthTokenResponse,
  AuthScope,
} from '../types/auth';
import { SDKError } from '../types/common';

let currentToken: AuthTokenResponse | null = null;
let currentApiBaseUrl: string | null = null;
let currentPersistMode: AuthPersistMode = 'local';

type PersistedTokenV1 = AuthTokenResponse & {
  expiresAt: number;
  apiBaseUrl: string;
  persistedAt: number;
};

const TOKEN_STORAGE_KEY = 'gemigo:sdk-auth:v1';

function getStorage(mode: AuthPersistMode): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    if (mode === 'session') return window.sessionStorage;
    if (mode === 'local') return window.localStorage;
    return null;
  } catch {
    return null;
  }
}

function loadPersistedToken(mode: AuthPersistMode): PersistedTokenV1 | null {
  const storage = getStorage(mode);
  if (!storage) return null;
  try {
    const raw = storage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedTokenV1> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.accessToken !== 'string' || !parsed.accessToken) return null;
    if (typeof parsed.apiBaseUrl !== 'string' || !parsed.apiBaseUrl) return null;
    if (typeof parsed.appId !== 'string' || !parsed.appId) return null;
    if (typeof parsed.appUserId !== 'string' || !parsed.appUserId) return null;
    if (!Array.isArray(parsed.scopes)) return null;
    if (typeof parsed.expiresAt !== 'number' || !Number.isFinite(parsed.expiresAt)) return null;
    if (Date.now() >= parsed.expiresAt) return null;

    return parsed as PersistedTokenV1;
  } catch {
    return null;
  }
}

function savePersistedToken(
  mode: AuthPersistMode,
  token: AuthTokenResponse,
  apiBaseUrl: string
): void {
  const storage = getStorage(mode);
  if (!storage) return;
  try {
    const expiresAt = Date.now() + Math.max(0, token.expiresIn) * 1000;
    const payload: PersistedTokenV1 = {
      ...token,
      expiresAt,
      apiBaseUrl,
      persistedAt: Date.now(),
    };
    storage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function clearPersistedToken(mode: AuthPersistMode): void {
  const storage = getStorage(mode);
  if (!storage) return;
  try {
    storage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function hydrateFromStorageIfNeeded(): void {
  if (typeof window === 'undefined') return;
  if (currentToken && currentApiBaseUrl) return;

  const session = loadPersistedToken('session');
  const local = loadPersistedToken('local');
  const persisted =
    session && local
      ? session.persistedAt >= local.persistedAt
        ? session
        : local
      : (session ?? local);
  if (!persisted) return;

  currentToken = {
    accessToken: persisted.accessToken,
    expiresIn: Math.max(0, Math.floor((persisted.expiresAt - Date.now()) / 1000)),
    appId: persisted.appId,
    appUserId: persisted.appUserId,
    scopes: persisted.scopes,
  };
  currentApiBaseUrl = persisted.apiBaseUrl;
  currentPersistMode = session && persisted === session ? 'session' : 'local';
}

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
  const list = (scopes ?? ['identity:basic']).map((s) => String(s).trim()).filter(Boolean);
  return list.length > 0 ? list : ['identity:basic'];
}

async function exchangeCode(
  apiBaseUrl: string,
  code: string,
  codeVerifier: string
): Promise<AuthTokenResponse> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error('Login exchange timed out. Please retry.')),
    30000
  );
  try {
    const res = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}/sdk/token`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, codeVerifier }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || 'Failed to exchange code');
    }
    return (await res.json()) as AuthTokenResponse;
  } finally {
    clearTimeout(timer);
  }
}

export function getWebApiBaseUrl(): string {
  hydrateFromStorageIfNeeded();
  return currentApiBaseUrl || 'https://gemigo.io/api/v1';
}

const PENDING_KEY = 'gemigo:sdk-auth:redirect:v1';
const CALLBACK_KEYS = ['gemigo_code', 'gemigo_state', 'gemigo_error'];
type PendingLogin = {
  appId: string;
  apiBaseUrl: string;
  redirectUri: string;
  returnUrl: string;
  state: string;
  codeVerifier: string;
  persist: AuthPersistMode;
  expiresAt: number;
};
let callbackFlight: Promise<AuthTokenResponse | null> | null = null;

function acceptToken(
  token: AuthTokenResponse,
  pending: Pick<PendingLogin, 'appId' | 'apiBaseUrl' | 'persist'>
): AuthTokenResponse {
  if (token.appId !== pending.appId || !token.accessToken || !token.appUserId)
    throw new Error('Unexpected application identity. Please retry login.');
  currentToken = token;
  currentApiBaseUrl = pending.apiBaseUrl;
  currentPersistMode = pending.persist;
  clearPersistedToken('session');
  clearPersistedToken('local');
  savePersistedToken(pending.persist, token, pending.apiBaseUrl);
  return token;
}
async function finishRedirect(): Promise<AuthTokenResponse | null> {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  if (!CALLBACK_KEYS.some((key) => url.searchParams.has(key))) return null;
  const code = url.searchParams.get('gemigo_code');
  const state = url.searchParams.get('gemigo_state');
  const error = url.searchParams.get('gemigo_error');
  CALLBACK_KEYS.forEach((key) => url.searchParams.delete(key));
  window.history.replaceState(null, '', url.href);
  const storage = getStorage('session');
  const raw = storage?.getItem(PENDING_KEY);
  storage?.removeItem(PENDING_KEY);
  let pending: PendingLogin | null = null;
  try {
    pending = raw ? (JSON.parse(raw) as PendingLogin) : null;
  } catch {
    /* handled below */
  }
  if (
    !pending ||
    pending.state !== state ||
    !Number.isFinite(pending.expiresAt) ||
    pending.expiresAt <= Date.now()
  )
    throw new Error('Login expired or state mismatch. Please retry login.');
  const callback = new URL(pending.redirectUri);
  const original = new URL(pending.returnUrl);
  if (
    callback.origin !== url.origin ||
    callback.pathname !== url.pathname ||
    original.origin !== url.origin
  )
    throw new Error('Invalid login return address.');
  window.history.replaceState(null, '', original.href);
  if (error)
    throw new Error(error === 'access_denied' ? 'Login cancelled.' : 'Login failed. Please retry.');
  if (!code) throw new Error('Missing authorization code.');
  return acceptToken(await exchangeCode(pending.apiBaseUrl, code, pending.codeVerifier), pending);
}

export const webAuth: AuthAPI = {
  async login(options: AuthLoginOptions = {}): Promise<AuthTokenResponse> {
    if (typeof window === 'undefined')
      throw new SDKError('NOT_SUPPORTED', 'auth.login requires a browser.');
    const platformOrigin = new URL(options.platformOrigin?.trim() || 'https://gemigo.io').origin;
    const apiBaseUrl = options.apiBaseUrl?.trim() || `${platformOrigin}/api/v1`;
    const appId = options.appId?.trim() || deriveDefaultAppId();
    const scopes = normalizeScopes(options.scopes);
    const timeoutMs = options.timeoutMs ?? 2 * 60 * 1000;
    const persist = options.persist ?? 'local';
    const display = options.display ?? 'popup';
    const redirectUri = new URL(options.redirectUri || '/', window.location.origin).href;
    if (new URL(redirectUri).origin !== window.location.origin)
      throw new Error('Return URL must belong to this app.');
    let mode: 'popup' | 'redirect' =
      display === 'redirect' ||
      (display === 'auto' && /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent))
        ? 'redirect'
        : 'popup';
    // Open before the first await to preserve the click gesture.
    const popup =
      mode === 'popup'
        ? window.open('about:blank', 'gemigo_sdk_auth', 'popup=yes,width=520,height=720')
        : null;
    if (mode === 'popup' && !popup) {
      if (display !== 'auto')
        throw new Error('Popup blocked. Use display: "redirect" or allow popups.');
      mode = 'redirect';
    }
    const pending: PendingLogin = {
      appId,
      apiBaseUrl,
      persist,
      redirectUri,
      returnUrl: window.location.href,
      state: randomString(32),
      codeVerifier: randomString(48),
      expiresAt: Date.now() + 10 * 60 * 1000,
    };
    try {
      const codeChallenge = await sha256Base64Url(pending.codeVerifier);
      const controller = new AbortController();
      const requestTimer = window.setTimeout(
        () => controller.abort(new Error('Login timed out. Please retry.')),
        timeoutMs
      );
      const closedTimer = popup
        ? window.setInterval(() => {
            if (popup.closed) controller.abort(new Error('Login window closed. Please retry.'));
          }, 500)
        : null;
      let response: Response;
      let data: { authorizationUrl?: string; error?: string };
      try {
        response = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}/sdk/auth-requests`, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appId,
            scopes,
            codeChallenge,
            state: pending.state,
            redirectUri,
            mode,
          }),
        });
        data = (await response.json()) as { authorizationUrl?: string; error?: string };
      } finally {
        window.clearTimeout(requestTimer);
        if (closedTimer !== null) window.clearInterval(closedTimer);
      }
      if (!response.ok || !data.authorizationUrl)
        throw new Error(data.error || 'Unable to start login.');
      const target = new URL(data.authorizationUrl);
      if (target.origin !== platformOrigin || target.pathname !== '/auth/authorize')
        throw new Error('Invalid authorization address.');
      if (mode === 'redirect') {
        const storage = getStorage('session');
        if (!storage)
          throw new Error('Browser storage is unavailable. Enable session storage to sign in.');
        storage.setItem(PENDING_KEY, JSON.stringify(pending));
        window.location.assign(target.href);
        // The new page resumes via handleRedirectCallback().
        return await new Promise<AuthTokenResponse>(() => {});
      }
      if (!popup) throw new Error('Login window unavailable.');
      const result = await new Promise<string>((resolve, reject) => {
        const cleanup = () => {
          window.clearTimeout(timer);
          window.clearInterval(closedTimer);
          window.removeEventListener('message', onMessage);
          popup.close();
        };
        const onMessage = (event: MessageEvent) => {
          if (event.origin !== platformOrigin || event.source !== popup) return;
          const payload = event.data as {
            state?: string;
            type?: string;
            code?: string;
            error?: string;
          } | null;
          if (!payload || payload.state !== pending.state) return;
          if (payload.type === 'gemigo:sdk-auth-error') {
            cleanup();
            reject(new Error(payload.error || 'Login cancelled.'));
          }
          if (payload.type === 'gemigo:sdk-auth-code' && typeof payload.code === 'string') {
            cleanup();
            resolve(payload.code);
          }
        };
        const timer = window.setTimeout(() => {
          cleanup();
          reject(new Error('Login timed out. Please retry.'));
        }, timeoutMs);
        const closedTimer = window.setInterval(() => {
          if (popup.closed) {
            cleanup();
            reject(new Error('Login window closed. Please retry.'));
          }
        }, 500);
        window.addEventListener('message', onMessage);
        try {
          popup.location.href = target.href;
        } catch (error) {
          cleanup();
          reject(error);
        }
      });
      return acceptToken(await exchangeCode(apiBaseUrl, result, pending.codeVerifier), pending);
    } catch (error) {
      popup?.close();
      throw error;
    }
  },

  handleRedirectCallback(): Promise<AuthTokenResponse | null> {
    if (callbackFlight) return callbackFlight;
    callbackFlight = finishRedirect().finally(() => {
      callbackFlight = null;
    });
    return callbackFlight;
  },

  getAccessToken(): string | null {
    hydrateFromStorageIfNeeded();
    return currentToken?.accessToken ?? null;
  },

  logout(): void {
    currentToken = null;
    currentApiBaseUrl = null;
    clearPersistedToken('session');
    clearPersistedToken('local');
    getStorage('session')?.removeItem(PENDING_KEY);
  },
};

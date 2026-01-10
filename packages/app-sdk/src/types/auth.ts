export type AuthScope = 'identity:basic' | 'storage:rw' | string;

export interface AuthLoginOptions {
  /**
   * App identifier used for consent + app-scoped identity.
   * In GemiGo hosted apps, default is derived from `<slug>.gemigo.app`.
   */
  appId?: string;
  scopes?: AuthScope[];
  /**
   * Platform origin that hosts the broker page, e.g. `https://gemigo.io`.
   * Defaults to `https://gemigo.io`.
   */
  platformOrigin?: string;
  /**
   * API base URL, e.g. `https://gemigo.io/api/v1` (or `https://api.gemigo.io/api/v1`).
   * Defaults to `${platformOrigin}/api/v1`.
   */
  apiBaseUrl?: string;
  /**
   * Popup wait timeout.
   */
  timeoutMs?: number;
}

export interface AuthTokenResponse {
  accessToken: string;
  expiresIn: number;
  appId: string;
  appUserId: string;
  scopes: string[];
}

export interface AuthAPI {
  login(options?: AuthLoginOptions): Promise<AuthTokenResponse>;
  getAccessToken(): string | null;
  logout(): void;
}


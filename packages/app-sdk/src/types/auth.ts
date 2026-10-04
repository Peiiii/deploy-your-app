export type AuthScope = 'identity:basic' | 'storage:rw' | string;

export type AuthPersistMode = 'memory' | 'session' | 'local';

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
  /** Popup by default; auto uses redirect on mobile or when popup is blocked. */
  display?: 'popup' | 'redirect' | 'auto';
  /** Must exactly match the application's published URL. Defaults to origin + '/'. */
  redirectUri?: string;

  /**
   * Where to persist the SDK access token.
   *
   * - `local` (default): survives refresh and browser restarts (higher risk if your app has XSS).
   * - `session`: survives refresh in the same tab, cleared when the tab closes.
   * - `memory`: never persisted (refresh loses token).
   */
  persist?: AuthPersistMode;
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
  /** Call on app startup to finish a same-tab login; returns null when no callback exists. */
  handleRedirectCallback(): Promise<AuthTokenResponse | null>;
  getAccessToken(): string | null;
  logout(): void;
}

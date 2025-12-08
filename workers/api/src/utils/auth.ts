import type { User, PublicUser } from '../types/user';

const SESSION_COOKIE_NAME = 'session_id';
const OAUTH_STATE_COOKIE_GOOGLE = 'oauth_state_google';
const OAUTH_STATE_COOKIE_GITHUB = 'oauth_state_github';

// 30 days session lifetime
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    providers: {
      email: !!user.passwordHash,
      google: !!user.googleSub,
      github: !!user.githubId,
    },
  };
}

// ---------------------------------------------------------------------------
// Password hashing (MVP: salted SHA-256 – can be upgraded to scrypt/argon2 later)
// ---------------------------------------------------------------------------

function getPasswordSalt(env: { PASSWORD_SALT?: string }): string {
  // Fallback salt is only for local dev; in production you should set PASSWORD_SALT.
  return env.PASSWORD_SALT && env.PASSWORD_SALT.trim().length > 0
    ? env.PASSWORD_SALT.trim()
    : 'local-dev-salt-change-me';
}

export async function hashPassword(
  plain: string,
  env: { PASSWORD_SALT?: string },
): Promise<string> {
  const salt = getPasswordSalt(env);
  const data = new TextEncoder().encode(salt + plain);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPassword(
  plain: string,
  hash: string,
  env: { PASSWORD_SALT?: string },
): Promise<boolean> {
  const calculated = await hashPassword(plain, env);
  return calculated === hash;
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

export function buildSessionCookie(sessionId: string): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${sessionId}`,
    `Max-Age=${SESSION_TTL_SECONDS}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ];
  return parts.join('; ');
}

export function clearSessionCookie(): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Max-Age=0',
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ];
  return parts.join('; ');
}

export function getSessionIdFromRequest(req: Request): string | null {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  for (const c of cookies) {
    if (c.startsWith(`${SESSION_COOKIE_NAME}=`)) {
      return c.slice(SESSION_COOKIE_NAME.length + 1);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// OAuth state helpers (stored in short-lived cookies)
// ---------------------------------------------------------------------------

export type OAuthProvider = 'google' | 'github';

function getStateCookieName(provider: OAuthProvider): string {
  return provider === 'google'
    ? OAUTH_STATE_COOKIE_GOOGLE
    : OAUTH_STATE_COOKIE_GITHUB;
}

export function buildOAuthStateCookie(
  provider: OAuthProvider,
  state: string,
  redirectTo: string,
): string {
  const name = getStateCookieName(provider);
  const value = encodeURIComponent(`${state}|${redirectTo}`);
  const parts = [
    `${name}=${value}`,
    'Max-Age=600', // 10 minutes
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ];
  return parts.join('; ');
}

export function clearOAuthStateCookie(provider: OAuthProvider): string {
  const name = getStateCookieName(provider);
  return `${name}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function readOAuthStateCookie(
  req: Request,
  provider: OAuthProvider,
): { state: string; redirectTo: string } | null {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  const name = getStateCookieName(provider);
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  for (const c of cookies) {
    if (c.startsWith(`${name}=`)) {
      const raw = decodeURIComponent(c.slice(name.length + 1));
      const [state, redirectTo] = raw.split('|');
      if (!state || !redirectTo) return null;
      return { state, redirectTo };
    }
  }
  return null;
}


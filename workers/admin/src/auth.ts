export interface AdminEnv {
  ANALYTICS_DB: D1Database;
  ASSETS: Fetcher;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD_HASH: string;
}
const COOKIE = '__Host-gemigo_admin';
const hex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
export const hash = async (text: string) =>
  hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
export const passwordHash = async (password: string, salt: string) => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  return hex(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100000 },
      key,
      256
    )
  );
};
export const verifyPassword = async (password: string, stored: string) => {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const actual = await passwordHash(password, salt);
  let different = actual.length ^ expected.length;
  for (let i = 0; i < actual.length; i++)
    different |= actual.charCodeAt(i) ^ (expected.charCodeAt(i) || 0);
  return different === 0;
};
const token = (request: Request) =>
  request.headers
    .get('cookie')
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(COOKIE + '='))
    ?.slice(COOKIE.length + 1);
export const authenticated = async (request: Request, env: AdminEnv) => {
  const value = token(request);
  if (!value || !/^[a-f0-9]{64}$/.test(value)) return false;
  return Boolean(
    await env.ANALYTICS_DB.prepare(
      'SELECT 1 FROM admin_sessions WHERE token_hash=? AND expires_at>?'
    )
      .bind(await hash(value), Date.now())
      .first()
  );
};
export const createSession = async (env: AdminEnv) => {
  const value = hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
  await env.ANALYTICS_DB.prepare('INSERT INTO admin_sessions VALUES (?,?)')
    .bind(await hash(value), Date.now() + 12 * 3600000)
    .run();
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`;
};
export const logout = async (request: Request, env: AdminEnv) => {
  const value = token(request);
  if (value)
    await env.ANALYTICS_DB.prepare('DELETE FROM admin_sessions WHERE token_hash=?')
      .bind(await hash(value))
      .run();
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
};

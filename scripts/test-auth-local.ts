/**
 * Simple local auth smoke test against the API Worker running via `wrangler dev`.
 *
 * Flow:
 *   1) GET  /api/v1/me                → expect user: null
 *   2) POST /api/v1/auth/email/signup → expect user + Set-Cookie: session_id=...
 *   3) GET  /api/v1/me                → expect same user with cookie
 *   4) POST /api/v1/logout            → expect 204, user cleared
 *   5) GET  /api/v1/me                → expect user: null
 *   6) POST /api/v1/auth/email/login  → expect same user, new session cookie
 *   7) GET  /api/v1/me                → expect same user
 *
 * Usage (from repo root, with `pnpm dev` already running):
 *   pnpm test:auth:local
 */

const DEFAULT_BASE_URL = 'http://127.0.0.1:8787/api/v1';

type Json = Record<string, unknown>;

interface FetchResult {
  status: number;
  body: Json | null;
  setCookie?: string | null;
}

async function fetchJson(
  path: string,
  opts: {
    method?: string;
    body?: Json;
    cookie?: string | null;
  } = {},
): Promise<FetchResult> {
  const baseUrl = process.env.API_BASE_URL || DEFAULT_BASE_URL;
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (opts.cookie) {
    headers.cookie = opts.cookie;
  }

  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers,
    body:
      opts.body && opts.method && opts.method !== 'GET'
        ? JSON.stringify(opts.body)
        : undefined,
  });

  const setCookie = res.headers.get('set-cookie');
  let body: Json | null = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text) as Json;
    } catch {
      body = { raw: text };
    }
  }

  return { status: res.status, body, setCookie };
}

function extractSessionCookie(setCookieHeader: string | null | undefined): string | null {
  if (!setCookieHeader) return null;
  const parts = setCookieHeader.split(';');
  const first = parts[0]?.trim();
  if (!first.startsWith('session_id=')) return null;
  return first;
}

async function main(): Promise<void> {
  let cookie: string | null = null;
  const email = `local-auth-test+${Date.now()}@example.com`;
  const password = 'Passw0rd!';

  console.log('🔍 Step 1: GET /me  (expect user: null)');
  const me1 = await fetchJson('/me');
  console.log('  status:', me1.status, 'body:', me1.body);

  // Step 2: signup
  console.log('\n📝 Step 2: POST /auth/email/signup');
  const signup = await fetchJson('/auth/email/signup', {
    method: 'POST',
    body: { email, password },
  });
  console.log('  status:', signup.status, 'body:', signup.body);
  cookie = extractSessionCookie(signup.setCookie) ?? null;
  if (!cookie) {
    throw new Error('No session_id cookie returned from signup.');
  }
  const userAfterSignup = signup.body?.user as Json | undefined;
  const userId = userAfterSignup?.id as string | undefined;
  if (!userId) {
    throw new Error('Signup did not return a user id.');
  }
  console.log('  ✅ session cookie:', cookie);

  // Step 3: /me with cookie
  console.log('\n👤 Step 3: GET /me with session cookie');
  const me2 = await fetchJson('/me', { cookie });
  console.log('  status:', me2.status, 'body:', me2.body);
  const meUser = me2.body?.user as Json | undefined;
  if (!meUser || meUser.id !== userId) {
    throw new Error('GET /me after signup did not return the same user.');
  }

  // Step 4: logout
  console.log('\n🚪 Step 4: POST /logout');
  const logout = await fetchJson('/logout', {
    method: 'POST',
    cookie,
  });
  console.log('  status:', logout.status, 'body:', logout.body);

  // Step 5: /me should be null again
  console.log('\n👤 Step 5: GET /me after logout (expect user: null)');
  const me3 = await fetchJson('/me', { cookie });
  console.log('  status:', me3.status, 'body:', me3.body);
  if (me3.body?.user !== null) {
    throw new Error('Expected user: null after logout.');
  }

  // Step 6: login again
  console.log('\n🔐 Step 6: POST /auth/email/login');
  const login = await fetchJson('/auth/email/login', {
    method: 'POST',
    body: { email, password },
  });
  console.log('  status:', login.status, 'body:', login.body);
  const loginCookie = extractSessionCookie(login.setCookie);
  if (!loginCookie) {
    throw new Error('No session_id cookie returned from login.');
  }
  cookie = loginCookie;
  console.log('  ✅ new session cookie:', cookie);

  // Step 7: /me should again return same user id
  console.log('\n👤 Step 7: GET /me after login');
  const me4 = await fetchJson('/me', { cookie });
  console.log('  status:', me4.status, 'body:', me4.body);
  const me4User = me4.body?.user as Json | undefined;
  if (!me4User || me4User.id !== userId) {
    throw new Error('GET /me after login did not return the same user.');
  }

  console.log('\n✅ Local auth smoke test passed.');
}

main().catch((err) => {
  console.error('\n❌ Local auth smoke test failed:', err);
  process.exit(1);
});


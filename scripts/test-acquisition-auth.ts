import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { buildOAuthStateCookie, readOAuthStateCookie } from '../workers/api/src/utils/auth';
import { readTelemetry } from '../workers/api/src/analytics';
import type { EventBatch } from '../packages/product-analytics/src/contract';
const require = createRequire(import.meta.url);
const runtime = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare } = runtime('miniflare');
const { build } = runtime('esbuild');
const bundle = await build({
  stdin: {
    contents: `import worker from './workers/api/src/index.ts'; export default { async fetch(request, env, ctx) { const pending = []; const response = await worker.fetch(request, env, { waitUntil(promise) { pending.push(promise); }, passThroughOnException() { ctx.passThroughOnException(); } }); await Promise.all(pending); return response; } };`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
});
const batch = (): EventBatch => ({
  visitorId: crypto.randomUUID(),
  sessionId: crypto.randomUUID(),
  device: 'desktop',
  referrer: 'ai',
  channel: 'web',
  events: [{ id: crypto.randomUUID(), name: 'page_view', at: Date.now(), page: 'guide' }],
});
const context = batch();
const cookie = buildOAuthStateCookie('google', 'state', 'https://gemigo.io', {
  ...context,
  events: [],
}).split(';')[0];
assert.equal(
  readOAuthStateCookie(new Request('https://gemigo.io', { headers: { cookie } }), 'google')
    ?.analytics?.referrer,
  'ai'
);
assert.equal(
  readOAuthStateCookie(
    new Request('https://gemigo.io', { headers: { cookie: 'oauth_state_google=%INVALID' } }),
    'google'
  ),
  null
);
assert.equal(
  (
    await readTelemetry(
      new Request('https://gemigo.io/api/v1/auth/google/callback', { headers: { cookie } })
    )
  )?.sessionId,
  context.sessionId
);
let providerId = 'google-new';
const mf = new Miniflare({
  modules: true,
  script: bundle.outputFiles[0].text,
  compatibilityDate: '2026-09-18',
  d1Databases: { PROJECTS_DB: 'auth-test', ANALYTICS_DB: 'auth-test' },
  bindings: {
    PASSWORD_SALT: 'test-only-salt',
    AUTH_REDIRECT_BASE: 'https://gemigo.io',
    GOOGLE_CLIENT_ID: 'test-google',
    GOOGLE_CLIENT_SECRET: 'test-secret',
    GITHUB_CLIENT_ID: 'test-github',
    GITHUB_CLIENT_SECRET: 'test-secret',
  },
  outboundService: async (request: Request) => {
    const url = new URL(request.url);
    if (url.hostname === 'oauth2.googleapis.com' || url.pathname === '/login/oauth/access_token')
      return Response.json({ access_token: 'test-token' });
    if (url.hostname === 'openidconnect.googleapis.com')
      return Response.json({ sub: providerId, email: providerId + '@example.com', name: 'Test' });
    if (url.hostname === 'api.github.com' && url.pathname === '/user')
      return Response.json({ id: 123, email: 'github-new@example.com', login: 'test' });
    throw new Error('Unexpected external auth URL: ' + url.origin + url.pathname);
  },
});
try {
  const db = await mf.getD1Database('ANALYTICS_DB');
  for (const file of readdirSync('packages/product-analytics/migrations').sort())
    for (const sql of readFileSync(`packages/product-analytics/migrations/${file}`, 'utf8')
      .split(';')
      .filter((sql) => sql.trim()))
      await db.prepare(sql).run();
  const request = async (path: string, init: RequestInit = {}) => {
    const response = await mf.dispatchFetch('https://gemigo.io' + path, {
      ...init,
      redirect: 'manual',
    });
    return response;
  };
  const signup = async (email: string, ctx: EventBatch) =>
    request('/api/v1/auth/email/signup', {
      method: 'POST',
      headers: {
        origin: 'https://gemigo.io',
        'content-type': 'application/json',
        'x-gemigo-events': JSON.stringify(ctx),
      },
      body: JSON.stringify({ email, password: 'test-password-123' }),
    });
  const emailContext = batch();
  assert.equal((await signup('email-new@example.com', emailContext)).status, 200);
  const emailRows = await db
    .prepare("SELECT referrer,dimension FROM product_events WHERE name='signup_success'")
    .all();
  assert.deepEqual(emailRows.results, [{ referrer: 'ai', dimension: 'email' }]);
  const oauth = async (provider: 'google' | 'github', ctx?: EventBatch, valid = true) => {
    const start = await request(
      `/api/v1/auth/${provider}/start?redirect=https%3A%2F%2Fgemigo.io%2Fguides%2Fpublish-html${ctx ? '&analytics=' + encodeURIComponent(JSON.stringify({ ...ctx, events: [] })) : ''}`
    );
    assert.equal(start.status, 302);
    const state = new URL(start.headers.get('location')!).searchParams.get('state');
    const cookie = start.headers.get('set-cookie')!.split(';')[0];
    return request(`/api/v1/auth/${provider}/callback?code=test&state=${valid ? state : 'wrong'}`, {
      headers: { cookie },
    });
  };
  const googleContext = batch();
  assert.equal((await oauth('google', googleContext)).status, 302);
  assert.equal((await oauth('google', googleContext)).headers.get('x-gemigo-auth-result'), 'login');
  assert.equal(
    (await signup('google-new@example.com', batch())).headers.get('x-gemigo-auth-result'),
    'login',
    'adding an email password is not a new account'
  );
  assert.equal((await oauth('github', batch())).status, 302);
  assert.equal((await oauth('google', batch(), false)).status, 401);
  const rows = await db
    .prepare(
      "SELECT dimension,COUNT(*) AS n FROM product_events WHERE name='signup_success' GROUP BY dimension ORDER BY dimension"
    )
    .all();
  assert.deepEqual(rows.results, [
    { dimension: 'email', n: 1 },
    { dimension: 'github', n: 1 },
    { dimension: 'google', n: 1 },
  ]);
  assert.equal(
    (
      await db
        .prepare(
          "SELECT session_id FROM product_events WHERE name='signup_success' AND dimension='google'"
        )
        .first()
    ).session_id,
    googleContext.sessionId
  );
  providerId = 'without-context';
  await oauth('google');
  assert.equal(
    (
      await db
        .prepare("SELECT COUNT(*) AS n FROM product_events WHERE name='signup_success'")
        .first()
    ).n,
    3,
    'absent context (DNT) does not collect'
  );
  await db
    .prepare("INSERT INTO analytics_settings VALUES ('collection',?)")
    .bind(JSON.stringify({ enabled: false, dailyEvents: 100 }))
    .run();
  providerId = 'disabled';
  await oauth('google', batch());
  assert.equal(
    (
      await db
        .prepare("SELECT COUNT(*) AS n FROM product_events WHERE name='signup_success'")
        .first()
    ).n,
    3,
    'disabled analytics does not affect OAuth success or write events'
  );
  console.log(
    'PASS assembled API + D1: email/Google/GitHub genuine registrations, preserved anonymous context, repeat login/password addition excluded, invalid state, absent context and disabled collection'
  );
} finally {
  await mf.dispose();
}

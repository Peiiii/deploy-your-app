import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import {
  hash,
  passwordHash,
  changePassword,
  credential,
  createSession,
} from '../workers/admin/src/auth';
import { authRepository } from '../workers/api/src/repositories/auth.repository';
import { projectRepository } from '../workers/api/src/repositories/project.repository';
import { deploymentRepository } from '../workers/api/src/repositories/deployment.repository';
import { analyticsRepository } from '../workers/api/src/repositories/analytics.repository';

const require = createRequire(import.meta.url);
const runtime = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare } = runtime('miniflare');
const { build } = runtime('esbuild');
const bundle = await build({
  entryPoints: ['workers/admin/src/index.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
});
const initial = crypto.randomUUID();
const replacement = crypto.randomUUID();
const stored = `test-salt:${await passwordHash(initial, 'test-salt')}`;
const mf = new Miniflare({
  modules: true,
  script: bundle.outputFiles[0].text,
  d1Databases: { ANALYTICS_DB: 'admin-console-test' },
  bindings: { ADMIN_USERNAME: 'admin', ADMIN_PASSWORD_HASH: stored },
  serviceBindings: { ASSETS: () => new Response('admin assets') },
  compatibilityDate: '2026-09-18',
});
try {
  const db = await mf.getD1Database('ANALYTICS_DB');
  await authRepository.ensureAuthSchema(db);
  await projectRepository.getAllProjects(db);
  await deploymentRepository.listPending(db);
  await analyticsRepository.ensureSchema(db);
  for (const directory of ['packages/product-analytics/migrations', 'workers/admin/migrations'])
    for (const file of readdirSync(directory).sort())
      for (const sql of readFileSync(`${directory}/${file}`, 'utf8')
        .split(';')
        .filter((sql) => sql.trim()))
        await db.prepare(sql).run();
  const now = new Date().toISOString();
  await db
    .prepare(
      'INSERT INTO users (id,email,display_name,password_hash,created_at,updated_at) VALUES (?,?,?,?,?,?)'
    )
    .bind('user-test', 'admin-test@example.invalid', 'Console test user', 'NEVER_EXPOSE', now, now)
    .run();
  await db
    .prepare('INSERT INTO sessions VALUES (?,?,?,?,?)')
    .bind('main-site-session', 'user-test', now, '2099-01-01', now)
    .run();
  await db
    .prepare(
      `INSERT INTO projects (id,name,repo_url,owner_id,last_deployed,status,is_public,is_deleted,created_at,url)
    VALUES ('app-test','Console test app','','user-test',?,'Live',1,0,?,'https://example.invalid')`
    )
    .bind(now, now)
    .run();
  for (let i = 0; i < 21; i++)
    await db
      .prepare(
        `INSERT INTO deployment_attempts
    (id,project_id,owner_id,source_type,client_channel,status,started_at,duration_ms,error_code) VALUES (?, 'app-test','user-test','html','web',?,?,1000,?)`
      )
      .bind(`deploy-${i}`, i < 20 ? 'succeeded' : 'failed', now, i < 20 ? null : 'test_failure')
      .run();
  const request = (path: string, cookie = '', input?: object, origin = 'https://admin.test') =>
    mf.dispatchFetch(`https://admin.test/api/${path}`, {
      method: input ? 'POST' : 'GET',
      headers: { cookie, origin, 'Content-Type': 'application/json' },
      body: input ? JSON.stringify(input) : undefined,
    });
  const login = async (password: string) => {
    const response = await request('login', '', { username: 'admin', password });
    assert.equal(response.status, 200, await response.clone().text());
    const cookie = response.headers.get('set-cookie')!;
    assert.match(cookie, /HttpOnly; Secure; SameSite=Strict/);
    return cookie.split(';')[0];
  };
  for (const route of [
    'overview',
    'users',
    'projects',
    'deployments',
    'audit',
    'report',
    'budget',
  ]) {
    assert.equal((await request(route)).status, 401);
    assert.equal((await request(route, 'gemigo_session=main-site-session')).status, 401);
  }
  assert.equal(
    (await request('login', '', { username: 'admin', password: initial }, 'https://evil.test'))
      .status,
    403
  );
  assert.equal((await request('login', '', { username: 'admin', password: 'wrong' })).status, 401);
  const legacyToken = 'a'.repeat(64);
  await db
    .prepare('INSERT INTO admin_sessions VALUES (?,?)')
    .bind(await hash(legacyToken), Date.now() + 60000)
    .run();
  assert.equal(
    (await request('session', `__Host-gemigo_admin=${legacyToken}`)).status,
    200,
    'pre-upgrade session remains valid until rotation'
  );
  const cookie = await login(initial);
  const cookie2 = await login(initial);
  const summary = await (await request('overview', cookie)).json();
  assert.equal(summary.summary.users, 1);
  assert.equal(summary.summary.projects, 1);
  assert.equal(summary.deployments.succeeded, 20);
  assert.equal(summary.deployments.failed, 1);
  assert.equal(summary.daily.length, 7, 'zero deployment dates remain on the axis');
  assert.equal((await request('overview?days=90', cookie)).status, 400);
  const usersResponse = await request('users?q=example.invalid', cookie);
  assert.match(usersResponse.headers.get('cache-control')!, /no-store/);
  const usersText = await usersResponse.text();
  assert.ok(!usersText.includes('NEVER_EXPOSE'));
  assert.equal(JSON.parse(usersText).total, 1);
  const page2 = await (await request('deployments?page=2', cookie)).json();
  assert.equal(page2.items.length, 1);
  assert.equal(page2.total, 21);
  assert.equal(
    (await (await request('deployments?status=failed', cookie)).json()).items[0].error_code,
    'test_failure'
  );
  assert.equal((await request('projects?status=invalid', cookie)).status, 400);
  assert.equal(
    (
      await request(
        'manage',
        cookie,
        { action: 'visibility', id: 'app-test', expected: true, isPublic: false },
        'https://evil.test'
      )
    ).status,
    403
  );
  assert.equal(
    (
      await request('manage', cookie, {
        action: 'visibility',
        id: 'missing',
        expected: true,
        isPublic: false,
      })
    ).status,
    409
  );
  const change = { action: 'visibility', id: 'app-test', expected: true, isPublic: false };
  assert.equal((await request('manage', cookie, change)).status, 200);
  assert.equal((await request('manage', cookie, change)).status, 409);
  assert.equal(
    (await db.prepare("SELECT is_public FROM projects WHERE id='app-test'").first()).is_public,
    0
  );
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM admin_audit').first()).n, 1);
  assert.equal(
    (await request('manage', cookie, { action: 'revoke_sessions', id: 'user-test' })).status,
    200
  );
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM sessions').first()).n, 0);
  assert.equal((await request('report', cookie)).status, 200);
  assert.equal((await request('budget', cookie)).status, 200);
  const rotate = {
    currentPassword: initial,
    newPassword: replacement,
    confirmPassword: replacement,
  };
  assert.equal(
    (await request('password', cookie, { ...rotate, currentPassword: 'wrong' })).status,
    400
  );
  assert.equal(
    (await request('password', cookie, { ...rotate, confirmPassword: 'different' })).status,
    400
  );
  assert.equal((await request('password', cookie, rotate)).status, 200);
  assert.equal((await request('session', cookie)).status, 401);
  assert.equal((await request('session', cookie2)).status, 401);
  assert.equal((await request('session', `__Host-gemigo_admin=${legacyToken}`)).status, 401);
  assert.equal((await request('login', '', { username: 'admin', password: initial })).status, 401);
  const nextCookie = await login(replacement);
  assert.equal((await request('session', nextCookie)).status, 200);
  // A login that validated before rotation must not create a valid session afterwards.
  const env = {
    ANALYTICS_DB: db,
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD_HASH: stored,
    ASSETS: { fetch: async () => new Response() },
  };
  const old = await credential(env);
  const race = await Promise.all([
    changePassword(env, old, crypto.randomUUID()),
    changePassword(env, old, crypto.randomUUID()),
  ]);
  assert.equal(race.filter(Boolean).length, 1, 'CAS allows one concurrent rotation');
  const staleCookie = (await createSession(env, old.version)).split(';')[0];
  assert.equal((await request('session', staleCookie)).status, 401);
  const auditResponse = await request(
    'audit',
    await createSession(env, (await credential(env)).version)
  );
  assert.equal(auditResponse.status, 200);
  const activeCookie = await createSession(env, (await credential(env)).version);
  assert.equal(await changePassword(env, old, crypto.randomUUID()), false);
  assert.equal(
    (await request('session', activeCookie)).status,
    200,
    'a rejected stale rotation does not revoke current sessions'
  );
  assert.equal(
    (await db.prepare("SELECT COUNT(*) n FROM admin_audit WHERE action='password_changed'").first())
      .n,
    2
  );
  console.log(
    'PASS assembled Worker + real D1: independent auth, bootstrap, dashboard, search, pagination, field isolation, origin, CAS mutations + audit, session revocation, password validation/persistence/rotation/race, retained analytics.'
  );
  if (process.argv.includes('--serve')) {
    await changePassword(env, await credential(env), initial);
    writeFileSync(
      '/tmp/gemigo-admin-test-credentials.json',
      JSON.stringify({ username: 'admin', password: initial }),
      { mode: 0o600 }
    );
    const server = createServer(async (req, res) => {
      try {
        if (req.url?.startsWith('/api/')) {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(Buffer.from(chunk));
          const response = await mf.dispatchFetch(`https://admin.test${req.url}`, {
            method: req.method,
            headers: {
              cookie: req.headers.cookie || '',
              origin: 'https://admin.test',
              'Content-Type': 'application/json',
            },
            body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
          });
          res.writeHead(response.status, Object.fromEntries(response.headers));
          res.end(Buffer.from(await response.arrayBuffer()));
        } else {
          const path = req.url?.startsWith('/assets/')
            ? join('admin/dist', new URL(req.url, 'http://localhost').pathname)
            : 'admin/dist/index.html';
          res.setHeader(
            'Content-Type',
            path.endsWith('.js')
              ? 'text/javascript'
              : path.endsWith('.css')
                ? 'text/css'
                : 'text/html'
          );
          res.end(readFileSync(path));
        }
      } catch {
        res.writeHead(500);
        res.end('Test server error');
      }
    });
    server.listen(5176, '127.0.0.1');
    console.log('Isolated console UI: http://localhost:5176');
    await new Promise<void>((resolve) =>
      process.once('SIGINT', () => server.close(() => resolve()))
    );
  }
} finally {
  await mf.dispose();
}

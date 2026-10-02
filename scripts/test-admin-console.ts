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
import { communityRepository } from '../workers/api/src/repositories/community.repository';
import { communityService } from '../workers/api/src/services/community.service';

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
  bindings: {
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD_HASH: stored,
    ANALYTICS_CF_TOKEN: 'fixture-token',
    CLOUDFLARE_ACCOUNT_ID: 'fixture-account',
    GROWTH_PLATFORM_SITE_TAG: 'platform-fixture',
    GROWTH_APPS_SITE_TAG: 'apps-fixture',
  },
  outboundService: async (request: Request) => {
    assert.equal(new URL(request.url).host, 'api.cloudflare.com');
    const payload = (await request.json()) as { variables: { start: string; end: string } };
    const rows = Array.from(
      {
        length:
          Math.round(
            (Date.parse(payload.variables.end) - Date.parse(payload.variables.start)) / 86400000
          ) + 1,
      },
      (_, i) => ({
        count: i * 3 + 10,
        sum: { visits: i + 3 },
        avg: { sampleInterval: 1 },
        dimensions: {
          date: new Date(Date.parse(payload.variables.start) + i * 86400000)
            .toISOString()
            .slice(0, 10),
        },
      })
    );
    return Response.json({
      data: {
        viewer: {
          accounts: [
            {
              platform: rows,
              apps: [],
              referrers: [
                { count: 30, sum: { visits: 20 }, dimensions: { refererHost: 'example.invalid' } },
              ],
              devices: [{ count: 30, sum: { visits: 20 }, dimensions: { deviceType: 'desktop' } }],
            },
          ],
        },
      },
    });
  },
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
  await communityRepository.listPosts(db, {
    ownerId: null,
    category: null,
    status: null,
    offset: 0,
    limit: 20,
  });
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
    'growth',
    'users',
    'projects',
    'deployments',
    'audit',
    'feedback',
    'feedback/missing',
    'report',
    'budget',
  ]) {
    assert.equal((await request(route)).status, 401);
    assert.equal((await request(route, 'session_id=main-site-session')).status, 401);
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
  for (let i = 0; i < 21; i++) {
    await db
      .prepare(
        `INSERT INTO deployment_attempts
      (id,project_id,owner_id,source_type,client_channel,status,started_at)
      VALUES (?,'app-test','user-test','zip','cli',?,?)`
      )
      .bind(`cli-${i}`, i < 20 ? 'succeeded' : 'failed', now)
      .run();
  }
  await db
    .prepare(
      `INSERT INTO projects (id,name,repo_url,owner_id,status,is_deleted,last_deployed,created_at)
    VALUES ('app-cli','CLI test app','','user-test','Live',0,?,?),
    ('app-empty','No attempts','','user-test','Live',0,?,?)`
    )
    .bind(now, now, now, now)
    .run();
  await db
    .prepare(
      `INSERT INTO deployment_attempts
    (id,project_id,owner_id,source_type,client_channel,status,started_at)
    VALUES ('cli-yesterday','app-cli','user-test','zip','cli','succeeded',?)`
    )
    .bind(new Date(Date.now() - 86400000).toISOString())
    .run();
  const channels = await (await request('projects?q=Console&channel=cli', cookie)).json();
  assert.equal(channels.total, 1);
  assert.equal(channels.items[0].first_channel, 'web');
  assert.equal(
    channels.items[0].latest_channel,
    'cli',
    'same timestamp follows immutable attempt insertion order'
  );
  assert.equal(
    (await (await request('projects?channel=web', cookie)).json()).total,
    0,
    'project filter uses latest attempt, not any past use'
  );
  assert.equal(
    (await (await request('projects?channel=unrecorded', cookie)).json()).items[0].id,
    'app-empty'
  );
  const cliPage2 = await (await request('deployments?channel=cli&page=2', cookie)).json();
  assert.equal(cliPage2.total, 22);
  assert.equal(cliPage2.items.length, 2);
  assert.ok(
    cliPage2.items.every((row: { client_channel: string }) => row.client_channel === 'cli')
  );
  assert.equal(
    (await (await request('deployments?channel=cli&status=failed', cookie)).json()).total,
    1
  );
  for (const path of [
    'projects?channel=bad',
    'deployments?channel=bad',
    'deployments?channel=unrecorded',
  ])
    assert.equal((await request(path, cookie)).status, 400);
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
  const owner = { userId: 'user-test', isAdmin: false };
  const other = { userId: 'other-user', isAdmin: false };
  const feedback = await communityService.createPost(db, {
    viewer: owner,
    title: 'Admin feedback fixture',
    content: 'Private problem details\nSecond line',
    category: 'bug',
  });
  for (let i = 0; i < 21; i++)
    await communityRepository.createPost(db, {
      id: `feedback-list-${i}`,
      userId: 'user-test',
      title: `Pagination ${i}`,
      content: 'Testing list',
      category: 'question',
    });
  const inbox = await (await request('feedback?category=bug&q=Private', activeCookie)).json();
  assert.equal(inbox.total, 1);
  assert.equal(inbox.items[0].id, feedback.id);
  assert.ok(!JSON.stringify(inbox).includes('NEVER_EXPOSE'));
  const feedbackPage2 = await (
    await request('feedback?category=question&page=2', activeCookie)
  ).json();
  assert.equal(feedbackPage2.total, 21);
  assert.equal(feedbackPage2.items.length, 1);
  assert.equal((await request('feedback?status=invalid', activeCookie)).status, 400);
  assert.equal((await request('feedback/missing', activeCookie)).status, 404);
  assert.equal(
    (
      await request(
        'feedback/manage',
        activeCookie,
        { id: feedback.id, action: 'status', expected: 'open', status: 'planned' },
        'https://evil.test'
      )
    ).status,
    403
  );
  assert.equal(
    (
      await request('feedback/manage', activeCookie, {
        id: feedback.id,
        action: 'status',
        expected: 'open',
        status: 'in_progress',
      })
    ).status,
    200
  );
  assert.equal(
    (
      await request('feedback/manage', activeCookie, {
        id: feedback.id,
        action: 'status',
        expected: 'open',
        status: 'planned',
      })
    ).status,
    409
  );
  assert.equal(
    (
      await communityService.listPosts(db, {
        viewer: owner,
        category: 'bug',
        status: 'in_progress',
        page: 1,
        pageSize: 20,
      })
    ).items[0].id,
    feedback.id
  );
  const reply = {
    action: 'reply',
    id: feedback.id,
    replyId: crypto.randomUUID(),
    content: 'Confirmed by team\nWe are investigating.',
  };
  assert.equal(
    (await request('feedback/manage', activeCookie, { ...reply, content: 'x'.repeat(801) })).status,
    400
  );
  assert.equal(
    (await request('feedback/manage', activeCookie, { ...reply, replyId: 'bad' })).status,
    400
  );
  const concurrent = await Promise.all([
    request('feedback/manage', activeCookie, reply),
    request('feedback/manage', activeCookie, reply),
  ]);
  assert.ok(concurrent.every((r) => r.status === 200));
  assert.equal((await request('feedback/manage', activeCookie, reply)).status, 200);
  assert.equal(
    (await request('feedback/manage', activeCookie, { ...reply, content: 'different' })).status,
    409
  );
  const visible = await communityService.listComments(db, feedback.id, owner);
  assert.equal(visible.items.length, 1);
  assert.equal(visible.items[0].author.displayName, 'GemiGo 团队');
  assert.equal(visible.items[0].content, reply.content);
  assert.equal(visible.items[0].canDelete, false);
  await assert.rejects(communityService.listComments(db, feedback.id, other), /access/);
  assert.equal(
    (
      await communityService.listPosts(db, {
        viewer: other,
        category: null,
        status: null,
        page: 1,
        pageSize: 20,
      })
    ).total,
    0
  );
  await assert.rejects(communityService.deleteComment(db, reply.replyId, owner), /permission/);
  assert.equal(
    (
      await db
        .prepare("SELECT COUNT(*) AS n FROM admin_audit WHERE action='feedback_reply'")
        .first()
    ).n,
    1
  );
  for (let i = 0; i < 105; i++)
    await communityRepository.createComment(db, {
      id: `page-comment-${i}`,
      postId: feedback.id,
      userId: 'user-test',
      content: `Reply ${i}`,
    });
  const discussion = await (await request(`feedback/${feedback.id}?page=2`, activeCookie)).json();
  const completeDiscussion = await communityService.listComments(db, feedback.id, owner);
  assert.equal(
    completeDiscussion.items.length,
    106,
    'main author discussion must not silently truncate team replies after 100 comments'
  );
  assert.equal(discussion.total, 106);
  assert.equal(discussion.comments.length, 6);
  assert.equal(
    (await request('feedback/manage', activeCookie, { id: feedback.id, action: 'delete' })).status,
    200
  );
  assert.equal((await request(`feedback/${feedback.id}`, activeCookie)).status, 404);
  assert.equal(
    (await request('feedback/manage', activeCookie, { ...reply, replyId: crypto.randomUUID() }))
      .status,
    404
  );
  await assert.rejects(communityService.listComments(db, feedback.id, owner), /not found/i);
  assert.equal(
    (
      await db
        .prepare(
          "SELECT COUNT(*) AS n FROM admin_audit WHERE action IN ('feedback_status','feedback_reply','feedback_delete')"
        )
        .first()
    ).n,
    3
  );
  await communityRepository.createPost(db, {
    id: 'feedback-ui',
    userId: 'user-test',
    title: 'Feedback UI fixture',
    content: 'Please investigate this private bug.\nSecond line.',
    category: 'bug',
  });
  console.log(
    'PASS assembled Worker + real D1: independent auth, bootstrap, dashboard, search, pagination, field isolation, origin, CAS mutations + audit, session revocation, password validation/persistence/rotation/race, retained analytics; canonical feedback filters/pagination/status CAS/idempotent concurrent reply/team projection/privacy/soft deletion.'
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

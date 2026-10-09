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
  authenticated,
} from '../workers/admin/src/auth';
import { authRepository } from '../workers/api/src/repositories/auth.repository';
import { projectRepository } from '../workers/api/src/repositories/project.repository';
import { deploymentRepository } from '../workers/api/src/repositories/deployment.repository';
import { analyticsRepository } from '../workers/api/src/repositories/analytics.repository';
import { communityRepository } from '../workers/api/src/repositories/community.repository';
import { communityService } from '../workers/api/src/services/community.service';
import { projectInventory } from '../workers/admin/src/project-inventory';
import { analyticsService } from '../workers/api/src/services/analytics.service';

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
  assert.deepEqual(
    await projectInventory(db),
    {
      summary: {
        total: 0,
        public: 0,
        private: 0,
        visibilityUnknown: 0,
        live: 0,
        publicLive: 0,
        languageKnown: 0,
      },
      categories: [],
      languages: [],
    },
    'empty inventory is measured zero, not null or NaN'
  );
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
    assert.match(cookie, /Max-Age=7776000(?:;|$)/, 'login persists for 90 days');
    return cookie.split(';')[0];
  };
  for (const route of [
    'overview',
    'growth',
    'users',
    'projects',
    'projects/app-test',
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
  const readBucket = `reads:${now.slice(0, 10)}`;
  await db
    .prepare('INSERT INTO product_event_limits VALUES (?,?,?)')
    .bind(readBucket, 1000000, Date.now() + 86400000)
    .run();
  for (const days of [7, 30]) {
    const coldResponse = await request(`growth?days=${days}`, cookie);
    assert.equal(coldResponse.status, 200, await coldResponse.clone().text());
    assert.match(coldResponse.headers.get('cache-control')!, /private, no-store/);
    const cold = await coldResponse.json();
    assert.equal(cold.cached, false);
    assert.equal(cold.period.days, days);
    const hot = await (await request(`growth?days=${days}`, cookie2)).json();
    assert.equal(hot.cached, true, 'another valid session shares the report');
    assert.equal(hot.generatedAt, cold.generatedAt);
  }
  const budgetResponse = await (await request('budget', cookie)).json();
  assert.ok(!budgetResponse.readBudget, 'normal reads have no daily allowance');
  assert.equal(
    (
      await db
        .prepare('SELECT count FROM product_event_limits WHERE bucket=?')
        .bind(readBucket)
        .first()
    ).count,
    1000000
  );
  assert.ok(budgetResponse.used.growth_reads > 0, 'actual operating reads remain observable');
  for (const path of [
    'report',
    'acquisition?days=7',
    'acquisition?days=30',
    'events',
    'events?export=true',
  ]) {
    const response = await request(path, cookie);
    assert.equal(response.status, 200, await response.clone().text());
  }
  const burstCookie = await login(initial);
  let limited: Response | null = null;
  for (let i = 0; i < 242; i++) {
    const response = await request('growth?days=7', burstCookie);
    if (response.status === 429) {
      limited = response;
      break;
    }
    assert.equal(response.status, 200);
  }
  assert.ok(limited, 'only an abnormal request burst is rejected');
  assert.ok(
    Number(limited.headers.get('Retry-After')) >= 1 &&
      Number(limited.headers.get('Retry-After')) <= 60
  );
  assert.match((await limited.json()).error, /查询过于频繁/);
  assert.equal(
    (await request('growth?days=7', `unrelated=random; ${burstCookie}; extra=changed`)).status,
    429,
    'changing unrelated cookies cannot evade the same authenticated session limit'
  );
  assert.equal(
    (await request('growth?days=7', cookie)).status,
    200,
    'another valid session is unaffected'
  );
  assert.equal((await request('growth?days=90', cookie)).status, 400);
  await db.prepare('DELETE FROM product_event_limits WHERE bucket=?').bind(readBucket).run();
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
  for (const [id, category, language, visibility, status] of [
    [
      'inventory-multi',
      'Education',
      JSON.stringify({ source: 'author', languages: ['zh', 'en', 'zh'] }),
      1,
      'Live',
    ],
    ['inventory-en', 'Games', JSON.stringify({ source: 'detected', languages: ['en'] }), 0, 'Live'],
    [
      'inventory-zh',
      'Education',
      JSON.stringify({ source: 'author', languages: ['zh'] }),
      1,
      'Building',
    ],
    ['inventory-json', 'Legacy', '{broken', null, 'Failed'],
    [
      'inventory-object',
      'Creative',
      JSON.stringify({ source: 'author', languages: { en: true } }),
      0,
      'Live',
    ],
    [
      'inventory-source',
      null,
      JSON.stringify({ source: 'translation', languages: ['en'] }),
      1,
      'Live',
    ],
    [
      'inventory-neutral',
      'Creative',
      JSON.stringify({ source: 'author', languages: ['zxx'] }),
      0,
      'Live',
    ],
    [
      'inventory-deleted',
      'Education',
      JSON.stringify({ source: 'author', languages: ['fr'] }),
      1,
      'Live',
    ],
  ] as const) {
    await db
      .prepare(
        `INSERT INTO projects (id,name,repo_url,owner_id,created_at,last_deployed,category,app_language,is_public,status,is_deleted,url,default_locale,localized_metadata)
      VALUES (?,?,'','user-test',?,?,?,?,?,?,?,?,'en','{"defaultLocale":"en","locales":{"en":{"name":"Translated"}}}')`
      )
      .bind(
        id,
        id,
        now,
        now,
        category,
        language,
        visibility,
        status,
        Number(id === 'inventory-deleted'),
        id === 'inventory-multi' ? 'https://example.invalid' : ''
      )
      .run();
  }
  const inventoryResponse = await (await request('projects', cookie)).json();
  const inventory = inventoryResponse.inventory;
  assert.deepEqual(inventory.summary, {
    total: 10,
    public: 4,
    private: 3,
    visibilityUnknown: 3,
    live: 8,
    publicLive: 2,
    languageKnown: 4,
  });
  assert.equal(
    inventory.categories.reduce((n: number, row: { total: number }) => n + row.total, 0),
    10
  );
  assert.equal(inventory.languages.find((row: { name: string }) => row.name === 'zh').total, 2);
  assert.equal(
    inventory.categories.find((row: { name: string }) => row.name === 'Education').total,
    2
  );
  assert.equal(inventory.categories.find((row: { name: string }) => row.name === 'Other').total, 5);
  assert.equal(
    inventory.categories.length,
    4,
    'one group per primary category, not per application name'
  );
  assert.equal(
    inventory.languages.find((row: { name: string }) => row.name === 'en').total,
    2,
    'translation locale must not imply UI language'
  );
  assert.equal(inventory.languages.find((row: { name: string }) => row.name === 'zxx').total, 1);
  assert.ok(
    !inventory.languages.some((row: { name: string }) => row.name === 'fr'),
    'deleted apps excluded'
  );
  const combined = await (
    await request('projects?category=Education&language=zh&visibility=public&status=Live', cookie)
  ).json();
  assert.equal(combined.total, 1);
  assert.equal(combined.items[0].id, 'inventory-multi');
  assert.deepEqual(JSON.parse(combined.items[0].languages), ['en', 'zh']);
  assert.deepEqual(
    combined.inventory,
    inventory,
    'snapshot stays global while the table is filtered'
  );
  assert.equal((await (await request('projects?language=und', cookie)).json()).total, 6);
  assert.equal((await (await request('projects?visibility=unrecorded', cookie)).json()).total, 3);
  assert.equal((await (await request('projects?category=Other', cookie)).json()).total, 5);
  for (const path of [
    'projects?category=bad',
    'projects?language=zh-CN',
    'projects?visibility=bad',
    'users?language=zh',
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
  // Use the real D1 session and authentication owner at controlled time boundaries.
  const realNow = Date.now;
  const issuedAt = realNow();
  const lifetime = 90 * 86400000;
  let longCookie: string;
  try {
    Date.now = () => issuedAt;
    longCookie = (await createSession(env, old.version)).split(';')[0];
    const sessionRequest = new Request('https://admin.test/api/session', {
      headers: { cookie: longCookie },
    });
    for (const elapsed of [86400000, 30 * 86400000, 89 * 86400000, lifetime - 1]) {
      Date.now = () => issuedAt + elapsed;
      assert.equal(await authenticated(sessionRequest, env), true, `valid after ${elapsed}ms`);
    }
    for (const elapsed of [lifetime, lifetime + 1]) {
      Date.now = () => issuedAt + elapsed;
      assert.equal(await authenticated(sessionRequest, env), false, 'absolute expiry is enforced');
    }
  } finally {
    Date.now = realNow;
  }
  assert.equal((await request('session', longCookie)).status, 200);
  const longHash = await hash(`${old.version}:${longCookie.split('=')[1]}`);
  const longSession = await db.prepare('SELECT expires_at FROM admin_sessions WHERE token_hash=?')
    .bind(longHash).first();
  assert.equal(longSession.expires_at, issuedAt + lifetime, 'access never extends absolute expiry');
  const exited = await request('logout', longCookie, {});
  assert.equal(exited.status, 200);
  assert.match(exited.headers.get('set-cookie')!, /Max-Age=0/);
  assert.equal((await request('session', longCookie)).status, 401, 'logout revokes long session');
  await db.prepare('UPDATE admin_sessions SET expires_at=? WHERE token_hash=?')
    .bind(realNow() - 1, await hash(`${old.version}:${nextCookie.split('=')[1]}`)).run();
  assert.equal((await request('session', nextCookie)).status, 401, 'HTTP denies expired session');
  console.log('PASS: 90-day persistent login, time boundaries, absolute expiry and logout revocation.');
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
  // Operational journeys: recorded first/repeat publishers, current issues and scoped application trace.
  const ago = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
  for (const [id, status, deleted] of [
    ['ops-stalled', 'Building', 0],
    ['ops-no-history', 'Building', 0],
    ['ops-recovered', 'Live', 0],
    ['ops-recent', 'Building', 0],
    ['ops-deleted', 'Failed', 1],
    ...Array.from({ length: 7 }, (_, i) => [`ops-failed-${i}`, 'Failed', 0]),
  ] as [string, string, number][]) {
    await db
      .prepare(
        `INSERT INTO projects (id,name,slug,repo_url,status,is_deleted,owner_id,created_at,updated_at,last_deployed,is_public)
      VALUES (?,?,?,'',?,?,'user-test',?,?,?,0)`
      )
      .bind(id, id, id, status, deleted, ago(3), ago(2), ago(2))
      .run();
  }
  for (const [id, project, owner, status, started] of [
    ['ops-past', 'ops-recovered', 'publisher-repeat', 'succeeded', ago(40)],
    ['ops-now', 'ops-recovered', 'publisher-repeat', 'succeeded', now],
    ['ops-again', 'ops-recovered', 'publisher-repeat', 'succeeded', now],
    ['ops-first', 'ops-recovered', 'publisher-first', 'succeeded', now],
    ['ops-first-earlier', 'ops-recovered', 'publisher-first', 'succeeded', ago(10)],
    ['ops-fail-only', 'ops-failed-0', 'publisher-failed', 'failed', now],
    ['ops-stalled-attempt', 'ops-stalled', 'user-test', 'accepted', ago(2)],
    ['ops-recent-attempt', 'ops-recent', 'user-test', 'started', now],
    ['ops-recovery-old', 'ops-recovered', 'user-test', 'failed', ago(2)],
    ['ops-recovery-new', 'ops-recovered', 'user-test', 'succeeded', now],
  ]) {
    await db
      .prepare(
        `INSERT INTO deployment_attempts (id,project_id,owner_id,source_type,client_channel,status,started_at,error_code)
      VALUES (?,?,?,'html','cli',?,?,'ops_fixture')`
      )
      .bind(id, project, owner, status, started)
      .run();
  }
  const ops = await (await request('overview', activeCookie)).json();
  assert.deepEqual(ops.publishing, { publishers: 3, firstPublishers: 1, repeatPublishers: 2 });
  const monthOps = await (await request('overview?days=30', activeCookie)).json();
  assert.deepEqual(monthOps.publishing, { publishers: 3, firstPublishers: 2, repeatPublishers: 1 });
  assert.equal(ops.attention.total, 10); // 7 current failures + inventory-json + 2 stale projects
  assert.equal(ops.attention.items.length, 6);
  assert.equal(ops.attention.items[0].reason, 'stalled');
  assert.ok(
    !ops.attention.items.some((row: { id: string }) =>
      ['ops-recovered', 'ops-deleted', 'ops-recent', 'app-test'].includes(row.id)
    )
  );
  const opsPage2 = await (await request('overview?actionPage=2', activeCookie)).json();
  assert.equal(opsPage2.attention.items.length, 4);
  assert.equal(opsPage2.feedback.page, 1, 'independent queue pagination');
  assert.equal((await request('overview?actionPage=0', activeCookie)).status, 400);
  assert.equal((await request('overview?feedbackPage=1.5', activeCookie)).status, 400);
  await db
    .prepare(
      `INSERT INTO project_daily_stats (slug,date,views,human_views,bot_views,unique_visitors)
    VALUES ('ops-recovered',?,12,12,3,2)`
    )
    .bind(now.slice(0, 10))
    .run();
  const collectionStart =
    new Date(Date.now() - 86400000).toISOString().slice(0, 10) + 'T00:00:00.000Z';
  await db
    .prepare('INSERT INTO project_analytics_collection (id,started_at) VALUES(1,?)')
    .bind(collectionStart)
    .run();
  const appSignal = {
    isBot: false,
    visitorHash: 'a'.repeat(64),
    sessionHash: 'b'.repeat(64),
    dedupeKey: 'a'.repeat(64),
    userAgentFamily: 'browser',
    clientChannel: 'web',
  };
  await analyticsRepository.recordPageView(
    db,
    'ops-recovered',
    new Date(Date.now() - 86400000),
    appSignal
  );
  await analyticsRepository.recordPageView(db, 'ops-recovered', new Date(), {
    ...appSignal,
    dedupeKey: 'b'.repeat(64),
  });
  await analyticsRepository.recordPageView(db, 'ops-recovered', new Date(), {
    ...appSignal,
    visitorHash: '',
    sessionHash: '',
    dedupeKey: 'c'.repeat(64),
  });
  await analyticsRepository.recordPageView(db, 'ops-recovered', new Date(), {
    ...appSignal,
    isBot: true,
    dedupeKey: 'd'.repeat(64),
  });
  await analyticsRepository.recordPageView(db, 'other-app', new Date(), {
    ...appSignal,
    dedupeKey: 'e'.repeat(64),
  });
  const traceResponse = await request('projects/ops-recovered', activeCookie);
  assert.match(traceResponse.headers.get('cache-control')!, /no-store/);
  const trace = await traceResponse.json();
  assert.equal(trace.item.id, 'ops-recovered');
  assert.equal(trace.item.latest_channel, 'cli');
  assert.equal(
    trace.deployments.items[0].id,
    'ops-recovery-new',
    'latest same-time attempt follows rowid, not UUID ordering'
  );
  assert.equal(trace.traffic.points.length, 7);
  assert.equal(
    trace.traffic.pageViews,
    3,
    'browser PV excludes other apps, bot signals and old server diagnostics'
  );
  assert.equal(trace.traffic.uniqueVisitors, 1, 'same browser across days counts once');
  assert.equal(trace.traffic.unidentifiedViews, 1, 'missing storage counts PV, not UV');
  assert.equal(trace.traffic.points[6].views, 2);
  assert.equal(trace.traffic.points[6].uniqueVisitors, 1);
  assert.equal(trace.traffic.points[0].views, null, 'unsampled history is not zero');
  assert.deepEqual(
    trace.traffic,
    await analyticsService.getProjectStatsForSlug(db, 'ops-recovered', 7),
    'admin and owner consume the same stats owner'
  );
  assert.ok(trace.feedback.items.some((row: { id: string }) => row.id === 'feedback-ui'));
  assert.ok(!JSON.stringify(trace).includes('NEVER_EXPOSE'));
  assert.ok(!('html_content' in trace.item) && !('password_hash' in trace.item));
  const tracePage2 = await (await request('projects/app-test?page=2&days=30', activeCookie)).json();
  assert.equal(tracePage2.deployments.total, 42);
  assert.equal(tracePage2.deployments.items.length, 20);
  assert.equal(tracePage2.traffic.points.length, 30);
  assert.equal(tracePage2.traffic.pageViews, 0, 'covered empty app remains zero');
  assert.equal(tracePage2.traffic.uniqueVisitors, 0);
  for (const route of ['projects/missing', 'projects/ops-deleted'])
    assert.equal((await request(route, activeCookie)).status, 404);
  for (const route of ['projects/app-test?days=1', 'projects/app-test?page=-1'])
    assert.equal((await request(route, activeCookie)).status, 400);
  const authorFeedback = await (await request('feedback?owner=user-test', activeCookie)).json();
  assert.ok(authorFeedback.items.every((row: { user_id: string }) => row.user_id === 'user-test'));
  assert.equal((await (await request('feedback?owner=nonexistent', activeCookie)).json()).total, 0);
  assert.equal((await request(`feedback?owner=${'x'.repeat(201)}`, activeCookie)).status, 400);
  await request('feedback/manage', activeCookie, {
    id: 'feedback-ui',
    action: 'status',
    expected: 'open',
    status: 'planned',
  });
  const after = await (await request('overview', activeCookie)).json();
  assert.equal(
    after.feedback.total,
    ops.feedback.total - 1,
    'pending feedback uses canonical status, no parallel task state'
  );
  assert.ok(!after.feedback.items.some((row: { id: string }) => row.id === 'feedback-ui'));
  await request('feedback/manage', activeCookie, {
    id: 'feedback-ui',
    action: 'status',
    expected: 'planned',
    status: 'open',
  });
  // Ranking is current inventory, not a 7/30-day cohort or deployment count.
  for (let index = 0; index < 12; index++) {
    const id = `ranking-${String(index).padStart(2, '0')}`;
    await db.prepare('INSERT INTO users (id,email,display_name,created_at,updated_at) VALUES (?,?,?,?,?)')
      .bind(id, `${id}@example.invalid`, index === 0 ? null : `Creator ${index}`, now, now).run();
    await db.prepare(`WITH RECURSIVE numbers(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM numbers WHERE n<?)
      INSERT INTO projects (id,owner_id,name,slug,repo_url,framework,status,last_deployed,created_at,is_public,is_deleted,url)
      SELECT ?||':'||n,?,?||' app '||n,?||'-'||n,'draft:qa','Unknown',CASE WHEN n<=7 THEN 'Live' ELSE 'Offline' END,
      '2020-01-01','2020-01-01',CASE WHEN n<=3 THEN 1 ELSE 0 END,0,CASE WHEN n<=7 THEN 'https://qa.example.invalid/' ELSE NULL END FROM numbers`)
      .bind(index <= 1 ? 200 : 200 - index, id, id, id, id).run();
  }
  await db.prepare(`INSERT INTO projects (id,owner_id,name,repo_url,framework,status,last_deployed,is_deleted)
    VALUES ('ranking-deleted','ranking-00','Deleted','draft:qa','Unknown','Offline','2020-01-01',1)`).run();
  const ranking = await (await request('overview', activeCookie)).json();
  assert.equal(ranking.topCreators.length, 10);
  assert.deepEqual(ranking.topCreators.map((row: { id: string }) => row.id), Array.from({ length: 10 }, (_, i) => `ranking-${String(i).padStart(2, '0')}`));
  assert.equal(ranking.topCreators[0].projects, 200, 'draft/private/old apps included, deleted excluded');
  assert.equal(ranking.topCreators[0].live, 7);
  assert.equal(ranking.topCreators[0].publicLive, 3);
  assert.equal(ranking.topCreators[0].display_name, null, 'unnamed account remains identifiable to the administrator');
  assert.deepEqual((await (await request('overview?days=30', activeCookie)).json()).topCreators, ranking.topCreators);
  const ownerApps = await (await request('projects?owner=ranking-00', activeCookie)).json();
  assert.equal(ownerApps.total, 200);
  assert.equal(ownerApps.items.length, 20);
  assert.ok(ownerApps.items.every((row: { owner_id: string }) => row.owner_id === 'ranking-00'));
  assert.equal((await request(`projects?owner=${'x'.repeat(201)}`, activeCookie)).status, 400);
  assert.equal((await request('overview')).status, 401, 'ranking remains behind administrator authentication');
  console.log('PASS: top ten current creators; stable ties; deleted/draft/private/date boundaries; exact owner drilldown; administrator authentication.');

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

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { authRepository } from '../workers/api/src/repositories/auth.repository';
import { projectRepository } from '../workers/api/src/repositories/project.repository';
import { deploymentRepository } from '../workers/api/src/repositories/deployment.repository';
import { growthPeriod } from '../workers/admin/src/growth';
const require = createRequire(import.meta.url);
const runtime = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare } = runtime('miniflare');
const { build } = runtime('esbuild');
const bundle = await build({
  stdin: {
    contents: `import { queryGrowth } from './workers/admin/src/growth'; export default { async fetch(request,env) { try { return Response.json(await queryGrowth(env,new URL(request.url))); } catch(e) { return Response.json({error:e.message},{status:e.status||500}); } } };`,
    resolveDir: process.cwd(),
    sourcefile: 'growth-test.ts',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
});
const period = growthPeriod(7);
const timestamp = (ago: number) =>
  new Date(Date.parse(period.today) - ago * 86400000 + 3600000).toISOString();
assert.deepEqual(growthPeriod(7, Date.parse('2026-10-03T03:10:00Z')), {
  days: 7,
  today: '2026-10-03',
  from: '2026-09-26',
  to: '2026-10-02',
  previousFrom: '2026-09-19',
  previousTo: '2026-09-25',
  rawFrom: '2026-09-04',
});
assert.throws(() => growthPeriod(90), /7/);
let failed = false,
  calls = 0;
const row = (date: string, count: number, visits: number) => ({
  count,
  sum: { visits },
  avg: { sampleInterval: 2 },
  dimensions: { date },
});
const mf = new Miniflare({
  modules: true,
  script: bundle.outputFiles[0].text,
  compatibilityDate: '2026-09-18',
  d1Databases: { ANALYTICS_DB: 'growth-test' },
  bindings: {
    ANALYTICS_CF_TOKEN: 'test-token',
    CLOUDFLARE_ACCOUNT_ID: 'test-account',
    GROWTH_PLATFORM_SITE_TAG: 'main-site',
    GROWTH_APPS_SITE_TAG: 'app-sites',
  },
  outboundService: async (request: Request) => {
    calls++;
    assert.equal(new URL(request.url).href, 'https://api.cloudflare.com/client/v4/graphql');
    assert.equal(request.headers.get('authorization'), 'Bearer test-token');
    const payload = (await request.json()) as { query: string; variables: Record<string, string> };
    assert.match(payload.query, /bot:0/);
    assert.equal(payload.variables.platform, 'main-site');
    assert.equal(payload.variables.apps, 'app-sites');
    if (failed) return Response.json({ errors: [{ message: 'upstream unavailable' }] });
    return Response.json({
      data: {
        viewer: {
          accounts: [
            {
              platform: [
                row(period.to, 100, 30),
                row(period.previousTo, 50, 20),
                row(period.today, 7, 4),
              ],
              apps: [row(period.to, 900, 200)],
              referrers: [
                { count: 100, sum: { visits: 30 }, dimensions: { refererHost: '192.0.2.1' } },
              ],
              devices: [{ count: 100, sum: { visits: 30 }, dimensions: { deviceType: 'mobile' } }],
            },
          ],
        },
      },
    });
  },
});
try {
  const db = await mf.getD1Database('ANALYTICS_DB');
  await authRepository.ensureAuthSchema(db);
  await projectRepository.getAllProjects(db);
  await deploymentRepository.listPending(db);
  for (const file of readdirSync('packages/product-analytics/migrations').sort())
    for (const sql of readFileSync(`packages/product-analytics/migrations/${file}`, 'utf8')
      .split(';')
      .filter((s) => s.trim()))
      await db.prepare(sql).run();
  for (const [id, ago] of [
    ['new-user', 1],
    ['old-user', 60],
  ] as const)
    await db
      .prepare('INSERT INTO users (id,email,created_at,updated_at) VALUES (?,?,?,?)')
      .bind(id, `${id}@example.invalid`, timestamp(ago), timestamp(ago))
      .run();
  await db
    .prepare(
      "INSERT INTO projects (id,name,repo_url,owner_id,status,is_deleted,last_deployed,created_at) VALUES ('new-app','New app','','new-user','Live',0,?,?)"
    )
    .bind(timestamp(1), timestamp(1))
    .run();
  await db
    .prepare(
      "INSERT INTO deployment_attempts (id,project_id,owner_id,source_type,client_channel,status,started_at) VALUES ('new-deploy','new-app','new-user','html','web','succeeded',?)"
    )
    .bind(timestamp(1))
    .run();
  for (const [id, ago, visitor, admin, channel, name] of [
    ['v1', 1, 'visitor-one', 0, 'web', 'page_view'],
    ['v2', 1, 'visitor-one', 0, 'web', 'page_view'],
    ['v3', 2, 'visitor-one', 0, 'web', 'page_view'],
    ['admin', 1, 'admin-visitor', 1, 'web', 'page_view'],
    ['desktop', 1, 'desktop-visitor', 0, 'desktop', 'page_view'],
    ['other-event', 1, 'other-visitor', 0, 'web', 'auth_open'],
  ] as const)
    await db
      .prepare(
        "INSERT INTO product_events (id,name,at,received_at,visitor_id,session_id,page,device,referrer,client_channel,signed_in,is_admin,source) VALUES (?,?,?,?,?,?,?,'desktop','direct',?,0,?,'browser')"
      )
      .bind(
        id,
        name,
        Date.parse(timestamp(ago)),
        Date.now(),
        visitor,
        `session-${id}`,
        'home',
        channel,
        admin
      )
      .run();
  const get = async (days = 7) => {
    const response = await mf.dispatchFetch(`https://test/growth?days=${days}`);
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  };
  const report = await get();
  assert.equal(report.daily.length, 7);
  assert.equal(report.current.pv, 100);
  assert.equal(report.previous.pv, 50);
  assert.equal(report.current.appsPv, 900, 'app traffic must not inflate platform PV');
  assert.equal(report.referrers[0].dimensions.refererHost, '外部 IP 来源');
  assert.ok(!JSON.stringify(report).includes('192.0.2.1'), 'growth never exposes raw IP hosts');
  assert.equal(report.current.visits, 30, 'visits are independent from UV');
  assert.equal(
    report.observedUv,
    1,
    'period UV dedupes across days/sessions and excludes admins/nonweb/nonpageview'
  );
  assert.equal(report.daily.at(-1).uv, 1);
  assert.equal(report.daily.at(-2).uv, 1);
  assert.equal(report.daily.at(-1).pv, 100);
  assert.equal(report.daily[0].pv, 0, 'valid web snapshot missing date means observed zero');
  assert.equal(report.current.registrations, 1);
  assert.equal(report.current.succeeded, 1);
  assert.deepEqual(report.cohort, { registered: 1, activated: 1, deployed: 1 });
  assert.equal(report.today.pv, 7, 'incomplete day must not enter period totals');
  assert.equal(report.web.adaptiveSampling, true);
  const again = await get();
  assert.equal(calls, 1, 'CF cache avoids repeated upstream reads');
  assert.equal(again.web.stale, false);
  // Repeated owners/apps across days and channels must not inflate channel reach.
  for (const [id, ago, channel, status] of [
    ['cli-success', 1, 'cli', 'succeeded'],
    ['cli-failure', 2, 'cli', 'failed'],
    ['cli-pending', 1, 'cli', 'accepted'],
    ['cli-prior', 8, 'cli', 'succeeded'],
    ['cli-today', 0, 'cli', 'started'],
    ['api-success', 1, 'api', 'succeeded'],
    ['unknown-success', 1, 'legacy-client', 'succeeded'],
  ] as const) {
    await db
      .prepare(
        `INSERT INTO deployment_attempts (id,project_id,owner_id,source_type,client_channel,status,started_at)
      VALUES (?,'new-app','new-user','zip',?,?,?)`
      )
      .bind(id, channel, status, timestamp(ago))
      .run();
  }
  const usage = await get();
  assert.equal(usage.current.attempts, 6);
  assert.equal(usage.current.cliAttempts, 3);
  assert.equal(usage.previous.cliAttempts, 1);
  assert.equal(usage.today.cliAttempts, 1, 'today remains outside the full-period CLI usage');
  assert.equal(usage.daily.at(-1).cliAttempts, 2);
  assert.equal(usage.daily.at(-2).cliAttempts, 1);
  const cli = usage.channels.find((row: { channel: string }) => row.channel === 'cli');
  assert.deepEqual(cli.current, {
    attempts: 3,
    succeeded: 1,
    failed: 1,
    pending: 1,
    projects: 1,
    users: 1,
  });
  assert.deepEqual(cli.previous, {
    attempts: 1,
    succeeded: 1,
    failed: 0,
    pending: 0,
    projects: 1,
    users: 1,
  });
  assert.equal(
    usage.channels.find((row: { channel: string }) => row.channel === 'unknown').current.attempts,
    1
  );
  assert.equal(
    usage.channels.reduce(
      (n: number, row: { current: { attempts: number } }) => n + row.current.attempts,
      0
    ),
    usage.current.attempts
  );
  assert.equal(
    usage.channels.find((row: { channel: string }) => row.channel === 'desktop').current.attempts,
    0
  );
  assert.ok(!JSON.stringify(usage).includes('new-user'), 'channel reach is aggregate only');
  const month = await get(30);
  assert.equal(month.daily.length, 30);
  assert.equal(month.daily[0].uv, null, 'partially retained date must not look like measured zero');
  assert.equal(month.uvPartial, true);
  const saved = await db
    .prepare("SELECT value FROM analytics_settings WHERE key='growth_web_7'")
    .first();
  const snapshot = JSON.parse(saved.value);
  snapshot.fetchedAt = 0;
  await db
    .prepare("UPDATE analytics_settings SET value=? WHERE key='growth_web_7'")
    .bind(JSON.stringify(snapshot))
    .run();
  failed = true;
  const stale = await get();
  assert.equal(stale.web.stale, true);
  assert.equal(stale.current.pv, 100);
  assert.ok(stale.web.error);
  assert.equal(stale.current.registrations, 1);
  await db.prepare("DELETE FROM analytics_settings WHERE key='growth_web_7'").run();
  const missing = await get();
  assert.equal(missing.current.pv, null);
  assert.equal(missing.daily[0].pv, null);
  assert.equal(missing.web.stale, false);
  assert.equal(missing.current.registrations, 1);
  assert.ok(
    !JSON.stringify(missing).includes('example.invalid'),
    'growth response never exposes individual user data'
  );
  assert.equal((await mf.dispatchFetch('https://test/growth?days=90')).status, 400);
  await db
    .prepare("UPDATE product_event_limits SET count=1000000 WHERE bucket LIKE 'reads:%'")
    .run();
  assert.equal(
    (await mf.dispatchFetch('https://test/growth?days=7')).status,
    429,
    'growth shares the account daily query allowance'
  );
  console.log(
    'PASS growth: complete UTC windows/previous periods, human CF PV vs app PV/visits, daily+period UV dedupe, admin/channel exclusion, actual registration/activation/deploy cohort, today separation, retention nulls, cached/stale/missing upstream, no individual user data.'
  );
} finally {
  await mf.dispose();
}

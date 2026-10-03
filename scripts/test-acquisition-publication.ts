import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { queryAcquisition } from '../workers/admin/src/acquisition';
const require = createRequire(import.meta.url);
const { Miniflare } = createRequire(require.resolve('wrangler/package.json'))('miniflare');
const now = Date.parse('2026-10-10T04:00:00Z');
const at = Date.parse('2026-10-08T01:00:00Z');
const mf = new Miniflare({
  modules: true,
  script: 'export default {fetch(){return new Response("ok")}}',
  d1Databases: { DB: 'publication-events' },
  compatibilityDate: '2026-09-18',
});
try {
  const db = await mf.getD1Database('DB');
  const projects = db;
  for (const file of readdirSync('packages/product-analytics/migrations').sort())
    for (const sql of readFileSync('packages/product-analytics/migrations/' + file, 'utf8')
      .split(';')
      .filter((s) => s.trim()))
      await db.prepare(sql).run();
  await db
    .prepare(
      "INSERT INTO analytics_settings VALUES('acquisition_registration_start','2026-10-03T00:00:00Z')"
    )
    .run();
  await projects
    .prepare(
      'CREATE TABLE deployment_attempts(flow_id TEXT PRIMARY KEY,status TEXT,client_channel TEXT,started_at TEXT,finished_at TEXT)'
    )
    .run();
  const event = async (
    session: string,
    name: string,
    time: number,
    flow: string | null = null,
    source = 'server'
  ) => {
    await db
      .prepare(
        'INSERT INTO product_events(id,name,at,received_at,visitor_id,session_id,page,dimension,flow_id,device,referrer,signed_in,is_admin,source,client_channel) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
      )
      .bind(
        crypto.randomUUID(),
        name,
        time,
        time,
        session,
        session,
        'guide',
        name === 'signup_success' ? 'email' : null,
        flow,
        'desktop',
        'search',
        1,
        0,
        source,
        'web'
      )
      .run();
  };
  const cohort = async (session: string, signup = true) => {
    await event(session, 'page_view', at, null, 'browser');
    if (signup) await event(session, 'signup_success', at + 1);
  };
  const attempt = async (
    flow: string,
    status = 'succeeded',
    finished = at + 1000,
    started = at + 3,
    channel = 'web'
  ) => {
    await projects
      .prepare('INSERT INTO deployment_attempts VALUES(?,?,?,?,?)')
      .bind(
        flow,
        status,
        channel,
        new Date(started).toISOString(),
        new Date(finished).toISOString()
      )
      .run();
  };
  await cohort('success');
  await event('success', 'deployment_accepted', at + 10, 'ok');
  await event('success', 'deployment_accepted', at + 11, 'ok');
  await attempt('ok');
  await cohort('failed');
  await event('failed', 'deployment_accepted', at + 10, 'failed');
  await attempt('failed', 'failed');
  await cohort('browser-lie');
  await event('browser-lie', 'deployment_success', at + 10, 'lie', 'browser');
  await attempt('lie');
  await cohort('no-signup', false);
  await event('no-signup', 'deployment_accepted', at + 10, 'existing');
  await attempt('existing');
  await cohort('before');
  await event('before', 'deployment_accepted', at - 10, 'before');
  await attempt('before', 'succeeded', at, at - 50);
  await cohort('stale-flow');
  await event('stale-flow', 'deployment_accepted', at + 10, 'old');
  await attempt('old', 'succeeded', at - 5, at - 50);
  await cohort('cli');
  await event('cli', 'deployment_accepted', at + 10, 'cli');
  await attempt('cli', 'succeeded', at + 100, at + 3, 'cli');
  await cohort('later');
  await event('later', 'deployment_accepted', at + 10, 'later');
  await attempt('later', 'succeeded', Date.parse('2026-10-10T01:00:00Z'));
  const report = await queryAcquisition(db, 7, now);
  assert.equal(
    report.summary[0].publishedSessions,
    1,
    'one deduplicated durable success before period end'
  );
  assert.equal(report.landings[0].publishedSessions, 1);
  assert.equal(
    report.daily.find((d) => d.day === '2026-10-08')?.sources[0].publishedSessions,
    2,
    'daily cohorts observe outcomes up to query time'
  );
  assert.equal(report.summary[1].publishedSessions, null, 'no eligible AI cohort');
  assert.ok(report.rowsRead > 0);
  for (let i = 0; i < 501; i++)
    await event('success', 'deployment_accepted', at + 20 + i, 'limit-' + i);
  const repeated = await queryAcquisition(db, 7, now);
  assert.equal(
    repeated.summary[0].publishedSessions,
    1,
    'many accepted attempts do not multiply sessions'
  );
  assert.ok(repeated.rowsRead > 0);
  console.log(
    'PASS real D1 publication attribution: ordered registration, durable status/time, duplicates, browser lies, no signup, old flows, CLI, UTC cutoff and bounded read budget'
  );
} finally {
  await mf.dispose();
}

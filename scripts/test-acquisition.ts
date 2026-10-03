import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import {
  classifyReferrer,
  parseBatch,
  normalizePage,
} from '../packages/product-analytics/src/contract';
import { queryAcquisition } from '../workers/admin/src/acquisition';
import { reserveReads, readBudgetMessage } from '../packages/product-analytics/src/budget';
const require = createRequire(import.meta.url);
const runtime = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare } = runtime('miniflare');
for (const host of [
  'www.google.com',
  'google.co.uk',
  'bing.com',
  'www.baidu.com',
  'duckduckgo.com',
  'search.yahoo.com',
  'search.brave.com',
])
  assert.equal(classifyReferrer('https://' + host + '/private?q=secret', 'gemigo.io'), 'search');
for (const host of [
  'chatgpt.com',
  'chat.openai.com',
  'www.perplexity.ai',
  'claude.ai',
  'gemini.google.com',
  'copilot.microsoft.com',
  'chat.deepseek.com',
])
  assert.equal(classifyReferrer('https://' + host, 'gemigo.io'), 'ai');
for (const host of ['chatgpt.com.evil.test', 'google.fake', 'notperplexity.ai'])
  assert.equal(classifyReferrer('https://' + host, 'gemigo.io'), 'other');
assert.equal(classifyReferrer('', 'gemigo.io', 'chatgpt'), 'ai');
assert.equal(classifyReferrer('', 'gemigo.io', 'chatgpt.com'), 'ai');
assert.equal(classifyReferrer('https://www.google.com', 'gemigo.io', undefined, 'cpc'), 'other');
assert.equal(classifyReferrer('https://gemigo.io/about', 'gemigo.io'), 'direct');
assert.equal(normalizePage('/guides/publish-html?secret=hidden'), 'guide');
const context = {
  visitorId: crypto.randomUUID(),
  sessionId: crypto.randomUUID(),
  referrer: 'ai',
  device: 'desktop',
  channel: 'web',
  events: [],
};
assert.equal(parseBatch(context).referrer, 'ai');
assert.throws(() => parseBatch({ ...context, referrer: 'private-url' }));
const now = Date.parse('2026-10-10T04:00:00Z');
const at = Date.parse('2026-10-08T01:00:00Z');
const mf = new Miniflare({
  modules: true,
  script: 'export default {fetch(){return new Response("ok")}}',
  d1Databases: { DB: 'acquisition-test' },
  compatibilityDate: '2026-09-18',
});
try {
  const db = await mf.getD1Database('DB');
  for (const file of readdirSync('packages/product-analytics/migrations').sort())
    for (const sql of readFileSync(`packages/product-analytics/migrations/${file}`, 'utf8')
      .split(';')
      .filter((sql) => sql.trim()))
      await db.prepare(sql).run();
  await db
    .prepare(
      'CREATE TABLE deployment_attempts(flow_id TEXT PRIMARY KEY,status TEXT,client_channel TEXT,started_at TEXT,finished_at TEXT)'
    )
    .run();
  await db
    .prepare("INSERT INTO analytics_settings VALUES ('acquisition_registration_start', ?)")
    .bind('2026-10-03T00:00:00Z')
    .run();
  const add = async (
    name: string,
    session: string,
    source: string,
    time: number,
    options: {
      visitor?: string;
      admin?: number;
      channel?: string;
      medium?: string;
      dimension?: string;
      page?: string;
    } = {}
  ) => {
    await db
      .prepare(
        'INSERT INTO product_events (id,name,at,received_at,visitor_id,session_id,page,dimension,device,referrer,signed_in,is_admin,source,client_channel,utm_medium) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
      )
      .bind(
        crypto.randomUUID(),
        name,
        time,
        time,
        options.visitor || session,
        session,
        options.page || 'home',
        options.dimension || null,
        'desktop',
        source,
        0,
        options.admin || 0,
        name === 'signup_success' ? 'server' : 'browser',
        options.channel || 'web',
        options.medium || null
      )
      .run();
  };
  await add('page_view', 'search-a', 'search', at, { visitor: 'same-browser' });
  await add('page_view', 'search-a', 'direct', at + 1, { page: 'guide', visitor: 'same-browser' });
  await add('signup_success', 'search-a', 'search', at + 2, { dimension: 'email' });
  await add('signup_success', 'search-a', 'search', at + 3, { dimension: 'google' });
  await add('page_view', 'search-b', 'search', at + 86400000, {
    visitor: 'same-browser',
    page: 'guide',
  });
  await add('login_success', 'search-b', 'search', at + 86400001);
  await add('page_view', 'ai-a', 'ai', at, { page: 'guide' });
  await add('signup_success', 'ai-a', 'ai', at + 1, { dimension: 'github' });
  await add('signup_success', 'wrong-order', 'ai', at - 1, { dimension: 'google' });
  await add('page_view', 'wrong-order', 'ai', at);
  await add('page_view', 'history', 'search', at);
  await add('signup_success', 'history', 'search', at + 1); // old ambiguous definition is excluded
  for (const [session, source, options] of [
    ['paid', 'search', { medium: 'cpc' }],
    ['admin', 'search', { admin: 1 }],
    ['cli', 'ai', { channel: 'cli' }],
    ['desktop', 'search', { channel: 'desktop' }],
    ['direct', 'direct', {}],
  ] as const) {
    await add('page_view', session, source, at, options);
    await add('signup_success', session, source, at + 1, { ...options, dimension: 'email' });
  }
  await add('page_view', 'late-source', 'direct', at);
  await add('page_view', 'late-source', 'search', at + 1);
  await add('page_view', 'today', 'search', Date.parse('2026-10-10T01:00:00Z'));
  const report = await queryAcquisition(db, 7, now);
  assert.deepEqual(
    report.summary.map((r) => [r.visitors, r.sessions, r.registeredSessions, r.registrations]),
    [
      [2, 3, 1, 2],
      [2, 2, 1, 1],
    ]
  );
  assert.equal(report.summary[0].conversionRate, 1 / 3);
  assert.equal(report.today.sources[0].sessions, 1, 'today is separate');
  assert.equal(report.daily.length, 7);
  assert.equal(report.daily[0].sources[0].conversionRate, null);
  assert.ok(report.landings.some((row) => row.page === 'guide' && row.source === 'search'));
  assert.ok(report.rowsRead < report.reservedReads, 'actual D1 rows fit the reservation');
  const retained = await queryAcquisition(db, 30, now);
  assert.equal(retained.period.partial, true);
  assert.equal(retained.daily[0].available, false);
  await assert.rejects(queryAcquisition(db, 90, now));
  await db
    .prepare("DELETE FROM analytics_settings WHERE key='acquisition_registration_start'")
    .run();
  const unconfigured = await queryAcquisition(db, 7, now);
  assert.equal(unconfigured.registrationTrackingSince, null);
  assert.equal(unconfigured.today.registrationsAvailable, false);
  assert.equal(unconfigured.summary[0].eligibleSessions, 0);
  assert.equal(unconfigured.summary[0].registeredSessions, 0);
  assert.equal(unconfigured.summary[0].conversionRate, null);
  await db.prepare('DELETE FROM product_events').run();
  const empty = await queryAcquisition(db, 7, now);
  assert.equal(empty.summary[0].conversionRate, null);
  assert.equal(empty.landings.length, 0);
  // Representative upper-bound mix: every entry is eligible and converts,
  // with repeated page views, forcing the indexed session join and each grouping.
  await db
    .prepare("INSERT INTO analytics_settings VALUES ('acquisition_registration_start', ?)")
    .bind('2026-10-03T00:00:00Z')
    .run();
  for (let i = 0; i < 200; i++) {
    const session = `scale-${i}`;
    const source = i % 2 ? 'ai' : 'search';
    await add('page_view', session, source, at, { visitor: `browser-${i % 80}` });
    await add('page_view', session, source, at + 1, { page: 'guide' });
    await add('signup_success', session, source, at + 2, { dimension: 'email' });
  }
  const readBucket = `reads:${new Date(now).toISOString().slice(0, 10)}`;
  const readUsed = async () =>
    (await db
      .prepare('SELECT count FROM product_event_limits WHERE bucket=?')
      .bind(readBucket)
      .first<{ count: number }>())!.count;
  const beforeScale = await readUsed();
  const scale = await queryAcquisition(db, 30, now);
  const scaleCharge = (await readUsed()) - beforeScale;
  assert.ok(
    scaleCharge >= scale.rowsRead && scaleCharge < scale.reservedReads,
    'successful report charges measured reads with headroom, not the gross estimate'
  );
  assert.deepEqual(
    scale.summary.map((row) => row.registeredSessions),
    [100, 100]
  );
  assert.ok(
    scale.rowsRead < 600 * 48 + 1000,
    'two fully converting passes fit the query reservation'
  );
  console.log('Representative D1 read amplification:', scale.rowsRead, 'rows / 600 events');
  console.log(
    'Budget settlement:',
    JSON.stringify({ grossReservation: scale.reservedReads, charged: scaleCharge })
  );
  // A rejected aggregate must charge completed preflight work, not its entire estimate.
  for (let i = 200; i < 400; i++) {
    const session = `budget-${i}`;
    await add('page_view', session, 'search', at);
    await add('page_view', session, 'search', at + 1, { page: 'guide' });
    await add('signup_success', session, 'search', at + 2, { dimension: 'email' });
  }
  const bucket = `reads:${new Date(now).toISOString().slice(0, 10)}`;
  const initialUsed = 1000000 - 40100;
  await db
    .prepare('UPDATE product_event_limits SET count=? WHERE bucket=?')
    .bind(initialUsed, bucket)
    .run();
  await assert.rejects(queryAcquisition(db, 7, now), /预算/);
  const afterRejected = await db
    .prepare('SELECT count FROM product_event_limits WHERE bucket=?')
    .bind(bucket)
    .first<{ count: number }>();
  assert.ok(afterRejected!.count > initialUsed, 'completed preflight is still charged');
  assert.ok(afterRejected!.count - initialUsed < 40100, 'unused preflight estimate is released');
  console.log(
    'Rejected report preflight charge:',
    afterRejected!.count - initialUsed,
    '/ 40100 reserved'
  );
  await assert.rejects(queryAcquisition(db, 7, now), /预算/);
  const afterRetry = await db
    .prepare('SELECT count FROM product_event_limits WHERE bucket=?')
    .bind(bucket)
    .first<{ count: number }>();
  assert.equal(afterRetry!.count, afterRejected!.count, 'denied preflight performs no scan');
  const concurrentBucket = 'reads:2099-10-01';
  const reservations = await Promise.all([
    reserveReads(db, concurrentBucket, 600000),
    reserveReads(db, concurrentBucket, 600000),
  ]);
  assert.equal(reservations.filter(Boolean).length, 1, 'concurrent reservations obey shared cap');
  const reservation = reservations.find(Boolean)!;
  const used = async (key: string) =>
    (await db
      .prepare('SELECT count FROM product_event_limits WHERE bucket=?')
      .bind(key)
      .first<{ count: number }>())!.count;
  await Promise.all([reservation.settle(150), reservation.settle(150)]);
  assert.equal(await used(concurrentBucket), 250, 'completed reads plus management allowance');
  await reservation.settle(0);
  assert.equal(await used(concurrentBucket), 250, 'cannot refund another reservation twice');
  const unknown = (await reserveReads(db, concurrentBucket, 1000))!;
  await unknown.settle(NaN);
  assert.equal(await used(concurrentBucket), 1250, 'unknown usage retains reservation');
  await reserveReads(db, 'reads:2099-10-02', 1000);
  assert.equal(await used(concurrentBucket), 1250, 'fixed day bucket remains isolated');
  await assert.rejects(reserveReads(db, 'events:2099-10-01', 1000), /Invalid/);
  await assert.rejects(reserveReads(db, concurrentBucket, -1), /Invalid/);
  assert.match(readBudgetMessage(now), /2026-10-11 08:00（北京时间）/);
  console.log(
    'PASS acquisition: strict source domains, paid exclusion, AI parser, guide redaction; real D1 cohort order, multiple registrations, duplicate browser dedup, excluded admin/CLI/direct/history, UTC/today, retention gaps, zero denominator and reserved reads'
  );
} finally {
  await mf.dispose();
}

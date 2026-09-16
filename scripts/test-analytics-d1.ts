import { storeTelemetry } from '../workers/api/src/analytics';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { collect, reserve } from '../packages/product-analytics/src/budget';
import { cleanupAnalytics, parseFilter } from '../packages/product-analytics/src/repository';
import { querySqlReport } from '../packages/product-analytics/src/sql-report';
import type { EventBatch } from '../packages/product-analytics/src/contract';
const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare } = wranglerRequire('miniflare');
const mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("ok")}}', d1Databases: { DB: 'analytics-test' }, compatibilityDate: '2025-11-20' });
try {
  const db = await mf.getD1Database('DB');
  for (const sql of readFileSync('packages/product-analytics/migrations/0001.sql', 'utf8').split(';').filter(s => s.trim())) await db.prepare(sql).run();
  const decisions = await Promise.all(Array.from({ length: 20 }, () => reserve(db, 'race', 10, 50)));
  assert.equal(decisions.filter(Boolean).length, 5, 'atomic limit under concurrent submissions');
  const batch: EventBatch = { visitorId: crypto.randomUUID(), sessionId: crypto.randomUUID(), device: 'desktop', referrer: 'direct', events: [{ id: crypto.randomUUID(), name: 'page_view', at: Date.now(), page: 'home' }] };
  await collect(db, batch, { signedIn: false, admin: false }, 'piggyback');
  await collect(db, batch, { signedIn: false, admin: false }, 'piggyback');
  assert.equal((await db.prepare('SELECT COUNT(*) count FROM product_events').first()).count, 1, 'retry deduplication');
  for (const path of ['/api/v1/projects', '/api/v1/projects/draft']) {
    await storeTelemetry(new Request('https://gemigo.io' + path, { method: 'POST' }), new Response(null, { status: 201 }), { PROJECTS_DB: db, ANALYTICS_DB: db }, { ...batch, events: [] });
  }
  assert.equal((await db.prepare("SELECT COUNT(*) count FROM product_events WHERE name='project_created' AND source='server'").first()).count, 2, 'both creation routes emit server-confirmed outcomes');
  await db.prepare("DELETE FROM product_events WHERE name='project_created'").run();
  await db.prepare("INSERT INTO analytics_settings VALUES ('collection', ?)").bind(JSON.stringify({ enabled: false, dailyEvents: 100 })).run();
  await collect(db, { ...batch, events: [{ ...batch.events[0], id: crypto.randomUUID() }] }, { signedIn: false, admin: false }, 'standalone');
  assert.equal((await db.prepare('SELECT COUNT(*) count FROM product_events').first()).count, 1, 'disable switch');
  const report = await querySqlReport(db, parseFilter(new URL('https://admin.test')));
  assert.equal(report.summary.events, 1); assert.equal(report.summary.pageViews, 1); assert.equal(report.daily.length, 1); assert.equal(report.features.find(f => f.name === 'page_view')?.events, 1);
  assert.equal(report.features.find(f => f.name === 'deployment_success')?.events, 0);
  const series = Array.from({ length: 1000 }, (_, i) => ({ ...batch.events[0], id: crypto.randomUUID(), name: ['page_view','project_create_click','project_created','deployment_start','deployment_success'][i % 5], at: Date.now() - 10000 + i }));
  for (let i = 0; i < series.length; i += 20) await db.batch(series.slice(i, i + 20).map(e => db.prepare('INSERT INTO product_events SELECT ?,?, ?,received_at,visitor_id,session_id,page,dimension,duration_ms,?,device,referrer,signed_in,is_admin,source FROM product_events LIMIT 1').bind(e.id,e.name,e.at,batch.sessionId)));
  const large = await querySqlReport(db, parseFilter(new URL('https://admin.test')));
  assert.equal(large.summary.events, 1001);
  assert.ok(large.rowsRead < large.reservedReads, 'read reservation exceeds measured D1 scan cost');
  console.log('1,001 event report rows read / reserved:', large.rowsRead, large.reservedReads);
  await db.prepare('UPDATE product_events SET at=?').bind(Date.now() - 31 * 86400000).run();
  await cleanupAnalytics(db);
  assert.equal((await db.prepare('SELECT COUNT(*) count FROM product_events').first()).count, 0, '30-day retention');
  console.log('PASS real D1: atomic quota races, duplicate suppression, disable switch, SQL report data, zero features, retention. Report rows read:', report.rowsRead);
} finally { await mf.dispose(); }

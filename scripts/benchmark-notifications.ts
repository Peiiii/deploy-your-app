import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ensureNotificationSchema } from '../packages/notifications/src/persistence';
import { authRepository } from '../workers/api/src/repositories/auth.repository';
import { projectRepository } from '../workers/api/src/repositories/project.repository';
import { commentRepository } from '../workers/api/src/repositories/comment.repository';
import { communityRepository } from '../workers/api/src/repositories/community.repository';
import { listNotifications } from '../workers/api/src/notifications/repository';
const runtime = createRequire(createRequire(import.meta.url).resolve('wrangler/package.json'));
const { Miniflare } = runtime('miniflare');
const persist = await mkdtemp(join(tmpdir(), 'gemigo-notification-benchmark-'));
let mf = new Miniflare({
  modules: true,
  script: 'export default {fetch(){return new Response("ok")}}',
  d1Databases: { DB: 'notification-performance' },
  d1Persist: persist,
});
try {
  let db = (await mf.getD1Database('DB')) as D1Database;
  await authRepository.createUser(db, { id: 'target', email: 'benchmark@example.invalid' });
  await projectRepository.createProjectRecord(db, {
    id: 'benchmark',
    name: 'Benchmark',
    ownerId: 'target',
    status: 'Live',
    isPublic: true,
    framework: 'Unknown',
    sourceType: 'html',
    repoUrl: '',
    lastDeployed: new Date().toISOString(),
    url: 'https://example.invalid',
  });
  await Promise.all([
    ensureNotificationSchema(db),
    commentRepository.ensureSchema(db),
    communityRepository.ensureSchema(db),
  ]);
  const now = Date.now();
  // Populate the isolated local SQLite fixture directly; measure every read through D1.
  await mf.dispose();
  await promisify(execFile)(
    'python3',
    [
      '-c',
      `
import pathlib,sqlite3,sys
for file in pathlib.Path(sys.argv[1]).rglob('*.sqlite'):
 c=sqlite3.connect(file,timeout=30)
 if c.execute("SELECT name FROM sqlite_master WHERE name='notifications'").fetchone():
  c.execute("WITH RECURSIVE counter(x) AS (SELECT 0 UNION ALL SELECT x+1 FROM counter WHERE x<999999) INSERT INTO notifications(event_key,recipient_id,actor_id,kind,subject_id,group_key,priority,attention_eligible,created_at) SELECT 'benchmark:'||x,CASE WHEN x<10000 THEN 'target' ELSE 'background:'||(x%1000) END,'actor:'||(x%100),'follow','author:'||(x%100),'follow:'||(x%100),'light',1,? FROM counter",(int(sys.argv[2]),))
  c.commit()
  break
 else: c.close()
else: raise RuntimeError('Fixture SQLite database not found')
`,
      persist,
      String(now),
    ],
    { timeout: 120000 }
  );
  mf = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("ok")}}',
    d1Databases: { DB: 'notification-performance' },
    d1Persist: persist,
  });
  db = (await mf.getD1Database('DB')) as D1Database;
  const samples: number[] = [];
  for (let i = 0; i < 21; i++) {
    const start = performance.now();
    const page = await listNotifications(db, 'target');
    samples.push(performance.now() - start);
    assert.equal(page.items.length, 30);
    assert.equal(page.ordinary, 100);
    assert.ok(page.cursor);
    assert.ok(page.items.every((item) => item.count === 100));
  }
  const warm = samples.slice(1).sort((a, b) => a - b);
  const p95 = warm[Math.ceil(warm.length * 0.95) - 1];
  const result = {
    environment: 'Local Miniflare D1 SQLite; SQL query and serialization, without WAN',
    totalRows: 1_000_000,
    userRows: 10_000,
    groups: 100,
    pageSize: 30,
    samples: samples.length,
    coldMs: Math.round(samples[0]),
    warmMedianMs: Math.round(warm[10]),
    warmP95Ms: Math.round(p95),
    limitMs: 500,
  };
  await writeFile(
    'docs/logs/2026-10-13-engagement-notifications/evidence/performance.json',
    JSON.stringify(result, null, 2) + '\n'
  );
  console.log(JSON.stringify(result));
  assert.ok(p95 <= 500, 'representative first-page p95 <=500ms');
} finally {
  await mf.dispose();
  await rm(persist, { recursive: true, force: true });
}

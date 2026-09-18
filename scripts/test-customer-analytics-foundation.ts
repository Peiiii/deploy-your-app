import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { projectRepository } from '../workers/api/src/repositories/project.repository';
import { deploymentRepository } from '../workers/api/src/repositories/deployment.repository';
import { analyticsRepository } from '../workers/api/src/repositories/analytics.repository';
import { maintenanceService } from '../workers/admin/src/maintenance';
import { SourceType } from '../workers/api/src/types/project';

const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare } = wranglerRequire('miniflare');
const mf = new Miniflare({
  modules: true,
  script: 'export default {fetch(){return new Response("ok")}}',
  d1Databases: { DB: 'customer-analytics-test' },
  compatibilityDate: '2026-09-18',
});

try {
  const db = await mf.getD1Database('DB');
  for (const file of readdirSync('packages/product-analytics/migrations').sort()) {
    for (const sql of readFileSync(`packages/product-analytics/migrations/${file}`, 'utf8')
      .split(';')
      .filter((statement) => statement.trim())) {
      await db.prepare(sql).run();
    }
  }
  const now = new Date().toISOString();
  const project = await projectRepository.createProjectRecord(db, {
    id: 'project-1', ownerId: 'owner-1', name: 'Analytics Test', repoUrl: 'draft:project-1',
    sourceType: SourceType.Html, lastDeployed: now, status: 'Offline', framework: 'Unknown',
  });
  assert.equal(project.createdAt, now);
  assert.equal(project.lastSuccessAt, undefined);

  const attemptId = crypto.randomUUID();
  const flowId = crypto.randomUUID();
  await deploymentRepository.createAttempt(db, {
    id: attemptId, projectId: project.id, ownerId: 'owner-1', flowId,
    sourceType: SourceType.Html, clientChannel: 'web', payloadBytes: 128, startedAt: now,
  });
  await deploymentRepository.markAccepted(db, attemptId, 'provider-1', now);
  await deploymentRepository.finishAttempt(db, attemptId, 'succeeded', now, 4200);
  const attempt = await db.prepare('SELECT * FROM deployment_attempts WHERE id=?').bind(attemptId).first();
  assert.equal(attempt?.status, 'succeeded');
  assert.equal(attempt?.source_type, 'html');

  const signal = {
    isBot: false, visitorHash: 'a'.repeat(64), sessionHash: 'b'.repeat(64),
    dedupeKey: 'c'.repeat(64), userAgentFamily: 'chrome', clientChannel: 'web',
  };
  assert.equal(await analyticsRepository.recordPageView(db, 'analytics-test', new Date(), signal), true);
  assert.equal(await analyticsRepository.recordPageView(db, 'analytics-test', new Date(), signal), false);
  await analyticsRepository.recordPageView(db, 'analytics-test', new Date(), {
    ...signal, isBot: true, dedupeKey: 'd'.repeat(64),
  });
  const stats = await db.prepare(
    "SELECT raw_views,human_views,bot_views,unique_visitors,sessions FROM project_daily_stats WHERE slug='analytics-test'",
  ).first();
  assert.deepEqual(stats, { raw_views: 2, human_views: 1, bot_views: 1, unique_visitors: 1, sessions: 1 });

  const stale = new Date(Date.now() - 2 * 86400000).toISOString();
  await db.prepare("UPDATE projects SET status='Building',updated_at=? WHERE id=?").bind(stale, project.id).run();
  const staleAttempt = crypto.randomUUID();
  await deploymentRepository.createAttempt(db, {
    id: staleAttempt, projectId: project.id, ownerId: 'owner-1', sourceType: SourceType.Zip,
    clientChannel: 'web', startedAt: stale,
  });
  await maintenanceService.runDaily(db);
  assert.equal((await db.prepare('SELECT status FROM projects WHERE id=?').bind(project.id).first())?.status, 'Failed');
  assert.equal((await db.prepare('SELECT status FROM deployment_attempts WHERE id=?').bind(staleAttempt).first())?.status, 'failed');
  console.log('PASS deployment history, project timestamps, deduped human/bot traffic, stale build cleanup');
} finally {
  await mf.dispose();
}


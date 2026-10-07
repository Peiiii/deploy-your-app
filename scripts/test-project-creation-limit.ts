import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { authRepository } from '../workers/api/src/repositories/auth.repository';
import { projectRepository } from '../workers/api/src/repositories/project.repository';
import { ProjectCountLimitError } from '../workers/api/src/utils/error-handler';
import { FREE_PROJECT_LIMIT } from '../workers/api/src/utils/project-creation-limit';

const require = createRequire(import.meta.url);
const { ProjectCreationLimitError, throwProjectRequestError } = require('../frontend/src/services/project-request-error.ts') as typeof import('../frontend/src/services/project-request-error');
const { ProjectAddressError } = require('../frontend/src/services/project-address.ts') as typeof import('../frontend/src/services/project-address');
const runtime = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare } = runtime('miniflare');
const { build } = runtime('esbuild');
const bundle = await build({
  entryPoints: ['workers/api/src/index.ts'], bundle: true, write: false,
  format: 'esm', platform: 'browser',
});
const options = {
  modules: [{ type: 'ESModule', path: 'project-limit-test.js', contents: bundle.outputFiles[0].text }],
  d1Databases: { PROJECTS_DB: 'project-limit-test' },
  bindings: { DEPLOY_TARGET: 'r2', APPS_ROOT_DOMAIN: 'gemigo.app' },
  durableObjects: { APP_GATEWAY: { className: 'AppGateway', useSQLite: true } },
  r2Buckets: ['ASSETS'], compatibilityDate: '2026-09-18',
  outboundService: async () => {
    throw new Error('Unexpected external request');
  },
};
const mf = new Miniflare(options);

try {
  let db = await mf.getD1Database('PROJECTS_DB');
  await db.exec(readFileSync('workers/api/migrations/0007_app_api_gateway.sql', 'utf8').replace(/\n/g, ' '));
  const owner = await authRepository.createUser(db, { id: crypto.randomUUID() });
  const other = await authRepository.createUser(db, { id: crypto.randomUUID() });
  const session = await authRepository.createSession(db, owner.id);
  const otherSession = await authRepository.createSession(db, other.id);
  const call = (pathname: string, body: unknown, sessionId = session.id, method = 'POST') =>
    mf.dispatchFetch(`https://gemigo.test/api/v1${pathname}`, {
      method, headers: { Cookie: `session_id=${sessionId}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  const create = (ownerId: string, slug = `limit-${crypto.randomUUID()}`) =>
    projectRepository.createProjectRecord(db, {
      id: crypto.randomUUID(), ownerId, slug, name: slug, repoUrl: 'draft:test',
      framework: 'Unknown', lastDeployed: new Date().toISOString(), status: 'Offline',
      isPublic: false,
    });
  const count = async (ownerId: string) => (await db.prepare(
    'SELECT COUNT(*) AS count FROM projects WHERE owner_id = ?'
  ).bind(ownerId).first<{ count: number }>())!.count;

  // True HTTP authentication: a supplied ownerId never changes the quota owner.
  const first = await call('/projects/draft', { name: 'Quota QA', slug: 'quota-qa', ownerId: other.id });
  assert.equal(first.status, 200);
  const project = await first.json() as { id: string; slug: string; ownerId: string };
  assert.equal(project.ownerId, owner.id);
  assert.equal(await count(other.id), 0);
  await projectRepository.getAllProjects(db); // initialize host-side repository on this same D1

  const conflicting = await call('/projects/draft', { slug: project.slug });
  assert.equal(conflicting.status, 409);
  assert.equal((await conflicting.json()).code, 'ADDRESS_TAKEN');
  assert.equal(await count(owner.id), 1, 'failed creation does not consume quota');

  // Bypass the early service check to prove that the write itself enforces quota.
  for (let i = 0; i < FREE_PROJECT_LIMIT - 3; i++) await create(owner.id);
  const concurrent = await Promise.allSettled(Array.from({ length: 12 }, () => create(owner.id)));
  assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 2);
  for (const result of concurrent) if (result.status === 'rejected') {
    assert.ok(result.reason instanceof ProjectCountLimitError);
  }
  assert.equal(await count(owner.id), FREE_PROJECT_LIMIT);
  await db.prepare("UPDATE projects SET is_public = 0, created_at = '2020-01-01T00:00:00.000Z' WHERE owner_id = ?").bind(owner.id).run();

  for (const [pathname, body] of [
    ['/projects/draft', { slug: 'excess-draft' }],
    ['/projects', { name: 'Excess classic', identifier: 'html:test', sourceType: 'html', clientChannel: 'cli' }],
  ] as const) {
    const response = await call(pathname, body);
    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload.code, 'PROJECT_COUNT_LIMIT');
    assert.equal(payload.limit, FREE_PROJECT_LIMIT);
    assert.equal(payload.upgradeRequired, true);
    assert.equal(payload.resetAt, undefined);
    assert.match(payload.error, /update existing apps/);
    await assert.rejects(throwProjectRequestError(Response.json(payload, { status: 403 }), 'fallback'),
      (error: unknown) => error instanceof ProjectCreationLimitError && error.limit === FREE_PROJECT_LIMIT);
  }
  const updated = await call(`/projects/${project.id}`, { name: 'Still updatable', isPublic: false }, session.id, 'PATCH');
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).id, project.id);
  assert.equal(await count(owner.id), FREE_PROJECT_LIMIT);

  // Independent owner gets a classic creation, then HTTP parallel drafts fill exactly its remaining slots.
  const classic = await call('/projects', { name: 'Other owner', identifier: 'html:test', sourceType: 'html' }, otherSession.id);
  assert.equal(classic.status, 200);
  const httpParallel = await Promise.all(Array.from({ length: FREE_PROJECT_LIMIT + 4 }, (_, i) =>
    call('/projects/draft', { slug: `other-${i}` }, otherSession.id)));
  assert.equal(httpParallel.filter(response => response.status === 200).length, FREE_PROJECT_LIMIT - 1);
  for (const response of httpParallel) if (response.status !== 200) {
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, 'PROJECT_COUNT_LIMIT');
  }
  assert.equal(await count(other.id), FREE_PROJECT_LIMIT);

  // Soft-deleted apps do not consume current slots; restored historical accounts may exceed 100.
  const archived = await db.prepare('SELECT id FROM projects WHERE owner_id = ? AND id != ? LIMIT 1').bind(owner.id, project.id).first<{ id: string }>();
  await db.prepare('UPDATE projects SET is_deleted = 1 WHERE id = ?').bind(archived!.id).run();
  const replacement = await call('/projects/draft', { slug: 'replacement' });
  assert.equal(replacement.status, 200);
  await db.prepare('UPDATE projects SET is_deleted = 0 WHERE id = ?').bind(archived!.id).run();
  assert.equal(await count(owner.id), FREE_PROJECT_LIMIT + 1);
  assert.equal((await call(`/projects/${project.id}`, { name: 'Grandfathered' }, session.id, 'PATCH')).status, 200);
  assert.equal((await call('/projects/draft', { slug: 'over-existing-limit' })).status, 403);

  // Actual authenticated deletion restores exactly one slot and allows the old address to be reused.
  const extraId = (await replacement.json() as { id: string }).id;
  const remove = (id: string) => mf.dispatchFetch(`https://gemigo.test/api/v1/projects/${id}`, { method: 'DELETE', headers: { Cookie: `session_id=${session.id}`, Connection: 'close' } });
  await mf.setOptions({ ...options, r2Buckets: [] });
  db = await mf.getD1Database('PROJECTS_DB');
  const pending = await remove(extraId);
  assert.equal(pending.status, 503);
  assert.equal((await pending.json()).code, 'STORAGE_DELETE_PENDING');
  assert.equal((await db.prepare('SELECT storage_deletion_pending FROM projects WHERE id = ?').bind(extraId).first<{ storage_deletion_pending: number }>() )?.storage_deletion_pending, 1);
  const blockedPatch = await call(`/projects/${extraId}`, { slug: 'must-not-change-during-cleanup' }, session.id, 'PATCH');
  assert.equal(blockedPatch.status, 404);
  await blockedPatch.text();
  assert.equal(await count(owner.id), FREE_PROJECT_LIMIT + 1);
  await mf.setOptions(options);
  db = await mf.getD1Database('PROJECTS_DB');
  assert.equal((await remove(extraId)).status, 204);
  assert.equal((await call('/projects/draft', { slug: 'still-full' })).status, 403);
  assert.equal((await remove(project.id)).status, 204);
  assert.equal((await call('/projects/draft', { slug: project.slug })).status, 200);
  assert.equal(await count(owner.id), FREE_PROJECT_LIMIT);
  await assert.rejects(throwProjectRequestError(Response.json({ code: 'ADDRESS_TAKEN' }, { status: 409 }), 'fallback'), ProjectAddressError);
  console.log('PASS: 200 current apps; atomic parallel repository and HTTP creates; authentication; private/draft/old rows; soft deletion; grandfathered updates; delete/recreate; typed free-plan errors.');
} finally {
  await mf.dispose();
}

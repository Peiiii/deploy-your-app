import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { authRepository } from '../workers/api/src/repositories/auth.repository';
import { projectRepository } from '../workers/api/src/repositories/project.repository';
import { DailyProjectLimitError } from '../workers/api/src/utils/error-handler';
import { DAILY_PROJECT_LIMIT, projectCreationWindow } from '../workers/api/src/utils/project-creation-limit';

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
const mf = new Miniflare({
  modules: true, script: bundle.outputFiles[0].text,
  d1Databases: { PROJECTS_DB: 'project-limit-test' },
  bindings: { DEPLOY_TARGET: 'r2', APPS_ROOT_DOMAIN: 'gemigo.app' },
  r2Buckets: ['ASSETS'], compatibilityDate: '2026-09-18',
  outboundService: () => { throw new Error('Unexpected external request'); },
});

try {
  const db = await mf.getD1Database('PROJECTS_DB');
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
  for (let i = 0; i < DAILY_PROJECT_LIMIT - 3; i++) await create(owner.id);
  const concurrent = await Promise.allSettled(Array.from({ length: 12 }, () => create(owner.id)));
  assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 2);
  for (const result of concurrent) if (result.status === 'rejected') {
    assert.ok(result.reason instanceof DailyProjectLimitError);
  }
  assert.equal(await count(owner.id), DAILY_PROJECT_LIMIT);
  await db.prepare('UPDATE projects SET is_deleted = 1, is_public = 0 WHERE owner_id = ? AND id != ?')
    .bind(owner.id, project.id).run();

  for (const [pathname, body] of [
    ['/projects/draft', { slug: 'excess-draft' }],
    ['/projects', { name: 'Excess classic', identifier: 'html:test', sourceType: 'html', clientChannel: 'cli' }],
  ] as const) {
    const response = await call(pathname, body);
    assert.equal(response.status, 429);
    const payload = await response.json();
    assert.equal(payload.code, 'DAILY_PROJECT_LIMIT');
    assert.equal(payload.limit, DAILY_PROJECT_LIMIT);
    assert.equal(payload.resetAt, projectCreationWindow().resetAt);
    assert.match(payload.error, /update existing apps/);
    await assert.rejects(throwProjectRequestError(Response.json(payload, { status: 429 }), 'fallback'),
      (error: unknown) => error instanceof ProjectCreationLimitError && error.limit === DAILY_PROJECT_LIMIT);
  }
  const updated = await call(`/projects/${project.id}`, { name: 'Still updatable', isPublic: false }, session.id, 'PATCH');
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).id, project.id);
  assert.equal(await count(owner.id), DAILY_PROJECT_LIMIT);

  // Independent owner gets a classic creation, then HTTP parallel drafts fill exactly its remaining slots.
  const classic = await call('/projects', { name: 'Other owner', identifier: 'html:test', sourceType: 'html' }, otherSession.id);
  assert.equal(classic.status, 200);
  const httpParallel = await Promise.all(Array.from({ length: 24 }, (_, i) =>
    call('/projects/draft', { slug: `other-${i}` }, otherSession.id)));
  assert.equal(httpParallel.filter(response => response.status === 200).length, DAILY_PROJECT_LIMIT - 1);
  for (const response of httpParallel) if (response.status !== 200) {
    assert.equal(response.status, 429);
    assert.equal((await response.json()).code, 'DAILY_PROJECT_LIMIT');
  }
  assert.equal(await count(other.id), DAILY_PROJECT_LIMIT);

  // One millisecond before/at Beijing midnight belongs to distinct quota windows.
  const before = projectCreationWindow(new Date('2026-10-03T15:59:59.999Z'));
  const after = projectCreationWindow(new Date('2026-10-03T16:00:00.000Z'));
  assert.equal(before.startAt, '2026-10-02T16:00:00.000Z');
  assert.equal(before.resetAt, after.startAt);
  assert.equal(after.resetAt, '2026-10-04T16:00:00.000Z');
  await projectRepository.assertProjectCreationAllowed(db, owner.id, after);
  const today = projectCreationWindow();
  // Actual stored timestamp boundaries: previous-day rows no longer consume today's allowance.
  await db.prepare('UPDATE projects SET created_at = ? WHERE owner_id = ?')
    .bind(new Date(Date.parse(today.startAt) - 1).toISOString(), owner.id).run();
  await projectRepository.assertProjectCreationAllowed(db, owner.id, today);
  const nextDay = await call('/projects/draft', { slug: 'fresh-day' });
  assert.equal(nextDay.status, 200);
  assert.equal(await count(owner.id), DAILY_PROJECT_LIMIT + 1);
  await db.prepare('UPDATE projects SET created_at = ? WHERE owner_id = ? AND id != ?')
    .bind(today.startAt, owner.id, project.id).run();
  const midnightIncluded = await call('/projects/draft', { slug: 'midnight-full' });
  assert.equal(midnightIncluded.status, 429, 'exact start of day is included');
  await assert.rejects(throwProjectRequestError(Response.json({ code: 'ADDRESS_TAKEN' }, { status: 409 }), 'fallback'), ProjectAddressError);
  console.log('PASS: atomic parallel writes and HTTP creates; 20/day; authentication; soft-delete/private; reset boundaries; failure does not count; existing update; typed frontend errors.');
} finally {
  await mf.dispose();
}

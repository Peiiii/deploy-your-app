import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { authRepository } from '../workers/api/src/repositories/auth.repository';
import { communityRepository } from '../workers/api/src/repositories/community.repository';
import { projectRepository } from '../workers/api/src/repositories/project.repository';
import { passwordHash } from '../workers/admin/src/auth';
const runtime = createRequire(createRequire(import.meta.url).resolve('wrangler/package.json'));
const { Miniflare } = runtime('miniflare'),
  { build } = runtime('esbuild');
const bundles = await Promise.all(
  ['api', 'admin'].map((name) =>
    build({
      entryPoints: ['workers/' + name + '/src/index.ts'],
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'browser',
      external: ['cloudflare:workers'],
    })
  )
);
const password = 'isolated-console-test-only',
  salt = 'isolated-salt';
const mf = new Miniflare({
  workers: [
    {
      name: 'api',
      modules: [{ type: 'ESModule', path: 'api.mjs', contents: bundles[0].outputFiles[0].text }],
      compatibilityDate: '2026-09-18',
      d1Databases: { PROJECTS_DB: 'same-notification-database' },
    },
    {
      name: 'admin',
      modules: [{ type: 'ESModule', path: 'admin.mjs', contents: bundles[1].outputFiles[0].text }],
      compatibilityDate: '2026-09-18',
      d1Databases: { ANALYTICS_DB: 'same-notification-database' },
      bindings: {
        ADMIN_USERNAME: 'console-test',
        ADMIN_PASSWORD_HASH: salt + ':' + (await passwordHash(password, salt)),
      },
    },
  ],
});
try {
  const db = (await mf.getD1Database('PROJECTS_DB', 'api')) as D1Database;
  await authRepository.createUser(db, { id: 'reader', email: 'console-test@example.invalid' });
  const session = await authRepository.createSession(db, 'reader');
  await projectRepository.createProjectRecord(db, {
    id: 'unused',
    name: 'Unused',
    ownerId: 'reader',
    status: 'Failed',
    isPublic: false,
    framework: 'Unknown',
    sourceType: 'html',
    repoUrl: '',
    lastDeployed: new Date().toISOString(),
  });
  await communityRepository.createPost(db, {
    id: 'private-feedback',
    userId: 'reader',
    title: 'Private title',
    content: 'Private original',
    category: 'idea',
  });
  for (const file of [
    'workers/admin/migrations/0001_admin_console.sql',
    'packages/product-analytics/migrations/0001.sql',
  ])
    await db.batch(
      (await readFile(file, 'utf8'))
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => db.prepare(s))
    );
  const admin = await mf.getWorker('admin'),
    api = await mf.getWorker('api');
  const request = async (path: string, body: unknown, cookie = '') =>
    admin.fetch('https://admin.example.invalid' + path, {
      method: 'POST',
      headers: {
        origin: 'https://admin.example.invalid',
        'Content-Type': 'application/json',
        cookie,
      },
      body: JSON.stringify(body),
    });
  assert.equal(
    (
      await request('/api/feedback/manage', {
        id: 'private-feedback',
        action: 'reply',
        content: 'denied',
      })
    ).status,
    401
  );
  const login = await request('/api/login', { username: 'console-test', password });
  assert.equal(login.status, 200, await login.text());
  const cookie = login.headers.get('set-cookie')!.split(';')[0];
  const replyId = crypto.randomUUID();
  for (let i = 0; i < 2; i++) {
    const result = await request(
      '/api/feedback/manage',
      {
        id: 'private-feedback',
        action: 'reply',
        replyId,
        content: 'Saved from the actual console HTTP route',
      },
      cookie
    );
    assert.equal(result.status, 200, await result.text());
  }
  const status = await request(
    '/api/feedback/manage',
    { id: 'private-feedback', action: 'status', expected: 'open', status: 'planned' },
    cookie
  );
  assert.equal(status.status, 200, await status.text());
  const page = await api.fetch('https://api.example.invalid/api/v1/notifications', {
    headers: { cookie: 'session_id=' + session.id },
  });
  assert.equal(page.status, 200);
  const inbox = (await page.json()) as { items: { groupKey: string; count: number }[] };
  assert.equal(inbox.items[0].groupKey, 'feedback:private-feedback');
  assert.equal(inbox.items[0].count, 2);
  const detail = await api.fetch(
    'https://api.example.invalid/api/v1/me/feedback/private-feedback',
    { headers: { cookie: 'session_id=' + session.id } }
  );
  const context = (await detail.json()) as {
    comments: { content: string }[];
    post: { status: string };
  };
  assert.equal(context.post.status, 'planned');
  assert.equal(context.comments.length, 1);
  // Console visibility is a publication owner too: first exposure is recorded once,
  // and hiding the source atomically revokes its pending interactions.
  await projectRepository.updateProjectDeploymentRecord(db, 'unused', {
    status: 'Live',
    url: 'https://unused.example.invalid',
  });
  const expose = await request(
    '/api/manage',
    { action: 'visibility', id: 'unused', expected: false, isPublic: true },
    cookie
  );
  assert.equal(expose.status, 200, await expose.text());
  const publication = await db
    .prepare('SELECT author_id,baseline FROM first_publications WHERE project_id=?')
    .bind('unused')
    .first<{ author_id: string; baseline: number }>();
  assert.deepEqual(publication, { author_id: 'reader', baseline: 0 });
  await db
    .prepare(
      "INSERT INTO notifications(event_key,recipient_id,actor_id,kind,subject_id,group_key,priority,attention_eligible,created_at) VALUES('hide-test','other','reader','like','unused','likes:unused','light',1,?)"
    )
    .bind(Date.now())
    .run();
  const hide = await request(
    '/api/manage',
    { action: 'visibility', id: 'unused', expected: true, isPublic: false },
    cookie
  );
  assert.equal(hide.status, 200, await hide.text());
  assert.ok(
    (
      await db
        .prepare("SELECT revoked_at FROM notifications WHERE event_key='hide-test'")
        .first<{ revoked_at: number }>()
    )?.revoked_at
  );
  console.log(
    'PASS: two independently bundled Workers share actual D1; console login, unauthorized denial, stable reply replay and status reach the private main-app inbox/context over HTTP'
  );
} finally {
  await mf.dispose();
}

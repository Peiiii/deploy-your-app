import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';

const require = createRequire(realpathSync(new URL('../workers/api/node_modules/wrangler/package.json', import.meta.url)));
const { Miniflare } = require('miniflare');
const { build } = require('esbuild');
const built = await build({ entryPoints: ['workers/api/src/index.ts'], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
const mf = new Miniflare({ modules: true, script: built.outputFiles[0].text, compatibilityDate: '2026-09-18', d1Databases: ['PROJECTS_DB'], bindings: { APPS_ROOT_DOMAIN: 'gemigo.app', DEPLOY_TARGET: 'r2' } });
let cookie = '';
async function request(path, method = 'GET', body, authenticated = true) {
  return mf.dispatchFetch(`https://gemigo.test/api/v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(authenticated && cookie ? { Cookie: cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function json(response, expectedStatus = 200) {
  const body = await response.json();
  assert.equal(response.status, expectedStatus, JSON.stringify(body));
  return body;
}
try {
  for (const slug of ['Uppercase', '中文', '-app', 'app-', 'a'.repeat(64)]) {
    const result = await json(await request(`/projects/address-availability?slug=${encodeURIComponent(slug)}`), 400);
    assert.equal(result.code, 'INVALID_ADDRESS');
  }
  const initial = await request('/projects/address-availability?slug=travel-journal');
  assert.equal(initial.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await json(initial), { available: true, domain: 'gemigo.app' });
  const signup = await request('/auth/email/signup', 'POST', { email: 'address-qa@example.com', password: 'Passw0rd!' });
  await json(signup);
  cookie = signup.headers.get('set-cookie').split(';')[0];
  const draft = await json(await request('/projects/draft', 'POST', { name: '旅行账本', slug: 'travel-journal' }));
  assert.equal(draft.name, '旅行账本');
  assert.equal(draft.slug, 'travel-journal');
  assert.deepEqual(await json(await request('/projects/address-availability?slug=travel-journal')), { available: false, domain: 'gemigo.app', suggestion: 'travel-journal-1' });
  assert.equal((await json(await request(`/projects/address-availability?slug=travel-journal&projectId=${draft.id}`))).available, true);
  await json(await request(`/projects/address-availability?slug=travel-journal&projectId=${draft.id}`, 'GET', undefined, false), 401);
  const conflict = await json(await request('/projects/draft', 'POST', { name: 'Another', slug: 'travel-journal' }), 409);
  assert.equal(conflict.code, 'ADDRESS_TAKEN');
  const renamed = await json(await request(`/projects/${draft.id}`, 'PATCH', { name: '新名称' }));
  assert.equal(renamed.slug, draft.slug);
  assert.equal(renamed.name, '新名称');
  const legacy = await json(await request('/projects/draft', 'POST', { name: 'Travel Journal' }));
  assert.equal(legacy.slug, 'travel-journal-1', 'Older draft callers remain supported');
  assert.equal((await json(await request(`/projects/${legacy.id}`, 'PATCH', { slug: 'travel-journal' }), 409)).code, 'ADDRESS_TAKEN');
  assert.equal((await json(await request(`/projects/${legacy.id}`, 'PATCH', { slug: '中文' }), 400)).code, 'INVALID_ADDRESS');
  const moved = await json(await request(`/projects/${legacy.id}`, 'PATCH', { slug: 'before-first-publication' }));
  assert.equal(moved.slug, 'before-first-publication');
  const concurrent = await Promise.all([1, 2].map((i) => request('/projects/draft', 'POST', { name: `Concurrent ${i}`, slug: 'concurrent-address' })));
  assert.deepEqual(concurrent.map((response) => response.status).sort(), [200, 409], 'Exactly one concurrent writer owns an address');
  const database = await mf.getD1Database('PROJECTS_DB');
  const row = await database.prepare("SELECT COUNT(*) AS count FROM projects WHERE slug='concurrent-address'").first();
  assert.equal(row.count, 1);
  // These two projects read the same available candidate before an atomic update.
  const simultaneous = await Promise.all([draft, legacy].map((project) => request(`/projects/${project.id}`, 'PATCH', { slug: 'concurrent-update' })));
  assert.deepEqual(simultaneous.map((response) => response.status).sort(), [200, 409]);
  const published = await json(await request('/projects/draft', 'POST', { name: 'Published app', slug: 'published-address' }));
  await database.prepare("UPDATE projects SET status='Live',url=?,last_success_at=? WHERE id=?").bind('https://published-address.gemigo.app/', new Date().toISOString(), published.id).run();
  const afterRename = await json(await request(`/projects/${published.id}`, 'PATCH', { name: '随时改名' }));
  assert.equal(afterRename.url, 'https://published-address.gemigo.app/');
  assert.equal(afterRename.slug, 'published-address');
  assert.equal((await json(await request(`/projects/${published.id}`, 'PATCH', { slug: 'changed-address' }), 400)).code, 'ADDRESS_LOCKED');
  console.log('PASS: assembled Worker/D1 HTTP address validation, exact draft address, legacy compatibility, availability/auth, name independence, concurrent create/update conflicts and published address protection.');
} finally {
  await mf.dispose();
}

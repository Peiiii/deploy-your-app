import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';

const require = createRequire(realpathSync(new URL('../workers/api/node_modules/wrangler/package.json', import.meta.url)));
const { Miniflare } = require('miniflare');
const { build } = require('esbuild');
const built = await build({ entryPoints: ['workers/api/src/index.ts'], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
let aiContent = '{"slug":"travel-journal"}', aiStatus = 200;
const aiBodies = [];
const mf = new Miniflare({ outboundService: async (request) => {
  assert.equal(new URL(request.url).pathname, '/chat/completions');
  const body = await request.json(); aiBodies.push(body);
  return new Response(JSON.stringify({ choices: [{ message: { content: aiContent } }] }), { status: aiStatus, headers: { 'Content-Type': 'application/json' } });
}, modules: true, script: built.outputFiles[0].text, compatibilityDate: '2026-09-18', d1Databases: ['PROJECTS_DB'], bindings: { DASHSCOPE_API_KEY: 'local-test-placeholder', PLATFORM_AI_BASE_URL: 'https://model.test', APPS_ROOT_DOMAIN: 'gemigo.app', DEPLOY_TARGET: 'r2' } });
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
  await json(await request('/projects/address-suggestion', 'POST', { name: '旅行账本' }, false), 401);
  for (const name of ['', 'x'.repeat(81)]) await json(await request('/projects/address-suggestion', 'POST', { name }), 400);
  assert.equal(aiBodies.length, 0, 'Validate authentication and input before paying for AI');
  const generatedResponse = await request('/projects/address-suggestion', 'POST', { name: '旅行账本' });
  assert.equal(generatedResponse.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await json(generatedResponse), { slug: 'travel-journal-1', domain: 'gemigo.app' }, 'AI suggestion checks collisions without creating a project');
  assert.deepEqual(JSON.parse(aiBodies[0].messages[1].content), { name: '旅行账本' });
  assert.equal(aiBodies[0].enable_thinking, false);
  assert.equal(aiBodies[0].max_tokens, 100);
  assert.equal((await json(await request('/projects/address-suggestion', 'POST', { name: '旅行账本', projectId: draft.id }))).slug, 'travel-journal');
  for (const content of ['not json', '{"slug":"Uppercase"}', '{"slug":"-broken"}', '{"name":"No address"}']) {
    aiContent = content;
    assert.equal((await json(await request('/projects/address-suggestion', 'POST', { name: '旅行账本' }), 503)).code, 'ADDRESS_GENERATION_FAILED');
  }
  aiStatus = 502;
  await json(await request('/projects/address-suggestion', 'POST', { name: '旅行账本' }), 503);
  aiStatus = 200; aiContent = '{"slug":"travel-journal"}';
  console.log('PASS: real Worker/D1 + standard AI HTTP boundary: auth/input validation, name-only prompt, collision suggestion, owner exclusion and upstream/invalid-output errors.');
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
  await database.prepare(`WITH RECURSIVE n(value) AS (SELECT 0 UNION ALL SELECT value+1 FROM n WHERE value<1000)
    INSERT INTO projects (id,name,repo_url,slug,last_deployed,status,is_deleted)
    SELECT 'busy-'||value,'Busy','fixture',CASE WHEN value=0 THEN 'busy' ELSE 'busy-'||value END,'2026-10-03','Draft',0 FROM n`).run();
  const start = performance.now();
  assert.deepEqual(await json(await request('/projects/address-availability?slug=busy')), { available: false, domain: 'gemigo.app', suggestion: 'busy-1001' });
  assert.ok(performance.now()-start < 2000, '1000 collisions must complete without serial D1 calls');
  await database.prepare("UPDATE projects SET is_deleted=1 WHERE slug='busy-42'").run();
  assert.equal((await json(await request('/projects/address-availability?slug=busy'))).suggestion, 'busy-42', 'Reuse the first numeric gap');
  await database.prepare("UPDATE projects SET slug='busy-1-extra' WHERE slug='busy-1'").run();
  assert.equal((await json(await request('/projects/address-availability?slug=busy'))).suggestion, 'busy-1', 'Only exact numeric candidates occupy a suffix');
  const longSlug = 'a'.repeat(56) + '-longer';
  await json(await request('/projects/draft', 'POST', { name: 'Long', slug: longSlug }));
  const longResult = await json(await request(`/projects/address-availability?slug=${longSlug}`));
  assert.equal(longResult.suggestion, 'a'.repeat(56), 'Trim trailing separator after shortening suggestion base');
  console.log('PASS: 1000 occupied addresses, first free numeric gap, deleted/non-numeric variants and 63-character suggestions.');
  console.log('PASS: assembled Worker/D1 HTTP address validation, exact draft address, legacy compatibility, availability/auth, name independence, concurrent create/update conflicts and published address protection.');
} finally {
  await mf.dispose();
}

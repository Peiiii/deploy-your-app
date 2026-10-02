import assert from 'node:assert/strict';
import gatewayModule from '../workers/r2-gateway/worker';

const gateway = gatewayModule.default;
const releaseA = 'apps/demo/releases/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const releaseB = 'apps/demo/releases/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const objects = new Map<string, string>([
  ['apps/demo/deployment.json', JSON.stringify({ prefix: releaseA })],
  [`${releaseA}/index.html`, '<h1>A</h1>'],
  [`${releaseA}/main.js`, 'A script'],
  [`${releaseA}/old.js`, 'previous asset'],
  [`${releaseB}/index.html`, '<h1>B</h1>'],
  [`${releaseB}/main.js`, 'B script'],
  ['apps/legacy/current/index.html', '<h1>legacy A</h1>'],
  ['apps/other/current/index.html', '<h1>other</h1>'],
  ['apps/legacy/current/releases/mutable.js', 'mutable A'],
]);
let now = 0;
let reads: string[] = [];
let failRead = false;
let failWrite = false;
const cached = new Map<string, { bytes: ArrayBuffer; headers: Headers; expires: number }>();
const originalCaches = globalThis.caches;
Object.defineProperty(globalThis, 'caches', { configurable: true, value: { default: {
  async match(request: Request) {
    if (failRead) throw new Error('cache unavailable');
    const entry = cached.get(request.url);
    return entry && entry.expires > now ? new Response(entry.bytes.slice(0), { headers: entry.headers }) : undefined;
  },
  async put(request: Request, response: Response) {
    if (failWrite) throw new Error('cache unavailable');
    assert.equal(request.method, 'GET');
    const ttl = Number(/max-age=(\d+)/.exec(response.headers.get('cache-control') ?? '')?.[1]);
    assert.ok(ttl > 0);
    cached.set(request.url, { bytes: await response.arrayBuffer(), headers: new Headers(response.headers), expires: now + ttl * 1000 });
  },
} } });
const env = { APPS_ROOT_DOMAIN: 'gemigo.app', ASSETS: {
  async get(key: string) {
    reads.push(key);
    const text = objects.get(key);
    return text === undefined ? null : {
      body: new Response(text).body,
      httpEtag: `"${text}"`,
      writeHttpMetadata(headers: Headers) {
        headers.set('content-type', key.endsWith('.html') ? 'text/html' : 'application/javascript');
        headers.set('cache-control', 'public, max-age=31536000, immutable');
      },
    };
  },
} };
const pending: Promise<unknown>[] = [];
const ctx = { waitUntil(promise: Promise<unknown>) { pending.push(promise); } };
async function request(path = '/', headers: Record<string, string> = {}, method = 'GET', slug = 'demo') {
  const response = await gateway.fetch(new Request(`https://${slug}.gemigo.app${path}`, { method, headers }), env as never, ctx as never);
  // Consume the response before awaiting cache writes (the real Worker streams concurrently).
  const body = await response.text();
  await Promise.all(pending.splice(0));
  return { response, body };
}
try {
  assert.equal((await request()).body, '<h1>A</h1>');
  assert.equal(reads.length, 2);
  reads = [];
  const hot = await request('/?utm_source=anything');
  assert.equal(hot.body, '<h1>A</h1>');
  assert.equal(hot.response.headers.get('x-gemigo-cache'), 'HIT');
  assert.equal(hot.response.headers.get('x-gemigo-deployment-cache'), 'HIT');
  assert.equal(hot.response.headers.get('cache-control'), 'no-cache');
  assert.equal(reads.length, 0, 'a fully warm request reads no R2 objects');
  const etag = hot.response.headers.get('etag')!;
  for (const condition of [etag, `W/${etag}`, `"unrelated", W/${etag}`, '*']) {
    const result = await request('/', { 'if-none-match': condition });
    assert.equal(result.response.status, 304);
    assert.equal(result.body, '');
    assert.equal(result.response.headers.has('content-length'), false);
  }
  assert.equal((await request('/', { 'if-none-match': '"different"' })).response.status, 200);
  const head = await request('/', {}, 'HEAD');
  assert.equal(head.body, '');
  assert.equal(head.response.headers.get('etag'), etag);
  assert.equal(reads.length, 0);
  assert.equal((await request('/route')).body, '<h1>A</h1>');
  assert.equal((await request('/', {}, 'GET', 'other')).body, '<h1>other</h1>');
  reads = [];
  for (const path of ['/.env', '/%2eenv', '/nested/.env.local', '/.git/config', '/node_modules/a.js', '/.npmrc']) {
    assert.equal((await request(path)).response.status, 404);
  }
  assert.equal(reads.length, 0, 'private paths are rejected before all storage/cache lookups');

  objects.set('apps/demo/deployment.json', JSON.stringify({ prefix: releaseB, previousPrefix: releaseA }));
  assert.equal((await request()).body, '<h1>A</h1>');
  now += 5001;
  const updated = await request('/', { 'if-none-match': etag });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body, '<h1>B</h1>', 'the new pointer is chosen before conditional validation');
  assert.equal((await request('/main.js')).body, 'B script');
  assert.equal((await request('/old.js')).body, 'previous asset');
  assert.equal((await request('/nested/path')).body, '<h1>B</h1>');
  objects.set('apps/demo/deployment.json', JSON.stringify({ prefix: releaseA, previousPrefix: releaseB }));
  now += 5001;
  assert.equal((await request()).body, '<h1>A</h1>', 'rollback selects the original version cache');

  assert.equal((await request('/', {}, 'GET', 'legacy')).body, '<h1>legacy A</h1>');
  await request('/releases/mutable.js', {}, 'GET', 'legacy');
  objects.set('apps/legacy/current/index.html', '<h1>legacy B</h1>');
  objects.set('apps/legacy/current/releases/mutable.js', 'mutable B');
  now += 5001;
  assert.equal((await request('/', {}, 'GET', 'legacy')).body, '<h1>legacy B</h1>');
  assert.equal((await request('/releases/mutable.js', {}, 'GET', 'legacy')).body, 'mutable B');
  objects.set('apps/legacy/deployment.json', JSON.stringify({ prefix: 'apps/legacy/releases/cccccccc-cccc-cccc-cccc-cccccccccccc' }));
  objects.set('apps/legacy/releases/cccccccc-cccc-cccc-cccc-cccccccccccc/index.html', 'first versioned release');
  now += 5001;
  assert.equal((await request('/', {}, 'GET', 'legacy')).body, 'first versioned release');

  objects.set(`${releaseA}/index.html`, 'forced refresh');
  assert.equal((await request('/', { 'cache-control': 'no-cache' })).body, 'forced refresh');
  const cacheSize = cached.size;
  reads = [];
  const noStore = await request('/main.js', { 'cache-control': 'no-store' });
  assert.equal(noStore.response.headers.get('x-gemigo-cache'), 'BYPASS');
  assert.equal(reads.length, 2);
  assert.equal(cached.size, cacheSize);
  assert.equal((await request('/', {}, 'POST')).response.headers.get('x-gemigo-cache'), 'BYPASS');

  for (const pointer of ['bad json', JSON.stringify({ prefix: 'apps/other/current' }), 'null']) {
    objects.set('apps/broken/deployment.json', pointer);
    assert.equal((await request('/', {}, 'GET', 'broken')).response.status, 503);
  }
  assert.equal((await request('/', {}, 'GET', 'missing')).response.status, 404);
  objects.set('apps/missing/current/index.html', 'now published');
  assert.equal((await request('/', {}, 'GET', 'missing')).body, 'now published', 'missing objects are not negatively cached');
  const originalError = console.error;
  let cacheErrors = 0;
  console.error = () => { cacheErrors += 1; };
  try {
    failRead = failWrite = true;
    assert.equal((await request()).body, 'forced refresh');
    assert.equal(cacheErrors, 4, 'cache failures fall back to storage and never break delivery');
  } finally { console.error = originalError; }
  console.log('PASS: hot R2 reads 2→0, tenant isolation, private paths, 304/HEAD, SPA/previous assets, release/rollback/legacy freshness, force refresh, no-store, malformed pointer and cache failure');
} finally {
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: originalCaches });
}

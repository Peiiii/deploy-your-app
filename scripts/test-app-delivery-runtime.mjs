import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { realpathSync, readFileSync } from 'node:fs';
const require = createRequire(realpathSync(new URL('../workers/r2-gateway/node_modules/wrangler/package.json', import.meta.url)));
const { Miniflare } = require('miniflare');
const { build } = require('esbuild');
const assets = JSON.parse(readFileSync(new URL('../workers/r2-gateway/runtime-assets.json', import.meta.url)));
const built = await build({ entryPoints: ['workers/r2-gateway/worker.ts'], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
const mf = new Miniflare({ modules: true, script: built.outputFiles[0].text, compatibilityDate: '2026-09-18', r2Buckets: ['ASSETS'], bindings: { APPS_ROOT_DOMAIN: 'gemigo.app', ANALYTICS_ENABLED: 'false' } });
try {
  for (const method of ['GET', 'HEAD']) {
    for (const protocol of ['http', 'https']) {
      const response = await mf.dispatchFetch(`${protocol}://gemigo.app/unused/path?utm_source=app&next=https%3A%2F%2Fevil.example`, { method, redirect: 'manual' });
      assert.equal(response.status, 301);
      assert.equal(response.headers.get('location'), 'https://gemigo.io/?utm_source=app&next=https%3A%2F%2Fevil.example');
      assert.equal(response.headers.get('cache-control'), 'public, max-age=300');
      assert.equal(await response.text(), '');
    }
  }
  const apex = await mf.dispatchFetch('https://gemigo.app/', { redirect: 'manual' });
  assert.equal(apex.headers.get('location'), 'https://gemigo.io/');
  for (const host of ['www.gemigo.app', 'gemigo.app.evil.example', 'evilgemigo.app']) {
    const response = await mf.dispatchFetch(`https://${host}/`, { redirect: 'manual' });
    assert.equal(response.status, 404);
    assert.equal(response.headers.has('location'), false);
  }
  const bucket = await mf.getR2Bucket('ASSETS');
  const html = '<html><head><script defer crossorigin="anonymous" integrity="unchanged" src="https://cdn.tailwindcss.com"></script><script src="//cdn.tailwindcss.com/"></script><script src="https://cdn.tailwindcss.com?plugins=forms"></script><script src="https://cdn.tailwindcss.com/3.4.17"></script><script src="https://cdn.tailwindcss.com.evil.test"></script><script crossorigin="use-credentials" src="https://cdn.tailwindcss.com"></script></head><body>Source stays unchanged</body></html>';
  await bucket.put('apps/demo/current/index.html', html, { httpMetadata: { contentType: 'text/html' } });
  let response = await mf.dispatchFetch('https://demo.gemigo.app/');
  const transformed = await response.text();
  const mirrored = `https://assets.gemigo.app${assets.tailwind.path}`;
  assert.equal(transformed.split(mirrored).length - 1, 2);
  assert.ok(transformed.includes('defer crossorigin="anonymous" integrity="unchanged"'));
  assert.ok(transformed.includes('https://cdn.tailwindcss.com?plugins=forms'));
  assert.ok(transformed.includes('https://cdn.tailwindcss.com/3.4.17'));
  assert.ok(transformed.includes('https://cdn.tailwindcss.com.evil.test'));
  assert.ok(transformed.includes('crossorigin="use-credentials" src="https://cdn.tailwindcss.com"'));
  assert.equal(await (await bucket.get('apps/demo/current/index.html')).text(), html);
  assert.ok(response.headers.get('etag').startsWith('W/'));
  assert.equal(response.headers.has('content-length'), false);
  const validator = response.headers.get('etag');
  response = await mf.dispatchFetch('https://demo.gemigo.app/', { headers: { 'if-none-match': validator } });
  assert.equal(response.status, 304);
  assert.equal(await response.text(), '');
  const csp = '<html><head><meta http-equiv="Content-Security-Policy" content="script-src https://cdn.tailwindcss.com"><script src="https://cdn.tailwindcss.com"></script></head></html>';
  await bucket.put('apps/csp/current/index.html', csp, { httpMetadata: { contentType: 'text/html' } });
  assert.equal(await (await mf.dispatchFetch('https://csp.gemigo.app/')).text(), csp);
  await bucket.put(assets.tailwind.key, 'window.tailwind={};', { httpMetadata: { contentType: 'application/javascript' } });
  response = await mf.dispatchFetch(mirrored);
  assert.equal(await response.text(), 'window.tailwind={};');
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.ok(response.headers.get('cache-control').includes('immutable'));
  const etag = response.headers.get('etag');
  response = await mf.dispatchFetch(mirrored, { headers: { 'if-none-match': etag } });
  assert.equal(response.status, 304);
  assert.equal(await response.text(), '');
  response = await mf.dispatchFetch(mirrored, { method: 'HEAD' });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '');
  response = await mf.dispatchFetch(mirrored, { headers: { 'cache-control': 'no-store' } });
  assert.equal(response.headers.get('x-gemigo-cache'), 'BYPASS');
  assert.equal(await response.text(), 'window.tailwind={};');
  assert.equal((await mf.dispatchFetch('https://other.gemigo.app'+assets.tailwind.path)).status,404);
  console.log('PASS real Worker runtime: exact apex HTTP/HTTPS 301/GET/HEAD/query/fixed target and subdomain isolation; HTMLRewriter, unchanged R2 source, ETag, runtime CORS/cache/304/HEAD');
} finally { await mf.dispose(); }

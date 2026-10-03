import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { realpathSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';

// Set PLAYWRIGHT_MODULE and CHROME_EXECUTABLE when using the desktop bundled runtime.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const require = createRequire(realpathSync(new URL('../workers/r2-gateway/node_modules/wrangler/package.json', import.meta.url)));
const { Miniflare } = require('miniflare');
const { build } = require('esbuild');
const built = await build({ entryPoints: ['workers/r2-gateway/worker.ts'], bundle: true,
  write: false, format: 'esm', platform: 'browser', target: 'es2022' });
const mf = new Miniflare({ modules: true, script: built.outputFiles[0].text,
  compatibilityDate: '2026-09-18', r2Buckets: ['ASSETS'],
  bindings: { APPS_ROOT_DOMAIN: 'gemigo.test', ANALYTICS_ENABLED: 'false' } });
const profile = mkdtempSync(path.join(tmpdir(), 'gemigo-smart-favicon-test-'));
let context, externalBytes, delayedRuntimeSent = false;
const server = createServer(async (request, outgoing) => {
  try {
    if (request.headers.host.startsWith('images.')) {
      if (request.url === '/slow-logo') await new Promise(resolve => setTimeout(resolve, 4200));
      outgoing.writeHead(200, { 'content-type': 'application/octet-stream' }); outgoing.end(externalBytes); return;
    }
    if (request.headers.host.startsWith('async-runtime.') && request.url === '/__gemigo/favicon-runtime.v1.js') {
      await new Promise(resolve => setTimeout(resolve, 3500)); delayedRuntimeSent = true;
    }
    const response = await mf.dispatchFetch('http://' + request.headers.host + request.url, {
      method: request.method, headers: request.headers,
    });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) { outgoing.writeHead(500); outgoing.end(String(error)); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const origin = slug => 'http://' + slug + '.gemigo.test:' + port;

const html = body => '<!doctype html><html><head><title>Test App</title></head><body>' + body + '</body></html>';
const square = color => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="' + color + '"/></svg>';
const cases = [
  ['svg', html('<style>.brand svg { fill:rgb(231,76,60); width:32px; height:32px; }</style><nav class="brand"><svg viewBox="0 0 32 32"><path d="M0 0h32v32H0z"/></svg>Test App</nav>'), 'logo-svg'],
  ['external', html('<img width="64" height="64" alt="logo" src="' + origin('images') + '/logo">'), 'logo-image'],
  ['original', html('<img alt="logo" width="64" height="64" src="/logo.svg">').replace('</head>', '<link rel="shortcut ICON" href="/author.svg"></head>'), 'original'],
  ['root', html('<img alt="logo" width="64" height="64" src="/logo.svg">'), 'original-root'],
  ['broken', html('<img alt="logo" width="64" height="64" src="/logo.svg">').replace('</head>', '<link rel="icon" href="/missing.png"></head>'), 'logo-image'],
  ['broken-root', html('<img alt="logo" width="64" height="64" src="/logo.svg">').replace('</head>', '<link rel="icon" href="/favicon.ico"></head>'), 'logo-image'],
  ['nonstandard', html('').replace('</head>', '<link rel="favicon" href="/logo.svg"></head>'), 'recovered-icon'],
  ['manifest', html('').replace('</head>', '<link rel="manifest" href="/manifest.json"></head>'), 'manifest'],
  ['dynamic', html('<script>setTimeout(()=>{const e=document.createElement("img");e.alt="logo";e.width=e.height=64;e.src="/logo.svg";document.body.append(e)},400)</script>'), 'logo-image'],
  ['none', html('<button class="logo"><svg width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32"/></svg>Search</button><img class="logo" width="272" height="92" src="/wide.svg">'), 'name'],
  ['base', html('<img alt="logo" width="64" height="64" src="' + origin('base') + '/logo.svg">').replace('</head>', '<base href="http://other.test/"></head>'), 'logo-image'],
  ['text', html('<header><span class="logo" style="display:inline-block;width:40px;height:40px;color:red;background:navy">A</span></header>'), 'logo-text'],
  ['background', html('<div class="app-logo" style="width:64px;height:64px;background-image:url(/logo.svg)"></div>'), 'logo-background'],
  ['empty', html('<div class="logo" style="width:64px;height:64px"></div>'), 'name'],
  ['late', html('<script>setTimeout(()=>{const e=document.createElement("img");e.alt="logo";e.width=e.height=64;e.src="/logo.svg";document.body.append(e)},10500)</script>'), 'name'],
  ['blank', html('<svg class="brand" width="32" height="32" viewBox="0 0 32 32"></svg>'), 'name'],
  ['large-manifest', html('<img alt="logo" width="64" height="64" src="/logo.svg">').replace('</head>', '<link rel="manifest" href="/manifest.json"></head>'), 'logo-image'],
  ['slow-image', html('<img width="64" height="64" alt="logo" src="' + origin('images') + '/slow-logo">'), 'logo-image'],
  ['adjacent-brand', html('<nav><div><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="green" stroke-width="2"><path d="M12 19h8 M4 17l6-6-6-6"/></svg><span>Test App v2.5.0</span></div><div><svg width="12" height="12" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>SYSTEM NORMAL</div></nav>'), 'logo-svg'],
  ['async-runtime', html('<h1>App loaded</h1>'), 'name'],
];
try {
  const bucket = await mf.getR2Bucket('ASSETS');
  for (const [slug, source] of cases) {
    await bucket.put('apps/' + slug + '/current/index.html', source, { httpMetadata: { contentType: 'text/html' } });
    await bucket.put('apps/' + slug + '/current/logo.svg', square('#22c55e'), { httpMetadata: { contentType: 'image/svg+xml' } });
  }
  await bucket.put('apps/original/current/author.svg', square('#2563eb'), { httpMetadata: { contentType: 'image/svg+xml' } });
  await bucket.put('apps/root/current/favicon.ico', square('#2563eb'), { httpMetadata: { contentType: 'image/svg+xml' } });
  await bucket.put('apps/none/current/wide.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="272" height="92"><text y="70" font-size="70">Google</text></svg>', { httpMetadata: { contentType: 'image/svg+xml' } });
  await bucket.put('apps/manifest/current/manifest.json', JSON.stringify({ icons: [{ src: 'logo.svg' }] }), { httpMetadata: { contentType: 'application/json' } });
  await bucket.put('apps/large-manifest/current/manifest.json', JSON.stringify({ padding: 'x'.repeat(70000), icons: [{ src: 'logo.svg' }] }), { httpMetadata: { contentType: 'application/json' } });

  for (const method of ['GET', 'HEAD']) {
    const fallback = await mf.dispatchFetch('http://none.gemigo.test/favicon.ico', { method });
    assert.equal(fallback.status, 200);
    assert.ok(fallback.headers.get('content-type').startsWith('image/svg+xml'));
    assert.equal(fallback.headers.get('x-gemigo-favicon'), 'fallback');
    const body = await fallback.text();
    assert.ok(method === 'HEAD' ? !body : body.includes('<svg'));
  }
  assert.equal((await mf.dispatchFetch('http://unknown.gemigo.test/favicon.ico')).status, 404);
  const injection = await (await mf.dispatchFetch('http://base.gemigo.test/')).text();
  assert.ok(injection.includes('src="http://base.gemigo.test/__gemigo/favicon-runtime.v1.js"'));
  assert.ok(injection.includes('href="http://base.gemigo.test/__gemigo/favicon.svg?name=Test%20App"'));
  const csp = html('').replace('</head>', '<meta http-equiv="Content-Security-Policy" content="script-src \'none\'; img-src \'self\'"></head>');
  await bucket.put('apps/csp/current/index.html', csp, { httpMetadata: { contentType: 'text/html' } });
  assert.equal(await (await mf.dispatchFetch('http://csp.gemigo.test/')).text(), csp);
  const escaped = await (await mf.dispatchFetch('http://svg.gemigo.test/__gemigo/favicon.svg?name=%3C')).text();
  assert.ok(escaped.includes('&lt;'));
  const runtime = await mf.dispatchFetch('http://svg.gemigo.test/__gemigo/favicon-runtime.v1.js');
  assert.ok(runtime.headers.get('content-type').startsWith('application/javascript'));
  assert.equal((await mf.dispatchFetch('http://svg.gemigo.test/__gemigo/favicon-runtime.v1.js', { headers: { 'if-none-match': runtime.headers.get('etag') } })).status, 304);
  assert.equal(await (await mf.dispatchFetch('http://svg.gemigo.test/__gemigo/favicon-runtime.v1.js', { method: 'HEAD' })).text(), '');

  context = await chromium.launchPersistentContext(profile, {
    ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}), headless: true,
    args: ['--host-resolver-rules=MAP *.gemigo.test 127.0.0.1', '--no-proxy-server'],
  });
  const seedPage = await context.newPage();
  const png = await seedPage.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 32;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#f59e0b'; ctx.fillRect(0,0,32,32); return c.toDataURL(); });
  externalBytes = Buffer.from(png.split(',')[1], 'base64');
  await seedPage.close();
  const browserErrors = [];
  for (const [slug, source, expected] of cases) {
    const page = await context.newPage();
    page.on('pageerror', error => browserErrors.push({ slug, message: error.message }));
    await page.goto(origin(slug) + '/', { waitUntil: 'domcontentloaded' });
    if (slug === 'async-runtime') assert.equal(delayedRuntimeSent, false, 'the app reaches DOMContentLoaded before the delayed icon script response');
    await page.waitForFunction(mode => document.documentElement.dataset.gemigoFavicon === mode, expected, { timeout: 10000 });
    if (slug === 'svg') {
      const pixel = await page.evaluate(async () => {
        const image = new Image(); image.src = document.querySelector('link[data-gemigo-favicon]').href;
        await image.decode(); const c = document.createElement('canvas'); c.width = c.height = 64;
        const ctx = c.getContext('2d'); ctx.drawImage(image, 0, 0); return Array.from(ctx.getImageData(32,32,1,1).data);
      });
      assert.deepEqual(pixel, [231,76,60,255], 'computed CSS color survives SVG extraction');
    }
    if (slug === 'original') assert.equal(await page.locator('link[rel="shortcut ICON"]').getAttribute('href'), '/author.svg');
    if (slug === 'external') assert.equal(await page.locator('link[data-gemigo-favicon]').getAttribute('href'), origin('images') + '/logo');
    if (slug === 'late') {
      const href = await page.locator('link[data-gemigo-favicon]').getAttribute('href');
      await page.waitForTimeout(11000);
      assert.equal(await page.locator('link[data-gemigo-favicon]').getAttribute('href'), href, 'identification stops after ten seconds');
    }
    assert.equal(await (await bucket.get('apps/' + slug + '/current/index.html')).text(), source, 'customer source remains intact');
    // Chromium fetches/stores favicons asynchronously after the DOM link changes.
    await page.waitForTimeout(500);
    await page.close();
    console.log('PASS browser ' + slug + ': ' + expected);
  }

  const page = await context.newPage();
  await page.goto(origin('dynamic') + '/');
  await page.waitForFunction(() => document.documentElement.dataset.gemigoFavicon === 'logo-image');
  const old = await page.locator('link[data-gemigo-favicon]').getAttribute('href');
  const prefix = 'apps/dynamic/releases/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  await bucket.put(prefix + '/index.html', html('<img alt="logo" width="64" height="64" src="/new.svg">'), { httpMetadata: { contentType: 'text/html' } });
  await bucket.put(prefix + '/new.svg', square('#ef4444'), { httpMetadata: { contentType: 'image/svg+xml' } });
  await bucket.put('apps/dynamic/deployment.json', JSON.stringify({ prefix, previousPrefix: 'apps/dynamic/current' }));
  await page.waitForTimeout(5100);
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.gemigoFavicon === 'logo-image');
  assert.notEqual(await page.locator('link[data-gemigo-favicon]').getAttribute('href'), old, 'redeploy follows current page');
  await page.close();
  const rootPrefix = 'apps/root/releases/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  await bucket.put(rootPrefix + '/index.html', html('new release'), { httpMetadata: { contentType: 'text/html' } });
  await bucket.put('apps/root/deployment.json', JSON.stringify({ prefix: rootPrefix, previousPrefix: 'apps/root/current' }));
  const removedRoot = await mf.dispatchFetch('http://root.gemigo.test/favicon.ico', { headers: { 'cache-control': 'no-cache' } });
  assert.equal(removedRoot.headers.get('x-gemigo-favicon'), 'fallback', 'removed icons do not resurrect the previous release icon');
  assert.deepEqual(browserErrors, []);
  await context.close(); context = undefined;

  const count = Number(execFileSync('python3', ['-c',
    'import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); print(c.execute("select count(*) from favicon_bitmaps where length(image_data)>0").fetchone()[0])',
    path.join(profile, 'Default', 'Favicons')], { encoding: 'utf8' }).trim());
  assert.ok(count >= 12, 'Chrome actually registered decoded favicon bitmaps, not only DOM links');
  console.log('PASS real Worker HTTP contracts, CSP/source preservation, redeploy, bounded browser identification, Chrome stored ' + count + ' favicon bitmaps');
} finally {
  if (context) await context.close();
  await new Promise(resolve => server.close(resolve));
  await mf.dispose();
}

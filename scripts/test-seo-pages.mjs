import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { getSeo, renderSeoContent, renderSitemap, PUBLIC_PATHS } from '../frontend/seo.mjs';
const require = createRequire(import.meta.url);
const runtime = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare } = runtime('miniflare');
const { build } = runtime('esbuild');
const bundle = await build({
  entryPoints: ['frontend/dist/_worker.js'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
});
const index = readFileSync('frontend/dist/index.html', 'utf8');
const mf = new Miniflare({
  modules: true,
  script: bundle.outputFiles[0].text,
  compatibilityDate: '2026-09-18',
  bindings: { BACKEND_ORIGIN: 'https://backend.test' },
  serviceBindings: {
    ASSETS: async (request) => {
      const path = new URL(request.url).pathname;
      if (path === '/' || path === '/index.html')
        return new Response(index, {
          headers: { 'Content-Type': 'text/html', ETag: 'old-template' },
        });
      if (path === '/sitemap.xml')
        return new Response(readFileSync('frontend/dist/sitemap.xml'), {
          headers: { 'Content-Type': 'application/xml' },
        });
      if (path === '/llms.txt')
        return new Response(readFileSync('frontend/dist/llms.txt'), {
          headers: { 'Content-Type': 'text/plain' },
        });
      if (path === '/favicon.svg')
        return new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } });
      // Exercise explicit route fallback; an asset miss can also return the SPA HTML.
      return path.includes('.')
        ? new Response(index, { headers: { 'Content-Type': 'text/html' } })
        : new Response('not found', { status: 404 });
    },
  },
  outboundService: async (request) => {
    assert.equal(new URL(request.url).origin, 'https://backend.test');
    assert.equal(request.headers.get('x-forwarded-host'), 'gemigo.io');
    return new Response('data: event\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
  },
});
try {
  for (const path of PUBLIC_PATHS)
    for (const language of ['en', 'zh-CN']) {
      const url =
        'https://gemigo.io' +
        path +
        (language === 'zh-CN' ? '?lang=zh-CN&utm_source=test' : '?utm_source=test');
      const response = await mf.dispatchFetch(url);
      assert.equal(response.status, 200, url);
      const html = await response.text();
      const seo = getSeo(new URL(url));
      assert.equal((html.match(/<title\b/g) || []).length, 1, 'one route title');
      assert.equal((html.match(/rel="canonical"/g) || []).length, 1, 'one canonical');
      assert.match(html, new RegExp(`lang="${language}"`));
      assert.ok(html.includes(`href="${seo.canonical}"`));
      assert.ok(html.includes(renderSeoContent(seo)), 'same human-visible copy in original HTML');
      assert.equal((html.match(/<h1\b/g) || []).length, 1);
      assert.ok(!html.includes('aggregateRating') && !html.includes('og-image.png'));
      const json = html.match(/<script data-seo type="application\/ld\+json">([^<]+)<\/script>/)[1];
      assert.equal(JSON.parse(json)['@graph'][2].url, seo.canonical);
      assert.equal(
        response.headers.has('etag'),
        false,
        'rewritten response must not keep template ETag'
      );
    }
  for (const path of ['/dashboard', '/deploy', '/u/creator', '/app/public-work', '/privacy-policy', '/cli/login']) {
    const response = await mf.dispatchFetch('https://gemigo.io' + path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, follow');
    assert.ok(!(await response.text()).includes('From your content to a public link'));
  }
  for (const path of ['/missing-page', '/og-image.png'])
    assert.equal((await mf.dispatchFetch('https://gemigo.io' + path)).status, 404);
  const redirected = await mf.dispatchFetch('https://gemigo.io/explore/?lang=zh-CN', {
    redirect: 'manual',
  });
  assert.equal(redirected.status, 308);
  assert.equal(redirected.headers.get('location'), 'https://gemigo.io/explore?lang=zh-CN');
  const alias = await mf.dispatchFetch('https://gemigo.io/privacy', { redirect: 'manual' });
  assert.equal(alias.status, 308);
  const sitemap = await mf.dispatchFetch('https://gemigo.io/sitemap.xml');
  assert.equal(sitemap.headers.get('content-type'), 'application/xml');
  assert.equal(await sitemap.text(), renderSitemap());
  assert.equal((renderSitemap().match(/<loc>/g) || []).length, 10);
  assert.equal(
    (await mf.dispatchFetch('https://gemigo.io/llms.txt')).headers.get('content-type'),
    'text/plain'
  );
  assert.equal(
    (await mf.dispatchFetch('https://gemigo.io/favicon.svg')).headers.get('content-type'),
    'image/svg+xml'
  );
  const head = await mf.dispatchFetch('https://gemigo.io/about', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const stream = await mf.dispatchFetch('https://gemigo.io/api/v1/test?x=1');
  assert.equal(stream.headers.get('content-type'), 'text/event-stream');
  assert.equal(await stream.text(), 'data: event\n\n');
  console.log(
    'PASS Pages runtime: bilingual raw HTML, canonical/hreflang/schema, visible content, real sitemap/llms types, private noindex, 404, redirects, HEAD and streaming API proxy'
  );
} finally {
  await mf.dispose();
}

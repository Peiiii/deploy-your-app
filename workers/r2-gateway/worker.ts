import { addAppAnalytics, APP_ANALYTICS_SCRIPT, APP_ANALYTICS_BEACON, APP_ANALYTICS_RUNTIME } from './app-analytics';
import runtimeAssets from './runtime-assets.json';
import { addSmartFavicon, faviconFallback, SMART_FAVICON_FALLBACK_PATH, SMART_FAVICON_PATH, SMART_FAVICON_RUNTIME } from './smart-favicon';

type R2ObjectLike = {
  body: ReadableStream | null;
  httpMetadata?: {
    contentType?: string;
  };
  writeHttpMetadata?: (headers: Headers) => void;
  httpEtag?: string;
  // Actual R2 objects expose a `size` field; we include it here so we can
  // detect obviously-invalid thumbnails (e.g. tiny 1x1 placeholder PNGs).
  size?: number;
};

type R2PutOptionsLike = {
  httpMetadata?: {
    cacheControl?: string;
    contentType?: string;
  };
};

type R2BucketBinding = {
  get(key: string): Promise<R2ObjectLike | null>;
  put(
    key: string,
    value: ArrayBuffer | ReadableStream | Blob,
    options?: R2PutOptionsLike,
  ): Promise<R2ObjectLike | null>;
  delete(key: string): Promise<void>;
};

type Env = {
  APPS_ROOT_DOMAIN?: string;
  ASSETS: R2BucketBinding;
  // Optional analytics API endpoint (e.g. https://gemigo-api.../api/v1).
  // When configured, the gateway will POST page view events for each app.
  ANALYTICS_API_BASE_URL?: string;
  /** Emergency kill switch for page-view ingestion. Disabled unless explicitly true. */
  ANALYTICS_ENABLED?: string;
  /** Shared secret used for HMAC anonymization and API authentication. */
  ANALYTICS_INGEST_SECRET?: string;
};

const OPTIMIZED_THUMBNAIL_CACHE_CONTROL =
  'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800';
const LEGACY_THUMBNAIL_CACHE_CONTROL =
  'public, max-age=60, s-maxage=60, stale-while-revalidate=300';
const THUMBNAIL_PLACEHOLDER_CACHE_CONTROL = 'public, max-age=5, s-maxage=5';
const MAX_OPTIMIZED_THUMBNAIL_BYTES = 300 * 1024;
const CENTRAL_THUMBNAIL_HOST = 'assets';
const CENTRAL_THUMBNAIL_PATH = /^\/thumbnails\/([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\.webp$/;
const PLACEHOLDER_PALETTES = [
  ['#60a5fa', '#6366f1'],
  ['#34d399', '#06b6d4'],
  ['#fb923c', '#ec4899'],
  ['#c084fc', '#6366f1'],
  ['#f87171', '#f43f5e'],
  ['#22d3ee', '#3b82f6'],
] as const;

const createThumbnailResponse = (thumb: R2ObjectLike): Response => {
  const headers = new Headers();
  if (typeof thumb.writeHttpMetadata === 'function') {
    thumb.writeHttpMetadata(headers);
  }
  if (thumb.httpEtag) {
    headers.set('etag', thumb.httpEtag);
  }
  headers.set('cache-control', OPTIMIZED_THUMBNAIL_CACHE_CONTROL);
  headers.set('content-type', 'image/webp');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-gemigo-gateway', 'r2');
  headers.set('access-control-allow-origin', '*');
  if (typeof thumb.size === 'number') {
    headers.set('content-length', String(thumb.size));
  }
  return new Response(thumb.body, { headers });
};

const createLegacyThumbnailResponse = (thumb: R2ObjectLike): Response => {
  const headers = new Headers();
  if (typeof thumb.writeHttpMetadata === 'function') {
    thumb.writeHttpMetadata(headers);
  }
  if (thumb.httpEtag) {
    headers.set('etag', thumb.httpEtag);
  }
  headers.set('cache-control', LEGACY_THUMBNAIL_CACHE_CONTROL);
  headers.set('content-type', thumb.httpMetadata?.contentType ?? 'image/png');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-gemigo-gateway', 'r2');
  headers.set('x-gemigo-thumbnail', 'legacy');
  headers.set('access-control-allow-origin', '*');
  if (typeof thumb.size === 'number') {
    headers.set('content-length', String(thumb.size));
  }
  return new Response(thumb.body, { headers });
};

const escapeSvgText = (value: string): string => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

const hashPlaceholderSeed = (value: string): number => {
  let hash = 0;
  for (const character of value) {
    hash = character.codePointAt(0)! + ((hash << 5) - hash);
    hash |= 0;
  }
  return Math.abs(hash);
};

const getPlaceholderInitial = (name: string, slug: string): string => {
  const candidate = name.trim() || slug;
  const initial = Array.from(candidate.normalize('NFC'))[0] ?? '•';
  return initial.toLocaleUpperCase();
};

const createThumbnailPlaceholder = (slug: string, name: string, seed: string): Response => {
  const label = name.trim() || slug;
  const initial = getPlaceholderInitial(label, slug);
  const [startColor, endColor] = PLACEHOLDER_PALETTES[
    hashPlaceholderSeed(seed.trim() || label) % PLACEHOLDER_PALETTES.length
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" role="img" aria-label="${escapeSvgText(label)} preview"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${startColor}"/><stop offset="1" stop-color="${endColor}"/></linearGradient></defs><rect width="960" height="540" rx="28" fill="url(#g)"/><circle cx="780" cy="72" r="250" fill="#fff" opacity=".08"/><circle cx="125" cy="500" r="210" fill="#000" opacity=".05"/><text x="480" y="340" text-anchor="middle" font-family="ui-sans-serif,system-ui,-apple-system,'Noto Sans Thai',sans-serif" font-size="220" font-weight="900" fill="#fff" opacity=".52" transform="rotate(-12 480 270)">${escapeSvgText(initial)}</text></svg>`;
  return new Response(svg, {
    status: 200,
    headers: {
      'access-control-allow-origin': '*',
      'cache-control': THUMBNAIL_PLACEHOLDER_CACHE_CONTROL,
      'content-type': 'image/svg+xml; charset=utf-8',
      'x-content-type-options': 'nosniff',
      'x-gemigo-thumbnail': 'generating',
    },
  });
};

const serveCentralThumbnail = async (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  slug: string,
): Promise<Response> => {
  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const optimized = await env.ASSETS.get(`apps/${slug}/thumbnail.webp`);
  if (optimized) {
    const response = createThumbnailResponse(optimized);
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  }

  const legacy = await env.ASSETS.get(`apps/${slug}/thumbnail.png`);
  const hasUsableLegacyThumbnail = Boolean(
    legacy?.body
    && typeof legacy.size === 'number'
    && legacy.size > 80,
  );
  if (
    legacy?.body
    && legacy.httpMetadata?.contentType === 'image/webp'
    && typeof legacy.size === 'number'
    && legacy.size > 80
    && legacy.size <= MAX_OPTIMIZED_THUMBNAIL_BYTES
  ) {
    await env.ASSETS.put(`apps/${slug}/thumbnail.webp`, legacy.body, {
      httpMetadata: {
        cacheControl: OPTIMIZED_THUMBNAIL_CACHE_CONTROL,
        contentType: 'image/webp',
      },
    });
    const promoted = await env.ASSETS.get(`apps/${slug}/thumbnail.webp`);
    if (promoted) {
      const response = createThumbnailResponse(promoted);
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    }
  }

  if (legacy && hasUsableLegacyThumbnail) {
    return createLegacyThumbnailResponse(legacy);
  }

  return createThumbnailPlaceholder(
    slug,
    new URL(request.url).searchParams.get('name') ?? '',
    new URL(request.url).searchParams.get('seed') ?? slug,
  );
};

const checkCentralThumbnail = async (env: Env, slug: string): Promise<Response> => {
  const optimized = await env.ASSETS.get(`apps/${slug}/thumbnail.webp`);
  const legacy = optimized ? null : await env.ASSETS.get(`apps/${slug}/thumbnail.png`);
  const usableLegacy = legacy && typeof legacy.size === 'number' && legacy.size > 80;
  const ready = Boolean(optimized || usableLegacy);

  return new Response(null, {
    status: ready ? 200 : 202,
    headers: {
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
      'content-type': optimized
        ? 'image/webp'
        : usableLegacy ? (legacy.httpMetadata?.contentType ?? 'image/png') : 'image/svg+xml',
      'x-gemigo-thumbnail': optimized ? 'ready' : usableLegacy ? 'legacy' : 'generating',
    },
  });
};

// Public URLs can be reused by arbitrary uploads. Cache immutable release objects
// at the edge, but always validate browser copies against the active deployment.
const DEPLOYMENT_CACHE_SECONDS = 5;
const LEGACY_ASSET_CACHE_SECONDS = 5;
const RELEASE_ASSET_CACHE_SECONDS = 86400;
type DeploymentPointer = { prefix: string; previousPrefix?: string };
type CacheState = 'HIT' | 'MISS' | 'BYPASS';

const siteCacheKey = (url: URL, kind: string, key: string): Request =>
  new Request(`${url.origin}/__gemigo_cache/v1/${kind}/${encodeURIComponent(key)}`);

const readSiteCache = async (key: Request): Promise<Response | undefined> => {
  try {
    return await caches.default.match(key);
  } catch (error) {
    console.error('Site cache read failed', error);
    return undefined;
  }
};

const writeSiteCache = (ctx: ExecutionContext, key: Request, response: Response): void => {
  ctx.waitUntil(Promise.resolve().then(() => caches.default.put(key, response)).catch((error) => {
    console.error('Site cache write failed', error);
  }));
};

const resolveDeployment = async (
  url: URL, slug: string, bucket: R2BucketBinding, ctx: ExecutionContext,
  bypass: boolean, store: boolean,
): Promise<{ deployment: DeploymentPointer; state: CacheState } | null> => {
  const cacheKey = siteCacheKey(url, 'deployment', slug);
  const cached = bypass ? undefined : await readSiteCache(cacheKey);
  if (cached) return { deployment: await cached.json() as DeploymentPointer, state: 'HIT' };

  let deployment: DeploymentPointer = { prefix: `apps/${slug}/current` };
  const pointer = await bucket.get(`apps/${slug}/deployment.json`);
  if (pointer?.body) {
    try {
      const manifest = await new Response(pointer.body).json() as DeploymentPointer;
      const validPrefix = (value?: string): value is string => typeof value === 'string'
        && (value === `apps/${slug}/current`
          || (value.startsWith(`apps/${slug}/releases/`)
            && /^[a-f0-9-]{36}$/i.test(value.slice(`apps/${slug}/releases/`.length))));
      if (!validPrefix(manifest.prefix)) return null;
      deployment = { prefix: manifest.prefix };
      if (validPrefix(manifest.previousPrefix)) deployment.previousPrefix = manifest.previousPrefix;
    } catch {
      return null;
    }
  }
  if (store) writeSiteCache(ctx, cacheKey, Response.json(deployment, {
    headers: { 'cache-control': `public, max-age=${DEPLOYMENT_CACHE_SECONDS}` },
  }));
  return { deployment, state: bypass ? 'BYPASS' : 'MISS' };
};

const readSiteObject = async (
  url: URL, key: string, bucket: R2BucketBinding, ctx: ExecutionContext,
  bypass: boolean, store: boolean,
): Promise<{ response: Response; state: CacheState } | null> => {
  const cacheKey = siteCacheKey(url, 'object', key);
  const cached = bypass ? undefined : await readSiteCache(cacheKey);
  if (cached) return { response: cached, state: 'HIT' };
  const object = await bucket.get(key);
  if (!object) return null;
  const headers = new Headers();
  object.writeHttpMetadata?.(headers);
  if (object.httpEtag) headers.set('etag', object.httpEtag);
  if (!headers.has('content-type')) {
    headers.set('content-type', getContentTypeFromExt(key.split('.').pop()?.toLowerCase() ?? ''));
  }
  const ttl = key.startsWith('platform/runtime/') || /^apps\/[^/]+\/releases\//.test(key) ? RELEASE_ASSET_CACHE_SECONDS : LEGACY_ASSET_CACHE_SECONDS;
  headers.set('cache-control', `public, max-age=${ttl}`);
  const response = new Response(object.body, { headers });
  if (store) writeSiteCache(ctx, cacheKey, response.clone());
  return { response, state: bypass ? 'BYPASS' : 'MISS' };
};

const matchesEtag = (condition: string | null, etag: string | null): boolean => {
  if (!condition) return false;
  if (condition.trim() === '*') return true;
  if (!etag) return false;
  const normalize = (tag: string): string => tag.trim().replace(/^W\//, '');
  return condition.split(',').some((tag) => normalize(tag) === normalize(etag));
};

const respondWithValidation = (
  request: Request, response: Response, headers: Headers, ctx: ExecutionContext,
): Response => {
  const notModified = (request.method === 'GET' || request.method === 'HEAD')
    && matchesEtag(request.headers.get('if-none-match'), headers.get('etag'));
  if (notModified || request.method === 'HEAD') {
    if (notModified) headers.delete('content-length');
    if (response.body) ctx.waitUntil(response.body.cancel());
    return new Response(null, { status: notModified ? 304 : 200, headers });
  }
  return new Response(response.body, { headers });
};

const rewriteSharedRuntime = (response: Response, rootDomain: string, origin: string, analyticsEnabled: boolean): Response => {
  let hasCsp = false;
  const rewriter = new HTMLRewriter()
    .on('meta[http-equiv]', { element(element) {
      if (element.getAttribute('http-equiv')?.toLowerCase() === 'content-security-policy') hasCsp = true;
    } })
    .on('script[src]', { element(element) {
      if (hasCsp || element.getAttribute('crossorigin')?.toLowerCase() === 'use-credentials') return;
      const src = element.getAttribute('src');
      // Exact root URL only: explicit versions and plugin/query configuration stay upstream.
      if (src && /^(?:https?:)?\/\/cdn\.tailwindcss\.com\/?$/i.test(src)) {
        element.setAttribute('src', `https://${CENTRAL_THUMBNAIL_HOST}.${rootDomain}${runtimeAssets.tailwind.path}`);
      }
    } });
  if (analyticsEnabled) addAppAnalytics(rewriter, origin);
  return addSmartFavicon(rewriter, response, origin).transform(response);
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const host = url.hostname;

    const rootDomain: string = env.APPS_ROOT_DOMAIN || 'example.com';

    if (host === rootDomain) {
      const destination = new URL('https://gemigo.io/');
      destination.search = url.search;
      return new Response(null, {
        status: 301,
        headers: {
          location: destination.href,
          'cache-control': 'public, max-age=300',
        },
      });
    }

    // Expect requests like <slug>.<rootDomain>
    if (!host.endsWith(rootDomain)) {
      return new Response('Not found', { status: 404 });
    }

    const withoutRoot = host.slice(0, host.length - rootDomain.length);
    const subdomain = withoutRoot.replace(/\.$/, '');

    // Ignore invalid or reserved subdomains.
    if (!subdomain || subdomain === 'www') {
      return new Response('Not found', { status: 404 });
    }

    // Block private build configuration in both current and legacy publications.
    let decodedPath: string;
    try { decodedPath = decodeURIComponent(url.pathname); }
    catch { return new Response('Invalid path', { status: 400 }); }
    if (decodedPath.replace(/\\/g, '/').split('/').some(segment => {
      const name = segment.toLowerCase();
      return name === '.env' || name.startsWith('.env.') || name === '.npmrc' || name === '.git' || name === 'node_modules';
    })) return new Response('Not found', { status: 404 });

    if (url.pathname === SMART_FAVICON_PATH && (request.method === 'GET' || request.method === 'HEAD')) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(SMART_FAVICON_RUNTIME));
      const etag = `"${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}"`;
      const headers = new Headers({ 'content-type': 'application/javascript; charset=utf-8',
        'cache-control': 'no-cache', 'x-content-type-options': 'nosniff', etag });
      return respondWithValidation(request, new Response(SMART_FAVICON_RUNTIME), headers, ctx);
    }

    const analyticsEnabled = env.ANALYTICS_ENABLED === 'true';
    if (url.pathname === APP_ANALYTICS_SCRIPT) {
      if (!analyticsEnabled || request.method !== 'GET') return new Response(null, { status: 404 });
      return new Response(APP_ANALYTICS_RUNTIME, { headers: {
        'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'public, max-age=3600',
        'x-content-type-options': 'nosniff',
      } });
    }
    if (url.pathname === APP_ANALYTICS_BEACON) {
      if (!analyticsEnabled) return new Response(null, { status: 404 });
      return recordPageView(env, request, url, subdomain);
    }

    const bucket = env.ASSETS; // R2 bucket binding configured in wrangler / dashboard
    if (!bucket) {
      return new Response('R2 bucket binding "ASSETS" is not configured', {
        status: 500,
      });
    }

    if (subdomain === CENTRAL_THUMBNAIL_HOST && (request.method === 'GET' || request.method === 'HEAD')) {
      const match = CENTRAL_THUMBNAIL_PATH.exec(url.pathname);
      if (match) {
        if (request.method === 'HEAD') {
          return checkCentralThumbnail(env, match[1]);
        }
        return serveCentralThumbnail(request, env, ctx, match[1]);
      }
    }

    const cacheableMethod = request.method === 'GET' || request.method === 'HEAD';
    const requestCacheControl = request.headers.get('cache-control') ?? '';
    const noStore = /(?:^|,)\s*no-store\b/i.test(requestCacheControl);
    const bypass = !cacheableMethod || noStore || /(?:^|,)\s*no-cache\b/i.test(requestCacheControl);
    const store = cacheableMethod && !noStore;

    if (subdomain === CENTRAL_THUMBNAIL_HOST && (request.method === 'GET' || request.method === 'HEAD')) {
      const asset = Object.values(runtimeAssets).find((entry) => entry.path === url.pathname);
      if (asset) {
        const started = performance.now();
        const result = await readSiteObject(url, asset.key, bucket, ctx, bypass, store);
        if (!result) return new Response('Runtime asset unavailable', { status: 503 });
        const headers = new Headers(result.response.headers);
        headers.set('cache-control', 'public, max-age=31536000, immutable');
        headers.set('content-type', asset.contentType);
        headers.set('access-control-allow-origin', '*');
        headers.set('x-content-type-options', 'nosniff');
        headers.set('x-gemigo-gateway', 'r2');
        headers.set('x-gemigo-cache', result.state);
        headers.set('server-timing', `gemigo;dur=${(performance.now() - started).toFixed(1)}`);
        return respondWithValidation(request, result.response, headers, ctx);
      }
    }

    // Thumbnail endpoint: /__thumbnail.png on the app subdomain.
    if (url.pathname === '/__thumbnail.png') {
      const thumbKey = `apps/${subdomain}/thumbnail.png`;
      let thumb = await bucket.get(thumbKey);

      // If a previous version of the screenshot pipeline saved a 1x1
      // placeholder PNG, it will be very small (tens of bytes). Treat such
      // tiny objects as "missing" so we can regenerate a real thumbnail.
      if (thumb && typeof thumb.size === 'number' && thumb.size > 0 && thumb.size <= 80) {
        console.log(
          'Existing thumbnail is too small, treating as missing and regenerating',
          { key: thumbKey, size: thumb.size },
        );
        thumb = null;
      }

      if (!thumb) {
        thumb = await bucket.get(`apps/${subdomain}/thumbnail.webp`);
      }

      if (!thumb) {
        return new Response('Thumbnail not available', { status: 404 });
      }

      const headers = new Headers();
      if (typeof thumb.writeHttpMetadata === 'function') {
        thumb.writeHttpMetadata(headers);
      }
      if (thumb.httpEtag) {
        headers.set('etag', thumb.httpEtag);
      }
      // Debug/diagnostic header so we can verify that requests are
      // actually flowing through this R2 gateway worker.
      headers.set('x-gemigo-gateway', 'r2');
      if (!headers.has('content-type')) {
        headers.set('content-type', thumb.httpMetadata?.contentType ?? 'image/png');
      }

      return new Response(thumb.body, { headers });
    }

    const started = performance.now();
    const resolved = await resolveDeployment(url, subdomain, bucket, ctx, bypass, store);
    if (!resolved) return new Response('Invalid site deployment', { status: 503 });
    const { prefix, previousPrefix } = resolved.deployment;
    let pathname = url.pathname || '/';
    if (pathname.endsWith('/')) pathname += 'index.html';

    if (pathname === SMART_FAVICON_FALLBACK_PATH) {
      const index = await readSiteObject(url, `${prefix}/index.html`, bucket, ctx, bypass, store);
      if (!index) return new Response('Not found', { status: 404 });
      if (index.response.body) ctx.waitUntil(index.response.body.cancel());
      const response = faviconFallback((url.searchParams.get('name') || subdomain).slice(0, 160));
      return respondWithValidation(request, response, response.headers, ctx);
    }

    let result = await readSiteObject(url, `${prefix}${pathname}`, bucket, ctx, bypass, store);
    if (pathname === '/favicon.ico' && (!result || result.response.headers.get('content-type')?.includes('text/html'))) {
      if (result?.response.body) ctx.waitUntil(result.response.body.cancel());
      const index = await readSiteObject(url, `${prefix}/index.html`, bucket, ctx, bypass, store);
      if (!index) return new Response('Not found', { status: 404 });
      if (index.response.body) ctx.waitUntil(index.response.body.cancel());
      const response = faviconFallback(subdomain);
      return respondWithValidation(request, response, response.headers, ctx);
    }
    // Existing open tabs can still need files from the previous release.
    if (!result && previousPrefix && /\.[a-z0-9]+$/i.test(pathname) && !pathname.endsWith('.html')) {
      result = await readSiteObject(url, `${previousPrefix}${pathname}`, bucket, ctx, bypass, store);
    }
    // Keep the existing SPA fallback, caching the actual index object, not each route.
    if (!result && pathname !== '/index.html') {
      result = await readSiteObject(url, `${prefix}/index.html`, bucket, ctx, bypass, store);
    }
    if (!result) return new Response('Not found', { status: 404 });

    const headers = new Headers(result.response.headers);
    headers.set('cache-control', 'no-cache');
    headers.set('x-gemigo-gateway', 'r2');
    headers.set('x-gemigo-cache', result.state);
    headers.set('x-gemigo-deployment-cache', resolved.state);
    headers.set('server-timing', `gemigo;dur=${(performance.now() - started).toFixed(1)}`);
    if (headers.get('content-type')?.includes('text/html')) {
      const etag = headers.get('etag');
      if (etag) headers.set('etag', `W/${etag.replace(/^W\//, '').replace(/"$/, `-hosting-${runtimeAssets.tailwind.sha256.slice(0, 8)}-favicon-v2${analyticsEnabled ? "-analytics-v2" : ""}"`)}`);
      headers.delete('content-length');
      // Origin objects stay byte-for-byte intact; this is a delivery-only URL substitution.
      const response = rewriteSharedRuntime(new Response(result.response.body, { headers }), rootDomain, url.origin, analyticsEnabled);
      return respondWithValidation(request, response, headers, ctx);
    }
    return respondWithValidation(request, result.response, headers, ctx);
  },
};

function getContentTypeFromExt(ext: string): string {
  switch (ext) {
    case 'html':
      return 'text/html; charset=utf-8';
    case 'js':
    case 'mjs':
      return 'application/javascript; charset=utf-8';
    case 'css':
      return 'text/css; charset=utf-8';
    case 'json':
      return 'application/json; charset=utf-8';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    case 'webp':
      return 'image/webp';
    case 'ico':
      return 'image/x-icon';
    default:
      return 'application/octet-stream';
  }
}

const hmac = async (secret: string, value: string): Promise<string> => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, encoder.encode(value)),
  );
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const isAutomatedRequest = (request: Request, userAgent: string): boolean => {
  const cf = request.cf as
    | {
        botManagement?: { score?: number; verifiedBot?: boolean };
        verifiedBotCategory?: string;
      }
    | undefined;
  if (cf?.botManagement?.verifiedBot || cf?.verifiedBotCategory) return true;
  if (typeof cf?.botManagement?.score === 'number' && cf.botManagement.score < 30) return true;
  return /bot|crawler|spider|slurp|headless|lighthouse|monitor|uptime|curl|wget|python|httpclient/i.test(
    userAgent,
  );
};

const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

async function recordPageView(
  env: Env, request: Request, requestUrl: URL, slug: string,
): Promise<Response> {
  const reply = (status: number) => new Response(null, { status, headers: { 'cache-control': 'no-store' } });
  if (request.method !== 'POST') return reply(405);
  if (request.headers.get('origin') !== requestUrl.origin
      || request.headers.get('sec-fetch-site') !== 'same-origin'
      || !request.headers.get('content-type')?.startsWith('application/json')) return reply(403);
  const userAgent = request.headers.get('user-agent') ?? '';
  if (isAutomatedRequest(request, userAgent)) return reply(204);
  const base = env.ANALYTICS_API_BASE_URL;
  const secret = env.ANALYTICS_INGEST_SECRET;
  if (!base || !secret) return reply(503);
  // Bound the streamed body too; Content-Length is optional in Worker requests.
  const reader = request.body?.getReader();
  if (!reader) return reply(400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 512) { await reader.cancel(); return reply(413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let body: { eventId?: unknown; visitorId?: unknown };
  try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { return reply(400); }
  if (!body || typeof body.eventId !== 'string' || !uuidPattern.test(body.eventId)
      || (body.visitorId !== undefined && (typeof body.visitorId !== 'string' || !uuidPattern.test(body.visitorId)))) return reply(400);
  const [visitorHash, sessionHash, dedupeKey] = await Promise.all([
    typeof body.visitorId === 'string' ? hmac(secret, `visitor-v2|${slug}|${body.visitorId}`) : Promise.resolve(''),
    typeof body.visitorId === 'string' ? hmac(secret, `session-v2|${slug}|${Math.floor(Date.now() / 1800000)}|${body.visitorId}`) : Promise.resolve(''),
    hmac(secret, `event-v2|${slug}|${body.eventId}`),
  ]);
  try {
    const response = await fetch(`${base.replace(/\/+$/, '')}/analytics/ping/${encodeURIComponent(slug)}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'X-Gemigo-Analytics-Token': secret },
      body: JSON.stringify({ version: 2, isBot: false, visitorHash, sessionHash,
        dedupeKey, userAgentFamily: 'browser', clientChannel: 'web' }),
    });
    if (!response.ok) { console.warn('App analytics ingestion failed', response.status); return reply(503); }
    return reply(204);
  } catch { console.warn('App analytics ingestion unavailable'); return reply(503); }
}

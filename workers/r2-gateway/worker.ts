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
};

type Env = {
  APPS_ROOT_DOMAIN?: string;
  ASSETS: R2BucketBinding;
  // Optional external screenshot service the worker can call to generate
  // thumbnails on first request. The service is expected to accept a JSON
  // body { url: string } and return a PNG image.
  SCREENSHOT_SERVICE_URL?: string;
  SCREENSHOT_SERVICE_TOKEN?: string;
  SCREENSHOT_SERVICE?: Fetcher;
  // Optional analytics API endpoint (e.g. https://gemigo-api.../api/v1).
  // When configured, the gateway will POST page view events for each app.
  ANALYTICS_API_BASE_URL?: string;
  /** Shared secret used for HMAC anonymization and API authentication. */
  ANALYTICS_INGEST_SECRET?: string;
};

const OPTIMIZED_THUMBNAIL_CACHE_CONTROL =
  'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800';
const LEGACY_THUMBNAIL_CACHE_CONTROL =
  'public, max-age=60, s-maxage=60, stale-while-revalidate=300';
const THUMBNAIL_PLACEHOLDER_CACHE_CONTROL = 'public, max-age=5, s-maxage=5';
const MAX_OPTIMIZED_THUMBNAIL_BYTES = 100 * 1024;
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

const generateOptimizedThumbnail = async (
  env: Env,
  slug: string,
  rootDomain: string,
  hasLegacyThumbnail: boolean,
): Promise<void> => {
  if (!env.SCREENSHOT_SERVICE_URL) return;

  const targetUrl = `https://${slug}.${rootDomain}/`;
  const screenshotRequest = new Request(env.SCREENSHOT_SERVICE_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(env.SCREENSHOT_SERVICE_TOKEN
        ? { authorization: `Bearer ${env.SCREENSHOT_SERVICE_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({
      url: targetUrl,
      ...(hasLegacyThumbnail
        ? { imageUrl: `https://${slug}.${rootDomain}/__thumbnail.png` }
        : {}),
      format: 'webp',
      maxBytes: MAX_OPTIMIZED_THUMBNAIL_BYTES,
    }),
  });
  const screenshotResp = env.SCREENSHOT_SERVICE
    ? await env.SCREENSHOT_SERVICE.fetch(screenshotRequest)
    : await fetch(screenshotRequest);

  if (!screenshotResp.ok) {
    throw new Error(`Optimized thumbnail generation failed with ${screenshotResp.status}`);
  }

  const declaredLength = Number(screenshotResp.headers.get('content-length') || 0);
  if (declaredLength > MAX_OPTIMIZED_THUMBNAIL_BYTES) {
    throw new Error(`Optimized thumbnail is too large: ${declaredLength} bytes`);
  }

  const buffer = await screenshotResp.arrayBuffer();
  if (buffer.byteLength <= 80 || buffer.byteLength > MAX_OPTIMIZED_THUMBNAIL_BYTES) {
    throw new Error(`Invalid optimized thumbnail size: ${buffer.byteLength} bytes`);
  }

  await env.ASSETS.put(`apps/${slug}/thumbnail.webp`, buffer, {
    httpMetadata: {
      cacheControl: OPTIMIZED_THUMBNAIL_CACHE_CONTROL,
      contentType: 'image/webp',
    },
  });
};

const serveCentralThumbnail = async (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  slug: string,
  rootDomain: string,
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

  ctx.waitUntil(
    generateOptimizedThumbnail(env, slug, rootDomain, Boolean(legacy)).catch((error) => {
      console.error(JSON.stringify({
        message: 'Failed to generate optimized thumbnail',
        slug,
        error: error instanceof Error ? error.message : String(error),
      }));
    }),
  );

  if (legacy && hasUsableLegacyThumbnail) {
    return createLegacyThumbnailResponse(legacy);
  }

  return createThumbnailPlaceholder(
    slug,
    new URL(request.url).searchParams.get('name') ?? '',
    new URL(request.url).searchParams.get('seed') ?? slug,
  );
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const host = url.hostname;

    const rootDomain: string = env.APPS_ROOT_DOMAIN || 'example.com';

    // Expect requests like <slug>.<rootDomain>
    if (!host.endsWith(rootDomain)) {
      return new Response('Not found', { status: 404 });
    }

    const withoutRoot = host.slice(0, host.length - rootDomain.length);
    const subdomain = withoutRoot.replace(/\.$/, '');

    // Ignore bare domain or invalid hostnames.
    if (!subdomain || subdomain === 'www') {
      return new Response('Not found', { status: 404 });
    }

    const bucket = env.ASSETS; // R2 bucket binding configured in wrangler / dashboard
    if (!bucket) {
      return new Response('R2 bucket binding "ASSETS" is not configured', {
        status: 500,
      });
    }

    if (subdomain === CENTRAL_THUMBNAIL_HOST && request.method === 'GET') {
      const match = CENTRAL_THUMBNAIL_PATH.exec(url.pathname);
      if (match) {
        return serveCentralThumbnail(request, env, ctx, match[1], rootDomain);
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

      // If thumbnail does not exist yet, try to generate it via an external
      // screenshot service (if configured). This keeps the worker generic:
      // you can plug in Cloudflare Browser Rendering or any third-party API.
      if (!thumb && env.SCREENSHOT_SERVICE_URL) {
        try {
          const targetUrl = `https://${subdomain}.${rootDomain}/`;
          const screenshotResp = await fetch(env.SCREENSHOT_SERVICE_URL, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              ...(env.SCREENSHOT_SERVICE_TOKEN
                ? { authorization: `Bearer ${env.SCREENSHOT_SERVICE_TOKEN}` }
                : {}),
            },
            body: JSON.stringify({ url: targetUrl }),
          });

          if (screenshotResp.ok) {
            const buffer = await screenshotResp.arrayBuffer();
            await bucket.put(thumbKey, buffer, {
              httpMetadata: { contentType: 'image/png' },
            });
            thumb = await bucket.get(thumbKey);
          }
        } catch (err) {
          // If screenshot generation fails, we simply fall back to 404 so
          // the frontend can use a graceful placeholder.
          console.error('Failed to generate thumbnail', err);
        }
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
        headers.set('content-type', 'image/png');
      }

      return new Response(thumb.body, { headers });
    }

    // This must match the prefix used by the backend R2 deployer:
    //   apps/<slug>/current/...
    const basePrefix = `apps/${subdomain}/current`;

    let pathname = url.pathname;
    if (!pathname || pathname === '/') {
      pathname = '/index.html';
    }

    let objectKey =
      pathname.endsWith('/')
        ? `${basePrefix}${pathname}index.html`
        : `${basePrefix}${pathname}`;

    // Try to fetch the requested asset first.
    let object = await bucket.get(objectKey);

    // SPA fallback: if the asset does not exist, return index.html so
    // client-side routing (React/Vue/etc.) can handle the path.
    if (!object) {
      const fallbackKey = `${basePrefix}/index.html`;
      object = await bucket.get(fallbackKey);
      objectKey = fallbackKey;
    }

    if (!object) {
      return new Response('Not found', { status: 404 });
    }

    // Record page views for top-level HTML / SPA routes.
    if (isPageViewRequest(url)) {
      ctx.waitUntil(
        recordPageView(env, request, url, subdomain).catch((err) => {
          console.error('Failed to record page view', err);
        }),
      );
    }

    const headers = new Headers();
    if (typeof object.writeHttpMetadata === 'function') {
      object.writeHttpMetadata(headers);
    }
    if (object.httpEtag) {
      headers.set('etag', object.httpEtag);
    }

    // Basic content-type safety net in case metadata is missing.
    if (!headers.has('content-type')) {
      const ext = objectKey.split('.').pop()?.toLowerCase() ?? '';
      headers.set('content-type', getContentTypeFromExt(ext));
    }

    // Debug/diagnostic header so we can verify in curl/DevTools
    // that this Worker handled the request.
    headers.set('x-gemigo-gateway', 'r2');

    return new Response(object.body, {
      headers,
    });
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

function isPageViewRequest(url: URL): boolean {
  const pathname = url.pathname;
  if (!pathname || pathname === '/' || pathname === '/index.html') {
    return true;
  }
  // Heuristic: treat SPA-style routes without a file extension as page views.
  const lastSegment = pathname.split('/').pop() ?? '';
  return !lastSegment.includes('.');
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

const attribution = (url: URL, name: string): string | undefined => {
  const value = url.searchParams.get(name)?.trim().toLowerCase();
  return value && /^[a-z0-9._+-]{1,80}$/.test(value) ? value : undefined;
};

const userAgentFamily = (userAgent: string): string => {
  if (/edg\//i.test(userAgent)) return 'edge';
  if (/firefox\//i.test(userAgent)) return 'firefox';
  if (/chrome\//i.test(userAgent)) return 'chrome';
  if (/safari\//i.test(userAgent)) return 'safari';
  if (/curl|wget|python|httpclient/i.test(userAgent)) return 'script';
  return 'other';
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

async function recordPageView(
  env: Env,
  request: Request,
  requestUrl: URL,
  slug: string,
): Promise<void> {
  const base = env.ANALYTICS_API_BASE_URL;
  const secret = env.ANALYTICS_INGEST_SECRET;
  if (!base || !secret) return;
  const apiBase = base.replace(/\/+$/, '');
  const url = `${apiBase}/analytics/ping/${encodeURIComponent(slug)}`;
  const userAgent = request.headers.get('user-agent') ?? '';
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const sessionBucket = Math.floor(now / (30 * 60 * 1000));
  const dedupeBucket = Math.floor(now / 10000);
  const identity = `${ip}|${userAgent}`;
  const [visitorHash, sessionHash, dedupeKey] = await Promise.all([
    hmac(secret, `visitor|${day}|${identity}`),
    hmac(secret, `session|${sessionBucket}|${identity}`),
    hmac(secret, `dedupe|${dedupeBucket}|${identity}|${requestUrl.pathname}`),
  ]);
  let referrerHost: string | undefined;
  try {
    const referrer = request.headers.get('referer');
    referrerHost = referrer ? new URL(referrer).hostname.toLowerCase().slice(0, 120) : undefined;
  } catch {
    referrerHost = undefined;
  }
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Gemigo-Analytics-Token': secret,
    },
    body: JSON.stringify({
      isBot: isAutomatedRequest(request, userAgent),
      visitorHash,
      sessionHash,
      dedupeKey,
      userAgentFamily: userAgentFamily(userAgent),
      ...(referrerHost ? { referrerHost } : {}),
      ...(attribution(requestUrl, 'utm_source')
        ? { utmSource: attribution(requestUrl, 'utm_source') }
        : {}),
      ...(attribution(requestUrl, 'utm_medium')
        ? { utmMedium: attribution(requestUrl, 'utm_medium') }
        : {}),
      ...(attribution(requestUrl, 'utm_campaign')
        ? { utmCampaign: attribution(requestUrl, 'utm_campaign') }
        : {}),
      clientChannel: 'web',
    }),
  });
}

type R2ObjectLike = {
  body: ReadableStream | null;
  writeHttpMetadata?: (headers: Headers) => void;
  httpEtag?: string;
  // Actual R2 objects expose a `size` field; we include it here so we can
  // detect obviously-invalid thumbnails (e.g. tiny 1x1 placeholder PNGs).
  size?: number;
};

type R2PutOptionsLike = {
  httpMetadata?: {
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
  // Optional analytics API endpoint (e.g. https://gemigo-api.../api/v1).
  // When configured, the gateway will POST page view events for each app.
  ANALYTICS_API_BASE_URL?: string;
  /** Shared secret used for HMAC anonymization and API authentication. */
  ANALYTICS_INGEST_SECRET?: string;
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

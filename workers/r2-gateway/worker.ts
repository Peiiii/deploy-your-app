type R2ObjectLike = {
  body: ReadableStream | null;
  writeHttpMetadata?: (headers: Headers) => void;
  httpEtag?: string;
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
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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

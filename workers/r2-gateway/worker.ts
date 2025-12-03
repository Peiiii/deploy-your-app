type R2ObjectLike = {
  body: ReadableStream | null;
  writeHttpMetadata?: (headers: Headers) => void;
  httpEtag?: string;
};

type R2BucketBinding = {
  get(key: string): Promise<R2ObjectLike | null>;
};

type Env = {
  APPS_ROOT_DOMAIN?: string;
  ASSETS: R2BucketBinding;
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

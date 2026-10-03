import { getSeo, renderSeoHead, renderSeoContent, PUBLIC_PATHS } from './seo.js';

// Cloudflare Pages Advanced Mode worker.
// This worker sits in front of your static frontend and proxies all `/api/v1/*`
// requests to your configured backend.
//
// How to use:
//   1. Deploy this file as `_worker.js` at the root of your Pages project
//      (Vite copies it from `frontend/public/_worker.js` into `dist/_worker.js`).
//   2. In the Cloudflare Pages project settings, add an environment variable:
//        BACKEND_ORIGIN = https://<your-backend-domain>   (must be a full URL)
//      The backend must listen on a port Cloudflare allows (typically 80 or 443).
//   3. Keep the frontend calling relative URLs like `/api/v1/...`.
//
// Requests flow:
//   Browser → Cloudflare Pages (_worker.js) → BACKEND_ORIGIN → response

export default {
  /**
   * Main request handler for Cloudflare Pages advanced mode.
   *
   * @param {Request} request
   * @param {{ ASSETS: Fetcher, BACKEND_ORIGIN?: string }} env
   */
  async fetch(request, env) {
    const url = new URL(request.url);

    // Only proxy API requests; everything else is a static asset.
    if (url.pathname.startsWith('/api/v1')) {
      try {
        if (!env.BACKEND_ORIGIN) {
          return new Response('BACKEND_ORIGIN is not configured', {
            status: 500,
          });
        }

        // Build the target URL on the configured backend.
        // Example: BACKEND_ORIGIN = 'https://api.example.com'
        //   /api/v1/projects → https://api.example.com/api/v1/projects
        const backendOrigin = new URL(env.BACKEND_ORIGIN);
        backendOrigin.pathname = url.pathname;
        backendOrigin.search = url.search;

        // Clone the incoming request but point it at the backend URL.
        const backendRequest = new Request(backendOrigin.toString(), request);

        // Optionally forward extra headers for logging/auditing.
        backendRequest.headers.set('x-forwarded-host', url.host);
        backendRequest.headers.set(
          'x-forwarded-proto',
          url.protocol.replace(':', ''),
        );

        // Important: return the fetch directly so streaming (SSE, etc.) still works.
        return fetch(backendRequest);
      } catch (err) {
        // Log full error to Cloudflare logs to avoid opaque 1101 pages.
        console.error('API proxy error in _worker.js:', err);
        // Surface a simple error to the client so it is debuggable.
        const message =
          err && err.message ? err.message : String(err ?? 'Unknown error');
        return new Response(`API proxy error: ${message}`, {
          status: 502,
          headers: { 'Content-Type': 'text/plain' },
        });
      }
    }

    if (!['GET', 'HEAD'].includes(request.method)) return env.ASSETS.fetch(request);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if ((PUBLIC_PATHS.includes(path) && url.pathname !== path) || url.pathname === '/index.html' || path === '/privacy') {
      const target = new URL(url);
      target.pathname = path === '/privacy' ? '/privacy-policy' : url.pathname === '/index.html' ? '/' : path;
      return Response.redirect(target.toString(), 308);
    }
    let assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status === 404 && !path.includes('.')) {
      const index = new URL(url);
      index.pathname = '/index.html';
      index.search = '';
      assetResponse = await env.ASSETS.fetch(new Request(index, request));
    }
    if (!(assetResponse.headers.get('content-type') || '').includes('text/html')) return assetResponse;
    // Missing files must not return the SPA document as an image, XML or script.
    if (path.includes('.') || path.startsWith('/assets/')) {
      return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    const seo = getSeo(url);
    const rewritten = new HTMLRewriter()
      .on('html', { element(element) { element.setAttribute('lang', seo.language); } })
      .on('[data-seo]', { element(element) { element.remove(); } })
      .on('head', { element(element) { element.append(renderSeoHead(seo), { html: true }); } })
      .on('#root', { element(element) {
        element.setInnerContent(seo.known ? renderSeoContent(seo) : '<main class="seo-content"><h1>Page not found</h1><a href="/">GemiGo</a></main>', { html: true });
      } })
      .transform(assetResponse);
    const headers = new Headers(rewritten.headers);
    headers.delete('content-length');
    headers.delete('etag');
    headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
    if (!seo.indexable) headers.set('X-Robots-Tag', 'noindex, follow');
    return new Response(request.method === 'HEAD' ? null : rewritten.body, { status: seo.known ? 200 : 404, headers });
  },
};

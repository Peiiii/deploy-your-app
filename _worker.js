// Cloudflare Pages Advanced Mode worker.
// This worker sits in front of your static frontend and proxies all `/api/v1/*`
// requests to your real backend running on Aliyun.
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
//   Browser → Cloudflare Pages (_worker.js) → BACKEND_ORIGIN (Aliyun) → response

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

        // Build the target URL on the Aliyun backend.
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

    // For non-API requests, fall back to the static asset handler.
    // Without this, your HTML/CSS/JS will not be served.
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    // SPA fallback: serve index.html for client-side routes.
    // This is required so URLs like /privacy-policy can be opened directly.
    const isHtmlRequest =
      request.method === 'GET' &&
      (request.headers.get('accept') || '').includes('text/html');
    const looksLikeAsset = url.pathname.includes('.') || url.pathname.startsWith('/assets/');
    if (!isHtmlRequest || looksLikeAsset) {
      return assetResponse;
    }

    const indexUrl = new URL(url);
    indexUrl.pathname = '/index.html';
    indexUrl.search = '';
    return env.ASSETS.fetch(new Request(indexUrl.toString(), request));
  },
};

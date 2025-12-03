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
      backendRequest.headers.set(
        'x-forwarded-host',
        url.host,
      );
      backendRequest.headers.set('x-forwarded-proto', url.protocol.replace(':', ''));

      // Important: return the fetch directly so streaming (SSE, etc.) still works.
      return fetch(backendRequest);
    }

    // For non-API requests, fall back to the static asset handler.
    // Without this, your HTML/CSS/JS will not be served.
    return env.ASSETS.fetch(request);
  },
};


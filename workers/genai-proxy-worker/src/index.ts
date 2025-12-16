import type { Env } from './lib/env';
import { createWorkerApp, errorResponse } from '@deploy-your-app/worker-kit';
import { handleCountTokens } from './lib/handlers/countTokens';
import { handleGenerateContent } from './lib/handlers/generateContent';

// Disable default CORS so we can fully control headers (echo requested headers).
const app = createWorkerApp<Env>({ cors: false });

// Global CORS headers middleware
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin') || '*';
  const reqHeaders = c.req.header('Access-Control-Request-Headers');
  const allowHeaders =
    (reqHeaders && reqHeaders.length > 0
      ? reqHeaders
      : 'Content-Type, Authorization, x-goog-api-key') + '';

  c.header('Access-Control-Allow-Origin', origin);
  c.header(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  );
  c.header('Access-Control-Allow-Headers', allowHeaders);
  c.header('Access-Control-Max-Age', '86400');

  await next();
});

// Explicit preflight handling to satisfy browser CORS for @google/genai
app.options('*', (c) => {
  const origin = c.req.header('Origin') || '*';
  const reqHeaders = c.req.header('Access-Control-Request-Headers');
  const allowHeaders =
    (reqHeaders && reqHeaders.length > 0
      ? reqHeaders
      : 'Content-Type, Authorization, x-goog-api-key') + '';
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      // Echo requested headers to be maximally permissive for preflight.
      'Access-Control-Allow-Headers': allowHeaders,
      'Access-Control-Max-Age': '86400',
    },
  });
});

/**
 * GenAI compatibility endpoints used by `@google/genai`.
 *
 * Note: Google-style endpoints encode the action in the same path segment:
 *   /v1beta/models/<model>:generateContent
 */
app.post('/v1beta/models/:model', (c) => {
  const modelSegment = c.req.param('model'); // e.g. "gemini-2.0-flash:generateContent"

  if (modelSegment.endsWith(':generateContent')) {
    return handleGenerateContent(c.req.raw, c.env, { stream: false });
  }

  if (modelSegment.endsWith(':streamGenerateContent')) {
    return handleGenerateContent(c.req.raw, c.env, { stream: true });
  }

  if (modelSegment.endsWith(':countTokens')) {
    return handleCountTokens(c.req.raw);
  }

  return errorResponse(
    501,
    `Endpoint not supported by proxy: /v1beta/models/${modelSegment}`,
  );
});

export default app.getWorker();

import type { Env } from './lib/env';
import { createWorkerApp, errorResponse } from '@deploy-your-app/worker-kit';
import { handleCountTokens } from './lib/handlers/countTokens';
import { handleGenerateContent } from './lib/handlers/generateContent';

const app = createWorkerApp<Env>();

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

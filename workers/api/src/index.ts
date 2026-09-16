import { getSettings } from '@gemigo/product-analytics';
import { readTelemetry, storeTelemetry } from './analytics';
import type { ApiWorkerEnv } from './types/env';
import { jsonResponse, emptyResponse, normalizePath } from './utils/http';
import { handleError } from './utils/error-handler';
import type { HttpMethod } from './utils/routing';
import { buildApiRouter } from './routes';

async function handleRequest(
  request: Request,
  env: ApiWorkerEnv,
): Promise<Response> {
  const url = new URL(request.url);
  const pathname = normalizePath(url.pathname);

  if (request.method === 'OPTIONS') {
    return emptyResponse(204);
  }

  const method = request.method.toUpperCase() as HttpMethod;
  const router = buildApiRouter(env, url);

  try {
    const match = await router.match(pathname, method);
    if (!match) {
      return jsonResponse({ error: 'Not Found' }, 404);
    }
    return await match.handler(request, match.params);
  } catch (error) {
    return handleError(error);
  }
}

const worker: ExportedHandler<ApiWorkerEnv> = {
  async fetch(request, env, ctx) {
    try {
      const telemetryRequest = new URL(request.url).pathname === '/api/v1/telemetry';
      const batch = await readTelemetry(request as Request);
      let response = telemetryRequest
        ? new Response(null, { status: request.method === 'POST' && batch ? 204 : 400 })
        : await handleRequest(request, env);
      if (batch && env.ANALYTICS_DB) {
        // A telemetry/config failure never fails the underlying business request.
        const settings = await getSettings(env.ANALYTICS_DB).catch(() => null);
        if (settings) {
          response = new Response(response.body, response);
          response.headers.set('x-gemigo-collection', settings.enabled ? '1' : '0');
          if (settings.enabled) ctx.waitUntil(storeTelemetry(request, response, env, batch).catch(() => console.warn('Telemetry write skipped')));
        }
      }
      return response;
    } catch (err) {
      return handleError(err);
    }
  },
};

export default worker;

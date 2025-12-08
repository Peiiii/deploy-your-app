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
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (err) {
      return handleError(err);
    }
  },
};

export default worker;

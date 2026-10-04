import type { ApiWorkerEnv } from '../types/env';
import { jsonResponse, readJson } from '../utils/http';
import { sdkAuthRequestService } from '../services/sdk-auth-request.service';
import { sdkAuthService } from '../services/sdk-auth.service';

function authResponse(body: unknown): Response {
  const response = jsonResponse(body);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

class SdkAuthController {
  async createRequest(request: Request, env: ApiWorkerEnv, db: D1Database): Promise<Response> {
    return authResponse(
      await sdkAuthRequestService.create(request, env, db, await readJson(request))
    );
  }
  async requestContext(request: Request, db: D1Database, id?: string): Promise<Response> {
    const context = id
      ? await sdkAuthRequestService.context(request, db, id)
      : await sdkAuthRequestService.legacyContext(request, db);
    return authResponse(context);
  }
  async authorizeRequest(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    id: string
  ): Promise<Response> {
    return authResponse(await sdkAuthRequestService.authorize(request, env, db, id));
  }
  // POST /api/v1/sdk/authorize
  async authorize(request: Request, env: ApiWorkerEnv, db: D1Database): Promise<Response> {
    const body = await readJson(request);
    const result = await sdkAuthService.authorize(request, env, db, {
      appId: body.appId,
      openerOrigin: body.openerOrigin,
      scopes: body.scopes,
      codeChallenge: body.codeChallenge,
    });
    return jsonResponse(result);
  }

  // POST /api/v1/sdk/token
  async token(request: Request, env: ApiWorkerEnv, db: D1Database): Promise<Response> {
    const body = await readJson(request);
    const result = await sdkAuthService.exchangeToken(request, env, db, {
      code: body.code,
      codeVerifier: body.codeVerifier,
    });
    return jsonResponse(result);
  }

  // GET /api/v1/sdk/me
  async me(request: Request, env: ApiWorkerEnv, db: D1Database): Promise<Response> {
    void env;
    const result = await sdkAuthService.me(request, db);
    return jsonResponse(result);
  }

  // GET /api/v1/sdk/_debug
  async debug(request: Request, env: ApiWorkerEnv, db: D1Database): Promise<Response> {
    void request;
    const result = await sdkAuthService.debugStats(env, db);
    return jsonResponse(result);
  }
}

export const sdkAuthController = new SdkAuthController();

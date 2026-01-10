import type { ApiWorkerEnv } from '../types/env';
import { jsonResponse, readJson } from '../utils/http';
import { sdkAuthService } from '../services/sdk-auth.service';

class SdkAuthController {
  // POST /api/v1/sdk/authorize
  async authorize(request: Request, env: ApiWorkerEnv, db: D1Database): Promise<Response> {
    const body = await readJson(request);
    const result = await sdkAuthService.authorize(request, env, db, {
      appId: body.appId,
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


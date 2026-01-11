import { sdkCloudService } from '../services/sdk-cloud.service';
import { jsonResponse, readJson } from '../utils/http';
import type { ApiWorkerEnv } from '../types/env';
import type {
  CloudBlobCreateUploadUrlInput,
  CloudBlobGetDownloadUrlInput,
  CloudDbCreateDocInput,
  CloudDbQueryInput,
  CloudDbSetDocInput,
  CloudDbUpdateDocInput,
  CloudFunctionsCallInput,
} from '../types/sdk-cloud';

class SdkCloudController {
  // -----------
  // KV
  // -----------

  async kvGet(request: Request, _env: ApiWorkerEnv, db: D1Database): Promise<Response> {
    const env = _env;
    const url = new URL(request.url);
    const key = (url.searchParams.get('key') ?? '').trim();
    if (!key) return jsonResponse({ error: 'key is required' }, 400);
    const result = await sdkCloudService.kvGet(request, env, db, key);
    return jsonResponse(result);
  }

  async kvSet(request: Request, _env: ApiWorkerEnv, db: D1Database): Promise<Response> {
    const env = _env;
    const body = (await readJson(request)) as { key?: unknown; value?: unknown; ifMatch?: unknown };
    const result = await sdkCloudService.kvSet(request, env, db, body);
    return jsonResponse(result);
  }

  async kvDelete(request: Request, _env: ApiWorkerEnv, db: D1Database): Promise<Response> {
    const env = _env;
    const body = (await readJson(request)) as { key?: unknown; ifMatch?: unknown };
    await sdkCloudService.kvDelete(request, env, db, body);
    return jsonResponse({ ok: true });
  }

  async kvList(request: Request, _env: ApiWorkerEnv, db: D1Database): Promise<Response> {
    const env = _env;
    const url = new URL(request.url);
    const prefix = url.searchParams.get('prefix');
    const limit = url.searchParams.get('limit');
    const cursor = url.searchParams.get('cursor');
    const result = await sdkCloudService.kvList(request, env, db, { prefix, limit, cursor });
    return jsonResponse(result);
  }

  // -----------
  // DB
  // -----------

  async dbCreateDoc(
    request: Request,
    _env: ApiWorkerEnv,
    db: D1Database,
    collection: string,
  ): Promise<Response> {
    const env = _env;
    const body = (await readJson(request)) as CloudDbCreateDocInput;
    const result = await sdkCloudService.dbCreateDoc(request, env, db, collection, body);
    return jsonResponse(result);
  }

  async dbGetDoc(
    request: Request,
    _env: ApiWorkerEnv,
    db: D1Database,
    collection: string,
    id: string,
  ): Promise<Response> {
    const env = _env;
    const result = await sdkCloudService.dbGetDoc(request, env, db, collection, id);
    return jsonResponse(result);
  }

  async dbUpdateDoc(
    request: Request,
    _env: ApiWorkerEnv,
    db: D1Database,
    collection: string,
    id: string,
  ): Promise<Response> {
    const env = _env;
    const body = (await readJson(request)) as CloudDbUpdateDocInput;
    const result = await sdkCloudService.dbUpdateDoc(request, env, db, collection, id, body);
    return jsonResponse(result);
  }

  async dbSetDoc(
    request: Request,
    _env: ApiWorkerEnv,
    db: D1Database,
    collection: string,
    id: string,
  ): Promise<Response> {
    const env = _env;
    const body = (await readJson(request)) as CloudDbSetDocInput;
    const result = await sdkCloudService.dbSetDoc(request, env, db, collection, id, body);
    return jsonResponse(result);
  }

  async dbDeleteDoc(
    request: Request,
    _env: ApiWorkerEnv,
    db: D1Database,
    collection: string,
    id: string,
  ): Promise<Response> {
    const env = _env;
    await sdkCloudService.dbDeleteDoc(request, env, db, collection, id);
    return jsonResponse({ ok: true });
  }

  async dbQuery(
    request: Request,
    _env: ApiWorkerEnv,
    db: D1Database,
    collection: string,
  ): Promise<Response> {
    const env = _env;
    const body = (await readJson(request)) as CloudDbQueryInput;
    const result = await sdkCloudService.dbQuery(request, env, db, collection, body);
    return jsonResponse(result);
  }

  // -----------
  // Blob
  // -----------

  async blobCreateUploadUrl(request: Request, _env: ApiWorkerEnv, db: D1Database): Promise<Response> {
    const env = _env;
    const body = (await readJson(request)) as CloudBlobCreateUploadUrlInput;
    const result = await sdkCloudService.blobCreateUploadUrl(request, env, db, body);
    return jsonResponse(result);
  }

  async blobGetDownloadUrl(request: Request, _env: ApiWorkerEnv, db: D1Database): Promise<Response> {
    const env = _env;
    const body = (await readJson(request)) as CloudBlobGetDownloadUrlInput;
    const result = await sdkCloudService.blobGetDownloadUrl(request, env, db, body);
    return jsonResponse(result);
  }

  async blobUpload(request: Request, _env: ApiWorkerEnv): Promise<Response> {
    const env = _env;
    const url = new URL(request.url);
    const token = (url.searchParams.get('token') ?? '').trim();
    if (!token) return jsonResponse({ error: 'token is required' }, 400);
    const result = await sdkCloudService.blobUpload(request, env, token);
    return jsonResponse(result);
  }

  async blobDownload(request: Request, _env: ApiWorkerEnv): Promise<Response> {
    const env = _env;
    const url = new URL(request.url);
    const token = (url.searchParams.get('token') ?? '').trim();
    if (!token) return jsonResponse({ error: 'token is required' }, 400);
    return sdkCloudService.blobDownload(request, env, token);
  }

  // -----------
  // Functions
  // -----------

  async functionsCall(request: Request, _env: ApiWorkerEnv, db: D1Database): Promise<Response> {
    const env = _env;
    const body = (await readJson(request)) as CloudFunctionsCallInput;
    const result = await sdkCloudService.functionsCall(request, env, db, body);
    return jsonResponse(result);
  }
}

export const sdkCloudController = new SdkCloudController();

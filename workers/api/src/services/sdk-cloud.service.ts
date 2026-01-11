import { sdkAuthRepository } from '../repositories/sdk-auth.repository';
import { sdkCloudRepository } from '../repositories/sdk-cloud.repository';
import { UnauthorizedError, ValidationError } from '../utils/error-handler';
import type { ApiWorkerEnv } from '../types/env';
import type {
  CloudDbCreateDocInput,
  CloudDbDocResponse,
  CloudDbQueryInput,
  CloudDbQueryResponse,
  CloudDbUpdateDocInput,
  CloudKvDeleteInput,
  CloudKvGetResponse,
  CloudKvListResponse,
  CloudKvSetInput,
  CloudKvSetResponse,
  CloudVisibility,
} from '../types/sdk-cloud';

function requireBearerToken(request: Request): string {
  const header = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!header) throw new UnauthorizedError('Missing Authorization header.');
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new UnauthorizedError('Invalid Authorization header.');
  return match[1].trim();
}

type CloudLogLevel = 'off' | 'error' | 'info' | 'debug';

function resolveCloudLogLevel(env: ApiWorkerEnv): CloudLogLevel {
  const raw = env.SDK_CLOUD_LOG_LEVEL?.trim().toLowerCase() || 'error';
  if (raw === 'off' || raw === 'error' || raw === 'info' || raw === 'debug') return raw;
  return 'error';
}

function shouldLog(level: CloudLogLevel, want: Exclude<CloudLogLevel, 'off'>): boolean {
  const rank: Record<CloudLogLevel, number> = { off: 0, error: 1, info: 2, debug: 3 };
  return rank[level] >= rank[want];
}

function logCloudEvent(
  env: ApiWorkerEnv,
  level: Exclude<CloudLogLevel, 'off'>,
  event: Record<string, unknown>,
): void {
  const configured = resolveCloudLogLevel(env);
  if (!shouldLog(configured, level)) return;
  // Keep payload JSON for easy log search; never include raw `value/data` content.
  console.log(JSON.stringify({ source: 'gemigo-cloud', level, ...event }));
}

function requireScope(scopes: string[], required: string): void {
  if (!scopes.includes(required)) {
    throw new UnauthorizedError(`Missing required scope: ${required}`);
  }
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function requireCollection(raw: string): string {
  const value = raw.trim();
  if (!value) throw new ValidationError('collection is required');
  if (value.length > 64) throw new ValidationError('collection is too long');
  if (!/^[a-z0-9][a-z0-9-_]*$/.test(value)) {
    throw new ValidationError('collection must be lowercase letters/numbers/-/_');
  }
  return value;
}

function requireKey(raw: unknown): string {
  if (typeof raw !== 'string') throw new ValidationError('key is required');
  const key = raw.trim();
  if (!key) throw new ValidationError('key cannot be empty');
  if (key.length > 256) throw new ValidationError('key is too long');
  return key;
}

function normalizeVisibility(raw: unknown): CloudVisibility {
  if (raw === undefined || raw === null) return 'private';
  if (typeof raw !== 'string') throw new ValidationError('visibility must be a string');
  const v = raw.trim();
  if (!v) return 'private';
  if (v.length > 32) throw new ValidationError('visibility is invalid');
  return v;
}

function normalizeOptionalString(raw: unknown, field: string, maxLen: number): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') throw new ValidationError(`${field} must be a string`);
  const v = raw.trim();
  if (!v) return null;
  if (v.length > maxLen) throw new ValidationError(`${field} is too long`);
  return v;
}

function requireDocId(raw: unknown): string {
  if (raw === undefined || raw === null) return crypto.randomUUID();
  if (typeof raw !== 'string') throw new ValidationError('id must be a string');
  const id = raw.trim();
  if (!id) throw new ValidationError('id cannot be empty');
  if (id.length > 64) throw new ValidationError('id is too long');
  if (!/^[a-zA-Z0-9-_]+$/.test(id)) throw new ValidationError('id is invalid');
  return id;
}

function parseCursor(raw: unknown): { ts: number; id: string } | null {
  if (!raw) return null;
  if (typeof raw !== 'string') return null;
  try {
    const decoded = JSON.parse(atob(raw)) as unknown;
    if (!decoded || typeof decoded !== 'object') return null;
    const rec = decoded as { ts?: unknown; id?: unknown };
    const ts = typeof rec.ts === 'number' ? rec.ts : Number(rec.ts);
    const id = typeof rec.id === 'string' ? rec.id : '';
    if (!Number.isFinite(ts) || !id) return null;
    return { ts, id };
  } catch {
    return null;
  }
}

function encodeCursor(cursor: { ts: number; id: string } | null): string | null {
  if (!cursor) return null;
  return btoa(JSON.stringify(cursor));
}

function parseKvCursor(raw: unknown): { updatedAt: number; key: string } | null {
  if (!raw) return null;
  if (typeof raw !== 'string') return null;
  try {
    const decoded = JSON.parse(atob(raw)) as unknown;
    if (!decoded || typeof decoded !== 'object') return null;
    const rec = decoded as { updatedAt?: unknown; key?: unknown };
    const updatedAt =
      typeof rec.updatedAt === 'number' ? rec.updatedAt : Number(rec.updatedAt);
    const key = typeof rec.key === 'string' ? rec.key : '';
    if (!Number.isFinite(updatedAt) || !key) return null;
    return { updatedAt, key };
  } catch {
    return null;
  }
}

function encodeKvCursor(cursor: { updatedAt: number; key: string } | null): string | null {
  if (!cursor) return null;
  return btoa(JSON.stringify(cursor));
}

function normalizeLimit(raw: unknown, max: number, fallback: number): number {
  if (raw === undefined || raw === null) return fallback;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

export class SdkCloudService {
  private async requireSdkContext(request: Request, db: D1Database): Promise<{
    appId: string;
    appUserId: string;
    scopes: string[];
  }> {
    const token = requireBearerToken(request);
    const record = await sdkAuthRepository.findAccessToken(db, token);
    if (!record) throw new UnauthorizedError('Invalid access token.');
    const nowIso = new Date().toISOString();
    if (record.expiresAt <= nowIso) {
      throw new UnauthorizedError('Access token expired.');
    }
    return { appId: record.appId, appUserId: record.appUserId, scopes: record.scopes };
  }

  // -----------------
  // Cloud KV
  // -----------------

  async kvGet(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    key: string,
  ): Promise<CloudKvGetResponse> {
    const startedAt = Date.now();
    const ctx = await this.requireSdkContext(request, db);
    requireScope(ctx.scopes, 'storage:rw');

    try {
      const row = await sdkCloudRepository.findKvItem(db, {
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        key,
      });
      if (!row) throw new ValidationError('Key not found.');

      const result = {
        key: row.key,
        value: parseJson(row.valueJson),
        etag: row.etag,
        updatedAt: row.updatedAt,
      };

      logCloudEvent(env, 'info', {
        op: 'kv_get',
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        key,
        ms: Date.now() - startedAt,
      });

      return result;
    } catch (err) {
      logCloudEvent(env, 'error', {
        op: 'kv_get',
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        key,
        ms: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async kvSet(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    input: CloudKvSetInput,
  ): Promise<CloudKvSetResponse> {
    const startedAt = Date.now();
    const ctx = await this.requireSdkContext(request, db);
    requireScope(ctx.scopes, 'storage:rw');

    const key = requireKey(input.key);
    const ifMatch = normalizeOptionalString(input.ifMatch, 'ifMatch', 128);

    try {
      const existing = await sdkCloudRepository.findKvItem(db, {
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        key,
      });
      if (ifMatch && existing && existing.etag !== ifMatch) {
        throw new ValidationError('etag_mismatch');
      }

      const valueJson = JSON.stringify(input.value ?? null);
      const valueBytes = new TextEncoder().encode(valueJson).byteLength;
      if (valueBytes > 64 * 1024) {
        throw new ValidationError('value_too_large');
      }

      const updatedAt = Date.now();
      const etag = crypto.randomUUID();
      const saved = await sdkCloudRepository.upsertKvItem(db, {
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        key,
        valueJson,
        valueBytes,
        updatedAt,
        etag,
      });

      logCloudEvent(env, 'info', {
        op: 'kv_set',
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        key,
        valueBytes,
        ms: Date.now() - startedAt,
      });

      return { key: saved.key, etag: saved.etag, updatedAt: saved.updatedAt };
    } catch (err) {
      logCloudEvent(env, 'error', {
        op: 'kv_set',
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        key,
        ms: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async kvDelete(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    input: CloudKvDeleteInput,
  ): Promise<void> {
    const startedAt = Date.now();
    const ctx = await this.requireSdkContext(request, db);
    requireScope(ctx.scopes, 'storage:rw');
    const key = requireKey(input.key);
    const ifMatch = normalizeOptionalString(input.ifMatch, 'ifMatch', 128);

    try {
      if (ifMatch) {
        const existing = await sdkCloudRepository.findKvItem(db, {
          appId: ctx.appId,
          appUserId: ctx.appUserId,
          key,
        });
        if (!existing) return;
        if (existing.etag !== ifMatch) {
          throw new ValidationError('etag_mismatch');
        }
      }

      await sdkCloudRepository.deleteKvItem(db, {
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        key,
      });

      logCloudEvent(env, 'info', {
        op: 'kv_delete',
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        key,
        ms: Date.now() - startedAt,
      });
    } catch (err) {
      logCloudEvent(env, 'error', {
        op: 'kv_delete',
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        key,
        ms: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async kvList(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    input: { prefix?: unknown; limit?: unknown; cursor?: unknown },
  ): Promise<CloudKvListResponse> {
    const startedAt = Date.now();
    const ctx = await this.requireSdkContext(request, db);
    requireScope(ctx.scopes, 'storage:rw');

    const prefix =
      typeof input.prefix === 'string' ? input.prefix.trim() : '';
    if (prefix.length > 256) throw new ValidationError('prefix too long');
    const limit = normalizeLimit(input.limit, 100, 20);
    const cursor = parseKvCursor(input.cursor);

    try {
      const { items, nextCursor } = await sdkCloudRepository.listKvItems(db, {
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        prefix,
        limit,
        cursor,
      });

      const result = {
        items: items.map((row) => ({
          key: row.key,
          etag: row.etag,
          updatedAt: row.updatedAt,
          valueBytes: row.valueBytes,
        })),
        nextCursor: encodeKvCursor(nextCursor),
      };

      logCloudEvent(env, 'info', {
        op: 'kv_list',
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        prefix,
        limit,
        returned: result.items.length,
        ms: Date.now() - startedAt,
      });

      return result;
    } catch (err) {
      logCloudEvent(env, 'error', {
        op: 'kv_list',
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        prefix,
        limit,
        ms: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  // -----------------
  // Cloud DB
  // -----------------

  async dbCreateDoc(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    collectionRaw: string,
    input: CloudDbCreateDocInput,
  ): Promise<CloudDbDocResponse> {
    const startedAt = Date.now();
    const ctx = await this.requireSdkContext(request, db);
    requireScope(ctx.scopes, 'db:rw');

    const collection = requireCollection(collectionRaw);
    const id = requireDocId(input.id);
    const visibility = normalizeVisibility(input.visibility);
    const refType = normalizeOptionalString(input.refType, 'refType', 64);
    const refId = normalizeOptionalString(input.refId, 'refId', 128);
    const dataJson = JSON.stringify(input.data ?? {});

    const bytes = new TextEncoder().encode(dataJson).byteLength;
    if (bytes > 256 * 1024) throw new ValidationError('doc_too_large');

    try {
      const now = Date.now();
      const etag = crypto.randomUUID();
      const row = await sdkCloudRepository.insertDbDoc(db, {
        appId: ctx.appId,
        collection,
        id,
        ownerId: ctx.appUserId,
        visibility,
        refType,
        refId,
        dataJson,
        createdAt: now,
        updatedAt: now,
        etag,
      });

      const result = {
        id: row.id,
        ownerId: row.ownerId,
        visibility: row.visibility,
        refType: row.refType,
        refId: row.refId,
        data: parseJson(row.dataJson),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        etag: row.etag,
      };

      logCloudEvent(env, 'info', {
        op: 'db_create',
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        collection,
        id,
        visibility,
        refType,
        refId,
        bytes,
        ms: Date.now() - startedAt,
      });

      return result;
    } catch (err) {
      logCloudEvent(env, 'error', {
        op: 'db_create',
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        collection,
        id,
        ms: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async dbGetDoc(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    collectionRaw: string,
    id: string,
  ): Promise<CloudDbDocResponse> {
    const startedAt = Date.now();
    const ctx = await this.requireSdkContext(request, db);
    requireScope(ctx.scopes, 'db:rw');

    const collection = requireCollection(collectionRaw);
    try {
      const row = await sdkCloudRepository.findDbDoc(db, { appId: ctx.appId, collection, id });
      if (!row) throw new ValidationError('not_found');

      const isOwner = row.ownerId === ctx.appUserId;
      const isPublic = String(row.visibility).toLowerCase() === 'public';
      if (!isOwner && !isPublic) {
        throw new UnauthorizedError('forbidden');
      }

      const result = {
        id: row.id,
        ownerId: row.ownerId,
        visibility: row.visibility,
        refType: row.refType,
        refId: row.refId,
        data: parseJson(row.dataJson),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        etag: row.etag,
      };

      logCloudEvent(env, 'info', {
        op: 'db_get',
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        collection,
        id,
        ms: Date.now() - startedAt,
      });

      return result;
    } catch (err) {
      logCloudEvent(env, 'error', {
        op: 'db_get',
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        collection,
        id,
        ms: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async dbUpdateDoc(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    collectionRaw: string,
    id: string,
    input: CloudDbUpdateDocInput,
  ): Promise<CloudDbDocResponse> {
    const startedAt = Date.now();
    const ctx = await this.requireSdkContext(request, db);
    requireScope(ctx.scopes, 'db:rw');

    const collection = requireCollection(collectionRaw);
    try {
      const existing = await sdkCloudRepository.findDbDoc(db, { appId: ctx.appId, collection, id });
      if (!existing) throw new ValidationError('not_found');
      if (existing.ownerId !== ctx.appUserId) throw new UnauthorizedError('forbidden');

      const ifMatch = normalizeOptionalString(input.ifMatch, 'ifMatch', 128);
      if (ifMatch && existing.etag !== ifMatch) throw new ValidationError('etag_mismatch');

      const visibility =
        input.visibility === undefined ? existing.visibility : normalizeVisibility(input.visibility);
      const refType =
        input.refType === undefined
          ? existing.refType
          : normalizeOptionalString(input.refType, 'refType', 64);
      const refId =
        input.refId === undefined
          ? existing.refId
          : normalizeOptionalString(input.refId, 'refId', 128);

      const currentData = parseJson(existing.dataJson);
      const patch = input.patch ?? {};
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        throw new ValidationError('patch must be an object');
      }
      const merged = { ...asObject(currentData), ...asObject(patch) };
      const dataJson = JSON.stringify(merged);
      const bytes = new TextEncoder().encode(dataJson).byteLength;
      if (bytes > 256 * 1024) throw new ValidationError('doc_too_large');

      const updatedAt = Date.now();
      const etag = crypto.randomUUID();
      const updated = await sdkCloudRepository.updateDbDoc(db, {
        appId: ctx.appId,
        collection,
        id,
        visibility,
        refType,
        refId,
        dataJson,
        updatedAt,
        etag,
      });
      if (!updated) throw new ValidationError('not_found');

      const result = {
        id: updated.id,
        ownerId: updated.ownerId,
        visibility: updated.visibility,
        refType: updated.refType,
        refId: updated.refId,
        data: parseJson(updated.dataJson),
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        etag: updated.etag,
      };

      logCloudEvent(env, 'info', {
        op: 'db_update',
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        collection,
        id,
        bytes,
        ms: Date.now() - startedAt,
      });

      return result;
    } catch (err) {
      logCloudEvent(env, 'error', {
        op: 'db_update',
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        collection,
        id,
        ms: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async dbDeleteDoc(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    collectionRaw: string,
    id: string,
  ): Promise<void> {
    const startedAt = Date.now();
    const ctx = await this.requireSdkContext(request, db);
    requireScope(ctx.scopes, 'db:rw');

    const collection = requireCollection(collectionRaw);
    try {
      const existing = await sdkCloudRepository.findDbDoc(db, { appId: ctx.appId, collection, id });
      if (!existing) return;
      if (existing.ownerId !== ctx.appUserId) throw new UnauthorizedError('forbidden');
      await sdkCloudRepository.deleteDbDoc(db, { appId: ctx.appId, collection, id });

      logCloudEvent(env, 'info', {
        op: 'db_delete',
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        collection,
        id,
        ms: Date.now() - startedAt,
      });
    } catch (err) {
      logCloudEvent(env, 'error', {
        op: 'db_delete',
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        collection,
        id,
        ms: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async dbQuery(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    collectionRaw: string,
    input: CloudDbQueryInput,
  ): Promise<CloudDbQueryResponse> {
    const startedAt = Date.now();
    const ctx = await this.requireSdkContext(request, db);
    requireScope(ctx.scopes, 'db:rw');

    const collection = requireCollection(collectionRaw);
    const whereList = Array.isArray(input.where) ? input.where : [];
    const where: { ownerId?: string; visibility?: string; refType?: string; refId?: string } = {};

    for (const cond of whereList) {
      if (!cond || typeof cond !== 'object') continue;
      const c = cond as { field?: unknown; op?: unknown; value?: unknown };
      if (c.op !== '==') continue;
      const value = typeof c.value === 'string' ? c.value : '';
      if (!value) continue;
      if (c.field === 'ownerId') where.ownerId = value;
      if (c.field === 'visibility') where.visibility = value;
      if (c.field === 'refType') where.refType = value;
      if (c.field === 'refId') where.refId = value;
    }

    if (where.ownerId && where.ownerId !== ctx.appUserId) {
      throw new UnauthorizedError('forbidden');
    }

    const orderBy = input.orderBy ?? { field: 'createdAt', direction: 'desc' };
    const field = orderBy.field === 'updatedAt' ? 'updatedAt' : 'createdAt';
    const direction = orderBy.direction === 'asc' ? 'asc' : 'desc';
    const limit = normalizeLimit(input.limit, 100, 20);
    const cursor = parseCursor(input.cursor);

    try {
      const { items, nextCursor } = await sdkCloudRepository.queryDbDocs(db, {
        appId: ctx.appId,
        collection,
        where: {
          ownerId: where.ownerId,
          visibility: where.visibility,
          refType: where.refType,
          refId: where.refId,
        },
        orderBy: { field, direction },
        limit,
        cursor,
      });

      const visible = items.filter((row) => {
        if (row.ownerId === ctx.appUserId) return true;
        return String(row.visibility).toLowerCase() === 'public';
      });

      const result = {
        items: visible.map((row) => ({
          id: row.id,
          ownerId: row.ownerId,
          visibility: row.visibility,
          refType: row.refType,
          refId: row.refId,
          data: parseJson(row.dataJson),
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          etag: row.etag,
        })),
        nextCursor: encodeCursor(nextCursor),
      };

      logCloudEvent(env, 'info', {
        op: 'db_query',
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        collection,
        where,
        orderBy: { field, direction },
        limit,
        returned: result.items.length,
        ms: Date.now() - startedAt,
      });

      return result;
    } catch (err) {
      logCloudEvent(env, 'error', {
        op: 'db_query',
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        collection,
        where,
        orderBy: { field, direction },
        limit,
        ms: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }
}

export const sdkCloudService = new SdkCloudService();

import { sdkAuthRepository } from '../repositories/sdk-auth.repository';
import { sdkCloudRepository } from '../repositories/sdk-cloud.repository';
import { ConfigurationError, NotFoundError, UnauthorizedError, ValidationError } from '../utils/error-handler';
import type { ApiWorkerEnv } from '../types/env';
import { parseSecurityRulesV0, rulesBranches, type SecurityRulesV0 } from '../utils/sdk-cloud-rules';
import type {
  CloudDbCreateDocInput,
  CloudDbDocResponse,
  CloudDbWhereOp,
  CloudDbWhere,
  CloudDbQueryInput,
  CloudDbQueryResponse,
  CloudDbCountResponse,
  CloudDbWhereUpdateInput,
  CloudDbWhereUpdateResponse,
  CloudDbWhereRemoveInput,
  CloudDbWhereRemoveResponse,
  CloudDbSetDocInput,
  CloudDbUpdateDocInput,
  CloudBlobCreateUploadUrlInput,
  CloudBlobCreateUploadUrlResponse,
  CloudBlobGetDownloadUrlInput,
  CloudBlobGetDownloadUrlResponse,
  CloudFunctionsCallInput,
  CloudFunctionsCallResponse,
  CloudKvDeleteInput,
  CloudKvGetResponse,
  CloudKvListResponse,
  CloudKvSetInput,
  CloudKvSetResponse,
  CloudVisibility,
} from '../types/sdk-cloud';
import type { CloudDbPermissionMode } from '../repositories/sdk-cloud.repository';

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

type WxServerDateSentinel = { __gemigoWxType: 'serverDate'; offset?: number };

function isWxServerDateSentinel(value: unknown): value is WxServerDateSentinel {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const rec = value as { __gemigoWxType?: unknown; offset?: unknown };
  if (rec.__gemigoWxType !== 'serverDate') return false;
  if (rec.offset === undefined) return true;
  return typeof rec.offset === 'number' && Number.isFinite(rec.offset);
}

function materializeWxSentinels(value: unknown, depth = 0): unknown {
  if (depth > 50) return null;

  if (isWxServerDateSentinel(value)) {
    const offset = typeof value.offset === 'number' && Number.isFinite(value.offset) ? value.offset : 0;
    return Date.now() + offset;
  }

  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => materializeWxSentinels(v, depth + 1));

  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = materializeWxSentinels(v, depth + 1);
  }
  return out;
}

function stripWxSystemFields(
  value: unknown,
  mode: 'strict' | 'lenient',
  depth = 0,
): unknown {
  if (depth > 50) return null;
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => stripWxSystemFields(v, mode, depth + 1));

  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === '_openid') {
      if (mode === 'strict') throw new ValidationError('cannot_write_system_field:_openid');
      continue;
    }
    if (k === '_id') continue;
    out[k] = stripWxSystemFields(v, mode, depth + 1);
  }
  return out;
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
  const lowered = v.toLowerCase();
  if (lowered === 'private' || lowered === 'public') return lowered;
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

function isCloudDbPermissionMode(value: unknown): value is CloudDbPermissionMode {
  return (
    value === 'all_read_creator_write' ||
    value === 'creator_read_write' ||
    value === 'all_read_readonly' ||
    value === 'none'
  );
}

async function resolveDbPermissionMode(
  db: D1Database,
  input: { appId: string; collection: string },
): Promise<CloudDbPermissionMode> {
  const row = await sdkCloudRepository.getDbCollectionPermission(db, input);
  if (row && isCloudDbPermissionMode(row.mode)) return row.mode;
  return 'creator_read_write';
}

function requireWriteAllowed(mode: CloudDbPermissionMode): void {
  if (mode === 'all_read_readonly' || mode === 'none') {
    throw new UnauthorizedError('forbidden');
  }
}

function requireReadAllowed(mode: CloudDbPermissionMode): void {
  if (mode === 'none') throw new UnauthorizedError('forbidden');
}

async function resolveSecurityRules(
  db: D1Database,
  input: { appId: string; collection: string },
): Promise<SecurityRulesV0 | null> {
  const row = await sdkCloudRepository.getDbCollectionSecurityRules(db, input);
  if (!row) return null;
  const parsed = JSON.parse(row.rulesJson) as unknown;
  return parseSecurityRulesV0(parsed);
}

function hasQueryEq(
  conditions: Array<{ field: string; op: CloudDbWhereOp; value: unknown }>,
  field: string,
  predicate?: (value: unknown) => boolean,
): boolean {
  return conditions.some(
    (c) => c.op === '==' && c.field.trim() === field && (predicate ? predicate(c.value) : true),
  );
}

function enforceSecurityRulesQuerySubset(
  rules: SecurityRulesV0,
  expr: 'read' | 'write',
  conditions: Array<{ field: string; op: CloudDbWhereOp; value: unknown }>,
  ctx: { appUserId: string },
): void {
  // v0: query must include all equality constraints of at least one branch.
  const branches = rulesBranches(expr === 'read' ? rules.read : rules.write);
  const ok = branches.some((branch) =>
    branch.allOf.every((cond) => {
      const field = cond.field;
      if (cond.value && typeof cond.value === 'object' && 'var' in cond.value && cond.value.var === 'auth.openid') {
        return (
          hasQueryEq(conditions, field, (v) => String(v ?? '') === ctx.appUserId) ||
          (field === '_openid' && hasQueryEq(conditions, 'ownerId', (v) => String(v ?? '') === ctx.appUserId)) ||
          (field === 'ownerId' && hasQueryEq(conditions, '_openid', (v) => String(v ?? '') === ctx.appUserId))
        );
      }
      return hasQueryEq(conditions, field, (v) => JSON.stringify(v) === JSON.stringify(cond.value));
    }),
  );

  if (!ok) throw new UnauthorizedError('query_not_subset_of_rules');
}

function evalRulesForDoc(
  rules: SecurityRulesV0,
  expr: 'read' | 'write',
  doc: Record<string, unknown>,
  ctx: { appUserId: string },
): boolean {
  const branches = rulesBranches(expr === 'read' ? rules.read : rules.write);
  return branches.some((branch) =>
    branch.allOf.every((cond) => {
      const value = doc[cond.field];
      if (cond.value && typeof cond.value === 'object' && 'var' in cond.value && cond.value.var === 'auth.openid') {
        return String(value ?? '') === ctx.appUserId;
      }
      return JSON.stringify(value) === JSON.stringify(cond.value);
    }),
  );
}

type DbCursorV0 = { ts: number; id: string };
type DbCursorV1 = { v: 1; q: string; last: { isNull: 0 | 1; v: unknown; id: string } };

type ParsedDbCursor =
  | { version: 1; q: string; last: { isNull: 0 | 1; v: unknown; id: string } }
  | { version: 0; last: { isNull: 0 | 1; v: number; id: string } };

function normalizeJsonForKey(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(normalizeJsonForKey);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) out[key] = normalizeJsonForKey(obj[key]);
    return out;
  }
  return String(value);
}

function buildDbQueryKey(input: {
  collection: string;
  orderBy: { field: string; direction: 'asc' | 'desc' };
  where: CloudDbWhere[];
}): string {
  const normalizedWhere = input.where
    .map((c) => ({
      field: typeof c.field === 'string' ? c.field.trim() : '',
      op: normalizeDbWhereOp(c.op),
      value: normalizeJsonForKey(c.value),
    }))
    .filter((c) => Boolean(c.field))
    .sort((a, b) => {
      if (a.field !== b.field) return a.field < b.field ? -1 : 1;
      if (a.op !== b.op) return a.op < b.op ? -1 : 1;
      const av = JSON.stringify(a.value);
      const bv = JSON.stringify(b.value);
      if (av !== bv) return av < bv ? -1 : 1;
      return 0;
    });
  return JSON.stringify({
    collection: input.collection,
    orderBy: input.orderBy,
    where: normalizedWhere,
  });
}

function parseCursor(raw: unknown): ParsedDbCursor | null {
  if (!raw) return null;
  if (typeof raw !== 'string') return null;
  try {
    const decoded = JSON.parse(atob(raw)) as unknown;
    if (!decoded || typeof decoded !== 'object') return null;
    const rec = decoded as Record<string, unknown>;

    if (rec['v'] === 1) {
      const q = typeof rec['q'] === 'string' ? rec['q'] : '';
      const last = rec['last'];
      if (!q || !last || typeof last !== 'object' || Array.isArray(last)) return null;
      const lastRec = last as Record<string, unknown>;
      const id = typeof lastRec['id'] === 'string' ? lastRec['id'] : '';
      const isNull = lastRec['isNull'] === 1 ? 1 : 0;
      const v = lastRec['v'];
      if (!id) return null;
      return { version: 1, q, last: { isNull, v, id } };
    }

    const v0 = rec as Partial<DbCursorV0>;
    const ts = typeof v0.ts === 'number' ? v0.ts : Number(v0.ts);
    const id = typeof v0.id === 'string' ? v0.id : '';
    if (!Number.isFinite(ts) || !id) return null;
    return { version: 0, last: { isNull: 0, v: ts, id } };
  } catch {
    return null;
  }
}

function encodeCursor(cursor: { q: string; last: { isNull: 0 | 1; v: unknown; id: string } } | null): string | null {
  if (!cursor) return null;
  return btoa(JSON.stringify({ v: 1, q: cursor.q, last: cursor.last } satisfies DbCursorV1));
}

function isWxCommandExpr(value: unknown): value is { __gemigoWxCmd: string; value?: unknown } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return typeof (value as Record<string, unknown>)['__gemigoWxCmd'] === 'string';
}

function applyWxUpdatePatch(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...current };
  for (const [field, raw] of Object.entries(patch)) {
    if (!field) continue;
    if (field.includes('.')) throw new ValidationError('nested_update_not_supported');

    if (!isWxCommandExpr(raw)) {
      next[field] = raw;
      continue;
    }

    const cmd = raw.__gemigoWxCmd;
    if (cmd === 'set') {
      next[field] = raw.value;
      continue;
    }
    if (cmd === 'remove') {
      delete next[field];
      continue;
    }
    if (cmd === 'inc') {
      const delta = Number(raw.value);
      if (!Number.isFinite(delta)) throw new ValidationError('inc requires a finite number');
      const prev = Number(next[field] ?? 0);
      next[field] = (Number.isFinite(prev) ? prev : 0) + delta;
      continue;
    }

    throw new ValidationError(`unsupported_update_command:${cmd}`);
  }
  return next;
}

function normalizeDbWhereOp(raw: unknown): CloudDbWhereOp {
  // Support wx-style command names (db.command.*) and their operator equivalents.
  if (raw === 'eq') return '==';
  if (raw === 'neq') return '!=';
  if (raw === 'gt') return '>';
  if (raw === 'gte') return '>=';
  if (raw === 'lt') return '<';
  if (raw === 'lte') return '<=';
  if (raw === '==' || raw === '!=' || raw === '<' || raw === '<=' || raw === '>' || raw === '>=' || raw === 'in' || raw === 'nin') {
    return raw;
  }
  return '==';
}

function normalizeDbWhereInput(whereRaw: unknown): CloudDbWhere[] {
  if (!whereRaw) return [];

  if (Array.isArray(whereRaw)) {
    return whereRaw
      .filter((x) => Boolean(x && typeof x === 'object'))
      .map((x) => {
        const rec = x as Record<string, unknown>;
        return {
          field: typeof rec['field'] === 'string' ? (rec['field'] as string) : '',
          op: normalizeDbWhereOp(rec['op']),
          value: rec['value'],
        } satisfies CloudDbWhere;
      })
      .filter((x) => Boolean(x.field));
  }

  if (typeof whereRaw === 'object') {
    const obj = whereRaw as Record<string, unknown>;
    const out: CloudDbWhere[] = [];
    for (const [field, raw] of Object.entries(obj)) {
      if (!field) continue;
      if (isWxCommandExpr(raw)) {
        out.push({ field, op: normalizeDbWhereOp(raw.__gemigoWxCmd), value: raw.value });
      } else {
        out.push({ field, op: '==', value: raw });
      }
    }
    return out;
  }

  return [];
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

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacSha256Base64Url(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return base64UrlEncode(new Uint8Array(sig));
}

type BlobTokenOp = 'upload' | 'download';
type BlobTokenPayload = {
  op: BlobTokenOp;
  key: string;
  exp: number;
  contentType?: string | null;
};

async function signBlobToken(secret: string, payload: BlobTokenPayload): Promise<string> {
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const sigB64 = await hmacSha256Base64Url(secret, payloadB64);
  return `${payloadB64}.${sigB64}`;
}

async function verifyBlobToken(secret: string, token: string): Promise<BlobTokenPayload> {
  const parts = token.split('.');
  if (parts.length !== 2) throw new ValidationError('invalid_token');
  const [payloadB64, sigB64] = parts;
  const expected = await hmacSha256Base64Url(secret, payloadB64);
  if (expected !== sigB64) throw new ValidationError('invalid_token');
  const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
  const payload = JSON.parse(payloadJson) as BlobTokenPayload;
  if (!payload || typeof payload !== 'object') throw new ValidationError('invalid_token');
  if (payload.op !== 'upload' && payload.op !== 'download') throw new ValidationError('invalid_token');
  if (typeof payload.key !== 'string' || !payload.key) throw new ValidationError('invalid_token');
  if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) throw new ValidationError('invalid_token');
  if (Date.now() > payload.exp) throw new ValidationError('token_expired');
  return payload;
}

function requireBlobSigningSecret(env: ApiWorkerEnv): string {
  const secret = env.SDK_CLOUD_BLOB_SIGNING_SECRET?.trim();
  if (!secret) {
    throw new ConfigurationError('Missing SDK_CLOUD_BLOB_SIGNING_SECRET (required for cloud.blob).');
  }
  return secret;
}

function requireBlobBucket(env: ApiWorkerEnv): R2Bucket {
  if (!env.ASSETS) throw new ConfigurationError('R2 bucket binding "ASSETS" is not configured.');
  return env.ASSETS;
}

function requireBlobVisibility(raw: unknown): 'private' | 'public' {
  const v = normalizeVisibility(raw).toLowerCase();
  if (v === 'private' || v === 'public') return v;
  throw new ValidationError('visibility must be "private" or "public"');
}

function normalizeBlobPath(raw: unknown): string {
  if (raw === undefined || raw === null) return crypto.randomUUID();
  if (typeof raw !== 'string') throw new ValidationError('path must be a string');
  const trimmed = raw.trim().replace(/^\/+/, '');
  if (!trimmed) return crypto.randomUUID();
  if (trimmed.length > 512) throw new ValidationError('path is too long');
  const parts = trimmed.split('/');
  if (parts.some((p) => !p || p === '.' || p === '..')) throw new ValidationError('path is invalid');
  if (parts.some((p) => p.length > 128)) throw new ValidationError('path is invalid');
  return parts.join('/');
}

function buildBlobKey(input: {
  appId: string;
  appUserId: string;
  visibility: 'private' | 'public';
  path: string;
}): string {
  return `sdk-cloud/blobs/${input.appId}/${input.visibility}/${input.appUserId}/${input.path}`;
}

function parseBlobKey(key: string): { appId: string; visibility: 'private' | 'public'; ownerId: string } | null {
  const parts = key.split('/');
  // sdk-cloud/blobs/<appId>/<visibility>/<ownerId>/<...path>
  if (parts.length < 6) return null;
  if (parts[0] !== 'sdk-cloud' || parts[1] !== 'blobs') return null;
  const appId = parts[2] ?? '';
  const visibility = parts[3] ?? '';
  const ownerId = parts[4] ?? '';
  if (!appId || !ownerId) return null;
  if (visibility !== 'private' && visibility !== 'public') return null;
  return { appId, visibility, ownerId };
}

function requireFunctionName(raw: unknown): string {
  if (typeof raw !== 'string') throw new ValidationError('name is required');
  const name = raw.trim();
  if (!name) throw new ValidationError('name is required');
  if (name.length > 128) throw new ValidationError('name is too long');
  if (!/^[a-zA-Z0-9._:-]+$/.test(name)) throw new ValidationError('name is invalid');
  return name;
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
    const sanitized = stripWxSystemFields(materializeWxSentinels(input.data ?? {}), 'strict');
    const dataJson = JSON.stringify(sanitized ?? {});

    const bytes = new TextEncoder().encode(dataJson).byteLength;
    if (bytes > 256 * 1024) throw new ValidationError('doc_too_large');

    try {
      const rules = await resolveSecurityRules(db, { appId: ctx.appId, collection });
      if (rules) {
        const docForRules = {
          ...asObject(sanitized),
          _id: id,
          _openid: ctx.appUserId,
          visibility,
          refType,
          refId,
        };
        if (!evalRulesForDoc(rules, 'write', docForRules, { appUserId: ctx.appUserId })) {
          throw new UnauthorizedError('forbidden');
        }
      } else {
        const permissionMode = await resolveDbPermissionMode(db, { appId: ctx.appId, collection });
        requireWriteAllowed(permissionMode);
      }

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

      const rules = await resolveSecurityRules(db, { appId: ctx.appId, collection });
      if (rules) {
        const docForRules = {
          ...asObject(parseJson(row.dataJson)),
          _id: row.id,
          _openid: row.ownerId,
          visibility: row.visibility,
          refType: row.refType,
          refId: row.refId,
        };
        if (!evalRulesForDoc(rules, 'read', docForRules, { appUserId: ctx.appUserId })) {
          throw new UnauthorizedError('forbidden');
        }
      } else {
        const permissionMode = await resolveDbPermissionMode(db, { appId: ctx.appId, collection });
        requireReadAllowed(permissionMode);
        if (permissionMode === 'creator_read_write' && row.ownerId !== ctx.appUserId) {
          throw new UnauthorizedError('forbidden');
        }
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
      const rules = await resolveSecurityRules(db, { appId: ctx.appId, collection });
      if (rules) {
        const docForRules = {
          ...asObject(parseJson(existing.dataJson)),
          _id: existing.id,
          _openid: existing.ownerId,
          visibility: existing.visibility,
          refType: existing.refType,
          refId: existing.refId,
        };
        if (!evalRulesForDoc(rules, 'write', docForRules, { appUserId: ctx.appUserId })) {
          throw new UnauthorizedError('forbidden');
        }
      } else {
        const permissionMode = await resolveDbPermissionMode(db, { appId: ctx.appId, collection });
        requireWriteAllowed(permissionMode);
        if (existing.ownerId !== ctx.appUserId) throw new UnauthorizedError('forbidden');
      }

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
      const sanitizedCurrent = stripWxSystemFields(currentData, 'lenient');
      const sanitizedPatch = stripWxSystemFields(materializeWxSentinels(patch), 'strict');
      const merged = applyWxUpdatePatch(asObject(sanitizedCurrent), asObject(sanitizedPatch));
      const normalized = merged;
      const dataJson = JSON.stringify(normalized ?? {});
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

  async dbSetDoc(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    collectionRaw: string,
    id: string,
    input: CloudDbSetDocInput,
  ): Promise<CloudDbDocResponse> {
    const startedAt = Date.now();
    const ctx = await this.requireSdkContext(request, db);
    requireScope(ctx.scopes, 'db:rw');

    const collection = requireCollection(collectionRaw);
    const docId = requireDocId(id);

    try {
      const existing = await sdkCloudRepository.findDbDoc(db, {
        appId: ctx.appId,
        collection,
        id: docId,
      });

      const rules = await resolveSecurityRules(db, { appId: ctx.appId, collection });
      if (rules) {
        const existingDocForRules = existing
          ? {
              ...asObject(parseJson(existing.dataJson)),
              _id: existing.id,
              _openid: existing.ownerId,
              visibility: existing.visibility,
              refType: existing.refType,
              refId: existing.refId,
            }
          : null;
        if (existingDocForRules) {
          if (!evalRulesForDoc(rules, 'write', existingDocForRules, { appUserId: ctx.appUserId })) {
            throw new UnauthorizedError('forbidden');
          }
        }
      } else {
        const permissionMode = await resolveDbPermissionMode(db, { appId: ctx.appId, collection });
        requireWriteAllowed(permissionMode);
        if (existing && existing.ownerId !== ctx.appUserId) {
          throw new UnauthorizedError('forbidden');
        }
      }

      const ifMatch = normalizeOptionalString(input.ifMatch, 'ifMatch', 128);
      if (existing && ifMatch && existing.etag !== ifMatch) throw new ValidationError('etag_mismatch');

      const visibility =
        input.visibility === undefined
          ? existing?.visibility ?? 'private'
          : normalizeVisibility(input.visibility);
      const refType =
        input.refType === undefined
          ? existing?.refType ?? null
          : normalizeOptionalString(input.refType, 'refType', 64);
      const refId =
        input.refId === undefined
          ? existing?.refId ?? null
          : normalizeOptionalString(input.refId, 'refId', 128);

      const sanitized = stripWxSystemFields(materializeWxSentinels(input.data ?? {}), 'strict');
      const dataJson = JSON.stringify(sanitized ?? {});
      const bytes = new TextEncoder().encode(dataJson).byteLength;
      if (bytes > 256 * 1024) throw new ValidationError('doc_too_large');

      if (rules) {
        const docForRules = {
          ...asObject(sanitized),
          _id: docId,
          _openid: existing?.ownerId ?? ctx.appUserId,
          visibility,
          refType,
          refId,
        };
        if (!evalRulesForDoc(rules, 'write', docForRules, { appUserId: ctx.appUserId })) {
          throw new UnauthorizedError('forbidden');
        }
      }

      const now = Date.now();
      const etag = crypto.randomUUID();
      const row = await sdkCloudRepository.upsertDbDoc(db, {
        appId: ctx.appId,
        collection,
        id: docId,
        ownerId: existing?.ownerId ?? ctx.appUserId,
        visibility,
        refType,
        refId,
        dataJson,
        createdAt: existing?.createdAt ?? now,
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
        op: 'db_set',
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        collection,
        id: docId,
        bytes,
        ms: Date.now() - startedAt,
      });

      return result;
    } catch (err) {
      logCloudEvent(env, 'error', {
        op: 'db_set',
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        collection,
        id: docId,
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
      const rules = await resolveSecurityRules(db, { appId: ctx.appId, collection });
      if (rules) {
        const docForRules = {
          ...asObject(parseJson(existing.dataJson)),
          _id: existing.id,
          _openid: existing.ownerId,
          visibility: existing.visibility,
          refType: existing.refType,
          refId: existing.refId,
        };
        if (!evalRulesForDoc(rules, 'write', docForRules, { appUserId: ctx.appUserId })) {
          throw new UnauthorizedError('forbidden');
        }
      } else {
        const permissionMode = await resolveDbPermissionMode(db, { appId: ctx.appId, collection });
        requireWriteAllowed(permissionMode);
        if (existing.ownerId !== ctx.appUserId) throw new UnauthorizedError('forbidden');
      }
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
    const rules = await resolveSecurityRules(db, { appId: ctx.appId, collection });
    const conditions = normalizeDbWhereInput(input.where).map((c) => ({
      field: c.field,
      op: c.op,
      value: materializeWxSentinels(c.value),
    }));
    if (rules) {
      enforceSecurityRulesQuerySubset(rules, 'read', conditions, { appUserId: ctx.appUserId });
    } else {
      const permissionMode = await resolveDbPermissionMode(db, { appId: ctx.appId, collection });
      requireReadAllowed(permissionMode);
      if (permissionMode === 'creator_read_write') {
        conditions.push({ field: '_openid', op: '==', value: ctx.appUserId });
      }
    }

    const orderBy = input.orderBy ?? { field: 'createdAt', direction: 'desc' };
    const field = typeof orderBy.field === 'string' ? orderBy.field : 'createdAt';
    const direction = orderBy.direction === 'asc' ? 'asc' : 'desc';
    const limit = normalizeLimit(input.limit, 100, 20);
    const cursor = parseCursor(input.cursor);
    if (input.cursor && !cursor) {
      throw new ValidationError('invalid_cursor');
    }
    const queryKey = buildDbQueryKey({
      collection,
      orderBy: { field, direction },
      where: conditions,
    });

    if (cursor?.version === 1 && cursor.q !== queryKey) {
      throw new ValidationError('cursor_mismatch');
    }

    try {
      const { items, nextCursor } = await sdkCloudRepository.queryDbDocs(db, {
        appId: ctx.appId,
        collection,
        conditions,
        orderBy: { field, direction },
        limit,
        cursor: cursor ? { field, direction, ...cursor.last } : null,
      });

      const result = {
        items: items.map((row) => ({
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
        nextCursor: encodeCursor(nextCursor ? { q: queryKey, last: nextCursor } : null),
      };

      logCloudEvent(env, 'info', {
        op: 'db_query',
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        collection,
        where: conditions,
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
        where: conditions,
        orderBy: { field, direction },
        limit,
        ms: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async dbCount(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    collectionRaw: string,
    input: CloudDbQueryInput,
  ): Promise<CloudDbCountResponse> {
    const startedAt = Date.now();
    const ctx = await this.requireSdkContext(request, db);
    requireScope(ctx.scopes, 'db:rw');
    const collection = requireCollection(collectionRaw);
    const rules = await resolveSecurityRules(db, { appId: ctx.appId, collection });
    const conditions = normalizeDbWhereInput(input.where).map((c) => ({
      field: c.field,
      op: c.op,
      value: materializeWxSentinels(c.value),
    }));
    if (rules) {
      enforceSecurityRulesQuerySubset(rules, 'read', conditions, { appUserId: ctx.appUserId });
    } else {
      const permissionMode = await resolveDbPermissionMode(db, { appId: ctx.appId, collection });
      requireReadAllowed(permissionMode);
      if (permissionMode === 'creator_read_write') {
        conditions.push({ field: '_openid', op: '==', value: ctx.appUserId });
      }
    }

    try {
      const total = await sdkCloudRepository.countDbDocs(db, {
        appId: ctx.appId,
        collection,
        conditions,
      });

      logCloudEvent(env, 'info', {
        op: 'db_count',
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        collection,
        where: conditions,
        ms: Date.now() - startedAt,
      });

      return { total };
    } catch (err) {
      logCloudEvent(env, 'error', {
        op: 'db_count',
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        collection,
        where: conditions,
        ms: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async dbWhereRemove(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    collectionRaw: string,
    input: CloudDbWhereRemoveInput,
  ): Promise<CloudDbWhereRemoveResponse> {
    const startedAt = Date.now();
    const ctx = await this.requireSdkContext(request, db);
    requireScope(ctx.scopes, 'db:rw');
    const collection = requireCollection(collectionRaw);
    const conditions = normalizeDbWhereInput(input.where).map((c) => ({
      field: c.field,
      op: c.op,
      value: materializeWxSentinels(c.value),
    }));

    try {
      const rules = await resolveSecurityRules(db, { appId: ctx.appId, collection });
      let removed = 0;
      if (rules) {
        enforceSecurityRulesQuerySubset(rules, 'write', conditions, { appUserId: ctx.appUserId });
        const docs = await sdkCloudRepository.listDbDocs(db, {
          appId: ctx.appId,
          collection,
          conditions,
          limit: 1000,
        });
        for (const doc of docs) {
          const docForRules = {
            ...asObject(parseJson(doc.dataJson)),
            _id: doc.id,
            _openid: doc.ownerId,
            visibility: doc.visibility,
            refType: doc.refType,
            refId: doc.refId,
          };
          if (!evalRulesForDoc(rules, 'write', docForRules, { appUserId: ctx.appUserId })) continue;
          await sdkCloudRepository.deleteDbDoc(db, { appId: ctx.appId, collection, id: doc.id });
          removed += 1;
        }
      } else {
        const permissionMode = await resolveDbPermissionMode(db, { appId: ctx.appId, collection });
        requireWriteAllowed(permissionMode);
        const removedNow = await sdkCloudRepository.removeDbDocs(db, {
          appId: ctx.appId,
          collection,
          ownerId: ctx.appUserId,
          conditions,
        });
        removed = removedNow;
      }

      logCloudEvent(env, 'info', {
        op: 'db_where_remove',
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        collection,
        where: conditions,
        removed,
        ms: Date.now() - startedAt,
      });

      return { stats: { removed } };
    } catch (err) {
      logCloudEvent(env, 'error', {
        op: 'db_where_remove',
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        collection,
        where: conditions,
        ms: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async dbWhereUpdate(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    collectionRaw: string,
    input: CloudDbWhereUpdateInput,
  ): Promise<CloudDbWhereUpdateResponse> {
    const startedAt = Date.now();
    const ctx = await this.requireSdkContext(request, db);
    requireScope(ctx.scopes, 'db:rw');

    const collection = requireCollection(collectionRaw);
    const conditions = normalizeDbWhereInput(input.where).map((c) => ({
      field: c.field,
      op: c.op,
      value: materializeWxSentinels(c.value),
    }));

    try {
      const rules = await resolveSecurityRules(db, { appId: ctx.appId, collection });
      const patchRaw = input.data;
      if (!patchRaw || typeof patchRaw !== 'object' || Array.isArray(patchRaw)) {
        throw new ValidationError('update data must be an object');
      }
      const sanitizedPatch = stripWxSystemFields(materializeWxSentinels(patchRaw), 'strict');

      let docs: Awaited<ReturnType<typeof sdkCloudRepository.listDbDocs>>;
      if (rules) {
        enforceSecurityRulesQuerySubset(rules, 'write', conditions, { appUserId: ctx.appUserId });
        docs = await sdkCloudRepository.listDbDocs(db, { appId: ctx.appId, collection, conditions, limit: 1000 });
      } else {
        const permissionMode = await resolveDbPermissionMode(db, { appId: ctx.appId, collection });
        requireWriteAllowed(permissionMode);
        docs = await sdkCloudRepository.listDbDocsForOwner(db, {
          appId: ctx.appId,
          collection,
          ownerId: ctx.appUserId,
          conditions,
          limit: 1000,
        });
      }

      const updates = docs.flatMap((row) => {
        if (rules) {
          const docForRules = {
            ...asObject(parseJson(row.dataJson)),
            _id: row.id,
            _openid: row.ownerId,
            visibility: row.visibility,
            refType: row.refType,
            refId: row.refId,
          };
          if (!evalRulesForDoc(rules, 'write', docForRules, { appUserId: ctx.appUserId })) {
            return [];
          }
        }

        const currentData = parseJson(row.dataJson);
        const sanitizedCurrent = stripWxSystemFields(currentData, 'lenient');
        const merged = applyWxUpdatePatch(asObject(sanitizedCurrent), asObject(sanitizedPatch));
        const dataJson = JSON.stringify(merged ?? {});
        const bytes = new TextEncoder().encode(dataJson).byteLength;
        if (bytes > 256 * 1024) throw new ValidationError('doc_too_large');
        return [{ row, dataJson }];
      });

      let updated = 0;
      for (const item of updates) {
        const now = Date.now();
        const etag = crypto.randomUUID();
        const res = await sdkCloudRepository.updateDbDoc(db, {
          appId: ctx.appId,
          collection,
          id: item.row.id,
          visibility: item.row.visibility,
          refType: item.row.refType,
          refId: item.row.refId,
          dataJson: item.dataJson,
          updatedAt: now,
          etag,
        });
        if (res) updated += 1;
      }

      logCloudEvent(env, 'info', {
        op: 'db_where_update',
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        collection,
        where: conditions,
        updated,
        ms: Date.now() - startedAt,
      });

      return { stats: { updated } };
    } catch (err) {
      logCloudEvent(env, 'error', {
        op: 'db_where_update',
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        collection,
        where: conditions,
        ms: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  // -----------------
  // Cloud Blob
  // -----------------

  async blobCreateUploadUrl(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    input: CloudBlobCreateUploadUrlInput,
  ): Promise<CloudBlobCreateUploadUrlResponse> {
    const startedAt = Date.now();
    const ctx = await this.requireSdkContext(request, db);
    requireScope(ctx.scopes, 'blob:rw');

    const visibility = requireBlobVisibility(input.visibility);
    const path = normalizeBlobPath(input.path);
    const contentType =
      typeof input.contentType === 'string' && input.contentType.trim()
        ? input.contentType.trim().slice(0, 128)
        : null;
    const expiresIn = normalizeLimit(input.expiresIn, 600, 300);

    const key = buildBlobKey({ appId: ctx.appId, appUserId: ctx.appUserId, visibility, path });
    const secret = requireBlobSigningSecret(env);
    const token = await signBlobToken(secret, {
      op: 'upload',
      key,
      exp: Date.now() + expiresIn * 1000,
      contentType,
    });

    const origin = new URL(request.url).origin;
    const uploadUrl = `${origin}/api/v1/cloud/blob/upload?token=${encodeURIComponent(token)}`;

    logCloudEvent(env, 'info', {
      op: 'blob_upload_url',
      appId: ctx.appId,
      appUserId: ctx.appUserId,
      visibility,
      key,
      ms: Date.now() - startedAt,
    });

    return { fileId: key, uploadUrl, expiresIn };
  }

  async blobGetDownloadUrl(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    input: CloudBlobGetDownloadUrlInput,
  ): Promise<CloudBlobGetDownloadUrlResponse> {
    const startedAt = Date.now();
    const ctx = await this.requireSdkContext(request, db);
    requireScope(ctx.scopes, 'blob:rw');

    if (typeof input.fileId !== 'string' || !input.fileId.trim()) {
      throw new ValidationError('fileId is required');
    }
    const fileId = input.fileId.trim();
    const parsed = parseBlobKey(fileId);
    if (!parsed) throw new ValidationError('invalid_fileId');
    if (parsed.appId !== ctx.appId) throw new UnauthorizedError('forbidden');
    if (parsed.visibility === 'private' && parsed.ownerId !== ctx.appUserId) {
      throw new UnauthorizedError('forbidden');
    }

    const expiresIn = normalizeLimit(input.expiresIn, 600, 300);
    const secret = requireBlobSigningSecret(env);
    const token = await signBlobToken(secret, {
      op: 'download',
      key: fileId,
      exp: Date.now() + expiresIn * 1000,
    });

    const origin = new URL(request.url).origin;
    const url = `${origin}/api/v1/cloud/blob/download?token=${encodeURIComponent(token)}`;

    logCloudEvent(env, 'info', {
      op: 'blob_download_url',
      appId: ctx.appId,
      appUserId: ctx.appUserId,
      fileId,
      ms: Date.now() - startedAt,
    });

    return { fileId, url, expiresIn };
  }

  async blobUpload(request: Request, env: ApiWorkerEnv, token: string): Promise<{ fileId: string; etag: string | null }> {
    const startedAt = Date.now();
    if (request.method !== 'PUT') throw new ValidationError('method_not_allowed');
    const secret = requireBlobSigningSecret(env);
    const payload = await verifyBlobToken(secret, token);
    if (payload.op !== 'upload') throw new ValidationError('invalid_token');

    const bucket = requireBlobBucket(env);
    const contentLength = request.headers.get('content-length');
    if (contentLength) {
      const n = Number(contentLength);
      if (Number.isFinite(n) && n > 10 * 1024 * 1024) throw new ValidationError('file_too_large');
    }
    if (!request.body) throw new ValidationError('missing_body');

    const contentType = payload.contentType ?? request.headers.get('content-type');
    const result = await bucket.put(payload.key, request.body, {
      httpMetadata: { contentType: contentType || undefined },
    });

    logCloudEvent(env, 'info', {
      op: 'blob_upload',
      key: payload.key,
      ms: Date.now() - startedAt,
    });

    return { fileId: payload.key, etag: result?.etag ?? null };
  }

  async blobDownload(request: Request, env: ApiWorkerEnv, token: string): Promise<Response> {
    const startedAt = Date.now();
    void request;
    const secret = requireBlobSigningSecret(env);
    const payload = await verifyBlobToken(secret, token);
    if (payload.op !== 'download') throw new ValidationError('invalid_token');

    const bucket = requireBlobBucket(env);
    const obj = await bucket.get(payload.key);
    if (!obj) throw new NotFoundError('not_found');

    const parsed = parseBlobKey(payload.key);
    const headers = new Headers();
    if (obj.httpMetadata?.contentType) headers.set('content-type', obj.httpMetadata.contentType);
    if (obj.size !== undefined) headers.set('content-length', String(obj.size));
    headers.set('etag', obj.etag);
    headers.set('cache-control', parsed?.visibility === 'public' ? 'public, max-age=60' : 'private, max-age=0');

    logCloudEvent(env, 'info', {
      op: 'blob_download',
      key: payload.key,
      ms: Date.now() - startedAt,
    });

    return new Response(obj.body, { status: 200, headers });
  }

  // -----------------
  // Cloud Functions
  // -----------------

  async functionsCall(
    request: Request,
    env: ApiWorkerEnv,
    db: D1Database,
    input: CloudFunctionsCallInput,
  ): Promise<CloudFunctionsCallResponse> {
    const startedAt = Date.now();
    const ctx = await this.requireSdkContext(request, db);
    requireScope(ctx.scopes, 'functions:invoke');

    const name = requireFunctionName(input.name);

    try {
      let data: unknown;
      switch (name) {
        case 'cloud.ping': {
          data = {
            ok: true,
            now: Date.now(),
            appId: ctx.appId,
            appUserId: ctx.appUserId,
          };
          break;
        }
        default:
          throw new ValidationError('unknown_function');
      }

      logCloudEvent(env, 'info', {
        op: 'fn_call',
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        name,
        ms: Date.now() - startedAt,
      });

      return { data };
    } catch (err) {
      logCloudEvent(env, 'error', {
        op: 'fn_call',
        appId: ctx.appId,
        appUserId: ctx.appUserId,
        name,
        ms: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }
}

export const sdkCloudService = new SdkCloudService();

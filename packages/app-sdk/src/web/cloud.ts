import type {
  CloudAPI,
  CloudDbCollection,
  CloudDbDoc,
  CloudDbQueryBuilder,
  CloudDbQueryInput,
  CloudDbQueryResult,
  CloudDbWhereOp,
  CloudKvAPI,
  CloudVisibility,
  WxCloudAddResult,
  WxCloudCallFunctionInput,
  WxCloudCallFunctionResult,
  WxCloudCommand,
  WxCloudCommandExpr,
  WxCloudDatabase,
  WxCloudGetResult,
  WxCloudGetTempFileURLInput,
  WxCloudGetTempFileURLResult,
  WxCloudQuery,
  WxCloudQueryDirection,
  WxCloudRemoveResult,
  WxCloudUploadFileInput,
  WxCloudUploadFileResult,
} from '../types/cloud';
import { SDKError } from '../types/common';
import { webAuth, getWebApiBaseUrl } from './auth';

function requireAccessToken(): string {
  const token = webAuth.getAccessToken();
  if (!token) {
    throw new SDKError('PERMISSION_DENIED', 'Login required. Call gemigo.auth.login() first.');
  }
  return token;
}

async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const accessToken = requireAccessToken();
  const baseUrl = getWebApiBaseUrl().replace(/\/+$/, '');
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    const message = data.error || `Request failed: ${res.status}`;
    if (res.status === 401 || res.status === 403) {
      throw new SDKError('PERMISSION_DENIED', message);
    }
    throw new SDKError('INTERNAL_ERROR', message);
  }

  return (await res.json()) as T;
}

class WebCloudKv implements CloudKvAPI {
  async get<T = unknown>(
    key: string,
  ): Promise<{ key: string; value: T; etag: string; updatedAt: number }> {
    const encoded = encodeURIComponent(key);
    return fetchJson(`/cloud/kv/get?key=${encoded}`);
  }

  async set(
    key: string,
    value: unknown,
    options?: { ifMatch?: string },
  ): Promise<{ key: string; etag: string; updatedAt: number }> {
    return fetchJson(`/cloud/kv/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value, ifMatch: options?.ifMatch }),
    });
  }

  async delete(key: string, options?: { ifMatch?: string }): Promise<void> {
    await fetchJson(`/cloud/kv/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, ifMatch: options?.ifMatch }),
    });
  }

  async list(options?: {
    prefix?: string;
    limit?: number;
    cursor?: string | null;
  }): Promise<{ items: { key: string; etag: string; updatedAt: number; valueBytes: number }[]; nextCursor: string | null }> {
    const params = new URLSearchParams();
    if (options?.prefix) params.set('prefix', options.prefix);
    if (typeof options?.limit === 'number') params.set('limit', String(options.limit));
    if (options?.cursor) params.set('cursor', options.cursor);
    const qs = params.toString();
    return fetchJson(`/cloud/kv/list${qs ? `?${qs}` : ''}`);
  }
}

type QueryState = Required<Pick<CloudDbQueryInput, 'where' | 'orderBy' | 'limit'>> & {
  cursor: string | null;
};

class WebCloudDbQueryBuilder<T> implements CloudDbQueryBuilder<T> {
  private state: QueryState;

  constructor(
    private readonly collectionName: string,
    state?: Partial<QueryState>,
  ) {
    this.state = {
      where: state?.where ?? [],
      orderBy: state?.orderBy ?? { field: 'createdAt', direction: 'desc' },
      limit: state?.limit ?? 20,
      cursor: state?.cursor ?? null,
    };
  }

  where(field: 'ownerId' | 'visibility' | 'refType' | 'refId', op: CloudDbWhereOp, value: string) {
    return new WebCloudDbQueryBuilder<T>(this.collectionName, {
      ...this.state,
      where: [...this.state.where, { field, op, value }],
    });
  }

  orderBy(field: 'createdAt' | 'updatedAt', direction: 'asc' | 'desc' = 'desc') {
    return new WebCloudDbQueryBuilder<T>(this.collectionName, {
      ...this.state,
      orderBy: { field, direction },
    });
  }

  limit(n: number) {
    return new WebCloudDbQueryBuilder<T>(this.collectionName, {
      ...this.state,
      limit: n,
    });
  }

  startAfter(cursor: string) {
    return new WebCloudDbQueryBuilder<T>(this.collectionName, {
      ...this.state,
      cursor,
    });
  }

  async get(): Promise<CloudDbQueryResult<T>> {
    return fetchJson(`/cloud/db/collections/${encodeURIComponent(this.collectionName)}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        where: this.state.where,
        orderBy: this.state.orderBy,
        limit: this.state.limit,
        cursor: this.state.cursor,
      }),
    });
  }
}

class WebCloudDbCollection<T> implements CloudDbCollection<T> {
  constructor(private readonly name: string) {}

  async add(
    data: T,
    options?: { id?: string; visibility?: CloudVisibility; refType?: string; refId?: string },
  ): Promise<CloudDbDoc<T>> {
    return fetchJson(`/cloud/db/collections/${encodeURIComponent(this.name)}/docs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: options?.id,
        visibility: options?.visibility,
        refType: options?.refType,
        refId: options?.refId,
        data,
      }),
    });
  }

  doc(id: string) {
    const collection = this.name;
    return {
      get: async () =>
        fetchJson<CloudDbDoc<T>>(
          `/cloud/db/collections/${encodeURIComponent(collection)}/docs/${encodeURIComponent(id)}`,
        ),
      set: async (
        data: T,
        options?: { ifMatch?: string; visibility?: CloudVisibility; refType?: string; refId?: string },
      ) =>
        fetchJson<CloudDbDoc<T>>(
          `/cloud/db/collections/${encodeURIComponent(collection)}/docs/${encodeURIComponent(id)}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              data,
              ifMatch: options?.ifMatch,
              visibility: options?.visibility,
              refType: options?.refType,
              refId: options?.refId,
            }),
          },
        ),
      update: async (patch: Partial<T>, options?: { ifMatch?: string }) =>
        fetchJson<CloudDbDoc<T>>(
          `/cloud/db/collections/${encodeURIComponent(collection)}/docs/${encodeURIComponent(id)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patch, ifMatch: options?.ifMatch }),
          },
        ),
      delete: async () =>
        fetchJson(
          `/cloud/db/collections/${encodeURIComponent(collection)}/docs/${encodeURIComponent(id)}`,
          { method: 'DELETE' },
        ).then(() => undefined),
    };
  }

  query(): CloudDbQueryBuilder<T> {
    return new WebCloudDbQueryBuilder<T>(this.name);
  }
}

// -----------------
// wx.cloud Facade (API shape alignment)
// -----------------

function isWxCommandExpr(value: unknown): value is WxCloudCommandExpr {
  return Boolean(value && typeof value === 'object' && '__gemigoWxCmd' in (value as any));
}

function requireWxEq(expr: unknown): string {
  if (isWxCommandExpr(expr)) {
    if ((expr as WxCloudCommandExpr).__gemigoWxCmd !== 'eq') {
      throw new SDKError('NOT_SUPPORTED', 'Only db.command.eq(...) is supported in where() for now.');
    }
    const v = (expr as any).value;
    return typeof v === 'string' ? v : String(v ?? '');
  }
  return typeof expr === 'string' ? expr : String(expr ?? '');
}

function toWxDoc<TData>(doc: CloudDbDoc<TData>): TData & { _id: string } {
  const data = (doc.data && typeof doc.data === 'object' && !Array.isArray(doc.data) ? doc.data : {}) as TData;
  return { ...(data as any), _id: doc.id };
}

function createWxCommand(): WxCloudCommand {
  return {
    eq: (value) => ({ __gemigoWxCmd: 'eq', value }),
    inc: (n) => ({ __gemigoWxCmd: 'inc', value: n }),
    set: (value) => ({ __gemigoWxCmd: 'set', value }),
    remove: () => ({ __gemigoWxCmd: 'remove' }),
  };
}

type WxQueryState = {
  where: Record<string, unknown>;
  orderBy: { field: string; direction: WxCloudQueryDirection };
  limit: number;
  skip: number;
};

function normalizeWxDirection(dir?: WxCloudQueryDirection): WxCloudQueryDirection {
  return dir === 'asc' ? 'asc' : 'desc';
}

function applyWxUpdateCommands<TData extends Record<string, unknown>>(
  current: TData,
  patch: Record<string, unknown>,
): TData {
  const next: Record<string, unknown> = { ...current };
  for (const [key, raw] of Object.entries(patch)) {
    if (!isWxCommandExpr(raw)) {
      next[key] = raw;
      continue;
    }
    const expr = raw as WxCloudCommandExpr;
    if (expr.__gemigoWxCmd === 'set') {
      next[key] = (expr as any).value;
      continue;
    }
    if (expr.__gemigoWxCmd === 'remove') {
      delete next[key];
      continue;
    }
    if (expr.__gemigoWxCmd === 'inc') {
      const delta = Number((expr as any).value);
      const prev = Number((next as any)[key] ?? 0);
      next[key] = (Number.isFinite(prev) ? prev : 0) + (Number.isFinite(delta) ? delta : 0);
      continue;
    }
    throw new SDKError('NOT_SUPPORTED', `Unsupported command: ${String(expr.__gemigoWxCmd)}`);
  }
  return next as TData;
}

async function wxQueryPage<TData>(
  collectionName: string,
  state: WxQueryState,
  cursor: string | null,
  limit: number,
): Promise<CloudDbQueryResult<TData>> {
  let q = new WebCloudDbQueryBuilder<TData>(collectionName);

  const where = state.where;
  const docIdRaw = where._id;
  if (docIdRaw !== undefined) {
    throw new SDKError('NOT_SUPPORTED', 'where({_id: ...}) is only supported via doc(id).get().');
  }

  const supportedFields: Array<'ownerId' | 'visibility' | 'refType' | 'refId'> = [
    'ownerId',
    'visibility',
    'refType',
    'refId',
  ];

  for (const field of supportedFields) {
    if (where[field] === undefined) continue;
    const value = requireWxEq(where[field]);
    if (!value) continue;
    q = q.where(field, '==' as CloudDbWhereOp, value);
  }

  const { field, direction } = state.orderBy;
  if (field !== 'createdAt' && field !== 'updatedAt') {
    throw new SDKError('NOT_SUPPORTED', 'orderBy only supports createdAt/updatedAt for now.');
  }
  q = q.orderBy(field, direction);
  q = q.limit(limit);
  if (cursor) q = q.startAfter(cursor);
  return q.get();
}

function createWxQuery<TData extends Record<string, unknown>>(
  collectionName: string,
  command: WxCloudCommand,
  state?: Partial<WxQueryState>,
): WxCloudQuery<TData> {
  const resolved: WxQueryState = {
    where: state?.where ?? {},
    orderBy: state?.orderBy ?? { field: 'createdAt', direction: 'desc' },
    limit: state?.limit ?? 20,
    skip: state?.skip ?? 0,
  };

  const api: WxCloudQuery<TData> = {
    where(condition: Record<string, unknown>) {
      return createWxQuery<TData>(collectionName, command, {
        ...resolved,
        where: { ...resolved.where, ...(condition ?? {}) },
      });
    },
    orderBy(field: string, direction?: WxCloudQueryDirection) {
      return createWxQuery<TData>(collectionName, command, {
        ...resolved,
        orderBy: { field: String(field), direction: normalizeWxDirection(direction) },
      });
    },
    limit(n: number) {
      return createWxQuery<TData>(collectionName, command, {
        ...resolved,
        limit: Math.max(1, Math.floor(Number(n) || 0)),
      });
    },
    skip(n: number) {
      return createWxQuery<TData>(collectionName, command, {
        ...resolved,
        skip: Math.max(0, Math.floor(Number(n) || 0)),
      });
    },
    async get(): Promise<WxCloudGetResult<TData & { _id: string }>> {
      const hardLimit = Math.min(resolved.limit, 100);
      const hardSkip = resolved.skip;
      if (hardSkip > 1000) {
        throw new SDKError('NOT_SUPPORTED', 'skip(n) is capped at 1000; use cursor pagination instead.');
      }

      let cursor: string | null = null;
      let remainingSkip = hardSkip;
      let remainingTake = hardLimit;
      const out: Array<TData & { _id: string }> = [];
      let requests = 0;

      while ((remainingSkip > 0 || remainingTake > 0) && requests < 30) {
        const pageLimit = Math.min(100, remainingSkip > 0 ? remainingSkip : remainingTake);
        const page: CloudDbQueryResult<TData> = await wxQueryPage<TData>(
          collectionName,
          resolved,
          cursor,
          pageLimit,
        );
        requests += 1;
        if (page.items.length === 0) break;

        if (remainingSkip > 0) {
          const skipped = Math.min(remainingSkip, page.items.length);
          remainingSkip -= skipped;
          const rest = page.items.slice(skipped);
          if (remainingSkip === 0 && remainingTake > 0 && rest.length > 0) {
            const takeNow = Math.min(remainingTake, rest.length);
            out.push(...rest.slice(0, takeNow).map(toWxDoc));
            remainingTake -= takeNow;
          }
        } else {
          out.push(...page.items.slice(0, remainingTake).map(toWxDoc));
          remainingTake = Math.max(0, remainingTake - page.items.length);
        }

        cursor = page.nextCursor;
        if (!cursor) break;
      }

      if (requests >= 30) {
        throw new SDKError('NOT_SUPPORTED', 'skip/limit query requires too many requests; narrow your query.');
      }

      return { data: out };
    },
  };

  void command;
  return api;
}

function createWxDatabase(): WxCloudDatabase {
  const command = createWxCommand();
  return {
    command,
    collection<TData = unknown>(name: string) {
      const trimmed = String(name).trim();
      if (!trimmed) {
        throw new SDKError('INTERNAL_ERROR', 'collection name is required');
      }

      const baseQuery = createWxQuery<Record<string, unknown>>(trimmed, command);

      const collectionApi = {
        ...baseQuery,
        add: async (input: { data: TData }): Promise<WxCloudAddResult> => {
          const doc = await webCloud.db.collection<TData>(trimmed).add(input?.data as TData);
          return { _id: doc.id };
        },
        doc: (id: string) => {
          const ref = webCloud.db.collection<TData>(trimmed).doc(String(id));
          return {
            get: async () => {
              const doc = await ref.get();
              return { data: toWxDoc(doc) };
            },
            set: async (input: { data: TData }) => {
              await ref.set(input?.data as TData);
            },
            update: async (input: { data: Partial<TData> }) => {
              const patch = (input?.data ?? {}) as unknown;
              if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
                throw new SDKError('INTERNAL_ERROR', 'update({data}) must be an object');
              }

              const hasCommand = Object.values(patch as Record<string, unknown>).some(isWxCommandExpr);
              if (!hasCommand) {
                await ref.update(patch as Partial<TData>);
                return;
              }

              const current = await ref.get();
              const next = applyWxUpdateCommands(
                (current.data ?? {}) as Record<string, unknown>,
                patch as Record<string, unknown>,
              );
              await ref.set(next as TData, { ifMatch: current.etag });
            },
            remove: async (): Promise<WxCloudRemoveResult> => {
              await ref.delete();
              return { stats: { removed: 1 } };
            },
          };
        },
        // Convenience alias: collection.get() -> query.get()
        get: async (): Promise<WxCloudGetResult<TData & { _id: string }>> =>
          (baseQuery.get() as Promise<WxCloudGetResult<TData & { _id: string }>>),
      };

      return collectionApi as any;
    },
  };
}

export const webCloud: CloudAPI = {
  kv: new WebCloudKv(),
  db: {
    collection<T = unknown>(name: string): CloudDbCollection<T> {
      const trimmed = String(name).trim();
      if (!trimmed) {
        throw new SDKError('INTERNAL_ERROR', 'collection name is required');
      }
      return new WebCloudDbCollection<T>(trimmed);
    },
  },
  blob: {
    async createUploadUrl(input: {
      path?: string;
      visibility?: CloudVisibility;
      contentType?: string;
      expiresIn?: number;
    }): Promise<{ fileId: string; uploadUrl: string; expiresIn: number }> {
      return fetchJson(`/cloud/blob/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: input.path,
          visibility: input.visibility,
          contentType: input.contentType,
          expiresIn: input.expiresIn,
        }),
      });
    },
    async getDownloadUrl(input: {
      fileId: string;
      expiresIn?: number;
    }): Promise<{ fileId: string; url: string; expiresIn: number }> {
      return fetchJson(`/cloud/blob/download-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: input.fileId,
          expiresIn: input.expiresIn,
        }),
      });
    },
  },
  functions: {
    async call<T = unknown>(name: string, payload?: unknown): Promise<T> {
      const res = await fetchJson<{ data: T }>(`/cloud/functions/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, data: payload ?? null }),
      });
      return res.data;
    },
  },

  init(_options?: { env?: string }): void {
    // Reserved for wx.cloud.init({ env }) alignment; env routing can be added later.
  },

  database(): WxCloudDatabase {
    return createWxDatabase();
  },

  async callFunction<TResult = unknown>(
    input: WxCloudCallFunctionInput,
  ): Promise<WxCloudCallFunctionResult<TResult>> {
    const name = String(input?.name ?? '').trim();
    if (!name) throw new SDKError('INTERNAL_ERROR', 'callFunction name is required');
    const result = await webCloud.functions.call<TResult>(name, input?.data);
    return { result };
  },

  async uploadFile(input: WxCloudUploadFileInput): Promise<WxCloudUploadFileResult> {
    const cloudPath = String(input?.cloudPath ?? '').trim().replace(/^\/+/, '');
    if (!cloudPath) throw new SDKError('INTERNAL_ERROR', 'cloudPath is required');
    const file = input?.filePath;
    if (!file) throw new SDKError('INTERNAL_ERROR', 'filePath is required');

    const contentType = (file as any).type ? String((file as any).type) : undefined;
    const { fileId, uploadUrl } = await webCloud.blob.createUploadUrl({
      path: cloudPath,
      visibility: 'private',
      contentType,
    });
    await fetch(uploadUrl, {
      method: 'PUT',
      headers: contentType ? { 'Content-Type': contentType } : undefined,
      body: file,
    });
    return { fileID: fileId };
  },

  async getTempFileURL(input: WxCloudGetTempFileURLInput): Promise<WxCloudGetTempFileURLResult> {
    const list = Array.isArray(input?.fileList) ? input.fileList : [];
    const results = await Promise.all(
      list.map(async (item) => {
        const fileID = typeof item === 'string' ? item : String(item?.fileID ?? '');
        if (!fileID) {
          return { fileID: '', tempFileURL: '', status: 400, errMsg: 'fileID is required' };
        }
        try {
          const { url } = await webCloud.blob.getDownloadUrl({ fileId: fileID });
          return { fileID, tempFileURL: url, status: 0 };
        } catch (err) {
          return {
            fileID,
            tempFileURL: '',
            status: 500,
            errMsg: err instanceof Error ? err.message : String(err),
          };
        }
      }),
    );
    return { fileList: results };
  },
};

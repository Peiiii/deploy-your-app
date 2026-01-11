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
};

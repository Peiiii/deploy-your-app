export type CloudScope =
  | 'identity:basic'
  | 'storage:rw'
  | 'db:rw'
  | 'blob:rw'
  | 'functions:invoke'
  | string;

export type CloudVisibility = 'private' | 'public' | string;

export interface CloudKvItemMeta {
  key: string;
  etag: string;
  updatedAt: number;
  valueBytes: number;
}

export interface CloudKvAPI {
  get<T = unknown>(key: string): Promise<{ key: string; value: T; etag: string; updatedAt: number }>;
  set(
    key: string,
    value: unknown,
    options?: { ifMatch?: string },
  ): Promise<{ key: string; etag: string; updatedAt: number }>;
  delete(key: string, options?: { ifMatch?: string }): Promise<void>;
  list(options?: {
    prefix?: string;
    limit?: number;
    cursor?: string | null;
  }): Promise<{ items: CloudKvItemMeta[]; nextCursor: string | null }>;
}

export interface CloudDbDoc<T = unknown> {
  id: string;
  ownerId: string;
  visibility: CloudVisibility;
  refType: string | null;
  refId: string | null;
  data: T;
  createdAt: number;
  updatedAt: number;
  etag: string;
}

export type CloudDbWhereOp = '==';

export interface CloudDbWhere {
  field: 'ownerId' | 'visibility' | 'refType' | 'refId';
  op: CloudDbWhereOp;
  value: string;
}

export interface CloudDbQueryInput {
  where?: CloudDbWhere[];
  orderBy?: { field: 'createdAt' | 'updatedAt'; direction: 'asc' | 'desc' };
  limit?: number;
  cursor?: string | null;
}

export interface CloudDbQueryResult<T = unknown> {
  items: Array<CloudDbDoc<T>>;
  nextCursor: string | null;
}

export interface CloudDbDocumentRef<T = unknown> {
  get(): Promise<CloudDbDoc<T>>;
  set(
    data: T,
    options?: { ifMatch?: string; visibility?: CloudVisibility; refType?: string; refId?: string },
  ): Promise<CloudDbDoc<T>>;
  update(patch: Partial<T>, options?: { ifMatch?: string }): Promise<CloudDbDoc<T>>;
  delete(): Promise<void>;
}

export interface CloudDbQueryBuilder<T = unknown> {
  where(field: CloudDbWhere['field'], op: CloudDbWhereOp, value: string): CloudDbQueryBuilder<T>;
  orderBy(field: 'createdAt' | 'updatedAt', direction?: 'asc' | 'desc'): CloudDbQueryBuilder<T>;
  limit(n: number): CloudDbQueryBuilder<T>;
  startAfter(cursor: string): CloudDbQueryBuilder<T>;
  get(): Promise<CloudDbQueryResult<T>>;
}

export interface CloudDbCollection<T = unknown> {
  add(
    data: T,
    options?: { id?: string; visibility?: CloudVisibility; refType?: string; refId?: string },
  ): Promise<CloudDbDoc<T>>;
  doc(id: string): CloudDbDocumentRef<T>;
  query(): CloudDbQueryBuilder<T>;
}

export interface CloudDbAPI {
  collection<T = unknown>(name: string): CloudDbCollection<T>;
}

export interface CloudBlobAPI {
  createUploadUrl(input: {
    path?: string;
    visibility?: CloudVisibility;
    contentType?: string;
    expiresIn?: number;
  }): Promise<{ fileId: string; uploadUrl: string; expiresIn: number }>;
  getDownloadUrl(input: {
    fileId: string;
    expiresIn?: number;
  }): Promise<{ fileId: string; url: string; expiresIn: number }>;
}

export interface CloudFunctionsAPI {
  call<T = unknown>(name: string, payload?: unknown): Promise<T>;
}

export interface CloudAPI {
  kv: CloudKvAPI;
  db: CloudDbAPI;
  blob: CloudBlobAPI;
  functions: CloudFunctionsAPI;
}

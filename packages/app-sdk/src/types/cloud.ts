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

// -----------------
// WeChat Mini Program–style Facade (wx.cloud.*)
// -----------------

export type WxCloudQueryDirection = 'asc' | 'desc';

export type WxCloudCommandExpr =
  | { __gemigoWxCmd: 'eq'; value: unknown }
  | { __gemigoWxCmd: 'inc'; value: number }
  | { __gemigoWxCmd: 'set'; value: unknown }
  | { __gemigoWxCmd: 'remove' };

export interface WxCloudCommand {
  eq(value: unknown): WxCloudCommandExpr;
  inc(n: number): WxCloudCommandExpr;
  set(value: unknown): WxCloudCommandExpr;
  remove(): WxCloudCommandExpr;
}

export interface WxCloudGetResult<TDoc = unknown> {
  data: TDoc[];
}

export interface WxCloudAddResult {
  _id: string;
}

export interface WxCloudRemoveResult {
  stats: { removed: number };
}

export interface WxCloudDocumentRef<TData = unknown> {
  get(): Promise<{ data: (TData & { _id: string }) }>;
  set(input: { data: TData }): Promise<void>;
  update(input: { data: Partial<TData> }): Promise<void>;
  remove(): Promise<WxCloudRemoveResult>;
}

export interface WxCloudQuery<TData = unknown> {
  where(condition: Record<string, unknown>): WxCloudQuery<TData>;
  orderBy(field: string, direction?: WxCloudQueryDirection): WxCloudQuery<TData>;
  limit(n: number): WxCloudQuery<TData>;
  skip(n: number): WxCloudQuery<TData>;
  get(): Promise<WxCloudGetResult<TData & { _id: string }>>;
}

export interface WxCloudCollection<TData = unknown> extends WxCloudQuery<TData> {
  add(input: { data: TData }): Promise<WxCloudAddResult>;
  doc(id: string): WxCloudDocumentRef<TData>;
}

export interface WxCloudDatabase {
  readonly command: WxCloudCommand;
  collection<TData = unknown>(name: string): WxCloudCollection<TData>;
}

export interface WxCloudCallFunctionInput {
  name: string;
  data?: unknown;
}

export interface WxCloudCallFunctionResult<TResult = unknown> {
  result: TResult;
}

export interface WxCloudUploadFileInput {
  cloudPath: string;
  filePath: Blob;
}

export interface WxCloudUploadFileResult {
  fileID: string;
}

export interface WxCloudGetTempFileURLInput {
  fileList: Array<string | { fileID: string }>;
}

export interface WxCloudGetTempFileURLResult {
  fileList: Array<{
    fileID: string;
    tempFileURL: string;
    status: number;
    errMsg?: string;
  }>;
}

export interface CloudAPI {
  kv: CloudKvAPI;
  db: CloudDbAPI;
  blob: CloudBlobAPI;
  functions: CloudFunctionsAPI;

  /** wx.cloud.init-style facade (currently a no-op config holder) */
  init(options?: { env?: string }): void;
  /** wx.cloud.database() facade */
  database(): WxCloudDatabase;
  /** wx.cloud.callFunction facade */
  callFunction<TResult = unknown>(input: WxCloudCallFunctionInput): Promise<WxCloudCallFunctionResult<TResult>>;
  /** wx.cloud.uploadFile facade (web accepts Blob/File) */
  uploadFile(input: WxCloudUploadFileInput): Promise<WxCloudUploadFileResult>;
  /** wx.cloud.getTempFileURL facade */
  getTempFileURL(input: WxCloudGetTempFileURLInput): Promise<WxCloudGetTempFileURLResult>;
}

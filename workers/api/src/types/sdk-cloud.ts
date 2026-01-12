export type CloudVisibility = 'private' | 'public' | string;

export type CloudDbOrderByField = 'createdAt' | 'updatedAt';
export type CloudDbOrderDirection = 'asc' | 'desc';

export type CloudDbWhereOp = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'nin';

export interface CloudDbWhere {
  field: string;
  op: CloudDbWhereOp;
  value: unknown;
}

export interface CloudDbQueryInput {
  where?: CloudDbWhere[] | Record<string, unknown>;
  orderBy?: { field: CloudDbOrderByField | string; direction: CloudDbOrderDirection };
  limit?: number;
  cursor?: string | null;
}

export interface CloudDbDocResponse {
  id: string;
  ownerId: string;
  data: unknown;
  createdAt: number;
  updatedAt: number;
  etag: string;
}

export interface CloudDbCreateDocInput {
  id?: unknown;
  data?: unknown;
}

export interface CloudDbUpdateDocInput {
  patch?: unknown;
  ifMatch?: unknown;
}

export interface CloudDbSetDocInput {
  data?: unknown;
  ifMatch?: unknown;
}

export interface CloudDbQueryResponse {
  items: CloudDbDocResponse[];
  nextCursor: string | null;
}

export interface CloudDbCountResponse {
  total: number;
}

export interface CloudDbWhereUpdateInput {
  where?: CloudDbWhere[] | Record<string, unknown>;
  data?: unknown;
}

export interface CloudDbWhereUpdateResponse {
  stats: { updated: number };
}

export interface CloudDbWhereRemoveInput {
  where?: CloudDbWhere[] | Record<string, unknown>;
}

export interface CloudDbWhereRemoveResponse {
  stats: { removed: number };
}

export interface CloudKvGetResponse {
  key: string;
  value: unknown;
  etag: string;
  updatedAt: number;
}

export interface CloudKvSetInput {
  key: unknown;
  value?: unknown;
  ifMatch?: unknown;
}

export interface CloudKvSetResponse {
  key: string;
  etag: string;
  updatedAt: number;
}

export interface CloudKvDeleteInput {
  key: unknown;
  ifMatch?: unknown;
}

export interface CloudKvListResponseItem {
  key: string;
  etag: string;
  updatedAt: number;
  valueBytes: number;
}

export interface CloudKvListResponse {
  items: CloudKvListResponseItem[];
  nextCursor: string | null;
}

// -----------------
// Cloud Blob (R2-backed; signed upload/download URLs)
// -----------------

export interface CloudBlobCreateUploadUrlInput {
  path?: unknown;
  visibility?: unknown;
  contentType?: unknown;
  expiresIn?: unknown;
}

export interface CloudBlobCreateUploadUrlResponse {
  fileId: string;
  uploadUrl: string;
  expiresIn: number;
}

export interface CloudBlobGetDownloadUrlInput {
  fileId?: unknown;
  expiresIn?: unknown;
}

export interface CloudBlobGetDownloadUrlResponse {
  fileId: string;
  url: string;
  expiresIn: number;
}

// -----------------
// Cloud Functions (RPC)
// -----------------

export interface CloudFunctionsCallInput {
  name?: unknown;
  data?: unknown;
}

export interface CloudFunctionsCallResponse {
  data: unknown;
}

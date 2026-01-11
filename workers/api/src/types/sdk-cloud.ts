export type CloudVisibility = 'private' | 'public' | string;

export type CloudDbOrderByField = 'createdAt' | 'updatedAt';
export type CloudDbOrderDirection = 'asc' | 'desc';

export type CloudDbWhereOp = '==';

export interface CloudDbWhere {
  field: 'ownerId' | 'visibility' | 'refType' | 'refId';
  op: CloudDbWhereOp;
  value: string;
}

export interface CloudDbQueryInput {
  where?: CloudDbWhere[];
  orderBy?: { field: CloudDbOrderByField; direction: CloudDbOrderDirection };
  limit?: number;
  cursor?: string | null;
}

export interface CloudDbDocResponse {
  id: string;
  ownerId: string;
  visibility: CloudVisibility;
  refType: string | null;
  refId: string | null;
  data: unknown;
  createdAt: number;
  updatedAt: number;
  etag: string;
}

export interface CloudDbCreateDocInput {
  id?: unknown;
  visibility?: unknown;
  refType?: unknown;
  refId?: unknown;
  data?: unknown;
}

export interface CloudDbUpdateDocInput {
  visibility?: unknown;
  refType?: unknown;
  refId?: unknown;
  patch?: unknown;
  ifMatch?: unknown;
}

export interface CloudDbSetDocInput {
  visibility?: unknown;
  refType?: unknown;
  refId?: unknown;
  data?: unknown;
  ifMatch?: unknown;
}

export interface CloudDbQueryResponse {
  items: CloudDbDocResponse[];
  nextCursor: string | null;
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

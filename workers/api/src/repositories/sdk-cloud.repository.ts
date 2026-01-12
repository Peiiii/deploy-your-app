import type { CloudVisibility } from '../types/sdk-cloud';

let sdkCloudSchemaEnsured = false;

type AnyRow = Record<string, unknown>;

function asString(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '');
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export interface CloudKvItemRow {
  appId: string;
  appUserId: string;
  key: string;
  valueJson: string;
  valueBytes: number;
  etag: string;
  updatedAt: number;
}

export interface CloudDbDocRow {
  appId: string;
  collection: string;
  id: string;
  ownerId: string;
  visibility: CloudVisibility;
  refType: string | null;
  refId: string | null;
  dataJson: string;
  createdAt: number;
  updatedAt: number;
  etag: string;
}

export class SdkCloudRepository {
  private async ensureSchema(db: D1Database): Promise<void> {
    if (sdkCloudSchemaEnsured) return;

    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS sdk_kv_items (
          app_id TEXT NOT NULL,
          app_user_id TEXT NOT NULL,
          key TEXT NOT NULL,
          value_json TEXT NOT NULL,
          value_bytes INTEGER NOT NULL,
          etag TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (app_id, app_user_id, key)
        )`,
      )
      .run();

    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_sdk_kv_items_updated
         ON sdk_kv_items(app_id, app_user_id, updated_at)`,
      )
      .run();

    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS sdk_db_docs (
          app_id TEXT NOT NULL,
          collection TEXT NOT NULL,
          id TEXT NOT NULL,
          owner_id TEXT NOT NULL,
          visibility TEXT NOT NULL,
          ref_type TEXT,
          ref_id TEXT,
          data_json TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          etag TEXT NOT NULL,
          PRIMARY KEY (app_id, collection, id)
        )`,
      )
      .run();

    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_sdk_db_docs_collection_created
         ON sdk_db_docs(app_id, collection, created_at, id)`,
      )
      .run();

    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_sdk_db_docs_collection_updated
         ON sdk_db_docs(app_id, collection, updated_at, id)`,
      )
      .run();

    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_sdk_db_docs_ref_created
         ON sdk_db_docs(app_id, collection, ref_type, ref_id, created_at, id)`,
      )
      .run();

    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_sdk_db_docs_ref_visibility_created
         ON sdk_db_docs(app_id, collection, ref_type, ref_id, visibility, created_at, id)`,
      )
      .run();

    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_sdk_db_docs_owner_created
         ON sdk_db_docs(app_id, collection, owner_id, created_at, id)`,
      )
      .run();

    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_sdk_db_docs_collection_visibility_created
         ON sdk_db_docs(app_id, collection, visibility, created_at, id)`,
      )
      .run();

    sdkCloudSchemaEnsured = true;
  }

  // -----------------
  // Cloud KV
  // -----------------

  async findKvItem(
    db: D1Database,
    input: { appId: string; appUserId: string; key: string },
  ): Promise<CloudKvItemRow | null> {
    await this.ensureSchema(db);
    const row = await db
      .prepare(
        `SELECT * FROM sdk_kv_items
         WHERE app_id = ? AND app_user_id = ? AND key = ?
         LIMIT 1`,
      )
      .bind(input.appId, input.appUserId, input.key)
      .first<AnyRow>();
    if (!row) return null;
    return {
      appId: asString(row.app_id),
      appUserId: asString(row.app_user_id),
      key: asString(row.key),
      valueJson: asString(row.value_json),
      valueBytes: asNumber(row.value_bytes),
      etag: asString(row.etag),
      updatedAt: asNumber(row.updated_at),
    };
  }

  async upsertKvItem(
    db: D1Database,
    input: {
      appId: string;
      appUserId: string;
      key: string;
      valueJson: string;
      valueBytes: number;
      updatedAt: number;
      etag: string;
    },
  ): Promise<CloudKvItemRow> {
    await this.ensureSchema(db);
    const row = await db
      .prepare(
        `INSERT INTO sdk_kv_items (
          app_id, app_user_id, key, value_json, value_bytes, etag, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(app_id, app_user_id, key) DO UPDATE SET
          value_json = excluded.value_json,
          value_bytes = excluded.value_bytes,
          etag = excluded.etag,
          updated_at = excluded.updated_at
        RETURNING *`,
      )
      .bind(
        input.appId,
        input.appUserId,
        input.key,
        input.valueJson,
        input.valueBytes,
        input.etag,
        input.updatedAt,
      )
      .first<AnyRow>();

    if (!row) throw new Error('Failed to persist KV item.');

    return {
      appId: asString(row.app_id),
      appUserId: asString(row.app_user_id),
      key: asString(row.key),
      valueJson: asString(row.value_json),
      valueBytes: asNumber(row.value_bytes),
      etag: asString(row.etag),
      updatedAt: asNumber(row.updated_at),
    };
  }

  async deleteKvItem(
    db: D1Database,
    input: { appId: string; appUserId: string; key: string },
  ): Promise<void> {
    await this.ensureSchema(db);
    await db
      .prepare(
        `DELETE FROM sdk_kv_items
         WHERE app_id = ? AND app_user_id = ? AND key = ?`,
      )
      .bind(input.appId, input.appUserId, input.key)
      .run();
  }

  async listKvItems(
    db: D1Database,
    input: {
      appId: string;
      appUserId: string;
      prefix: string;
      limit: number;
      cursor: { updatedAt: number; key: string } | null;
    },
  ): Promise<{ items: CloudKvItemRow[]; nextCursor: { updatedAt: number; key: string } | null }> {
    await this.ensureSchema(db);
    const params: unknown[] = [input.appId, input.appUserId, `${input.prefix}%`];

    let whereCursor = '';
    if (input.cursor) {
      whereCursor = `AND (updated_at < ? OR (updated_at = ? AND key < ?))`;
      params.push(input.cursor.updatedAt, input.cursor.updatedAt, input.cursor.key);
    }

    const rows = await db
      .prepare(
        `SELECT * FROM sdk_kv_items
         WHERE app_id = ? AND app_user_id = ? AND key LIKE ?
         ${whereCursor}
         ORDER BY updated_at DESC, key DESC
         LIMIT ?`,
      )
      .bind(...params, input.limit + 1)
      .all<AnyRow>();

    const list = (rows.results ?? []).map((row) => ({
      appId: asString(row.app_id),
      appUserId: asString(row.app_user_id),
      key: asString(row.key),
      valueJson: asString(row.value_json),
      valueBytes: asNumber(row.value_bytes),
      etag: asString(row.etag),
      updatedAt: asNumber(row.updated_at),
    }));

    const hasMore = list.length > input.limit;
    const items = hasMore ? list.slice(0, input.limit) : list;
    const last = items[items.length - 1];
    const nextCursor = hasMore && last ? { updatedAt: last.updatedAt, key: last.key } : null;
    return { items, nextCursor };
  }

  // -----------------
  // Cloud DB
  // -----------------

  async insertDbDoc(db: D1Database, input: CloudDbDocRow): Promise<CloudDbDocRow> {
    await this.ensureSchema(db);
    const row = await db
      .prepare(
        `INSERT INTO sdk_db_docs (
          app_id, collection, id, owner_id, visibility, ref_type, ref_id,
          data_json, created_at, updated_at, etag
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *`,
      )
      .bind(
        input.appId,
        input.collection,
        input.id,
        input.ownerId,
        input.visibility,
        input.refType,
        input.refId,
        input.dataJson,
        input.createdAt,
        input.updatedAt,
        input.etag,
      )
      .first<AnyRow>();

    if (!row) throw new Error('Failed to insert doc.');
    return {
      appId: asString(row.app_id),
      collection: asString(row.collection),
      id: asString(row.id),
      ownerId: asString(row.owner_id),
      visibility: asString(row.visibility),
      refType: row.ref_type === null ? null : asString(row.ref_type),
      refId: row.ref_id === null ? null : asString(row.ref_id),
      dataJson: asString(row.data_json),
      createdAt: asNumber(row.created_at),
      updatedAt: asNumber(row.updated_at),
      etag: asString(row.etag),
    };
  }

  async findDbDoc(
    db: D1Database,
    input: { appId: string; collection: string; id: string },
  ): Promise<CloudDbDocRow | null> {
    await this.ensureSchema(db);
    const row = await db
      .prepare(
        `SELECT * FROM sdk_db_docs
         WHERE app_id = ? AND collection = ? AND id = ?
         LIMIT 1`,
      )
      .bind(input.appId, input.collection, input.id)
      .first<AnyRow>();
    if (!row) return null;
    return {
      appId: asString(row.app_id),
      collection: asString(row.collection),
      id: asString(row.id),
      ownerId: asString(row.owner_id),
      visibility: asString(row.visibility),
      refType: row.ref_type === null ? null : asString(row.ref_type),
      refId: row.ref_id === null ? null : asString(row.ref_id),
      dataJson: asString(row.data_json),
      createdAt: asNumber(row.created_at),
      updatedAt: asNumber(row.updated_at),
      etag: asString(row.etag),
    };
  }

  async updateDbDoc(
    db: D1Database,
    input: {
      appId: string;
      collection: string;
      id: string;
      visibility: CloudVisibility;
      refType: string | null;
      refId: string | null;
      dataJson: string;
      updatedAt: number;
      etag: string;
    },
  ): Promise<CloudDbDocRow | null> {
    await this.ensureSchema(db);
    const row = await db
      .prepare(
        `UPDATE sdk_db_docs
         SET visibility = ?, ref_type = ?, ref_id = ?, data_json = ?, updated_at = ?, etag = ?
         WHERE app_id = ? AND collection = ? AND id = ?
         RETURNING *`,
      )
      .bind(
        input.visibility,
        input.refType,
        input.refId,
        input.dataJson,
        input.updatedAt,
        input.etag,
        input.appId,
        input.collection,
        input.id,
      )
      .first<AnyRow>();

    if (!row) return null;
    return {
      appId: asString(row.app_id),
      collection: asString(row.collection),
      id: asString(row.id),
      ownerId: asString(row.owner_id),
      visibility: asString(row.visibility),
      refType: row.ref_type === null ? null : asString(row.ref_type),
      refId: row.ref_id === null ? null : asString(row.ref_id),
      dataJson: asString(row.data_json),
      createdAt: asNumber(row.created_at),
      updatedAt: asNumber(row.updated_at),
      etag: asString(row.etag),
    };
  }

  async upsertDbDoc(
    db: D1Database,
    input: {
      appId: string;
      collection: string;
      id: string;
      ownerId: string;
      visibility: CloudVisibility;
      refType: string | null;
      refId: string | null;
      dataJson: string;
      createdAt: number;
      updatedAt: number;
      etag: string;
    },
  ): Promise<CloudDbDocRow> {
    await this.ensureSchema(db);
    const row = await db
      .prepare(
        `INSERT INTO sdk_db_docs (
          app_id, collection, id, owner_id, visibility, ref_type, ref_id,
          data_json, created_at, updated_at, etag
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(app_id, collection, id) DO UPDATE SET
          visibility = excluded.visibility,
          ref_type = excluded.ref_type,
          ref_id = excluded.ref_id,
          data_json = excluded.data_json,
          updated_at = excluded.updated_at,
          etag = excluded.etag
        RETURNING *`,
      )
      .bind(
        input.appId,
        input.collection,
        input.id,
        input.ownerId,
        input.visibility,
        input.refType,
        input.refId,
        input.dataJson,
        input.createdAt,
        input.updatedAt,
        input.etag,
      )
      .first<AnyRow>();

    if (!row) throw new Error('Failed to upsert doc.');
    return {
      appId: asString(row.app_id),
      collection: asString(row.collection),
      id: asString(row.id),
      ownerId: asString(row.owner_id),
      visibility: asString(row.visibility),
      refType: row.ref_type === null ? null : asString(row.ref_type),
      refId: row.ref_id === null ? null : asString(row.ref_id),
      dataJson: asString(row.data_json),
      createdAt: asNumber(row.created_at),
      updatedAt: asNumber(row.updated_at),
      etag: asString(row.etag),
    };
  }

  async deleteDbDoc(
    db: D1Database,
    input: { appId: string; collection: string; id: string },
  ): Promise<void> {
    await this.ensureSchema(db);
    await db
      .prepare(
        `DELETE FROM sdk_db_docs
         WHERE app_id = ? AND collection = ? AND id = ?`,
      )
      .bind(input.appId, input.collection, input.id)
      .run();
  }

  async queryDbDocs(
    db: D1Database,
    input: {
      appId: string;
      collection: string;
      viewerAppUserId: string;
      where: { ownerId?: string; visibility?: string; refType?: string; refId?: string };
      orderBy: { field: 'createdAt' | 'updatedAt'; direction: 'asc' | 'desc' };
      limit: number;
      cursor: { ts: number; id: string } | null;
    },
  ): Promise<{ items: CloudDbDocRow[]; nextCursor: { ts: number; id: string } | null }> {
    await this.ensureSchema(db);

    const clauses: string[] = ['app_id = ?', 'collection = ?'];
    const params: unknown[] = [input.appId, input.collection];

    // Access control (V0 default rules):
    // - owner can read all their docs
    // - others can only read visibility='public'
    //
    // If querying a specific ownerId that isn't the viewer, force public.
    if (input.where.ownerId) {
      clauses.push('owner_id = ?');
      params.push(input.where.ownerId);
      if (input.where.ownerId !== input.viewerAppUserId) {
        clauses.push('LOWER(visibility) = ?');
        params.push('public');
      }
    } else {
      clauses.push('(owner_id = ? OR LOWER(visibility) = ?)');
      params.push(input.viewerAppUserId, 'public');
    }

    if (input.where.visibility) {
      const lowered = input.where.visibility.toLowerCase();
      if (lowered === 'public' || lowered === 'private') {
        clauses.push('LOWER(visibility) = ?');
        params.push(lowered);
      } else {
        clauses.push('visibility = ?');
        params.push(input.where.visibility);
      }
    }
    if (input.where.refType !== undefined) {
      clauses.push('ref_type = ?');
      params.push(input.where.refType);
    }
    if (input.where.refId !== undefined) {
      clauses.push('ref_id = ?');
      params.push(input.where.refId);
    }

    const orderColumn = input.orderBy.field === 'updatedAt' ? 'updated_at' : 'created_at';
    const dir = input.orderBy.direction.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    if (input.cursor) {
      if (dir === 'DESC') {
        clauses.push(`(${orderColumn} < ? OR (${orderColumn} = ? AND id < ?))`);
        params.push(input.cursor.ts, input.cursor.ts, input.cursor.id);
      } else {
        clauses.push(`(${orderColumn} > ? OR (${orderColumn} = ? AND id > ?))`);
        params.push(input.cursor.ts, input.cursor.ts, input.cursor.id);
      }
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

    const rows = await db
      .prepare(
        `SELECT * FROM sdk_db_docs
         ${whereSql}
         ORDER BY ${orderColumn} ${dir}, id ${dir}
         LIMIT ?`,
      )
      .bind(...params, input.limit + 1)
      .all<AnyRow>();

    const list = (rows.results ?? []).map((row) => ({
      appId: asString(row.app_id),
      collection: asString(row.collection),
      id: asString(row.id),
      ownerId: asString(row.owner_id),
      visibility: asString(row.visibility),
      refType: row.ref_type === null ? null : asString(row.ref_type),
      refId: row.ref_id === null ? null : asString(row.ref_id),
      dataJson: asString(row.data_json),
      createdAt: asNumber(row.created_at),
      updatedAt: asNumber(row.updated_at),
      etag: asString(row.etag),
    }));

    const hasMore = list.length > input.limit;
    const items = hasMore ? list.slice(0, input.limit) : list;
    const last = items[items.length - 1];
    const lastTs = last ? (input.orderBy.field === 'updatedAt' ? last.updatedAt : last.createdAt) : 0;
    const nextCursor = hasMore && last ? { ts: lastTs, id: last.id } : null;
    return { items, nextCursor };
  }
}

export const sdkCloudRepository = new SdkCloudRepository();

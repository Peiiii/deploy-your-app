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

export type CloudDbPermissionMode =
  | 'all_read_creator_write'
  | 'creator_read_write'
  | 'all_read_readonly'
  | 'none';

export interface CloudDbCollectionPermissionRow {
  appId: string;
  collection: string;
  mode: CloudDbPermissionMode;
  updatedAt: number;
}

export interface CloudDbCollectionSecurityRulesRow {
  appId: string;
  collection: string;
  rulesJson: string;
  updatedAt: number;
}

export type CloudDbWhereOp = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'nin';

export interface CloudDbCondition {
  field: string;
  op: CloudDbWhereOp;
  value: unknown;
}

export interface CloudDbOrderBy {
  field: string;
  direction: 'asc' | 'desc';
}

export interface CloudDbQueryCursor {
  isNull: 0 | 1;
  v: unknown;
  id: string;
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
        `CREATE TABLE IF NOT EXISTS sdk_db_collection_permissions (
          app_id TEXT NOT NULL,
          collection TEXT NOT NULL,
          mode TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (app_id, collection)
        )`,
      )
      .run();

    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS sdk_db_collection_security_rules (
          app_id TEXT NOT NULL,
          collection TEXT NOT NULL,
          rules_json TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (app_id, collection)
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

  async getDbCollectionPermission(
    db: D1Database,
    input: { appId: string; collection: string },
  ): Promise<CloudDbCollectionPermissionRow | null> {
    await this.ensureSchema(db);
    const row = await db
      .prepare(
        `SELECT * FROM sdk_db_collection_permissions
         WHERE app_id = ? AND collection = ?
         LIMIT 1`,
      )
      .bind(input.appId, input.collection)
      .first<AnyRow>();
    if (!row) return null;
    return {
      appId: asString(row.app_id),
      collection: asString(row.collection),
      mode: asString(row.mode) as CloudDbPermissionMode,
      updatedAt: asNumber(row.updated_at),
    };
  }

  async setDbCollectionPermission(
    db: D1Database,
    input: { appId: string; collection: string; mode: CloudDbPermissionMode; updatedAt: number },
  ): Promise<CloudDbCollectionPermissionRow> {
    await this.ensureSchema(db);
    const row = await db
      .prepare(
        `INSERT INTO sdk_db_collection_permissions (app_id, collection, mode, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(app_id, collection) DO UPDATE SET
           mode = excluded.mode,
           updated_at = excluded.updated_at
         RETURNING *`,
      )
      .bind(input.appId, input.collection, input.mode, input.updatedAt)
      .first<AnyRow>();
    if (!row) throw new Error('Failed to persist collection permission.');
    return {
      appId: asString(row.app_id),
      collection: asString(row.collection),
      mode: asString(row.mode) as CloudDbPermissionMode,
      updatedAt: asNumber(row.updated_at),
    };
  }

  async getDbCollectionSecurityRules(
    db: D1Database,
    input: { appId: string; collection: string },
  ): Promise<CloudDbCollectionSecurityRulesRow | null> {
    await this.ensureSchema(db);
    const row = await db
      .prepare(
        `SELECT * FROM sdk_db_collection_security_rules
         WHERE app_id = ? AND collection = ?
         LIMIT 1`,
      )
      .bind(input.appId, input.collection)
      .first<AnyRow>();
    if (!row) return null;
    return {
      appId: asString(row.app_id),
      collection: asString(row.collection),
      rulesJson: asString(row.rules_json),
      updatedAt: asNumber(row.updated_at),
    };
  }

  async setDbCollectionSecurityRules(
    db: D1Database,
    input: { appId: string; collection: string; rulesJson: string; updatedAt: number },
  ): Promise<CloudDbCollectionSecurityRulesRow> {
    await this.ensureSchema(db);
    const row = await db
      .prepare(
        `INSERT INTO sdk_db_collection_security_rules (app_id, collection, rules_json, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(app_id, collection) DO UPDATE SET
           rules_json = excluded.rules_json,
           updated_at = excluded.updated_at
         RETURNING *`,
      )
      .bind(input.appId, input.collection, input.rulesJson, input.updatedAt)
      .first<AnyRow>();
    if (!row) throw new Error('Failed to persist security rules.');
    return {
      appId: asString(row.app_id),
      collection: asString(row.collection),
      rulesJson: asString(row.rules_json),
      updatedAt: asNumber(row.updated_at),
    };
  }

  private buildJsonPath(field: string): string {
    const trimmed = field.trim();
    if (!trimmed) throw new Error('field is required');
    // Allow dot notation. Each segment must be [A-Za-z0-9_]+ (matches our v0 SDK constraints).
    const parts = trimmed.split('.');
    if (parts.some((p) => !p || !/^[A-Za-z0-9_]+$/.test(p))) {
      throw new Error(`invalid field path: ${field}`);
    }
    return `$.${parts.join('.')}`;
  }

  private resolveDbFieldExpr(field: string): { expr: string; kind: 'column' | 'data' } {
    const f = field.trim();
    if (f === '_id' || f === 'id') return { expr: 'id', kind: 'column' };
    if (f === '_openid' || f === 'ownerId') return { expr: 'owner_id', kind: 'column' };
    if (f === 'createdAt') return { expr: 'created_at', kind: 'column' };
    if (f === 'updatedAt') return { expr: 'updated_at', kind: 'column' };
    if (f === 'visibility') return { expr: 'visibility', kind: 'column' };
    if (f === 'refType') return { expr: 'ref_type', kind: 'column' };
    if (f === 'refId') return { expr: 'ref_id', kind: 'column' };
    const path = this.buildJsonPath(f);
    return { expr: `json_extract(data_json, '${path}')`, kind: 'data' };
  }

  private buildWhereSql(input: {
    appId: string;
    collection: string;
    conditions: CloudDbCondition[];
  }): { clauses: string[]; params: unknown[]; usedDataFields: string[] } {
    const clauses: string[] = ['app_id = ?', 'collection = ?'];
    const params: unknown[] = [input.appId, input.collection];
    const usedDataFields: string[] = [];

    for (const cond of input.conditions) {
      const { expr, kind } = this.resolveDbFieldExpr(cond.field);
      if (kind === 'data') usedDataFields.push(cond.field.trim());

      const op = cond.op;
      if (op === 'in' || op === 'nin') {
        const list = Array.isArray(cond.value) ? cond.value : [];
        if (list.length === 0) {
          clauses.push(op === 'in' ? '0=1' : '1=1');
          continue;
        }
        const placeholders = list.map(() => '?').join(', ');
        clauses.push(`${expr} ${op === 'in' ? 'IN' : 'NOT IN'} (${placeholders})`);
        params.push(...list);
        continue;
      }

      if (cond.value === null) {
        clauses.push(`${expr} ${op === '!=' ? 'IS NOT' : 'IS'} NULL`);
        continue;
      }

      const sqlOp =
        op === '==' ? '=' : op === '!=' ? '<>' : op === '<' ? '<' : op === '<=' ? '<=' : op === '>' ? '>' : '>=';
      clauses.push(`${expr} ${sqlOp} ?`);
      params.push(cond.value);
    }

    return { clauses, params, usedDataFields };
  }

  async queryDbDocs(
    db: D1Database,
    input: {
      appId: string;
      collection: string;
      conditions: CloudDbCondition[];
      orderBy: CloudDbOrderBy;
      limit: number;
      cursor: { field: string; direction: 'asc' | 'desc'; isNull: 0 | 1; v: unknown; id: string } | null;
    },
  ): Promise<{ items: CloudDbDocRow[]; nextCursor: CloudDbQueryCursor | null }> {
    await this.ensureSchema(db);

    const { clauses, params } = this.buildWhereSql({
      appId: input.appId,
      collection: input.collection,
      conditions: input.conditions,
    });

    const whereSql = `WHERE ${clauses.join(' AND ')}`;
    const { expr: orderExpr } = this.resolveDbFieldExpr(input.orderBy.field);
    const dir = input.orderBy.direction === 'asc' ? 'ASC' : 'DESC';
    const nullKeyExpr = `(${orderExpr} IS NULL)`;

    let cursorSql = '';
    if (input.cursor) {
      if (input.cursor.field !== input.orderBy.field || input.cursor.direction !== input.orderBy.direction) {
        throw new Error('cursor does not match orderBy');
      }
      // NULLs are always last (nullKey asc). Within same nullKey:
      // - DESC: smaller values are later
      // - ASC: larger values are later
      if (input.cursor.isNull === 1) {
        cursorSql = `AND ${nullKeyExpr} = 1 AND id ${dir === 'DESC' ? '<' : '>'} ?`;
        params.push(input.cursor.id);
      } else if (dir === 'DESC') {
        cursorSql = `AND (${nullKeyExpr} > 0 OR (${nullKeyExpr} = 0 AND (${orderExpr} < ? OR (${orderExpr} = ? AND id < ?))))`;
        params.push(input.cursor.v, input.cursor.v, input.cursor.id);
      } else {
        cursorSql = `AND (${nullKeyExpr} > 0 OR (${nullKeyExpr} = 0 AND (${orderExpr} > ? OR (${orderExpr} = ? AND id > ?))))`;
        params.push(input.cursor.v, input.cursor.v, input.cursor.id);
      }
    }

    const rows = await db
      .prepare(
        `SELECT *, ${orderExpr} as __order_value, ${nullKeyExpr} as __order_is_null FROM sdk_db_docs
         ${whereSql}
         ${cursorSql}
         ORDER BY ${nullKeyExpr} ASC, ${orderExpr} ${dir}, id ${dir}
         LIMIT ?`,
      )
      .bind(...params, input.limit + 1)
      .all<AnyRow>();

    const list = (rows.results ?? []).map((row) => {
      const isNull = asNumber((row as AnyRow).__order_is_null) ? 1 : 0;
      const orderValue = (row as AnyRow).__order_value as unknown;
      const doc: CloudDbDocRow = {
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
      const cursor: CloudDbQueryCursor = {
        isNull: isNull as 0 | 1,
        v: isNull ? null : orderValue,
        id: doc.id,
      };
      return { doc, cursor };
    });

    const hasMore = list.length > input.limit;
    const items = hasMore ? list.slice(0, input.limit) : list;
    const last = items[items.length - 1];
    const nextCursor = hasMore && last ? last.cursor : null;
    return { items: items.map((x) => x.doc), nextCursor };
  }

  async countDbDocs(
    db: D1Database,
    input: { appId: string; collection: string; conditions: CloudDbCondition[] },
  ): Promise<number> {
    await this.ensureSchema(db);
    const { clauses, params } = this.buildWhereSql({
      appId: input.appId,
      collection: input.collection,
      conditions: input.conditions,
    });

    const whereSql = `WHERE ${clauses.join(' AND ')}`;
    const row = await db
      .prepare(`SELECT COUNT(*) as cnt FROM sdk_db_docs ${whereSql}`)
      .bind(...params)
      .first<AnyRow>();
    return asNumber(row?.cnt);
  }

  async removeDbDocs(
    db: D1Database,
    input: { appId: string; collection: string; ownerId: string; conditions: CloudDbCondition[] },
  ): Promise<number> {
    await this.ensureSchema(db);
    const { clauses, params } = this.buildWhereSql({
      appId: input.appId,
      collection: input.collection,
      conditions: input.conditions,
    });

    clauses.push('owner_id = ?');
    params.push(input.ownerId);

    const whereSql = `WHERE ${clauses.join(' AND ')}`;
    const res = await db
      .prepare(`DELETE FROM sdk_db_docs ${whereSql}`)
      .bind(...params)
      .run();
    return asNumber(res?.meta?.changes);
  }

  listDbDocs = async (
    db: D1Database,
    input: {
      appId: string;
      collection: string;
      conditions: CloudDbCondition[];
      limit: number;
    },
  ): Promise<CloudDbDocRow[]> => {
    await this.ensureSchema(db);
    const { clauses, params } = this.buildWhereSql({
      appId: input.appId,
      collection: input.collection,
      conditions: input.conditions,
    });

    const whereSql = `WHERE ${clauses.join(' AND ')}`;
    const rows = await db
      .prepare(`SELECT * FROM sdk_db_docs ${whereSql} LIMIT ?`)
      .bind(...params, input.limit)
      .all<AnyRow>();

    return (rows.results ?? []).map((row) => ({
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
  };

  listDbDocsForOwner = async (
    db: D1Database,
    input: {
      appId: string;
      collection: string;
      ownerId: string;
      conditions: CloudDbCondition[];
      limit: number;
    },
  ): Promise<CloudDbDocRow[]> => {
    await this.ensureSchema(db);
    const { clauses, params } = this.buildWhereSql({
      appId: input.appId,
      collection: input.collection,
      conditions: input.conditions,
    });
    clauses.push('owner_id = ?');
    params.push(input.ownerId);

    const whereSql = `WHERE ${clauses.join(' AND ')}`;
    const rows = await db
      .prepare(`SELECT * FROM sdk_db_docs ${whereSql} LIMIT ?`)
      .bind(...params, input.limit)
      .all<AnyRow>();

    return (rows.results ?? []).map((row) => ({
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
  };
}

export const sdkCloudRepository = new SdkCloudRepository();

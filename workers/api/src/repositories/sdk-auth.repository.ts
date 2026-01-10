import type {
  SdkAccessTokenRecord,
  SdkAppUserRecord,
  SdkAuthCodeRecord,
  SdkConsentRecord,
} from '../types/sdk-auth';

let sdkAuthSchemaEnsured = false;

type CountRow = { cnt: number };

function parseJsonArray(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === 'string')
      : [];
  } catch {
    return [];
  }
}

class SdkAuthRepository {
  private async ensureSchema(db: D1Database): Promise<void> {
    if (sdkAuthSchemaEnsured) return;

    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS sdk_app_users (
          app_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          app_user_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (app_id, user_id)
        )`,
      )
      .run();

    await db
      .prepare(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_sdk_app_users_app_user_id
         ON sdk_app_users(app_id, app_user_id)`,
      )
      .run();

    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS sdk_app_consents (
          app_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          scopes TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          revoked_at TEXT,
          PRIMARY KEY (app_id, user_id)
        )`,
      )
      .run();

    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS sdk_auth_codes (
          code TEXT PRIMARY KEY,
          app_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          scopes TEXT NOT NULL,
          code_challenge TEXT NOT NULL,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          consumed_at TEXT
        )`,
      )
      .run();

    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_sdk_auth_codes_app_user
         ON sdk_auth_codes(app_id, user_id)`,
      )
      .run();

    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS sdk_access_tokens (
          token TEXT PRIMARY KEY,
          app_id TEXT NOT NULL,
          app_user_id TEXT NOT NULL,
          scopes TEXT NOT NULL,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL
        )`,
      )
      .run();

    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_sdk_access_tokens_expires_at
         ON sdk_access_tokens(expires_at)`,
      )
      .run();

    sdkAuthSchemaEnsured = true;
  }

  async upsertConsent(
    db: D1Database,
    input: { appId: string; userId: string; scopes: string[] },
  ): Promise<SdkConsentRecord> {
    await this.ensureSchema(db);
    const now = new Date().toISOString();
    const scopesJson = JSON.stringify(input.scopes);
    const row = await db
      .prepare(
        `INSERT INTO sdk_app_consents (
          app_id, user_id, scopes, created_at, updated_at, revoked_at
        ) VALUES (?, ?, ?, ?, ?, NULL)
        ON CONFLICT(app_id, user_id) DO UPDATE SET
          scopes = excluded.scopes,
          updated_at = excluded.updated_at,
          revoked_at = NULL
        RETURNING *`,
      )
      .bind(input.appId, input.userId, scopesJson, now, now)
      .first<Record<string, unknown>>();

    if (!row) {
      throw new Error('Failed to persist consent.');
    }

    return {
      appId: String(row.app_id),
      userId: String(row.user_id),
      scopes: parseJsonArray(row.scopes),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      revokedAt: typeof row.revoked_at === 'string' ? row.revoked_at : null,
    };
  }

  async findConsent(
    db: D1Database,
    input: { appId: string; userId: string },
  ): Promise<SdkConsentRecord | null> {
    await this.ensureSchema(db);
    const row = await db
      .prepare(
        `SELECT * FROM sdk_app_consents
         WHERE app_id = ? AND user_id = ?
         LIMIT 1`,
      )
      .bind(input.appId, input.userId)
      .first<Record<string, unknown>>();

    if (!row) return null;
    return {
      appId: String(row.app_id),
      userId: String(row.user_id),
      scopes: parseJsonArray(row.scopes),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      revokedAt: typeof row.revoked_at === 'string' ? row.revoked_at : null,
    };
  }

  async ensureAppUserId(
    db: D1Database,
    input: { appId: string; userId: string },
  ): Promise<SdkAppUserRecord> {
    await this.ensureSchema(db);
    const existing = await db
      .prepare(
        `SELECT * FROM sdk_app_users
         WHERE app_id = ? AND user_id = ?
         LIMIT 1`,
      )
      .bind(input.appId, input.userId)
      .first<Record<string, unknown>>();

    if (existing) {
      return {
        appId: String(existing.app_id),
        userId: String(existing.user_id),
        appUserId: String(existing.app_user_id),
        createdAt: String(existing.created_at),
      };
    }

    const now = new Date().toISOString();
    const appUserId = crypto.randomUUID();
    const row = await db
      .prepare(
        `INSERT INTO sdk_app_users (app_id, user_id, app_user_id, created_at)
         VALUES (?, ?, ?, ?)
         RETURNING *`,
      )
      .bind(input.appId, input.userId, appUserId, now)
      .first<Record<string, unknown>>();

    if (!row) {
      throw new Error('Failed to create app user id.');
    }

    return {
      appId: String(row.app_id),
      userId: String(row.user_id),
      appUserId: String(row.app_user_id),
      createdAt: String(row.created_at),
    };
  }

  async insertAuthCode(
    db: D1Database,
    input: {
      code: string;
      appId: string;
      userId: string;
      scopes: string[];
      codeChallenge: string;
      expiresAt: string;
    },
  ): Promise<SdkAuthCodeRecord> {
    await this.ensureSchema(db);
    const now = new Date().toISOString();
    const row = await db
      .prepare(
        `INSERT INTO sdk_auth_codes (
          code, app_id, user_id, scopes, code_challenge, created_at, expires_at, consumed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
        RETURNING *`,
      )
      .bind(
        input.code,
        input.appId,
        input.userId,
        JSON.stringify(input.scopes),
        input.codeChallenge,
        now,
        input.expiresAt,
      )
      .first<Record<string, unknown>>();

    if (!row) {
      throw new Error('Failed to create auth code.');
    }

    return {
      code: String(row.code),
      appId: String(row.app_id),
      userId: String(row.user_id),
      scopes: parseJsonArray(row.scopes),
      codeChallenge: String(row.code_challenge),
      createdAt: String(row.created_at),
      expiresAt: String(row.expires_at),
      consumedAt: typeof row.consumed_at === 'string' ? row.consumed_at : null,
    };
  }

  async consumeAuthCode(
    db: D1Database,
    code: string,
  ): Promise<SdkAuthCodeRecord | null> {
    await this.ensureSchema(db);
    const now = new Date().toISOString();
    const row = await db
      .prepare(
        `UPDATE sdk_auth_codes
         SET consumed_at = ?
         WHERE code = ? AND consumed_at IS NULL
         RETURNING *`,
      )
      .bind(now, code)
      .first<Record<string, unknown>>();

    if (!row) return null;

    return {
      code: String(row.code),
      appId: String(row.app_id),
      userId: String(row.user_id),
      scopes: parseJsonArray(row.scopes),
      codeChallenge: String(row.code_challenge),
      createdAt: String(row.created_at),
      expiresAt: String(row.expires_at),
      consumedAt: typeof row.consumed_at === 'string' ? row.consumed_at : null,
    };
  }

  async insertAccessToken(
    db: D1Database,
    input: {
      token: string;
      appId: string;
      appUserId: string;
      scopes: string[];
      expiresAt: string;
    },
  ): Promise<SdkAccessTokenRecord> {
    await this.ensureSchema(db);
    const now = new Date().toISOString();
    const row = await db
      .prepare(
        `INSERT INTO sdk_access_tokens (
          token, app_id, app_user_id, scopes, created_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        RETURNING *`,
      )
      .bind(
        input.token,
        input.appId,
        input.appUserId,
        JSON.stringify(input.scopes),
        now,
        input.expiresAt,
      )
      .first<Record<string, unknown>>();

    if (!row) {
      throw new Error('Failed to issue access token.');
    }

    return {
      token: String(row.token),
      appId: String(row.app_id),
      appUserId: String(row.app_user_id),
      scopes: parseJsonArray(row.scopes),
      createdAt: String(row.created_at),
      expiresAt: String(row.expires_at),
    };
  }

  async findAccessToken(
    db: D1Database,
    token: string,
  ): Promise<SdkAccessTokenRecord | null> {
    await this.ensureSchema(db);
    const row = await db
      .prepare(`SELECT * FROM sdk_access_tokens WHERE token = ? LIMIT 1`)
      .bind(token)
      .first<Record<string, unknown>>();
    if (!row) return null;
    return {
      token: String(row.token),
      appId: String(row.app_id),
      appUserId: String(row.app_user_id),
      scopes: parseJsonArray(row.scopes),
      createdAt: String(row.created_at),
      expiresAt: String(row.expires_at),
    };
  }

  async countActiveAccessTokens(db: D1Database): Promise<number> {
    await this.ensureSchema(db);
    const now = new Date().toISOString();
    const row = await db
      .prepare(`SELECT COUNT(*) as cnt FROM sdk_access_tokens WHERE expires_at > ?`)
      .bind(now)
      .first<CountRow>();
    return row?.cnt ?? 0;
  }
}

export const sdkAuthRepository = new SdkAuthRepository();

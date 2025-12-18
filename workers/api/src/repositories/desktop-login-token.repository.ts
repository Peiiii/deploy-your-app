import type { User } from '../types/user';
import { authRepository } from './auth.repository';

interface DesktopLoginToken {
  id: string;
  userId: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

class DesktopLoginTokenRepository {
  private schemaEnsured = false;

  private async ensureSchema(db: D1Database): Promise<void> {
    if (this.schemaEnsured) return;
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS desktop_login_tokens (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          used_at TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY(user_id) REFERENCES users(id)
        )`,
      )
      .run();
    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_desktop_tokens_user_id ON desktop_login_tokens(user_id)`,
      )
      .run();
    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_desktop_tokens_expires_at ON desktop_login_tokens(expires_at)`,
      )
      .run();
    this.schemaEnsured = true;
  }

  async createToken(
    db: D1Database,
    userId: string,
    ttlSeconds = 60 * 5,
  ): Promise<DesktopLoginToken> {
    await this.ensureSchema(db);
    const id = crypto.randomUUID();
    const now = new Date();
    const createdAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

    const row = await db
      .prepare(
        `INSERT INTO desktop_login_tokens (
          id, user_id, expires_at, used_at, created_at
        ) VALUES (?, ?, ?, NULL, ?)
        RETURNING *`,
      )
      .bind(id, userId, expiresAt, createdAt)
      .first<Record<string, unknown>>();

    if (!row) {
      throw new Error('Failed to create desktop login token.');
    }

    return {
      id: String(row.id),
      userId: String(row.user_id),
      expiresAt: String(row.expires_at),
      usedAt:
        row.used_at == null
          ? null
          : typeof row.used_at === 'string'
            ? row.used_at
            : String(row.used_at),
      createdAt: String(row.created_at),
    };
  }

  async consumeToken(
    db: D1Database,
    tokenId: string,
  ): Promise<{ user: User } | null> {
    await this.ensureSchema(db);
    const row = await db
      .prepare(`SELECT * FROM desktop_login_tokens WHERE id = ?`)
      .bind(tokenId)
      .first<Record<string, unknown>>();

    if (!row) return null;
    const token: DesktopLoginToken = {
      id: String(row.id),
      userId: String(row.user_id),
      expiresAt: String(row.expires_at),
      usedAt:
        row.used_at == null
          ? null
          : typeof row.used_at === 'string'
            ? row.used_at
            : String(row.used_at),
      createdAt: String(row.created_at),
    };

    const nowIso = new Date().toISOString();
    if (token.usedAt || token.expiresAt <= nowIso) {
      await db
        .prepare(`DELETE FROM desktop_login_tokens WHERE id = ?`)
        .bind(token.id)
        .run();
      return null;
    }

    const user = await authRepository.findUserById(db, token.userId);
    if (!user) {
      await db
        .prepare(`DELETE FROM desktop_login_tokens WHERE id = ?`)
        .bind(token.id)
        .run();
      return null;
    }

    await db
      .prepare(
        `UPDATE desktop_login_tokens SET used_at = ? WHERE id = ?`,
      )
      .bind(nowIso, token.id)
      .run();

    return { user };
  }
}

export const desktopLoginTokenRepository = new DesktopLoginTokenRepository();

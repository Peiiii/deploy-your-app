import type { User, Session } from '../types/user';

let authSchemaEnsured = false;

class AuthRepository {
  private async ensureSchema(db: D1Database): Promise<void> {
    if (authSchemaEnsured) return;

    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE,
          handle TEXT UNIQUE,
          password_hash TEXT,
          google_sub TEXT UNIQUE,
          github_id TEXT UNIQUE,
          display_name TEXT,
          avatar_url TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`,
      )
      .run();

    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          last_seen_at TEXT NOT NULL,
          FOREIGN KEY(user_id) REFERENCES users(id)
        )`,
      )
      .run();

    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`,
      )
      .run();

    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
      )
      .run();

    // Backfill handle column for older databases where it does not exist yet.
    try {
      await db
        // SQLite/D1 only allows limited column constraints in ALTER TABLE, so we
        // add a plain TEXT column here and rely on a separate unique index plus
        // application-level checks for uniqueness.
        .prepare(`ALTER TABLE users ADD COLUMN handle TEXT`)
        .run();
    } catch {
      // Ignore error if column already exists.
    }

    // Best-effort unique index on handle so we catch conflicts early.
    try {
      await db
        .prepare(
          `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle ON users(handle)`,
        )
        .run();
    } catch {
      // Non-fatal; we still enforce uniqueness at application level.
    }

    authSchemaEnsured = true;
  }

  private mapRowToUser(row: Record<string, unknown>): User {
    return {
      id: String(row.id),
      email:
        typeof row.email === 'string'
          ? row.email
          : row.email == null
            ? null
            : String(row.email),
      handle:
        typeof row.handle === 'string'
          ? row.handle
          : row.handle == null
            ? null
            : String(row.handle),
      passwordHash:
        typeof row.password_hash === 'string'
          ? row.password_hash
          : row.password_hash == null
            ? null
            : String(row.password_hash),
      googleSub:
        typeof row.google_sub === 'string'
          ? row.google_sub
          : row.google_sub == null
            ? null
            : String(row.google_sub),
      githubId:
        typeof row.github_id === 'string'
          ? row.github_id
          : row.github_id == null
            ? null
            : String(row.github_id),
      displayName:
        typeof row.display_name === 'string'
          ? row.display_name
          : row.display_name == null
            ? null
            : String(row.display_name),
      avatarUrl:
        typeof row.avatar_url === 'string'
          ? row.avatar_url
          : row.avatar_url == null
            ? null
            : String(row.avatar_url),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private mapRowToSession(row: Record<string, unknown>): Session {
    return {
      id: String(row.id),
      userId: String(row.user_id),
      createdAt: String(row.created_at),
      expiresAt: String(row.expires_at),
      lastSeenAt: String(row.last_seen_at),
    };
  }

  async findUserByEmail(db: D1Database, email: string): Promise<User | null> {
    await this.ensureSchema(db);
    const row = await db
      .prepare(`SELECT * FROM users WHERE email = ?`)
      .bind(email.toLowerCase())
      .first<Record<string, unknown>>();
    return row ? this.mapRowToUser(row) : null;
  }

  async findUserByGoogleSub(
    db: D1Database,
    sub: string,
  ): Promise<User | null> {
    await this.ensureSchema(db);
    const row = await db
      .prepare(`SELECT * FROM users WHERE google_sub = ?`)
      .bind(sub)
      .first<Record<string, unknown>>();
    return row ? this.mapRowToUser(row) : null;
  }

  async findUserByGithubId(db: D1Database, id: string): Promise<User | null> {
    await this.ensureSchema(db);
    const row = await db
      .prepare(`SELECT * FROM users WHERE github_id = ?`)
      .bind(id)
      .first<Record<string, unknown>>();
    return row ? this.mapRowToUser(row) : null;
  }

  async findUserById(db: D1Database, id: string): Promise<User | null> {
    await this.ensureSchema(db);
    const row = await db
      .prepare(`SELECT * FROM users WHERE id = ?`)
      .bind(id)
      .first<Record<string, unknown>>();
    return row ? this.mapRowToUser(row) : null;
  }

  async findUserByHandle(
    db: D1Database,
    handle: string,
  ): Promise<User | null> {
    await this.ensureSchema(db);
    const normalized = handle.toLowerCase();
    const row = await db
      .prepare(`SELECT * FROM users WHERE handle = ?`)
      .bind(normalized)
      .first<Record<string, unknown>>();
    return row ? this.mapRowToUser(row) : null;
  }

  async findUsersByIds(
    db: D1Database,
    ids: string[],
  ): Promise<Array<Pick<User, 'id' | 'handle' | 'displayName'>>> {
    await this.ensureSchema(db);
    if (ids.length === 0) return [];

    const placeholders = ids.map(() => '?').join(', ');
    const result = await db
      .prepare(
        `SELECT id, handle, display_name FROM users WHERE id IN (${placeholders})`,
      )
      .bind(...ids)
      .all<Record<string, unknown>>();

    const rows = result.results ?? [];
    return rows.map((row) => ({
      id: String(row.id),
      handle:
        typeof row.handle === 'string'
          ? row.handle
          : row.handle == null
            ? null
            : String(row.handle),
      displayName:
        typeof row.display_name === 'string'
          ? row.display_name
          : row.display_name == null
            ? null
            : String(row.display_name),
    }));
  }

  async createUser(
    db: D1Database,
    input: {
      id: string;
      email?: string | null;
      handle?: string | null;
      passwordHash?: string | null;
      googleSub?: string | null;
      githubId?: string | null;
      displayName?: string | null;
      avatarUrl?: string | null;
    },
  ): Promise<User> {
    await this.ensureSchema(db);
    const now = new Date().toISOString();
    const email =
      input.email && input.email.trim().length > 0
        ? input.email.trim().toLowerCase()
        : null;
    const handle =
      input.handle && input.handle.trim().length > 0
        ? input.handle.trim().toLowerCase()
        : null;

    const row = await db
      .prepare(
        `INSERT INTO users (
          id, email, handle, password_hash, google_sub, github_id,
          display_name, avatar_url, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *`,
      )
      .bind(
        input.id,
        email,
        handle,
        input.passwordHash ?? null,
        input.googleSub ?? null,
        input.githubId ?? null,
        input.displayName ?? null,
        input.avatarUrl ?? null,
        now,
        now,
      )
      .first<Record<string, unknown>>();

    if (!row) {
      throw new Error('Failed to insert user.');
    }
    return this.mapRowToUser(row);
  }

  async updateUser(
    db: D1Database,
    id: string,
    patch: {
      email?: string | null;
      handle?: string | null;
      passwordHash?: string | null;
      googleSub?: string | null;
      githubId?: string | null;
      displayName?: string | null;
      avatarUrl?: string | null;
    },
  ): Promise<User> {
    await this.ensureSchema(db);
    const statements: string[] = [];
    const params: unknown[] = [];

    if (patch.email !== undefined) {
      statements.push('email = ?');
      params.push(
        patch.email && patch.email.trim().length > 0
          ? patch.email.trim().toLowerCase()
          : null,
      );
    }
    if (patch.handle !== undefined) {
      statements.push('handle = ?');
      params.push(
        patch.handle && patch.handle.trim().length > 0
          ? patch.handle.trim().toLowerCase()
          : null,
      );
    }
    if (patch.passwordHash !== undefined) {
      statements.push('password_hash = ?');
      params.push(patch.passwordHash);
    }
    if (patch.googleSub !== undefined) {
      statements.push('google_sub = ?');
      params.push(patch.googleSub);
    }
    if (patch.githubId !== undefined) {
      statements.push('github_id = ?');
      params.push(patch.githubId);
    }
    if (patch.displayName !== undefined) {
      statements.push('display_name = ?');
      params.push(patch.displayName);
    }
    if (patch.avatarUrl !== undefined) {
      statements.push('avatar_url = ?');
      params.push(patch.avatarUrl);
    }

    statements.push('updated_at = ?');
    params.push(new Date().toISOString());

    params.push(id);

    const row = await db
      .prepare(
        `UPDATE users
         SET ${statements.join(', ')}
         WHERE id = ?
         RETURNING *`,
      )
      .bind(...params)
      .first<Record<string, unknown>>();

    if (!row) {
      throw new Error('User not found');
    }
    return this.mapRowToUser(row);
  }

  async createSession(
    db: D1Database,
    userId: string,
    ttlSeconds = 60 * 60 * 24 * 30,
  ): Promise<Session> {
    await this.ensureSchema(db);
    const id = crypto.randomUUID();
    const now = new Date();
    const createdAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

    const row = await db
      .prepare(
        `INSERT INTO sessions (
          id, user_id, created_at, expires_at, last_seen_at
        ) VALUES (?, ?, ?, ?, ?)
        RETURNING *`,
      )
      .bind(id, userId, createdAt, expiresAt, createdAt)
      .first<Record<string, unknown>>();

    if (!row) {
      throw new Error('Failed to create session.');
    }
    return this.mapRowToSession(row);
  }

  async getSessionWithUser(
    db: D1Database,
    sessionId: string,
  ): Promise<{ session: Session; user: User } | null> {
    await this.ensureSchema(db);
    const row = await db
      .prepare(`SELECT * FROM sessions WHERE id = ?`)
      .bind(sessionId)
      .first<Record<string, unknown>>();

    if (!row) return null;

    const session = this.mapRowToSession(row);
    const now = new Date().toISOString();
    if (session.expiresAt <= now) {
      await this.deleteSession(db, sessionId);
      return null;
    }

    try {
      await db
        .prepare(`UPDATE sessions SET last_seen_at = ? WHERE id = ?`)
        .bind(now, sessionId)
        .run();
    } catch {
      // ignore
    }

    const user = await this.findUserById(db, session.userId);
    if (!user) {
      await this.deleteSession(db, sessionId);
      return null;
    }

    return {
      session,
      user,
    };
  }

  async deleteSession(db: D1Database, sessionId: string): Promise<void> {
    await this.ensureSchema(db);
    await db.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sessionId).run();
  }
}

export const authRepository = new AuthRepository();

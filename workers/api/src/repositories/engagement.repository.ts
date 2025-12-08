type LikeRow = {
  project_id: string;
  user_id: string;
  created_at: string;
};

type FavoriteRow = {
  project_id: string;
  user_id: string;
  created_at: string;
};

let engagementSchemaEnsured = false;

class EngagementRepository {
  private async ensureSchema(db: D1Database): Promise<void> {
    if (engagementSchemaEnsured) return;

    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS project_likes (
          project_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (project_id, user_id)
        )`,
      )
      .run();

    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_project_likes_project
         ON project_likes(project_id)`,
      )
      .run();

    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS project_favorites (
          project_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (project_id, user_id)
        )`,
      )
      .run();

    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_project_favorites_user
         ON project_favorites(user_id)`,
      )
      .run();

    engagementSchemaEnsured = true;
  }

  // ---- Likes ----

  async likeProject(
    db: D1Database,
    projectId: string,
    userId: string,
  ): Promise<void> {
    await this.ensureSchema(db);
    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO project_likes (project_id, user_id, created_at)
         VALUES (?, ?, ?)
         ON CONFLICT(project_id, user_id) DO NOTHING`,
      )
      .bind(projectId, userId, now)
      .run();
  }

  async unlikeProject(
    db: D1Database,
    projectId: string,
    userId: string,
  ): Promise<void> {
    await this.ensureSchema(db);
    await db
      .prepare(
        `DELETE FROM project_likes
         WHERE project_id = ? AND user_id = ?`,
      )
      .bind(projectId, userId)
      .run();
  }

  async getLikeStatusAndCount(
    db: D1Database,
    projectId: string,
    userId: string,
  ): Promise<{ liked: boolean; likesCount: number }> {
    await this.ensureSchema(db);

    const countRow = await db
      .prepare(
        `SELECT COUNT(*) as cnt
         FROM project_likes
         WHERE project_id = ?`,
      )
      .bind(projectId)
      .first<{ cnt: number }>();

    const likesCount = countRow?.cnt ?? 0;

    const likedRow = await db
      .prepare(
        `SELECT 1 as liked
         FROM project_likes
         WHERE project_id = ? AND user_id = ?
         LIMIT 1`,
      )
      .bind(projectId, userId)
      .first<{ liked: number }>();

    const liked = !!likedRow;

    return { liked, likesCount };
  }

  // ---- Favorites ----

  async favoriteProject(
    db: D1Database,
    projectId: string,
    userId: string,
  ): Promise<void> {
    await this.ensureSchema(db);
    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO project_favorites (project_id, user_id, created_at)
         VALUES (?, ?, ?)
         ON CONFLICT(project_id, user_id) DO NOTHING`,
      )
      .bind(projectId, userId, now)
      .run();
  }

  async unfavoriteProject(
    db: D1Database,
    projectId: string,
    userId: string,
  ): Promise<void> {
    await this.ensureSchema(db);
    await db
      .prepare(
        `DELETE FROM project_favorites
         WHERE project_id = ? AND user_id = ?`,
      )
      .bind(projectId, userId)
      .run();
  }

  async getFavoriteStatus(
    db: D1Database,
    projectId: string,
    userId: string,
  ): Promise<{ favorited: boolean }> {
    await this.ensureSchema(db);
    const row = await db
      .prepare(
        `SELECT 1 as favorited
         FROM project_favorites
         WHERE project_id = ? AND user_id = ?
         LIMIT 1`,
      )
      .bind(projectId, userId)
      .first<{ favorited: number }>();

    return { favorited: !!row };
  }

  async getFavoriteStatusAndCount(
    db: D1Database,
    projectId: string,
    userId: string,
  ): Promise<{ favorited: boolean; favoritesCount: number }> {
    await this.ensureSchema(db);

    const countRow = await db
      .prepare(
        `SELECT COUNT(*) as cnt
         FROM project_favorites
         WHERE project_id = ?`,
      )
      .bind(projectId)
      .first<{ cnt: number }>();

    const favoritesCount = countRow?.cnt ?? 0;

    const status = await this.getFavoriteStatus(db, projectId, userId);

    return {
      favorited: status.favorited,
      favoritesCount,
    };
  }

  async getFavoriteProjectIdsForUser(
    db: D1Database,
    userId: string,
  ): Promise<string[]> {
    await this.ensureSchema(db);
    const result = await db
      .prepare(
        `SELECT project_id
         FROM project_favorites
         WHERE user_id = ?
         ORDER BY created_at DESC`,
      )
      .bind(userId)
      .all<FavoriteRow>();
    const rows = result.results ?? [];
    return rows.map((row) => String(row.project_id));
  }
}

export const engagementRepository = new EngagementRepository();

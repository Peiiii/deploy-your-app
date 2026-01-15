type FavoriteRow = {
  project_id: string;
  user_id: string;
  created_at: string;
};

type CountRow = {
  project_id: string;
  cnt: number;
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

  /**
   * Bulk-fetch engagement counts (likes / favorites) for a set of projects.
   * This is used for backend-side "popularity" sorting in the explore feed.
   */
  async getEngagementCountsForProjects(
    db: D1Database,
    projectIds: string[],
  ): Promise<Record<string, { likesCount: number; favoritesCount: number }>> {
    await this.ensureSchema(db);

    if (projectIds.length === 0) {
      return {};
    }

    // SQLite/D1 can have a low variable limit (often 999). Keep headroom.
    const MAX_IDS_PER_QUERY = 900;

    const map: Record<string, { likesCount: number; favoritesCount: number }> = {};
    for (const id of projectIds) {
      map[id] = { likesCount: 0, favoritesCount: 0 };
    }

    for (let i = 0; i < projectIds.length; i += MAX_IDS_PER_QUERY) {
      const batch = projectIds.slice(i, i + MAX_IDS_PER_QUERY);
      const placeholders = batch.map(() => '?').join(', ');

      const [likesResult, favoritesResult] = await Promise.all([
        db
          .prepare(
            `SELECT project_id, COUNT(*) as cnt
             FROM project_likes
             WHERE project_id IN (${placeholders})
             GROUP BY project_id`,
          )
          .bind(...batch)
          .all<CountRow>(),
        db
          .prepare(
            `SELECT project_id, COUNT(*) as cnt
             FROM project_favorites
             WHERE project_id IN (${placeholders})
             GROUP BY project_id`,
          )
          .bind(...batch)
          .all<CountRow>(),
      ]);

      const likeRows = likesResult.results ?? [];
      const favoriteRows = favoritesResult.results ?? [];

      likeRows.forEach((row) => {
        const id = String(row.project_id);
        if (!map[id]) map[id] = { likesCount: 0, favoritesCount: 0 };
        map[id].likesCount = Number(row.cnt ?? 0);
      });

      favoriteRows.forEach((row) => {
        const id = String(row.project_id);
        if (!map[id]) map[id] = { likesCount: 0, favoritesCount: 0 };
        map[id].favoritesCount = Number(row.cnt ?? 0);
      });
    }

    return map;
  }

  async deleteEngagementForProject(
    db: D1Database,
    projectId: string,
  ): Promise<void> {
    await this.ensureSchema(db);
    await db
      .prepare(`DELETE FROM project_likes WHERE project_id = ?`)
      .bind(projectId)
      .run();
    await db
      .prepare(`DELETE FROM project_favorites WHERE project_id = ?`)
      .bind(projectId)
      .run();
  }
}

export const engagementRepository = new EngagementRepository();

type StatsRow = {
  slug: string;
  date: string;
  views: number;
  last_view_at?: string;
};

type ViewsBySlugRow = {
  slug: string;
  views: number;
};

let statsSchemaEnsured = false;

class AnalyticsRepository {
  private async ensureSchema(db: D1Database): Promise<void> {
    if (statsSchemaEnsured) return;
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS project_daily_stats (
          slug TEXT NOT NULL,
          date TEXT NOT NULL,
          views INTEGER NOT NULL DEFAULT 0,
          last_view_at TEXT,
          PRIMARY KEY (slug, date)
        )`,
      )
      .run();

    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_project_daily_stats_slug_date
         ON project_daily_stats(slug, date)`,
      )
      .run();

    statsSchemaEnsured = true;
  }

  async incrementPageView(
    db: D1Database,
    slug: string,
    date: string,
    timestampIso: string,
  ): Promise<void> {
    await this.ensureSchema(db);
    await db
      .prepare(
        `INSERT INTO project_daily_stats (slug, date, views, last_view_at)
         VALUES (?, ?, 1, ?)
         ON CONFLICT(slug, date)
         DO UPDATE SET views = views + 1, last_view_at = excluded.last_view_at`,
      )
      .bind(slug, date, timestampIso)
      .run();
  }

  async getStatsForSlug(
    db: D1Database,
    slug: string,
    fromDateInclusive: string,
  ): Promise<StatsRow[]> {
    await this.ensureSchema(db);
    const result = await db
      .prepare(
        `SELECT slug, date, views, last_view_at
         FROM project_daily_stats
         WHERE slug = ? AND date >= ?
         ORDER BY date ASC`,
      )
      .bind(slug, fromDateInclusive)
      .all<StatsRow>();
    return result.results ?? [];
  }

  async getViewsBySlugSince(
    db: D1Database,
    slugs: string[],
    fromDateInclusive: string,
  ): Promise<Record<string, number>> {
    await this.ensureSchema(db);
    const uniqueSlugs = Array.from(new Set(slugs.filter((slug) => slug.trim())));
    if (uniqueSlugs.length === 0) return {};

    const viewsBySlug: Record<string, number> = {};
    const MAX_SLUGS_PER_QUERY = 90;

    for (let i = 0; i < uniqueSlugs.length; i += MAX_SLUGS_PER_QUERY) {
      const batch = uniqueSlugs.slice(i, i + MAX_SLUGS_PER_QUERY);
      const placeholders = batch.map(() => '?').join(', ');
      const result = await db
        .prepare(
          `SELECT slug, SUM(views) AS views
           FROM project_daily_stats
           WHERE date >= ? AND slug IN (${placeholders})
           GROUP BY slug`,
        )
        .bind(fromDateInclusive, ...batch)
        .all<ViewsBySlugRow>();

      (result.results ?? []).forEach((row) => {
        viewsBySlug[row.slug] = row.views;
      });
    }

    return viewsBySlug;
  }

  async deleteStatsForSlug(db: D1Database, slug: string): Promise<void> {
    await this.ensureSchema(db);
    await db
      .prepare(`DELETE FROM project_daily_stats WHERE slug = ?`)
      .bind(slug)
      .run();
  }
}

export const analyticsRepository = new AnalyticsRepository();

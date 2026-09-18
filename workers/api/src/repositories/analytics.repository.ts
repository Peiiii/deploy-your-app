export interface PageViewSignal {
  isBot: boolean;
  visitorHash: string;
  sessionHash: string;
  dedupeKey: string;
  userAgentFamily: string;
  referrerHost?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  clientChannel: string;
}

type StatsRow = { slug: string; date: string; views: number; last_view_at?: string };
type ViewsBySlugRow = { slug: string; views: number };

let statsSchemaEnsured = false;

class AnalyticsRepository {
  private ensureSchema = async (db: D1Database): Promise<void> => {
    if (statsSchemaEnsured) return;
    await db.prepare(`CREATE TABLE IF NOT EXISTS project_daily_stats (
      slug TEXT NOT NULL, date TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 0,
      raw_views INTEGER NOT NULL DEFAULT 0, human_views INTEGER NOT NULL DEFAULT 0,
      bot_views INTEGER NOT NULL DEFAULT 0, unique_visitors INTEGER NOT NULL DEFAULT 0,
      sessions INTEGER NOT NULL DEFAULT 0, last_view_at TEXT, PRIMARY KEY (slug,date)
    )`).run();
    for (const column of [
      'raw_views INTEGER NOT NULL DEFAULT 0',
      'human_views INTEGER NOT NULL DEFAULT 0',
      'bot_views INTEGER NOT NULL DEFAULT 0',
      'unique_visitors INTEGER NOT NULL DEFAULT 0',
      'sessions INTEGER NOT NULL DEFAULT 0',
    ]) {
      try {
        await db.prepare(`ALTER TABLE project_daily_stats ADD COLUMN ${column}`).run();
      } catch {
        // Existing column.
      }
    }
    await db.prepare(`CREATE TABLE IF NOT EXISTS project_hourly_stats (
      slug TEXT NOT NULL, hour TEXT NOT NULL, raw_views INTEGER NOT NULL DEFAULT 0,
      human_views INTEGER NOT NULL DEFAULT 0, bot_views INTEGER NOT NULL DEFAULT 0,
      unique_visitors INTEGER NOT NULL DEFAULT 0, sessions INTEGER NOT NULL DEFAULT 0,
      last_view_at TEXT, PRIMARY KEY (slug,hour)
    )`).run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS project_traffic_uniques (
      slug TEXT NOT NULL, period_type TEXT NOT NULL, period TEXT NOT NULL,
      identity_type TEXT NOT NULL, identity_hash TEXT NOT NULL,
      PRIMARY KEY (slug,period_type,period,identity_type,identity_hash)
    )`).run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS project_view_dedup (
      dedupe_key TEXT PRIMARY KEY, expires_at INTEGER NOT NULL
    )`).run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS project_traffic_dimensions (
      slug TEXT NOT NULL, hour TEXT NOT NULL, user_agent_family TEXT NOT NULL,
      referrer_host TEXT NOT NULL DEFAULT '', utm_source TEXT NOT NULL DEFAULT '',
      utm_medium TEXT NOT NULL DEFAULT '', utm_campaign TEXT NOT NULL DEFAULT '',
      client_channel TEXT NOT NULL, is_bot INTEGER NOT NULL, views INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (slug,hour,user_agent_family,referrer_host,utm_source,utm_medium,utm_campaign,client_channel,is_bot)
    )`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_project_daily_stats_slug_date
      ON project_daily_stats(slug,date)`).run();
    statsSchemaEnsured = true;
  };

  private reserveUnique = async (
    db: D1Database,
    slug: string,
    periodType: 'day' | 'hour',
    period: string,
    identityType: 'visitor' | 'session',
    identityHash: string,
  ): Promise<number> => {
    const result = await db.prepare(`INSERT OR IGNORE INTO project_traffic_uniques
      (slug,period_type,period,identity_type,identity_hash) VALUES (?,?,?,?,?)`)
      .bind(slug, periodType, period, identityType, identityHash).run();
    return result.meta.changes > 0 ? 1 : 0;
  };

  recordPageView = async (
    db: D1Database,
    slug: string,
    timestamp: Date,
    signal: PageViewSignal,
  ): Promise<boolean> => {
    await this.ensureSchema(db);
    const nowMs = timestamp.getTime();
    const dedupe = await db.prepare(
      `INSERT OR IGNORE INTO project_view_dedup (dedupe_key,expires_at) VALUES (?,?)`,
    ).bind(signal.dedupeKey, nowMs + 120000).run();
    if (dedupe.meta.changes === 0) return false;

    const date = timestamp.toISOString().slice(0, 10);
    const hour = timestamp.toISOString().slice(0, 13);
    const human = signal.isBot ? 0 : 1;
    const bot = signal.isBot ? 1 : 0;
    const [dayVisitor, daySession, hourVisitor, hourSession] = signal.isBot
      ? [0, 0, 0, 0]
      : await Promise.all([
          this.reserveUnique(db, slug, 'day', date, 'visitor', signal.visitorHash),
          this.reserveUnique(db, slug, 'day', date, 'session', signal.sessionHash),
          this.reserveUnique(db, slug, 'hour', hour, 'visitor', signal.visitorHash),
          this.reserveUnique(db, slug, 'hour', hour, 'session', signal.sessionHash),
        ]);
    const timestampIso = timestamp.toISOString();
    await db.batch([
      db.prepare(`INSERT INTO project_daily_stats
        (slug,date,views,raw_views,human_views,bot_views,unique_visitors,sessions,last_view_at)
        VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(slug,date) DO UPDATE SET
        views=views+excluded.views,raw_views=raw_views+1,
        human_views=human_views+excluded.human_views,bot_views=bot_views+excluded.bot_views,
        unique_visitors=unique_visitors+excluded.unique_visitors,
        sessions=sessions+excluded.sessions,last_view_at=excluded.last_view_at`)
        .bind(slug,date,human,1,human,bot,dayVisitor,daySession,timestampIso),
      db.prepare(`INSERT INTO project_hourly_stats
        (slug,hour,raw_views,human_views,bot_views,unique_visitors,sessions,last_view_at)
        VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(slug,hour) DO UPDATE SET
        raw_views=raw_views+1,human_views=human_views+excluded.human_views,
        bot_views=bot_views+excluded.bot_views,
        unique_visitors=unique_visitors+excluded.unique_visitors,
        sessions=sessions+excluded.sessions,last_view_at=excluded.last_view_at`)
        .bind(slug,hour,1,human,bot,hourVisitor,hourSession,timestampIso),
      db.prepare(`INSERT INTO project_traffic_dimensions
        (slug,hour,user_agent_family,referrer_host,utm_source,utm_medium,utm_campaign,client_channel,is_bot,views)
        VALUES (?,?,?,?,?,?,?,?,?,1)
        ON CONFLICT(slug,hour,user_agent_family,referrer_host,utm_source,utm_medium,utm_campaign,client_channel,is_bot)
        DO UPDATE SET views=views+1`)
        .bind(slug,hour,signal.userAgentFamily,signal.referrerHost ?? '',signal.utmSource ?? '',
          signal.utmMedium ?? '',signal.utmCampaign ?? '',signal.clientChannel,bot),
    ]);
    return true;
  };

  getStatsForSlug = async (
    db: D1Database,
    slug: string,
    fromDateInclusive: string,
  ): Promise<StatsRow[]> => {
    await this.ensureSchema(db);
    const result = await db.prepare(`SELECT slug,date,human_views AS views,last_view_at
      FROM project_daily_stats WHERE slug=? AND date>=? ORDER BY date ASC`)
      .bind(slug, fromDateInclusive).all<StatsRow>();
    return result.results ?? [];
  };

  getViewsBySlugSince = async (
    db: D1Database,
    slugs: string[],
    fromDateInclusive: string,
  ): Promise<Record<string, number>> => {
    await this.ensureSchema(db);
    const uniqueSlugs = Array.from(new Set(slugs.filter((slug) => slug.trim())));
    if (uniqueSlugs.length === 0) return {};
    const viewsBySlug: Record<string, number> = {};
    for (let i = 0; i < uniqueSlugs.length; i += 90) {
      const batch = uniqueSlugs.slice(i, i + 90);
      const result = await db.prepare(`SELECT slug,SUM(human_views) AS views
        FROM project_daily_stats WHERE date>=? AND slug IN (${batch.map(() => '?').join(',')})
        GROUP BY slug`).bind(fromDateInclusive, ...batch).all<ViewsBySlugRow>();
      for (const row of result.results ?? []) viewsBySlug[row.slug] = row.views;
    }
    return viewsBySlug;
  };

  cleanup = async (db: D1Database, now = Date.now()): Promise<void> => {
    await this.ensureSchema(db);
    const date90 = new Date(now - 90 * 86400000).toISOString().slice(0, 10);
    const hour90 = new Date(now - 90 * 86400000).toISOString().slice(0, 13);
    await db.batch([
      db.prepare('DELETE FROM project_view_dedup WHERE expires_at < ?').bind(now),
      db.prepare('DELETE FROM project_hourly_stats WHERE hour < ?').bind(hour90),
      db.prepare('DELETE FROM project_traffic_dimensions WHERE hour < ?').bind(hour90),
      db.prepare('DELETE FROM project_traffic_uniques WHERE period < ?').bind(date90),
    ]);
  };

  deleteStatsForSlug = async (db: D1Database, slug: string): Promise<void> => {
    await this.ensureSchema(db);
    await db.batch([
      db.prepare('DELETE FROM project_daily_stats WHERE slug=?').bind(slug),
      db.prepare('DELETE FROM project_hourly_stats WHERE slug=?').bind(slug),
      db.prepare('DELETE FROM project_traffic_dimensions WHERE slug=?').bind(slug),
      db.prepare('DELETE FROM project_traffic_uniques WHERE slug=?').bind(slug),
    ]);
  };
}

export const analyticsRepository = new AnalyticsRepository();

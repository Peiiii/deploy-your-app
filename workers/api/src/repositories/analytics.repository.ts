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

type ViewsBySlugRow = { slug: string; views: number };

const schemaDatabases = new WeakSet<D1Database>();

class AnalyticsRepository {
  ensureSchema = async (db: D1Database): Promise<void> => {
    if (schemaDatabases.has(db)) return;
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
    await db.prepare(`CREATE TABLE IF NOT EXISTS project_analytics_collection (
      id INTEGER PRIMARY KEY CHECK(id=1), started_at TEXT NOT NULL
    )`).run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS project_page_views (
      slug TEXT NOT NULL, event_key TEXT NOT NULL, viewed_at TEXT NOT NULL,
      visitor_hash TEXT NOT NULL, session_hash TEXT NOT NULL, is_bot INTEGER NOT NULL,
      user_agent_family TEXT NOT NULL, referrer_host TEXT NOT NULL, utm_source TEXT NOT NULL,
      utm_medium TEXT NOT NULL, utm_campaign TEXT NOT NULL, client_channel TEXT NOT NULL,
      PRIMARY KEY(slug,event_key)
    )`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_project_page_views_slug_at
      ON project_page_views(slug,viewed_at)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_project_page_views_at
      ON project_page_views(viewed_at)`).run();
    // The event and every projection succeed or roll back together, including retries.
    await db.prepare(`CREATE TRIGGER IF NOT EXISTS project_page_views_aggregate
      AFTER INSERT ON project_page_views BEGIN
      INSERT INTO project_daily_stats
        (slug,date,views,raw_views,human_views,bot_views,unique_visitors,sessions,last_view_at)
      VALUES (NEW.slug,substr(NEW.viewed_at,1,10),1-NEW.is_bot,1,1-NEW.is_bot,NEW.is_bot,
        CASE WHEN NEW.is_bot=0 AND NEW.visitor_hash<>'' AND NOT EXISTS (
          SELECT 1 FROM project_traffic_uniques WHERE slug=NEW.slug AND period_type='day'
          AND period=substr(NEW.viewed_at,1,10) AND identity_type='browser' AND identity_hash=NEW.visitor_hash
        ) THEN 1 ELSE 0 END,
        CASE WHEN NEW.is_bot=0 AND NEW.session_hash<>'' AND NOT EXISTS (
          SELECT 1 FROM project_traffic_uniques WHERE slug=NEW.slug AND period_type='day'
          AND period=substr(NEW.viewed_at,1,10) AND identity_type='browser-session' AND identity_hash=NEW.session_hash
        ) THEN 1 ELSE 0 END,NEW.viewed_at)
      ON CONFLICT(slug,date) DO UPDATE SET views=views+excluded.views,raw_views=raw_views+1,
        human_views=human_views+excluded.human_views,bot_views=bot_views+excluded.bot_views,
        unique_visitors=unique_visitors+excluded.unique_visitors,sessions=sessions+excluded.sessions,
        last_view_at=MAX(COALESCE(last_view_at,''),excluded.last_view_at);
      INSERT INTO project_hourly_stats
        (slug,hour,raw_views,human_views,bot_views,unique_visitors,sessions,last_view_at)
      VALUES (NEW.slug,substr(NEW.viewed_at,1,13),1,1-NEW.is_bot,NEW.is_bot,
        CASE WHEN NEW.is_bot=0 AND NEW.visitor_hash<>'' AND NOT EXISTS (
          SELECT 1 FROM project_traffic_uniques WHERE slug=NEW.slug AND period_type='hour'
          AND period=substr(NEW.viewed_at,1,13) AND identity_type='browser' AND identity_hash=NEW.visitor_hash
        ) THEN 1 ELSE 0 END,
        CASE WHEN NEW.is_bot=0 AND NEW.session_hash<>'' AND NOT EXISTS (
          SELECT 1 FROM project_traffic_uniques WHERE slug=NEW.slug AND period_type='hour'
          AND period=substr(NEW.viewed_at,1,13) AND identity_type='browser-session' AND identity_hash=NEW.session_hash
        ) THEN 1 ELSE 0 END,NEW.viewed_at)
      ON CONFLICT(slug,hour) DO UPDATE SET raw_views=raw_views+1,human_views=human_views+excluded.human_views,
        bot_views=bot_views+excluded.bot_views,unique_visitors=unique_visitors+excluded.unique_visitors,
        sessions=sessions+excluded.sessions,last_view_at=MAX(COALESCE(last_view_at,''),excluded.last_view_at);
      INSERT OR IGNORE INTO project_traffic_uniques (slug,period_type,period,identity_type,identity_hash)
        SELECT NEW.slug,'day',substr(NEW.viewed_at,1,10),'browser',NEW.visitor_hash WHERE NEW.is_bot=0 AND NEW.visitor_hash<>'';
      INSERT OR IGNORE INTO project_traffic_uniques (slug,period_type,period,identity_type,identity_hash)
        SELECT NEW.slug,'hour',substr(NEW.viewed_at,1,13),'browser',NEW.visitor_hash WHERE NEW.is_bot=0 AND NEW.visitor_hash<>'';
      INSERT OR IGNORE INTO project_traffic_uniques (slug,period_type,period,identity_type,identity_hash)
        SELECT NEW.slug,'day',substr(NEW.viewed_at,1,10),'browser-session',NEW.session_hash WHERE NEW.is_bot=0 AND NEW.session_hash<>'';
      INSERT OR IGNORE INTO project_traffic_uniques (slug,period_type,period,identity_type,identity_hash)
        SELECT NEW.slug,'hour',substr(NEW.viewed_at,1,13),'browser-session',NEW.session_hash WHERE NEW.is_bot=0 AND NEW.session_hash<>'';
      INSERT INTO project_traffic_dimensions
        (slug,hour,user_agent_family,referrer_host,utm_source,utm_medium,utm_campaign,client_channel,is_bot,views)
      VALUES (NEW.slug,substr(NEW.viewed_at,1,13),NEW.user_agent_family,NEW.referrer_host,NEW.utm_source,
        NEW.utm_medium,NEW.utm_campaign,NEW.client_channel,NEW.is_bot,1)
      ON CONFLICT(slug,hour,user_agent_family,referrer_host,utm_source,utm_medium,utm_campaign,client_channel,is_bot)
        DO UPDATE SET views=views+1;
      END`).run();
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_project_traffic_uniques_period ON project_traffic_uniques(period)').run();
    schemaDatabases.add(db);
  };

  recordPageView = async (
    db: D1Database, slug: string, timestamp: Date, signal: PageViewSignal,
  ): Promise<boolean> => {
    await this.ensureSchema(db);
    const result = await db.prepare(`INSERT OR IGNORE INTO project_page_views
      (slug,event_key,viewed_at,visitor_hash,session_hash,is_bot,user_agent_family,
       referrer_host,utm_source,utm_medium,utm_campaign,client_channel)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(slug,signal.dedupeKey,timestamp.toISOString(),
      signal.visitorHash,signal.sessionHash,signal.isBot ? 1 : 0,signal.userAgentFamily,
      signal.referrerHost ?? '',signal.utmSource ?? '',signal.utmMedium ?? '',signal.utmCampaign ?? '',
      signal.clientChannel).run();
    return result.meta.changes > 0;
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
    const event35 = new Date(now - 35 * 86400000).toISOString();
    const date35 = event35.slice(0,10);
    const date90 = new Date(now - 90 * 86400000).toISOString().slice(0, 10);
    const hour90 = new Date(now - 90 * 86400000).toISOString().slice(0, 13);
    await db.batch([
      db.prepare('DELETE FROM project_page_views WHERE viewed_at < ?').bind(event35),
      db.prepare("DELETE FROM project_traffic_uniques WHERE period < ? AND identity_type IN ('browser','browser-session')").bind(date35),
      db.prepare('DELETE FROM project_view_dedup WHERE expires_at < ?').bind(now),
      db.prepare('DELETE FROM project_hourly_stats WHERE hour < ?').bind(hour90),
      db.prepare('DELETE FROM project_traffic_dimensions WHERE hour < ?').bind(hour90),
      db.prepare('DELETE FROM project_traffic_uniques WHERE period < ?').bind(date90),
    ]);
  };

  deleteStatsForSlug = async (db: D1Database, slug: string): Promise<void> => {
    await this.ensureSchema(db);
    await db.batch([
      db.prepare('DELETE FROM project_page_views WHERE slug=?').bind(slug),
      db.prepare('DELETE FROM project_daily_stats WHERE slug=?').bind(slug),
      db.prepare('DELETE FROM project_hourly_stats WHERE slug=?').bind(slug),
      db.prepare('DELETE FROM project_traffic_dimensions WHERE slug=?').bind(slug),
      db.prepare('DELETE FROM project_traffic_uniques WHERE slug=?').bind(slug),
    ]);
  };
}

export const analyticsRepository = new AnalyticsRepository();

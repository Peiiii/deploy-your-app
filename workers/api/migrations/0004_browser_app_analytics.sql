-- Browser events own idempotent writes; legacy history is not backfilled.
CREATE TABLE IF NOT EXISTS project_analytics_collection (
      id INTEGER PRIMARY KEY CHECK(id=1), started_at TEXT NOT NULL
    );

CREATE TABLE IF NOT EXISTS project_page_views (
      slug TEXT NOT NULL, event_key TEXT NOT NULL, viewed_at TEXT NOT NULL,
      visitor_hash TEXT NOT NULL, session_hash TEXT NOT NULL, is_bot INTEGER NOT NULL,
      user_agent_family TEXT NOT NULL, referrer_host TEXT NOT NULL, utm_source TEXT NOT NULL,
      utm_medium TEXT NOT NULL, utm_campaign TEXT NOT NULL, client_channel TEXT NOT NULL,
      PRIMARY KEY(slug,event_key)
    );

CREATE INDEX IF NOT EXISTS idx_project_page_views_slug_at
      ON project_page_views(slug,viewed_at);

CREATE INDEX IF NOT EXISTS idx_project_page_views_at
      ON project_page_views(viewed_at);

CREATE TRIGGER IF NOT EXISTS project_page_views_aggregate
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
      END;

CREATE INDEX IF NOT EXISTS idx_project_traffic_uniques_period ON project_traffic_uniques(period);

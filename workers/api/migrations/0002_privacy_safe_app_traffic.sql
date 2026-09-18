ALTER TABLE project_daily_stats ADD COLUMN raw_views INTEGER NOT NULL DEFAULT 0;
ALTER TABLE project_daily_stats ADD COLUMN human_views INTEGER NOT NULL DEFAULT 0;
ALTER TABLE project_daily_stats ADD COLUMN bot_views INTEGER NOT NULL DEFAULT 0;
ALTER TABLE project_daily_stats ADD COLUMN unique_visitors INTEGER NOT NULL DEFAULT 0;
ALTER TABLE project_daily_stats ADD COLUMN sessions INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS project_hourly_stats (
  slug TEXT NOT NULL, hour TEXT NOT NULL, raw_views INTEGER NOT NULL DEFAULT 0,
  human_views INTEGER NOT NULL DEFAULT 0, bot_views INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0, sessions INTEGER NOT NULL DEFAULT 0,
  last_view_at TEXT, PRIMARY KEY (slug,hour)
);
CREATE TABLE IF NOT EXISTS project_traffic_uniques (
  slug TEXT NOT NULL, period_type TEXT NOT NULL, period TEXT NOT NULL,
  identity_type TEXT NOT NULL, identity_hash TEXT NOT NULL,
  PRIMARY KEY (slug,period_type,period,identity_type,identity_hash)
);
CREATE TABLE IF NOT EXISTS project_view_dedup (
  dedupe_key TEXT PRIMARY KEY, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS project_traffic_dimensions (
  slug TEXT NOT NULL, hour TEXT NOT NULL, user_agent_family TEXT NOT NULL,
  referrer_host TEXT NOT NULL DEFAULT '', utm_source TEXT NOT NULL DEFAULT '',
  utm_medium TEXT NOT NULL DEFAULT '', utm_campaign TEXT NOT NULL DEFAULT '',
  client_channel TEXT NOT NULL, is_bot INTEGER NOT NULL, views INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (slug,hour,user_agent_family,referrer_host,utm_source,utm_medium,utm_campaign,client_channel,is_bot)
);


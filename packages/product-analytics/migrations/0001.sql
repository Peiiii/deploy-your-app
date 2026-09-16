CREATE TABLE IF NOT EXISTS product_events (id TEXT PRIMARY KEY, name TEXT NOT NULL, at INTEGER NOT NULL, received_at INTEGER NOT NULL, visitor_id TEXT NOT NULL, session_id TEXT NOT NULL, page TEXT NOT NULL, dimension TEXT, duration_ms INTEGER, flow_id TEXT, device TEXT NOT NULL, referrer TEXT NOT NULL, signed_in INTEGER NOT NULL, is_admin INTEGER NOT NULL, source TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS product_events_at ON product_events(at);
CREATE INDEX IF NOT EXISTS product_events_session ON product_events(session_id, at);
CREATE TABLE IF NOT EXISTS product_event_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS analytics_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);

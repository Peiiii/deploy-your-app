-- SDK tables previously created lazily; include them for fresh databases.
CREATE TABLE IF NOT EXISTS sdk_auth_codes (
 code TEXT PRIMARY KEY, app_id TEXT NOT NULL, user_id TEXT NOT NULL, scopes TEXT NOT NULL,
 code_challenge TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, consumed_at TEXT
);
CREATE TABLE IF NOT EXISTS sdk_access_tokens (
 token TEXT PRIMARY KEY, app_id TEXT NOT NULL, app_user_id TEXT NOT NULL, scopes TEXT NOT NULL,
 created_at TEXT NOT NULL, expires_at TEXT NOT NULL
);
-- Old credentials intentionally remain unbound and are rejected by the issuer repository.
ALTER TABLE sdk_auth_codes ADD COLUMN source_origin TEXT;
ALTER TABLE sdk_access_tokens ADD COLUMN source_origin TEXT;
CREATE TABLE sdk_auth_requests (
 id TEXT PRIMARY KEY, app_id TEXT NOT NULL, source_origin TEXT NOT NULL,
 redirect_uri TEXT NOT NULL, mode TEXT NOT NULL, scopes TEXT NOT NULL,
 code_challenge TEXT NOT NULL, state TEXT NOT NULL,
 created_at TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT
);
CREATE INDEX idx_sdk_auth_requests_app_expiry ON sdk_auth_requests(app_id,expires_at);

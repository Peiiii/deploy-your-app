CREATE TABLE IF NOT EXISTS app_secrets (
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  key_version TEXT NOT NULL,
  version INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, name)
);
CREATE TABLE IF NOT EXISTS app_connections (
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  config TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, name)
);
CREATE TABLE IF NOT EXISTS app_gateway_leases (
  id TEXT PRIMARY KEY,
  ticket_hash TEXT UNIQUE NOT NULL,
  project_id TEXT NOT NULL,
  connection_name TEXT NOT NULL,
  revision INTEGER NOT NULL,
  secret_version INTEGER NOT NULL,
  subject TEXT NOT NULL,
  origin TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  ticket_expires_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  ended_at INTEGER,
  status TEXT NOT NULL DEFAULT 'reserved',
  FOREIGN KEY (project_id, connection_name) REFERENCES app_connections(project_id, name)
);
CREATE INDEX IF NOT EXISTS app_gateway_budget ON app_gateway_leases(project_id, created_at, subject);
CREATE INDEX IF NOT EXISTS app_gateway_active ON app_gateway_leases(project_id, status, expires_at);

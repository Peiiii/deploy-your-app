ALTER TABLE projects ADD COLUMN created_at TEXT;
ALTER TABLE projects ADD COLUMN updated_at TEXT;
ALTER TABLE projects ADD COLUMN last_success_at TEXT;

UPDATE projects
SET created_at = COALESCE(created_at, last_deployed),
    updated_at = COALESCE(updated_at, last_deployed),
    last_success_at = CASE
      WHEN last_success_at IS NULL AND status = 'Live' THEN last_deployed
      ELSE last_success_at
    END;

CREATE TABLE IF NOT EXISTS deployment_attempts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  provider_deployment_id TEXT,
  flow_id TEXT,
  source_type TEXT NOT NULL,
  client_channel TEXT NOT NULL,
  file_extension TEXT,
  payload_bytes INTEGER,
  status TEXT NOT NULL,
  error_code TEXT,
  started_at TEXT NOT NULL,
  accepted_at TEXT,
  finished_at TEXT,
  duration_ms INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deployment_attempts_flow
  ON deployment_attempts(flow_id) WHERE flow_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deployment_attempts_project_started
  ON deployment_attempts(project_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployment_attempts_started_status
  ON deployment_attempts(started_at, status);


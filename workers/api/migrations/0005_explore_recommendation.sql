-- Entirely additive; no publication or catalogue state belongs to this experiment.
CREATE TABLE IF NOT EXISTS explore_rec_settings (
 id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL DEFAULT 0,
 percent INTEGER NOT NULL DEFAULT 20 CHECK(percent BETWEEN 0 AND 100),
 experiment TEXT NOT NULL DEFAULT 'explore-v1', ranker TEXT NOT NULL DEFAULT 'content',
 embedding TEXT NOT NULL DEFAULT '@cf/baai/bge-m3', monthly_micro INTEGER NOT NULL DEFAULT 10000000
);
INSERT OR IGNORE INTO explore_rec_settings(id) VALUES(1);
CREATE TABLE IF NOT EXISTS explore_rec_features (
 project_id TEXT PRIMARY KEY, revision TEXT NOT NULL, model TEXT NOT NULL,
 content TEXT NOT NULL, vector TEXT, retry_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS explore_rec_batches (
 id TEXT PRIMARY KEY, subject TEXT NOT NULL, filters TEXT NOT NULL, variant TEXT NOT NULL,
 experiment TEXT NOT NULL, algorithm TEXT NOT NULL, items TEXT NOT NULL,
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS explore_rec_batches_subject ON explore_rec_batches(subject,created_at);
CREATE TABLE IF NOT EXISTS explore_rec_events (
 id TEXT PRIMARY KEY, subject TEXT NOT NULL, session TEXT NOT NULL, batch_id TEXT NOT NULL,
 project_id TEXT NOT NULL, action TEXT NOT NULL, duration_ms INTEGER NOT NULL DEFAULT 0,
 variant TEXT NOT NULL, experiment TEXT NOT NULL, algorithm TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS explore_rec_events_once ON explore_rec_events(subject,session,batch_id,project_id,action);
CREATE INDEX IF NOT EXISTS explore_rec_events_subject ON explore_rec_events(subject,created_at);
CREATE INDEX IF NOT EXISTS explore_rec_events_experiment ON explore_rec_events(experiment,created_at);
CREATE TABLE IF NOT EXISTS explore_rec_budget(month TEXT PRIMARY KEY, reserved_micro INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS explore_rec_calls (
 id TEXT PRIMARY KEY, month TEXT NOT NULL, kind TEXT NOT NULL, model TEXT NOT NULL,
 reserved_micro INTEGER NOT NULL, actual_micro INTEGER, input_tokens INTEGER,
 status TEXT NOT NULL, latency_ms INTEGER, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS explore_rec_calls_month ON explore_rec_calls(month,kind,status);
CREATE TABLE IF NOT EXISTS explore_rec_rate(bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);

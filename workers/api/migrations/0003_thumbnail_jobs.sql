-- Pending work only: R2 remains the authority for whether a cover exists.
CREATE TABLE IF NOT EXISTS thumbnail_jobs (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  generation TEXT NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_thumbnail_jobs_due ON thumbnail_jobs(next_attempt_at, project_id);

CREATE TRIGGER IF NOT EXISTS thumbnail_jobs_insert
AFTER INSERT ON projects
WHEN NEW.is_public = 1 AND NEW.status = 'Live'
  AND (NEW.is_deleted = 0 OR NEW.is_deleted IS NULL)
  AND NEW.url IS NOT NULL AND TRIM(NEW.url) != ''
  AND NEW.slug IS NOT NULL AND TRIM(NEW.slug) != ''
BEGIN
  INSERT INTO thumbnail_jobs(project_id, slug) VALUES (NEW.id, NEW.slug);
END;

CREATE TRIGGER IF NOT EXISTS thumbnail_jobs_update
AFTER UPDATE OF is_public, status, is_deleted, url, slug, last_deployed ON projects
WHEN OLD.is_public IS NOT NEW.is_public OR OLD.status IS NOT NEW.status
  OR OLD.is_deleted IS NOT NEW.is_deleted OR OLD.url IS NOT NEW.url
  OR OLD.slug IS NOT NEW.slug OR OLD.last_deployed IS NOT NEW.last_deployed
BEGIN
  DELETE FROM thumbnail_jobs WHERE project_id = NEW.id
    AND NOT (COALESCE(NEW.is_public, 0) = 1 AND COALESCE(NEW.status, '') = 'Live'
      AND (NEW.is_deleted = 0 OR NEW.is_deleted IS NULL)
      AND COALESCE(TRIM(NEW.url), '') != '' AND COALESCE(TRIM(NEW.slug), '') != '');
  INSERT INTO thumbnail_jobs(project_id, slug)
    SELECT NEW.id, NEW.slug WHERE NEW.is_public = 1 AND NEW.status = 'Live'
      AND (NEW.is_deleted = 0 OR NEW.is_deleted IS NULL)
      AND COALESCE(TRIM(NEW.url), '') != '' AND COALESCE(TRIM(NEW.slug), '') != ''
    ON CONFLICT(project_id) DO UPDATE SET
      slug = excluded.slug, generation = lower(hex(randomblob(16))),
      attempts = 0, next_attempt_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), last_error = NULL;
END;

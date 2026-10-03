-- Financial records have one owner; this migration is additive.
CREATE TABLE IF NOT EXISTS points_settings (
 id INTEGER PRIMARY KEY CHECK(id=1), trial_points INTEGER NOT NULL DEFAULT 20 CHECK(trial_points>=0),
 trial_budget INTEGER NOT NULL DEFAULT 2000 CHECK(trial_budget>=0), trial_issued INTEGER NOT NULL DEFAULT 0 CHECK(trial_issued>=0 AND trial_issued<=trial_budget),
 ai_daily_limit INTEGER NOT NULL DEFAULT 10 CHECK(ai_daily_limit>=0), creator_bps INTEGER CHECK(creator_bps BETWEEN 0 AND 10000), live_payments INTEGER NOT NULL DEFAULT 0 CHECK(live_payments IN(0,1))
);
INSERT OR IGNORE INTO points_settings(id) VALUES(1);
CREATE TABLE IF NOT EXISTS points_lots (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL, source_ref TEXT NOT NULL UNIQUE,
 kind TEXT NOT NULL CHECK(kind IN('trial','paid')), total INTEGER NOT NULL CHECK(total>0),
 remaining INTEGER NOT NULL CHECK(remaining>=0 AND remaining<=total),
 paid_minor INTEGER NOT NULL DEFAULT 0 CHECK(paid_minor>=0), fee_minor INTEGER NOT NULL DEFAULT 0 CHECK(fee_minor>=0 AND fee_minor<=paid_minor),
 currency TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL,
 CHECK((kind='trial' AND paid_minor=0 AND fee_minor=0) OR (kind='paid' AND paid_minor>0 AND length(currency)=3))
);
CREATE INDEX IF NOT EXISTS points_lots_user ON points_lots(user_id,created_at);
CREATE TABLE IF NOT EXISTS points_items (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL, author_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL,
 type TEXT NOT NULL CHECK(type IN('repeatable','durable','term')), price INTEGER NOT NULL CHECK(price BETWEEN 1 AND 100000),
 entitlement TEXT NOT NULL, units INTEGER NOT NULL CHECK(units BETWEEN 1 AND 10000), period_seconds INTEGER NOT NULL DEFAULT 0 CHECK(period_seconds>=0),
 delivery TEXT NOT NULL CHECK(delivery IN('grant','ai')), enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN(0,1)), created_at INTEGER NOT NULL,
 CHECK((type='term' AND period_seconds BETWEEN 60 AND 31536000) OR (type<>'term' AND period_seconds=0)),
 CHECK(delivery<>'ai' OR type='repeatable')
);
CREATE INDEX IF NOT EXISTS points_items_project ON points_items(project_id);
CREATE TABLE IF NOT EXISTS points_intents (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL, project_id TEXT NOT NULL, item_id TEXT NOT NULL REFERENCES points_items(id),
 request_id TEXT NOT NULL, origin TEXT NOT NULL, state TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 UNIQUE(user_id,project_id,request_id)
);
CREATE TABLE IF NOT EXISTS points_subscriptions (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL, project_id TEXT NOT NULL, item_id TEXT NOT NULL REFERENCES points_items(id),
 active INTEGER NOT NULL CHECK(active IN(0,1)), due_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
 UNIQUE(user_id,project_id,item_id)
);
CREATE TABLE IF NOT EXISTS points_receipts (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL, project_id TEXT NOT NULL, author_id TEXT NOT NULL, item_id TEXT NOT NULL REFERENCES points_items(id), request_id TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN('prepared','reserved','running','granted','released','unknown','refunded')),
 price INTEGER NOT NULL, paid_minor INTEGER NOT NULL DEFAULT 0, fee_minor INTEGER NOT NULL DEFAULT 0, creator_minor INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT '',
 creator_bps INTEGER NOT NULL DEFAULT 0 CHECK(creator_bps BETWEEN 0 AND 10000), subscription_id TEXT,
 payload TEXT, result TEXT, previous_expiry INTEGER, previous_receipt TEXT, error TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 UNIQUE(user_id,project_id,request_id)
);
CREATE INDEX IF NOT EXISTS points_receipts_user ON points_receipts(user_id,created_at);
CREATE INDEX IF NOT EXISTS points_receipts_author ON points_receipts(author_id,created_at);
CREATE TABLE IF NOT EXISTS points_allocations (
 receipt_id TEXT NOT NULL REFERENCES points_receipts(id), lot_id TEXT NOT NULL REFERENCES points_lots(id), points INTEGER NOT NULL CHECK(points>0),
 value_minor INTEGER NOT NULL CHECK(value_minor>=0), fee_minor INTEGER NOT NULL CHECK(fee_minor>=0), returned INTEGER NOT NULL DEFAULT 0 CHECK(returned IN(0,1)), PRIMARY KEY(receipt_id,lot_id)
);
CREATE TRIGGER IF NOT EXISTS points_allocate AFTER INSERT ON points_allocations BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM points_lots l JOIN points_receipts r ON r.id=NEW.receipt_id WHERE l.id=NEW.lot_id AND l.user_id=r.user_id) THEN RAISE(ABORT,'points_source_mismatch') END;
 UPDATE points_lots SET remaining=remaining-NEW.points WHERE id=NEW.lot_id;
END;
CREATE TRIGGER IF NOT EXISTS points_return AFTER UPDATE OF returned ON points_allocations WHEN OLD.returned=0 AND NEW.returned=1 BEGIN
 UPDATE points_lots SET remaining=remaining+NEW.points WHERE id=NEW.lot_id;
END;
CREATE TRIGGER IF NOT EXISTS points_finalise BEFORE UPDATE OF status ON points_receipts WHEN NEW.status IN('granted','reserved') AND OLD.status='prepared' BEGIN
 SELECT CASE WHEN COALESCE((SELECT SUM(points) FROM points_allocations WHERE receipt_id=NEW.id AND returned=0),0)<>NEW.price THEN RAISE(ABORT,'points_allocation_incomplete') END;
END;
CREATE TABLE IF NOT EXISTS points_grants (
 receipt_id TEXT PRIMARY KEY REFERENCES points_receipts(id), user_id TEXT NOT NULL, project_id TEXT NOT NULL, entitlement TEXT NOT NULL,
 total INTEGER NOT NULL CHECK(total>0), remaining INTEGER NOT NULL CHECK(remaining>=0 AND remaining<=total)
);
CREATE TABLE IF NOT EXISTS points_durable (
 user_id TEXT NOT NULL, project_id TEXT NOT NULL, entitlement TEXT NOT NULL, receipt_id TEXT NOT NULL REFERENCES points_receipts(id), PRIMARY KEY(user_id,project_id,entitlement)
);
CREATE TABLE IF NOT EXISTS points_terms (
 user_id TEXT NOT NULL, project_id TEXT NOT NULL, entitlement TEXT NOT NULL, expires_at INTEGER NOT NULL, receipt_id TEXT NOT NULL REFERENCES points_receipts(id), PRIMARY KEY(user_id,project_id,entitlement)
);
CREATE TABLE IF NOT EXISTS points_consumptions (
 user_id TEXT NOT NULL, project_id TEXT NOT NULL, request_id TEXT NOT NULL, grant_id TEXT NOT NULL REFERENCES points_grants(receipt_id), created_at INTEGER NOT NULL,
 PRIMARY KEY(user_id,project_id,request_id)
);
CREATE TRIGGER IF NOT EXISTS points_consume AFTER INSERT ON points_consumptions BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM points_grants WHERE receipt_id=NEW.grant_id AND user_id=NEW.user_id AND project_id=NEW.project_id) THEN RAISE(ABORT,'points_grant_mismatch') END;
 UPDATE points_grants SET remaining=remaining-1 WHERE receipt_id=NEW.grant_id;
END;
-- Assertions make a failed conditional write abort the whole D1 batch.
CREATE TABLE IF NOT EXISTS points_assertions(id TEXT PRIMARY KEY, ok INTEGER NOT NULL CHECK(ok=1));
CREATE TABLE IF NOT EXISTS points_ai_budget(day TEXT PRIMARY KEY, used INTEGER NOT NULL CHECK(used>=0));
CREATE TABLE IF NOT EXISTS points_intent_payloads(id TEXT PRIMARY KEY, payload TEXT NOT NULL);

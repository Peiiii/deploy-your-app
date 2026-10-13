import { type NotificationKind } from './contract';
export const notificationSchema = [
  `CREATE TABLE IF NOT EXISTS notification_push_subscriptions(endpoint_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,endpoint TEXT NOT NULL,p256dh TEXT NOT NULL,auth TEXT NOT NULL,created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS notification_presence(user_id TEXT PRIMARY KEY,last_visible_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS notification_push_user ON notification_push_subscriptions(user_id)`,
  `CREATE TABLE IF NOT EXISTS notifications(seq INTEGER PRIMARY KEY AUTOINCREMENT,event_key TEXT NOT NULL,recipient_id TEXT NOT NULL,actor_id TEXT,kind TEXT NOT NULL,subject_id TEXT NOT NULL,comment_id TEXT,group_key TEXT NOT NULL,priority TEXT NOT NULL,attention_eligible INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL,revoked_at INTEGER,UNIQUE(recipient_id,event_key))`,
  `CREATE INDEX IF NOT EXISTS notifications_subject ON notifications(subject_id)`,
  `CREATE INDEX IF NOT EXISTS notifications_created_at ON notifications(created_at)`,
  `CREATE INDEX IF NOT EXISTS notifications_recipient_seq ON notifications(recipient_id,seq DESC)`,
  `CREATE INDEX IF NOT EXISTS notifications_group_seq ON notifications(recipient_id,group_key,seq DESC)`,
  `CREATE INDEX IF NOT EXISTS notifications_suppression ON notifications(recipient_id,actor_id,kind,subject_id,created_at)`,
  `CREATE TABLE IF NOT EXISTS notification_group_reads(recipient_id TEXT NOT NULL,group_key TEXT NOT NULL,read_through_seq INTEGER NOT NULL,read_at INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(recipient_id,group_key))`,
  `CREATE TABLE IF NOT EXISTS notification_preferences(user_id TEXT PRIMARY KEY,settings TEXT NOT NULL,consented_at INTEGER,last_scanned_at INTEGER NOT NULL DEFAULT 0,resumed_at INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS notification_subject_mutes(user_id TEXT NOT NULL,subject_id TEXT NOT NULL,muted INTEGER NOT NULL DEFAULT 1,suppressed_through_seq INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,subject_id))`,
  `CREATE TABLE IF NOT EXISTS comment_response_dispositions(user_id TEXT NOT NULL,comment_id TEXT NOT NULL,PRIMARY KEY(user_id,comment_id))`,
  `CREATE TABLE IF NOT EXISTS first_publications(project_id TEXT PRIMARY KEY,published_at INTEGER NOT NULL,author_id TEXT,baseline INTEGER NOT NULL DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS first_publications_at ON first_publications(published_at DESC,project_id)`,
  `CREATE TABLE IF NOT EXISTS notification_deliveries(id TEXT PRIMARY KEY,recipient_id TEXT NOT NULL,channel TEXT NOT NULL,scope TEXT NOT NULL,payload TEXT NOT NULL,state TEXT NOT NULL,not_before INTEGER NOT NULL,expires_at INTEGER NOT NULL,lease_until INTEGER NOT NULL DEFAULT 0,attempts INTEGER NOT NULL DEFAULT 0,first_attempt_at INTEGER,accepted_at INTEGER,delivered_at INTEGER,provider_id TEXT,error_code TEXT,endpoint_hash TEXT,UNIQUE(recipient_id,scope))`,
  `CREATE INDEX IF NOT EXISTS notification_deliveries_expiry ON notification_deliveries(expires_at)`,
  `CREATE INDEX IF NOT EXISTS notification_deliveries_due ON notification_deliveries(state,not_before)`,
  `CREATE TRIGGER IF NOT EXISTS notification_revoke_pending AFTER UPDATE OF revoked_at ON notifications WHEN NEW.revoked_at IS NOT NULL AND OLD.revoked_at IS NULL BEGIN UPDATE notification_deliveries SET state='cancelled' WHERE recipient_id=NEW.recipient_id AND state IN ('pending','retryable') AND EXISTS(SELECT 1 FROM json_each(notification_deliveries.payload,'$.groups') g WHERE json_extract(g.value,'$.key')=NEW.group_key AND json_extract(g.value,'$.seq')>=NEW.seq); END`,
];
const schemas = new WeakMap<D1Database, Promise<void>>();
export function ensureNotificationSchema(db: D1Database): Promise<void> {
  const existing = schemas.get(db);
  if (existing) return existing;
  const pending = db
    .batch(notificationSchema.map((sql) => db.prepare(sql)))
    .then(() => undefined)
    .catch((error) => {
      schemas.delete(db);
      throw error;
    });
  schemas.set(db, pending);
  return pending;
}
export interface NotificationEvent {
  key: string;
  actorId: string | null;
  recipientId: string;
  kind: NotificationKind;
  subjectId: string;
  commentId?: string | null;
  groupKey: string;
  priority: 'important' | 'normal' | 'light';
  at?: number;
}
/** Only trusted business owners supply conditions; never pass client SQL. */
export function notificationStatement(
  db: D1Database,
  event: NotificationEvent,
  condition = '1',
  bindings: (string | number | null)[] = []
): D1PreparedStatement {
  const at = event.at ?? Date.now();
  const light = ['like', 'favorite', 'follow'].includes(event.kind);
  return db
    .prepare(
      `INSERT OR IGNORE INTO notifications(event_key,recipient_id,actor_id,kind,subject_id,comment_id,group_key,priority,attention_eligible,created_at)
    SELECT ?,?,?,?,?,?,?,?,CASE WHEN ?=1 AND EXISTS(SELECT 1 FROM notifications WHERE recipient_id=? AND actor_id=? AND kind=? AND subject_id=? AND created_at>?) THEN 0 ELSE 1 END,?
    WHERE ?<>COALESCE(?,'') AND (${condition})`
    )
    .bind(
      event.key,
      event.recipientId,
      event.actorId,
      event.kind,
      event.subjectId,
      event.commentId ?? null,
      event.groupKey,
      event.priority,
      Number(light),
      event.recipientId,
      event.actorId,
      event.kind,
      event.subjectId,
      at - 86400000,
      at,
      event.recipientId,
      event.actorId,
      ...bindings
    );
}
export function revokeNotification(db: D1Database, eventKey: string): D1PreparedStatement {
  return db
    .prepare('UPDATE notifications SET revoked_at=? WHERE event_key=? AND revoked_at IS NULL')
    .bind(Date.now(), eventKey);
}
export function publicationStatement(db: D1Database, projectId: string): D1PreparedStatement {
  return db
    .prepare(
      `INSERT OR IGNORE INTO first_publications(project_id,published_at,author_id) SELECT id,?,owner_id FROM projects WHERE id=? AND is_public=1 AND status='Live' AND url IS NOT NULL AND url<>'' AND (is_deleted=0 OR is_deleted IS NULL) AND changes()>0`
    )
    .bind(Date.now(), projectId);
}
/** Source owners include these statements in their business mutation batch. */
export function revokeSubjectNotifications(db: D1Database, id: string) {
  return db
    .prepare('UPDATE notifications SET revoked_at=? WHERE subject_id=? AND revoked_at IS NULL')
    .bind(Date.now(), id);
}
export function revokeCommentNotifications(db: D1Database, id: string) {
  return db
    .prepare('UPDATE notifications SET revoked_at=? WHERE comment_id=? AND revoked_at IS NULL')
    .bind(Date.now(), id);
}
export function revokeInaccessibleProjectNotifications(db: D1Database, id: string) {
  return db
    .prepare(
      `UPDATE notifications SET revoked_at=? WHERE subject_id=? AND revoked_at IS NULL AND kind IN ('comment','reply','like','favorite','deployment_success','deployment_failure') AND EXISTS(SELECT 1 FROM projects p WHERE p.id=notifications.subject_id AND (p.is_deleted=1 OR (p.is_public=0 AND p.owner_id<>notifications.recipient_id) OR (notifications.kind IN ('comment','like','favorite','deployment_success','deployment_failure') AND p.owner_id<>notifications.recipient_id) OR (notifications.kind='reply' AND notifications.priority='normal' AND p.owner_id<>notifications.recipient_id)))`
    )
    .bind(Date.now(), id);
}
const feedbackSchemas = new WeakMap<D1Database, Promise<void>>();
export function ensureFeedbackNotificationSource(db: D1Database): Promise<void> {
  const prior = feedbackSchemas.get(db);
  if (prior) return prior;
  const pending = (async () => {
    await ensureNotificationSchema(db);
    for (const definition of [
      'notification_version INTEGER NOT NULL DEFAULT 0',
      'notification_mutation TEXT',
    ]) {
      try {
        await db.prepare('ALTER TABLE community_feedback_posts ADD COLUMN ' + definition).run();
      } catch (error) {
        if (!String(error).includes('duplicate column')) throw error;
      }
    }
  })().catch((error) => {
    feedbackSchemas.delete(db);
    throw error;
  });
  feedbackSchemas.set(db, pending);
  return pending;
}

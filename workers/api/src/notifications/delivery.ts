import type { ApiWorkerEnv } from '../types/env';
import type { NotificationItem } from '@gemigo/notifications';
import { ensureNotificationSchema } from '@gemigo/notifications/persistence';
import {
  getPreferences,
  listNotifications,
  hasUnreadThrough,
  getReminderCutoff,
} from './repository';
import { localTime, nextAllowed } from './policy';
import { sendWebPush } from './web-push';
interface Payload {
  recipientId: string;
  title: string;
  body: string;
  target: string;
  groups: { key: string; seq: number }[];
  category: 'direct' | 'feedback' | 'deployment' | 'digest';
}
interface Delivery {
  id: string;
  recipient_id: string;
  payload: string;
  expires_at: number;
  attempts: number;
  state: string;
  endpoint_hash: string | null;
}
const acceptedStates = "'leased','unknown','accepted','delivered','retryable'";
export async function reserveDelivery(
  db: D1Database,
  id: string,
  now: number,
  endpointHash: string | null = null
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE notification_deliveries SET state='leased',endpoint_hash=COALESCE(endpoint_hash,?),lease_until=?,first_attempt_at=COALESCE(first_attempt_at,?),attempts=attempts+1
    WHERE id=? AND state IN ('pending','retryable') AND not_before<=? AND expires_at>?
    AND NOT EXISTS(SELECT 1 FROM notification_deliveries other WHERE other.recipient_id=notification_deliveries.recipient_id AND other.id<>notification_deliveries.id AND other.state IN (${acceptedStates}) AND other.first_attempt_at>?)
    AND (json_extract(payload,'$.category')<>'digest' OR NOT EXISTS(SELECT 1 FROM notification_deliveries other WHERE other.recipient_id=notification_deliveries.recipient_id AND other.id<>notification_deliveries.id AND other.state IN (${acceptedStates}) AND json_extract(other.payload,'$.category')='digest' AND other.first_attempt_at>?))
    AND (SELECT COUNT(*) FROM notification_deliveries other WHERE other.recipient_id=notification_deliveries.recipient_id AND other.id<>notification_deliveries.id AND other.state IN (${acceptedStates}) AND other.first_attempt_at>?)<3`
    )
    .bind(
      endpointHash,
      now + 120000,
      now,
      id,
      now,
      now,
      now - 3600000,
      now - 86400000,
      now - 86400000
    )
    .run();
  return !!result.meta.changes;
}
const categoryOf = (item: NotificationItem): Payload['category'] =>
  item.kind.startsWith('feedback_')
    ? 'feedback'
    : item.kind === 'deployment_failure'
      ? 'deployment'
      : 'direct';
async function enqueue(
  db: D1Database,
  userId: string,
  items: NotificationItem[],
  category: Payload['category'],
  scope: string,
  now: number
): Promise<void> {
  const target = new URL(
    items.length === 1 ? items[0].target : '/notifications',
    'https://gemigo.io'
  );
  if (items.length === 1) {
    target.searchParams.set('notificationGroup', items[0].groupKey);
    target.searchParams.set('notificationSeq', String(items[0].throughSeq));
  }
  const payload: Payload = {
    recipientId: userId,
    title: 'GemiGo',
    body:
      category === 'feedback'
        ? '你的反馈有新的处理结果。'
        : category === 'deployment'
          ? '你的部署需要关注。'
          : category === 'digest'
            ? '你有新的互动，打开消息中心查看。'
            : '你有新的评论或回复。',
    target: target.pathname + target.search,
    groups: items.map((item) => ({ key: item.groupKey, seq: item.throughSeq })),
    category,
  };
  await db
    .prepare(
      "INSERT INTO notification_deliveries(id,recipient_id,channel,scope,payload,state,not_before,expires_at) VALUES(?,?,'push',?,?,'pending',?,?) ON CONFLICT(recipient_id,scope) DO UPDATE SET payload=excluded.payload,state='pending',not_before=excluded.not_before,expires_at=excluded.expires_at WHERE notification_deliveries.state='cancelled' AND notification_deliveries.first_attempt_at IS NULL"
    )
    .bind(
      crypto.randomUUID(),
      userId,
      scope,
      JSON.stringify(payload),
      now,
      now + (category === 'digest' ? 86400000 : 2 * 86400000)
    )
    .run();
}
export async function ignoredCategory(
  db: D1Database,
  userId: string,
  category: Payload['category'],
  now: number
) {
  const kinds =
    category === 'feedback'
      ? "'feedback_reply','feedback_status'"
      : category === 'deployment'
        ? "'deployment_failure'"
        : "'comment','reply'";
  const read = await db
    .prepare(
      `SELECT MAX(r.read_at) AS at FROM notification_group_reads r WHERE r.recipient_id=? AND (r.group_key='__all__' OR EXISTS(SELECT 1 FROM notifications n WHERE n.recipient_id=r.recipient_id AND n.group_key=r.group_key AND n.kind IN (${kinds})))`
    )
    .bind(userId)
    .first<{ at: number | null }>();
  const sends = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM notification_deliveries WHERE recipient_id=? AND state IN ('unknown','accepted','delivered') AND first_attempt_at>? AND json_extract(payload,'$.category')=?"
    )
    .bind(userId, now - 7 * 86400000, category)
    .first<{ n: number }>();
  const prefs = await db
    .prepare('SELECT consented_at,resumed_at FROM notification_preferences WHERE user_id=?')
    .bind(userId)
    .first<{ consented_at: number | null; resumed_at: number }>();
  const lastEngagement = Math.max(read?.at ?? prefs?.consented_at ?? now, prefs?.resumed_at ?? 0);
  return lastEngagement < now - 7 * 86400000 && (sends?.n ?? 0) >= 3;
}

async function prepareUser(db: D1Database, userId: string, now: number): Promise<void> {
  const prefs = await getPreferences(db, userId);
  const time = localTime(now, prefs.timezone);
  if (!time || prefs.pausedUntil > now) return;
  const cutoff = await getReminderCutoff(db, userId, prefs, now);
  const page = await listNotifications(db, userId, 'all', null, false, true, cutoff);
  const locallyCovered = new Map<string, number>();
  const previous = await db
    .prepare(
      "SELECT payload,state FROM notification_deliveries WHERE recipient_id=? AND state NOT IN ('cancelled','failed') AND expires_at>?"
    )
    .bind(userId, now - 86400000)
    .all<{ payload: string; state: string }>();
  const covered = (item: NotificationItem) =>
    (locallyCovered.get(item.groupKey) ?? 0) >= item.throughSeq ||
    previous.results?.some((row) =>
      (JSON.parse(row.payload) as Payload).groups.some(
        (group) =>
          group.key === item.groupKey &&
          (['pending', 'retryable', 'leased'].includes(row.state) || group.seq >= item.throughSeq)
      )
    );
  const direct = page.items.filter(
    (item) =>
      item.unread &&
      item.important &&
      item.firstUnreadAt !== null &&
      item.firstUnreadAt <= now - 600000 &&
      item.at > now - 2 * 86400000 &&
      !covered(item) &&
      prefs.external[categoryOf(item) as 'direct' | 'feedback' | 'deployment']
  );
  for (const category of ['feedback', 'direct', 'deployment'] as const) {
    const selected = direct.filter((item) => categoryOf(item) === category).slice(0, 5);
    if (!selected.length || (await ignoredCategory(db, userId, category, now))) continue;
    await enqueue(
      db,
      userId,
      selected,
      category,
      category + ':' + selected.map((item) => item.groupKey + ':' + item.throughSeq).join('|'),
      now
    );
    for (const item of selected) locallyCovered.set(item.groupKey, item.throughSeq);
    break;
  }
  if (prefs.external.digest && time.minute >= 18 * 60) {
    const digest = page.items
      .filter((item) => item.unread && item.at > now - 86400000 && !covered(item))
      .slice(0, 5);
    if (digest.length) await enqueue(db, userId, digest, 'digest', 'digest:' + time.day, now);
  }
}
async function deliver(
  db: D1Database,
  env: ApiWorkerEnv,
  row: Delivery,
  now: number
): Promise<void> {
  const payload = JSON.parse(row.payload) as Payload;
  const prefs = await getPreferences(db, row.recipient_id);
  const valid = await hasUnreadThrough(db, row.recipient_id, payload.groups, now);
  const allowed = nextAllowed(now, prefs);
  const subscription = await db
    .prepare(
      'SELECT endpoint_hash,endpoint,p256dh,auth FROM notification_push_subscriptions WHERE user_id=? AND (? IS NULL OR endpoint_hash=?) ORDER BY created_at DESC LIMIT 1'
    )
    .bind(row.recipient_id, row.endpoint_hash ?? null, row.endpoint_hash ?? null)
    .first<{ endpoint_hash: string; endpoint: string; p256dh: string; auth: string }>();
  if (!prefs.external[payload.category] || !valid || !subscription || row.expires_at <= now) {
    await db
      .prepare(
        "UPDATE notification_deliveries SET state='cancelled' WHERE id=? AND state IN ('pending','retryable')"
      )
      .bind(row.id)
      .run();
    return;
  }
  if (allowed === null || allowed > now) {
    await db
      .prepare(
        "UPDATE notification_deliveries SET not_before=? WHERE id=? AND state IN ('pending','retryable')"
      )
      .bind(allowed ?? now + 86400000, row.id)
      .run();
    return;
  }
  const presence = await db
    .prepare('SELECT last_visible_at FROM notification_presence WHERE user_id=?')
    .bind(row.recipient_id)
    .first<{ last_visible_at: number }>();
  if (presence && presence.last_visible_at > now - 90000) {
    await db
      .prepare(
        "UPDATE notification_deliveries SET not_before=? WHERE id=? AND state IN ('pending','retryable')"
      )
      .bind(now + 120000, row.id)
      .run();
    return;
  }
  if (!(await reserveDelivery(db, row.id, now, subscription.endpoint_hash))) return;
  try {
    const response = await sendWebPush(
      subscription,
      env.NOTIFICATION_VAPID_JWK!,
      JSON.stringify({ ...payload, tag: 'gemigo-' + row.id })
    );
    if (response.ok) {
      await db
        .prepare(
          "UPDATE notification_deliveries SET state=CASE WHEN state='delivered' THEN state ELSE 'accepted' END,accepted_at=?,provider_id=NULL WHERE id=? AND state IN ('leased','delivered')"
        )
        .bind(now, row.id)
        .run();
      return;
    }
    if (response.status === 404 || response.status === 410)
      await db
        .prepare('DELETE FROM notification_push_subscriptions WHERE endpoint_hash=?')
        .bind(subscription.endpoint_hash)
        .run();
    const retry = response.status === 429 || response.status >= 500;
    const retryAfter = response.headers.get('Retry-After');
    const seconds = Number(retryAfter);
    const requested = retryAfter
      ? Number.isFinite(seconds)
        ? seconds * 1000
        : Date.parse(retryAfter) - now
      : 0;
    const delay = Math.max(
      120000,
      Number.isFinite(requested) && requested > 0
        ? requested
        : Math.min(2 ** row.attempts * 120000, 7200000)
    );
    await db
      .prepare('UPDATE notification_deliveries SET state=?,not_before=?,error_code=? WHERE id=?')
      .bind(
        retry && row.attempts < 4 ? 'retryable' : 'failed',
        now + delay,
        'push_' + response.status,
        row.id
      )
      .run();
  } catch {
    await db
      .prepare(
        "UPDATE notification_deliveries SET state='unknown',error_code='push_acceptance_unknown' WHERE id=? AND state='leased'"
      )
      .bind(row.id)
      .run();
  }
}
export async function processNotificationsScheduled(
  env: ApiWorkerEnv,
  now = Date.now()
): Promise<void> {
  const db = env.PROJECTS_DB;
  if (!db) return;
  await ensureNotificationSchema(db);
  await db
    .prepare(
      "UPDATE notification_deliveries SET state='unknown',error_code='expired_lease' WHERE state='leased' AND lease_until<?"
    )
    .bind(Date.now())
    .run();
  // Bounded retention work also runs when outbound delivery is disabled.
  await db.batch([
    db
      .prepare(
        'DELETE FROM notifications WHERE seq IN (SELECT seq FROM notifications WHERE created_at<? LIMIT 10000)'
      )
      .bind(Date.now() - 90 * 86400000),
    db
      .prepare(
        "DELETE FROM notification_deliveries WHERE id IN (SELECT id FROM notification_deliveries WHERE expires_at<? AND state NOT IN ('pending','retryable','leased') LIMIT 10000)"
      )
      .bind(Date.now() - 90 * 86400000),
    db
      .prepare(
        "UPDATE notification_deliveries SET state='cancelled' WHERE state IN ('pending','retryable') AND expires_at<?"
      )
      .bind(Date.now()),
  ]);
  if (env.NOTIFICATION_SEND_ENABLED !== '1' || !env.NOTIFICATION_VAPID_JWK) return;
  const users = await db
    .prepare(
      "SELECT user_id FROM notification_preferences WHERE json_extract(settings,'$.external.direct')=1 OR json_extract(settings,'$.external.feedback')=1 OR json_extract(settings,'$.external.deployment')=1 OR json_extract(settings,'$.external.digest')=1 ORDER BY last_scanned_at LIMIT 20"
    )
    .all<{ user_id: string }>();
  for (const user of users.results ?? []) {
    await prepareUser(db, user.user_id, now);
    await db
      .prepare('UPDATE notification_preferences SET last_scanned_at=? WHERE user_id=?')
      .bind(now, user.user_id)
      .run();
  }
  const due = await db
    .prepare(
      "SELECT * FROM notification_deliveries WHERE state IN ('pending','retryable') AND not_before<=? ORDER BY not_before LIMIT 20"
    )
    .bind(now)
    .all<Delivery>();
  for (const row of due.results ?? []) await deliver(db, env, row, now);
}

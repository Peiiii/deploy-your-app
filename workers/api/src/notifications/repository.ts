import {
  categoryFor,
  defaultPreferences,
  type NotificationItem,
  type NotificationKind,
  type NotificationPage,
  type NotificationPreferences,
} from '@gemigo/notifications';
import { ensureNotificationSchema } from '@gemigo/notifications/persistence';
import { ValidationError } from '../utils/error-handler';

interface VisibleRow {
  seq: number;
  group_key: string;
  kind: NotificationKind;
  subject_id: string;
  comment_id: string | null;
  created_at: number;
  priority: string;
  attention_eligible: number;
  read_through: number;
  muted: number;
  project_name: string | null;
  feedback_title: string | null;
  actor_name: string | null;
  content: string | null;
  needs_reply: number;
}
const DAY = 86400000;
const visibleSource = `FROM notifications n
 LEFT JOIN projects p ON p.id=n.subject_id
 LEFT JOIN project_comments c ON c.id=n.comment_id AND n.kind IN ('comment','reply')
 LEFT JOIN community_feedback_posts f ON f.id=n.subject_id
 LEFT JOIN community_feedback_comments fc ON fc.id=n.comment_id AND n.kind='feedback_reply'
 LEFT JOIN users u ON u.id=n.actor_id
 LEFT JOIN notification_group_reads r ON r.recipient_id=n.recipient_id AND r.group_key=n.group_key
 LEFT JOIN notification_group_reads ar ON ar.recipient_id=n.recipient_id AND ar.group_key='__all__'
 LEFT JOIN notification_subject_mutes m ON m.user_id=n.recipient_id AND m.subject_id=n.subject_id
 WHERE n.recipient_id=? AND n.revoked_at IS NULL AND n.created_at>? AND n.seq<=?
 AND (n.kind='follow'
 OR (n.kind IN ('feedback_reply','feedback_status') AND f.user_id=n.recipient_id AND f.deleted_at IS NULL AND f.id IS NOT NULL AND (n.kind='feedback_status' OR (fc.id IS NOT NULL AND fc.deleted_at IS NULL)))
 OR (n.kind IN ('comment','reply','like','favorite','deployment_success','deployment_failure') AND p.id IS NOT NULL AND (p.is_deleted=0 OR p.is_deleted IS NULL)
   AND (p.is_public=1 OR p.owner_id=n.recipient_id)
   AND (n.kind NOT IN ('comment','like','favorite') OR p.owner_id=n.recipient_id)
   AND (n.kind<>'reply' OR n.priority<>'normal' OR p.owner_id=n.recipient_id)
   AND (n.kind NOT IN ('deployment_success','deployment_failure') OR p.owner_id=n.recipient_id)
   AND (n.kind NOT IN ('comment','reply') OR (c.id IS NOT NULL AND c.deleted_at IS NULL))))`;
const visibleFields = `n.*,p.name AS project_name,f.title AS feedback_title,
 CASE WHEN n.actor_id='gemigo-admin-team' THEN 'GemiGo 团队' ELSE COALESCE(u.handle,u.display_name) END AS actor_name,
 CASE WHEN n.kind='feedback_reply' THEN fc.content ELSE c.content END AS content,
 MAX(COALESCE(r.read_through_seq,0),COALESCE(ar.read_through_seq,0),COALESCE(m.suppressed_through_seq,0)) AS read_through,
 COALESCE(m.muted,0) AS muted,
 CASE WHEN n.kind='comment' AND c.reply_to_comment_id IS NULL AND p.owner_id=n.recipient_id
 AND NOT EXISTS(SELECT 1 FROM project_comments reply WHERE reply.reply_to_comment_id=c.id AND reply.user_id=n.recipient_id AND reply.deleted_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM comment_response_dispositions d WHERE d.user_id=n.recipient_id AND d.comment_id=c.id) THEN 1 ELSE 0 END AS needs_reply`;

export async function getPreferences(
  db: D1Database,
  userId: string
): Promise<NotificationPreferences> {
  await ensureNotificationSchema(db);
  const row = await db
    .prepare('SELECT settings FROM notification_preferences WHERE user_id=?')
    .bind(userId)
    .first<{ settings: string }>();
  const defaults = defaultPreferences();
  if (!row) return defaults;
  const settings = JSON.parse(row.settings) as Partial<NotificationPreferences>;
  return {
    ...defaults,
    ...settings,
    badges: { ...defaults.badges, ...settings.badges },
    external: { ...defaults.external, ...settings.external },
  };
}
export async function savePreferences(
  db: D1Database,
  userId: string,
  input: Record<string, unknown>,
  externalAvailable: boolean
): Promise<void> {
  const previous = await getPreferences(db, userId);
  const next = { ...previous, badges: { ...previous.badges }, external: { ...previous.external } };
  for (const key of ['badges', 'external'] as const) {
    if (input[key] === undefined) continue;
    if (!input[key] || typeof input[key] !== 'object' || Array.isArray(input[key]))
      throw new ValidationError('Invalid notification settings');
    for (const [name, value] of Object.entries(input[key] as Record<string, unknown>)) {
      if (!Object.hasOwn(next[key], name) || typeof value !== 'boolean')
        throw new ValidationError('Invalid notification setting');
      (next[key] as Record<string, boolean>)[name] = value;
    }
  }
  if (input.timezone !== undefined) {
    if (typeof input.timezone !== 'string' || input.timezone.length > 80)
      throw new ValidationError('Invalid timezone');
    try {
      new Intl.DateTimeFormat('en', { timeZone: input.timezone });
    } catch {
      throw new ValidationError('Invalid timezone');
    }
    next.timezone = input.timezone;
  }
  for (const key of ['quietStart', 'quietEnd'] as const)
    if (input[key] !== undefined) {
      const v = input[key];
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v >= 1440)
        throw new ValidationError('Invalid quiet time');
      next[key] = v;
    }
  if (input.pausedUntil !== undefined) {
    const v = input.pausedUntil;
    if (typeof v !== 'number' || v < 0 || v > Date.now() + 7 * DAY + 10000)
      throw new ValidationError('Invalid pause');
    next.pausedUntil = v;
  }
  if (
    Object.entries(next.external).some(
      ([key, value]) => value && !previous.external[key as keyof typeof previous.external]
    ) &&
    (!externalAvailable || !next.timezone)
  )
    throw new ValidationError(
      'Enable device notifications and set your timezone before enabling reminders'
    );
  await db
    .prepare(
      'INSERT INTO notification_preferences(user_id,settings,consented_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET settings=excluded.settings,consented_at=COALESCE(notification_preferences.consented_at,excluded.consented_at)'
    )
    .bind(
      userId,
      JSON.stringify(next),
      Object.values(next.external).some(Boolean) ? Date.now() : null
    )
    .run();
  if (
    input.resumeAutomatic === true ||
    (input.pausedUntil === 0 && previous.pausedUntil > Date.now())
  )
    await db
      .prepare('UPDATE notification_preferences SET resumed_at=? WHERE user_id=?')
      .bind(Date.now(), userId)
      .run();
  await db
    .prepare(
      "UPDATE notification_deliveries SET not_before=? WHERE recipient_id=? AND state='pending'"
    )
    .bind(Date.now(), userId)
    .run();
}

async function readSummary(db: D1Database, userId: string, maximum: number, eligible: string) {
  return await db
    .prepare(
      `SELECT COALESCE(SUM(important),0) AS important,COALESCE(SUM(1-important),0) AS ordinary FROM (SELECT n.group_key,MAX(CASE WHEN n.priority='important' THEN 1 ELSE 0 END) AS important ${visibleSource} AND (${eligible}) GROUP BY n.group_key)`
    )
    .bind(userId, Date.now() - 90 * DAY, maximum)
    .first<{ important: number; ordinary: number }>();
}
export async function getNotificationSummary(db: D1Database, userId: string) {
  const prefs = await getPreferences(db, userId);
  const maximum = await db
    .prepare('SELECT COALESCE(MAX(seq),0) AS seq FROM notifications WHERE recipient_id=?')
    .bind(userId)
    .first<{ seq: number }>();
  const summary = await readSummary(db, userId, maximum?.seq ?? 0, unreadEligibility(prefs));
  return {
    important: summary?.important ?? 0,
    ordinary: summary?.ordinary ?? 0,
    snapshotSeq: maximum?.seq ?? 0,
  };
}
function unreadEligibility(prefs: NotificationPreferences, forDelivery = false, cutoff = 0) {
  const kinds = (
    [
      'comment',
      'reply',
      'like',
      'favorite',
      'follow',
      'feedback_reply',
      'feedback_status',
      'deployment_success',
      'deployment_failure',
    ] as NotificationKind[]
  ).filter((kind) => forDelivery || prefs.badges[categoryFor(kind)]);
  return `n.attention_eligible=1 ${forDelivery ? `AND n.created_at>=${Math.max(0, cutoff)}` : ''} AND n.seq>MAX(COALESCE(r.read_through_seq,0),COALESCE(ar.read_through_seq,0),COALESCE(m.suppressed_through_seq,0)) AND COALESCE(m.muted,0)=0 AND n.kind IN (${kinds.map((kind) => "'" + kind + "'").join(',') || "''"})`;
}

/** Bound visible source before aggregation; no client recipient or private snapshots. */
export async function listNotifications(
  db: D1Database,
  userId: string,
  category = 'all',
  cursor: string | null = null,
  needsReply = false,
  forDelivery = false,
  reminderCutoff = 0
): Promise<NotificationPage> {
  await ensureNotificationSchema(db);
  const prefs = await getPreferences(db, userId);
  const maximum = await db
    .prepare('SELECT COALESCE(MAX(seq),0) AS seq FROM notifications WHERE recipient_id=?')
    .bind(userId)
    .first<{ seq: number }>();
  let snapshot = maximum?.seq ?? 0;
  let after = Number.MAX_SAFE_INTEGER;
  let afterPriority = 2;
  if (cursor) {
    try {
      const data = JSON.parse(atob(cursor));
      snapshot = data[0];
      after = data[1];
      afterPriority = data[2];
      if (
        !Number.isSafeInteger(snapshot) ||
        !Number.isSafeInteger(after) ||
        snapshot < 0 ||
        snapshot > (maximum?.seq ?? 0) ||
        after < 0 ||
        ![0, 1].includes(afterPriority)
      )
        throw Error();
    } catch {
      throw new ValidationError('Invalid notification cursor');
    }
  }
  // Aggregate in SQL and only load members for the next page. Summary shares the same visibility predicate.
  const eligible = unreadEligibility(prefs, forDelivery, reminderCutoff);
  const summary = await readSummary(db, userId, maximum?.seq ?? 0, eligible);
  const categoryClause =
    category === 'comments'
      ? "AND n.kind IN ('comment','reply')"
      : category === 'reactions'
        ? "AND n.kind IN ('like','favorite')"
        : category === 'follows'
          ? "AND n.kind='follow'"
          : category === 'system'
            ? "AND n.kind IN ('feedback_reply','feedback_status','deployment_success','deployment_failure')"
            : '';
  if (!['all', 'comments', 'reactions', 'follows', 'system'].includes(category))
    throw new ValidationError('Invalid category');
  const pending = needsReply
    ? `AND n.kind='comment' AND c.reply_to_comment_id IS NULL AND p.owner_id=n.recipient_id AND NOT EXISTS(SELECT 1 FROM project_comments reply WHERE reply.reply_to_comment_id=c.id AND reply.user_id=n.recipient_id AND reply.deleted_at IS NULL) AND NOT EXISTS(SELECT 1 FROM comment_response_dispositions d WHERE d.user_id=n.recipient_id AND d.comment_id=c.id)`
    : '';
  const groups = await db
    .prepare(
      `SELECT n.group_key,MAX(n.seq) AS latest,MAX(CASE WHEN (${eligible}) AND n.priority='important' THEN 1 ELSE 0 END) AS sort_priority,COUNT(*) AS count,MAX(CASE WHEN ${eligible} THEN 1 ELSE 0 END) AS unread,MAX(CASE WHEN (${eligible}) AND n.priority='important' THEN 1 ELSE 0 END) AS important_unread,MIN(CASE WHEN ${eligible} THEN n.created_at ELSE NULL END) AS first_unread_at ${visibleSource} ${categoryClause} ${pending} GROUP BY n.group_key HAVING (sort_priority<? OR (sort_priority=? AND MAX(n.seq)<?)) ORDER BY sort_priority DESC,latest DESC LIMIT 31`
    )
    .bind(userId, Date.now() - 90 * DAY, snapshot, afterPriority, afterPriority, after)
    .all<{
      group_key: string;
      latest: number;
      sort_priority: number;
      count: number;
      unread: number;
      important_unread: number;
      first_unread_at: number | null;
    }>();
  const page = (groups.results ?? []).slice(0, 30);
  const keys = page.map((g) => g.latest);
  const rows = keys.length
    ? ((
        await db
          .prepare(
            `SELECT ${visibleFields} ${visibleSource} AND n.seq IN (${keys.map(() => '?').join(',')}) ORDER BY n.seq DESC`
          )
          .bind(userId, Date.now() - 90 * DAY, snapshot, ...keys)
          .all<VisibleRow>()
      ).results ?? [])
    : [];
  const items: NotificationItem[] = page.flatMap((group) => {
    const members = rows.filter((row) => row.group_key === group.group_key);
    const last = members[0];
    if (!last) return [];
    return [
      {
        groupKey: group.group_key,
        throughSeq: group.latest,
        kind: last.kind,
        category: categoryFor(last.kind),
        important: !!group.important_unread,
        unread: !!group.unread,
        muted: !!last.muted,
        count: group.count,
        title: last.project_name ?? last.feedback_title ?? '',
        actorName: last.kind === 'favorite' ? null : last.actor_name,
        excerpt: last.content?.slice(0, 160) ?? null,
        subjectId: last.subject_id,
        commentId: last.comment_id,
        at: last.created_at,
        needsReply: members.some((r) => !!r.needs_reply),
        firstUnreadAt: group.first_unread_at,
        target:
          last.kind === 'follow'
            ? '/me?tab=followers'
            : last.kind.startsWith('feedback_')
              ? '/community?feedbackId=' + encodeURIComponent(last.subject_id)
              : last.kind.startsWith('deployment_')
                ? '/projects/' + encodeURIComponent(last.subject_id)
                : '/apps/' +
                  encodeURIComponent(last.subject_id) +
                  '/discussion' +
                  (last.comment_id ? '?commentId=' + encodeURIComponent(last.comment_id) : ''),
      },
    ];
  });
  const last = page.at(-1);
  return {
    items,
    important: summary?.important ?? 0,
    ordinary: summary?.ordinary ?? 0,
    snapshotSeq: snapshot,
    cursor:
      (groups.results?.length ?? 0) > 30 && last
        ? btoa(JSON.stringify([snapshot, last.latest, last.sort_priority]))
        : null,
  };
}
export async function readNotifications(
  db: D1Database,
  userId: string,
  group: string,
  seq: number
): Promise<void> {
  await ensureNotificationSchema(db);
  if (!Number.isSafeInteger(seq) || seq < 0 || group.length > 250)
    throw new ValidationError('Invalid reading boundary');
  const max = await db
    .prepare('SELECT MAX(seq) AS seq FROM notifications WHERE recipient_id=?')
    .bind(userId)
    .first<{ seq: number | null }>();
  if (seq > (max?.seq ?? 0)) throw new ValidationError('Invalid reading boundary');
  await db
    .prepare(
      'INSERT INTO notification_group_reads(recipient_id,group_key,read_through_seq,read_at) VALUES(?,?,?,?) ON CONFLICT(recipient_id,group_key) DO UPDATE SET read_through_seq=MAX(read_through_seq,excluded.read_through_seq),read_at=MAX(read_at,excluded.read_at)'
    )
    .bind(userId, group, seq, Date.now())
    .run();
}
/** Delivery validity uses its frozen membership boundary, never newer unread events. */
export async function getReminderCutoff(
  db: D1Database,
  userId: string,
  prefs: NotificationPreferences,
  now: number
) {
  const row = await db
    .prepare('SELECT resumed_at FROM notification_preferences WHERE user_id=?')
    .bind(userId)
    .first<{ resumed_at: number }>();
  return Math.max(row?.resumed_at ?? 0, prefs.pausedUntil <= now ? prefs.pausedUntil : 0);
}
export async function hasUnreadThrough(
  db: D1Database,
  userId: string,
  groups: { key: string; seq: number }[],
  now = Date.now()
): Promise<boolean> {
  if (!groups.length) return false;
  const cutoff = await getReminderCutoff(db, userId, await getPreferences(db, userId), now);
  const clauses = groups.map(() => '(n.group_key=? AND n.seq<=?)').join(' OR ');
  const bindings = groups.flatMap((group) => [group.key, group.seq]);
  const row = await db
    .prepare(
      `SELECT n.seq ${visibleSource} AND n.attention_eligible=1 AND n.created_at>=${cutoff} AND COALESCE(m.muted,0)=0 AND n.seq>MAX(COALESCE(r.read_through_seq,0),COALESCE(ar.read_through_seq,0),COALESCE(m.suppressed_through_seq,0)) AND (${clauses}) LIMIT 1`
    )
    .bind(userId, Date.now() - 90 * DAY, Math.max(...groups.map((g) => g.seq)), ...bindings)
    .first();
  return !!row;
}

import type { AdminEnv } from './auth';
import { AdminInputError } from './operations';

// Reserved non-user identity, projected as GemiGo 团队 by the main API repository.
const teamId = 'gemigo-admin-team';
const statuses = ['open', 'planned', 'in_progress', 'completed'];
const categories = ['general', 'idea', 'bug', 'question'];
const pageOf = (url: URL) => {
  const page = Number(url.searchParams.get('page') || 1);
  if (!Number.isInteger(page) || page < 1 || page > 10000)
    throw new AdminInputError('分页参数无效');
  return page;
};
const fields = `p.id,p.user_id,p.title,p.content,p.category,p.status,p.created_at,p.updated_at,
  u.email,u.handle,u.display_name,
  (SELECT COUNT(*) FROM community_feedback_comments c WHERE c.post_id=p.id AND c.deleted_at IS NULL) AS comments_count`;
const source = 'community_feedback_posts p LEFT JOIN users u ON u.id=p.user_id';
const post = async (db: D1Database, id: string) => {
  const row = await db
    .prepare(`SELECT ${fields} FROM ${source} WHERE p.id=? AND p.deleted_at IS NULL`)
    .bind(id)
    .first();
  if (!row) throw new AdminInputError('反馈不存在或已删除', 404);
  return row;
};
const audit = (env: AdminEnv, action: string, id: string, detail: string) =>
  env.ANALYTICS_DB.prepare('INSERT INTO admin_audit SELECT ?,?,?,?,?,? WHERE changes()>0').bind(
    crypto.randomUUID(),
    env.ADMIN_USERNAME,
    action,
    id,
    detail,
    Date.now()
  );

export const listFeedback = async (db: D1Database, url: URL) => {
  const page = pageOf(url);
  const q = (url.searchParams.get('q') || '').trim();
  const status = url.searchParams.get('status') || '';
  const owner = url.searchParams.get('owner') || '';
  const category = url.searchParams.get('category') || '';
  if (
    q.length > 100 ||
    owner.length > 200 ||
    (status && !statuses.includes(status)) ||
    (category && !categories.includes(category))
  )
    throw new AdminInputError('反馈筛选参数无效');
  let where = 'p.deleted_at IS NULL';
  const values: (string | number)[] = [];
  if (owner) {
    where += ' AND p.user_id=?';
    values.push(owner);
  }
  if (q) {
    where +=
      ' AND (p.title LIKE ? OR p.content LIKE ? OR u.email LIKE ? OR u.display_name LIKE ? OR u.handle LIKE ? OR p.id=?)';
    values.push(...Array(5).fill(`%${q}%`), q);
  }
  for (const [field, value] of [
    ['status', status],
    ['category', category],
  ]) {
    if (value) {
      where += ` AND p.${field}=?`;
      values.push(value);
    }
  }
  const result = await db.batch<Record<string, unknown>>([
    db.prepare(`SELECT COUNT(*) AS total FROM ${source} WHERE ${where}`).bind(...values),
    db
      .prepare(
        `SELECT ${fields} FROM ${source} WHERE ${where} ORDER BY p.updated_at DESC,p.id LIMIT 20 OFFSET ?`
      )
      .bind(...values, (page - 1) * 20),
    db.prepare(
      'SELECT status,COUNT(*) AS total FROM community_feedback_posts WHERE deleted_at IS NULL GROUP BY status'
    ),
  ]);
  return {
    items: result[1].results,
    total: Number(result[0].results[0].total),
    page,
    limit: 20,
    counts: result[2].results,
  };
};

export const feedbackDetail = async (db: D1Database, url: URL, id: string) => {
  const page = pageOf(url);
  const item = await post(db, id);
  const comments = await db
    .prepare(
      `SELECT c.id,c.user_id,c.content,c.created_at,c.updated_at,u.display_name,u.handle,
    CASE WHEN c.user_id=? THEN 1 ELSE 0 END AS is_team
    FROM community_feedback_comments c LEFT JOIN users u ON u.id=c.user_id
    WHERE c.post_id=? AND c.deleted_at IS NULL ORDER BY c.created_at,c.id LIMIT 100 OFFSET ?`
    )
    .bind(teamId, id, (page - 1) * 100)
    .all();
  return { item, comments: comments.results, page, limit: 100, total: Number(item.comments_count) };
};

export const manageFeedback = async (env: AdminEnv, input: Record<string, unknown>) => {
  if (typeof input.id !== 'string' || !input.id || input.id.length > 100)
    throw new AdminInputError('反馈 ID 无效');
  const db = env.ANALYTICS_DB;
  const now = new Date().toISOString();
  await post(db, input.id);
  if (input.action === 'status') {
    if (
      typeof input.status !== 'string' ||
      !statuses.includes(input.status) ||
      typeof input.expected !== 'string' ||
      !statuses.includes(input.expected)
    )
      throw new AdminInputError('反馈状态无效');
    const results = await db.batch([
      db
        .prepare(
          'UPDATE community_feedback_posts SET status=?,updated_at=? WHERE id=? AND status=? AND deleted_at IS NULL'
        )
        .bind(input.status, now, input.id, input.expected),
      audit(env, 'feedback_status', input.id, `${input.expected} → ${input.status}`),
    ]);
    if (!results[0].meta.changes) throw new AdminInputError('反馈状态已变化，请刷新后重试', 409);
  } else if (input.action === 'reply') {
    const content = typeof input.content === 'string' ? input.content.trim() : '';
    if (
      !content ||
      content.length > 800 ||
      typeof input.replyId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.replyId)
    )
      throw new AdminInputError('回复须为 1–800 字符');
    // A stable replyId also handles a lost response without double posting.
    const prior = await db
      .prepare(
        'SELECT post_id,user_id,content,deleted_at FROM community_feedback_comments WHERE id=?'
      )
      .bind(input.replyId)
      .first();
    if (prior) {
      if (
        prior.post_id === input.id &&
        prior.user_id === teamId &&
        prior.content === content &&
        !prior.deleted_at
      )
        return { ok: true };
      throw new AdminInputError('回复标识冲突，请刷新后重试', 409);
    }
    const results = await db.batch([
      db
        .prepare(
          `INSERT OR IGNORE INTO community_feedback_comments (id,post_id,user_id,content,created_at,updated_at)
        SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM community_feedback_posts WHERE id=? AND deleted_at IS NULL)`
        )
        .bind(input.replyId, input.id, teamId, content, now, now, input.id),
      db
        .prepare(
          'UPDATE community_feedback_posts SET updated_at=? WHERE id=? AND deleted_at IS NULL AND changes()>0'
        )
        .bind(now, input.id),
      audit(env, 'feedback_reply', input.id, input.replyId),
    ]);
    if (!results[0].meta.changes) {
      const existing = await db
        .prepare(
          'SELECT post_id,user_id,content,deleted_at FROM community_feedback_comments WHERE id=?'
        )
        .bind(input.replyId)
        .first();
      if (
        !existing ||
        existing.post_id !== input.id ||
        existing.user_id !== teamId ||
        existing.content !== content ||
        existing.deleted_at
      )
        throw new AdminInputError('反馈已变化，回复未发布，请刷新后重试', 409);
    }
  } else if (input.action === 'delete') {
    const results = await db.batch([
      db
        .prepare(
          'UPDATE community_feedback_posts SET deleted_at=?,updated_at=? WHERE id=? AND deleted_at IS NULL'
        )
        .bind(now, now, input.id),
      audit(env, 'feedback_delete', input.id, 'soft delete'),
    ]);
    if (!results[0].meta.changes) throw new AdminInputError('反馈已删除，请刷新', 409);
  } else throw new AdminInputError('反馈操作无效');
  return { ok: true };
};

import type { AdminEnv } from './auth';
import {
  categorySql,
  languageExistsSql,
  languageListSql,
  languageMatchSql,
  projectInventory,
} from './project-inventory';

export class AdminInputError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
  }
}
const active = '(p.is_deleted=0 OR p.is_deleted IS NULL)';
export const channelSql = (field: string) =>
  `CASE WHEN ${field} IN ('web','cli','desktop','extension','api') THEN ${field} ELSE 'unknown' END`;
export const projectChannel = (order: 'ASC' | 'DESC') =>
  `(SELECT ${channelSql('a.client_channel')} FROM deployment_attempts a WHERE a.project_id=p.id ORDER BY a.started_at ${order},a.rowid ${order} LIMIT 1)`;
const audit = (env: AdminEnv, action: string, target: string, detail: string, condition = '') =>
  env.ANALYTICS_DB.prepare(`INSERT INTO admin_audit SELECT ?,?,?,?,?,? ${condition}`).bind(
    crypto.randomUUID(),
    env.ADMIN_USERNAME,
    action,
    target,
    detail,
    Date.now()
  );

export const overview = async (db: D1Database, url: URL) => {
  const days = Number(url.searchParams.get('days') || 7);
  if (![7, 30].includes(days)) throw new AdminInputError('请选择近 7 天或 30 天');
  const from = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  const actionPage = Number(url.searchParams.get('actionPage') || 1);
  const feedbackPage = Number(url.searchParams.get('feedbackPage') || 1);
  if (
    !Number.isInteger(actionPage) ||
    actionPage < 1 ||
    actionPage > 10000 ||
    !Number.isInteger(feedbackPage) ||
    feedbackPage < 1 ||
    feedbackPage > 10000
  )
    throw new AdminInputError('待关注分页参数无效');
  const stale = new Date(Date.now() - 86400000).toISOString();
  const latest = `(SELECT a.rowid FROM deployment_attempts a WHERE a.project_id=p.id ORDER BY a.started_at DESC,a.rowid DESC LIMIT 1)`;
  const actionSource = `projects p LEFT JOIN deployment_attempts a ON a.rowid=${latest}`;
  const stalled = `(p.status='Building' AND ((a.status IN ('started','accepted') AND a.started_at<?) OR (a.id IS NULL AND COALESCE(p.updated_at,p.last_deployed,p.created_at)<?)))`;
  const needsAttention = `${active} AND (p.status='Failed' OR ${stalled})`;
  const results = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM users WHERE created_at>=?) AS newUsers,
      COUNT(*) AS projects, SUM(p.status='Live') AS live,
      SUM(p.status='Building') AS building, SUM(p.status='Failed') AS failed,
      SUM(p.is_public=1 AND p.status='Live' AND p.url IS NOT NULL AND TRIM(p.url)!='') AS public
      FROM projects p WHERE ${active}`
      )
      .bind(from),
    db
      .prepare(
        `SELECT COUNT(*) AS total, SUM(status='succeeded') AS succeeded,
      SUM(status IN ('failed','rejected')) AS failed, SUM(status IN ('started','accepted')) AS pending
      FROM deployment_attempts WHERE started_at>=?`
      )
      .bind(from),
    db
      .prepare(
        `SELECT substr(started_at,1,10) AS day, COUNT(*) AS total,
      SUM(status='succeeded') AS succeeded, SUM(status IN ('failed','rejected')) AS failed
      FROM deployment_attempts WHERE started_at>=? GROUP BY day ORDER BY day`
      )
      .bind(from),
    db
      .prepare(
        `SELECT source_type AS name, COUNT(*) AS total FROM deployment_attempts
      WHERE started_at>=? GROUP BY source_type ORDER BY total DESC`
      )
      .bind(from),
    db
      .prepare(
        `SELECT COALESCE(error_code,'unknown') AS name,COUNT(*) AS total FROM deployment_attempts
      WHERE started_at>=? AND status IN ('failed','rejected') GROUP BY name ORDER BY total DESC LIMIT 6`
      )
      .bind(from),
    db
      .prepare(
        'SELECT SUM(human_views) AS humanViews,SUM(bot_views) AS botViews FROM project_daily_stats WHERE date>=?'
      )
      .bind(from),
    db
      .prepare(
        `WITH first_success AS (
      SELECT owner_id,MIN(started_at) AS first_at FROM deployment_attempts
      WHERE status='succeeded' AND owner_id IS NOT NULL AND TRIM(owner_id)!='' GROUP BY owner_id
    ), publishers AS (
      SELECT DISTINCT owner_id FROM deployment_attempts WHERE status='succeeded' AND started_at>=?
        AND owner_id IS NOT NULL AND TRIM(owner_id)!=''
    ) SELECT COUNT(*) AS publishers,COALESCE(SUM(f.first_at>=?),0) AS firstPublishers,
      COALESCE(SUM(f.first_at<?),0) AS repeatPublishers FROM publishers p JOIN first_success f ON f.owner_id=p.owner_id`
      )
      .bind(from, from, from),
    db
      .prepare(`SELECT COUNT(*) AS total FROM ${actionSource} WHERE ${needsAttention}`)
      .bind(stale, stale),
    db
      .prepare(
        `SELECT p.id,p.name,p.status,a.error_code,a.started_at,
      CASE WHEN ${stalled} THEN 'stalled' ELSE 'failed' END AS reason
      FROM ${actionSource} WHERE ${needsAttention}
      ORDER BY CASE WHEN p.status='Building' THEN 0 ELSE 1 END,COALESCE(a.started_at,p.created_at),p.id LIMIT 6 OFFSET ?`
      )
      .bind(stale, stale, stale, stale, (actionPage - 1) * 6),
    db.prepare(
      "SELECT COUNT(*) AS total FROM community_feedback_posts WHERE deleted_at IS NULL AND status='open'"
    ),
    db
      .prepare(
        "SELECT id,title,created_at FROM community_feedback_posts WHERE deleted_at IS NULL AND status='open' ORDER BY created_at,id LIMIT 6 OFFSET ?"
      )
      .bind((feedbackPage - 1) * 6),
  ]);
  const perDay = new Map(results[2].results.map((row) => [String(row.day), row]));
  const daily = Array.from({ length: days }, (_, index) => {
    const day = new Date(Date.parse(from) + index * 86400000).toISOString().slice(0, 10);
    return perDay.get(day) || { day, total: 0, succeeded: 0, failed: 0 };
  });
  return {
    days,
    from,
    generatedAt: Date.now(),
    summary: results[0].results[0],
    deployments: results[1].results[0],
    daily,
    sources: results[3].results,
    errors: results[4].results,
    traffic: results[5].results[0],
    publishing: results[6].results[0],
    attention: {
      items: results[8].results,
      total: Number(results[7].results[0].total),
      page: actionPage,
      limit: 6,
    },
    feedback: {
      items: results[10].results,
      total: Number(results[9].results[0].total),
      page: feedbackPage,
      limit: 6,
    },
  };
};

export const listOperations = async (db: D1Database, kind: string, url: URL) => {
  const page = Number(url.searchParams.get('page') || 1);
  const search = (url.searchParams.get('q') || '').trim();
  const status = url.searchParams.get('status') || '';
  const channel = url.searchParams.get('channel') || '';
  const category = url.searchParams.get('category') || '';
  const language = url.searchParams.get('language') || '';
  const visibility = url.searchParams.get('visibility') || '';
  if ((category || language || visibility) && kind !== 'projects')
    throw new AdminInputError('应用筛选无效');
  if (
    category &&
    !['Education', 'Games', 'Productivity', 'Creative', 'Development', 'Other'].includes(category)
  )
    throw new AdminInputError('应用分类无效');
  if (language && !/^[a-z]{2,3}$/.test(language)) throw new AdminInputError('应用语言无效');
  if (visibility && !['public', 'private', 'unrecorded'].includes(visibility))
    throw new AdminInputError('公开设置无效');
  if (
    channel &&
    (!['projects', 'deployments'].includes(kind) ||
      !['web', 'cli', 'desktop', 'extension', 'api', 'unknown', 'unrecorded'].includes(channel) ||
      (kind === 'deployments' && channel === 'unrecorded'))
  )
    throw new AdminInputError('部署渠道无效');
  if (!Number.isInteger(page) || page < 1 || page > 10000 || search.length > 100)
    throw new AdminInputError('搜索或分页参数无效');
  const limit = 20;
  const params: (string | number)[] = [];
  let from: string, where: string, fields: string, order: string;
  if (kind === 'users') {
    from = 'users u';
    where = '1=1';
    order = 'u.created_at DESC,u.id';
    fields = `u.id,u.email,u.handle,u.display_name,u.created_at,
      (SELECT COUNT(*) FROM projects p WHERE p.owner_id=u.id AND ${active}) AS projects,
      (SELECT COUNT(*) FROM sessions s WHERE s.user_id=u.id AND s.expires_at>?) AS sessions`;
    if (search) {
      where += ' AND (u.email LIKE ? OR u.handle LIKE ? OR u.display_name LIKE ? OR u.id=?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, search);
    }
  } else if (kind === 'projects') {
    from = 'projects p LEFT JOIN users u ON u.id=p.owner_id';
    where = active;
    order = 'COALESCE(p.created_at,p.last_deployed) DESC,p.id';
    fields = `p.id,p.name,p.slug,p.status,p.url,p.is_public,p.owner_id,u.email AS owner_email,
      u.display_name AS owner_name,p.source_type,p.created_at,p.last_deployed,
      p.category,${languageListSql} AS languages,
      ${projectChannel('ASC')} AS first_channel,${projectChannel('DESC')} AS latest_channel`;
    if (search) {
      where += ' AND (p.name LIKE ? OR p.slug LIKE ? OR u.email LIKE ? OR p.owner_id=?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, search);
    }
    if (status) {
      if (!['Live', 'Building', 'Failed'].includes(status))
        throw new AdminInputError('应用状态无效');
      where += ' AND p.status=?';
      params.push(status);
    }
    if (channel) {
      where += ` AND COALESCE(${projectChannel('DESC')},'unrecorded')=?`;
      params.push(channel);
    }
    if (category) {
      where += ` AND ${categorySql}=?`;
      params.push(category);
    }
    if (language) {
      where += ` AND ${language === 'und' ? `NOT ${languageExistsSql}` : languageMatchSql}`;
      if (language !== 'und') params.push(language);
    }
    if (visibility)
      where +=
        visibility === 'unrecorded'
          ? ' AND (p.is_public IS NULL OR p.is_public NOT IN (0,1))'
          : ` AND p.is_public=${visibility === 'public' ? 1 : 0}`;
  } else if (kind === 'deployments') {
    from = 'deployment_attempts a LEFT JOIN projects p ON p.id=a.project_id';
    where = '1=1';
    order = 'a.started_at DESC,a.id';
    fields = `a.id,a.project_id,p.name,a.source_type,${channelSql('a.client_channel')} AS client_channel,a.status,a.error_code,a.started_at,a.finished_at,a.duration_ms`;
    if (search) {
      where += ' AND (p.name LIKE ? OR a.project_id=? OR a.id=?)';
      params.push(`%${search}%`, search, search);
    }
    if (status) {
      if (!['started', 'accepted', 'succeeded', 'failed', 'rejected'].includes(status))
        throw new AdminInputError('部署状态无效');
      where += ' AND a.status=?';
      params.push(status);
    }
    if (channel) {
      where += ` AND ${channelSql('a.client_channel')}=?`;
      params.push(channel);
    }
  } else if (kind === 'audit') {
    from = 'admin_audit';
    where = '1=1';
    fields = 'id,username,action,target_id,detail,at';
    order = 'at DESC,id';
  } else throw new AdminInputError('Not found', 404);
  const rows = await db.batch<Record<string, unknown>>([
    db.prepare(`SELECT COUNT(*) AS total FROM ${from} WHERE ${where}`).bind(...params),
    db
      .prepare(`SELECT ${fields} FROM ${from} WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`)
      .bind(
        ...(kind === 'users' ? [new Date().toISOString()] : []),
        ...params,
        limit,
        (page - 1) * limit
      ),
  ]);
  return {
    items: rows[1].results,
    total: Number(rows[0].results[0].total),
    page,
    limit,
    ...(kind === 'projects' ? { inventory: await projectInventory(db) } : {}),
  };
};

export const manageOperation = async (env: AdminEnv, input: Record<string, unknown>) => {
  const { action, id } = input;
  if (typeof id !== 'string' || !id || id.length > 200) throw new AdminInputError('资源 ID 无效');
  if (action === 'visibility') {
    if (
      typeof input.expected !== 'boolean' ||
      typeof input.isPublic !== 'boolean' ||
      input.expected === input.isPublic
    )
      throw new AdminInputError('公开展示参数无效');
    const results = await env.ANALYTICS_DB.batch([
      env.ANALYTICS_DB.prepare(
        `UPDATE projects AS p SET is_public=?,updated_at=? WHERE id=? AND ${active} AND COALESCE(is_public,1)=?`
      ).bind(Number(input.isPublic), new Date().toISOString(), id, Number(input.expected)),
      audit(
        env,
        'visibility',
        id,
        input.isPublic ? '设为公开展示' : '取消公开展示',
        'WHERE changes()=1'
      ),
    ]);
    if (!results[0].meta.changes)
      throw new AdminInputError('应用已被更改或不存在，请刷新后再试', 409);
    return { ok: true };
  }
  if (action === 'revoke_sessions') {
    if (!(await env.ANALYTICS_DB.prepare('SELECT id FROM users WHERE id=?').bind(id).first()))
      throw new AdminInputError('用户不存在', 404);
    const results = await env.ANALYTICS_DB.batch([
      env.ANALYTICS_DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(id),
      audit(env, 'revoke_sessions', id, '撤销主站登录会话'),
    ]);
    return { ok: true, revoked: results[0].meta.changes };
  }
  throw new AdminInputError('管理操作无效');
};

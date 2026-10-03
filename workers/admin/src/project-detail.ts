import { AdminInputError, channelSql, projectChannel } from './operations';
import { languageListSql } from './project-inventory';

export const projectDetail = async (db: D1Database, id: string, url: URL) => {
  const days = Number(url.searchParams.get('days') || 7);
  const page = Number(url.searchParams.get('page') || 1);
  if (
    !id ||
    id.length > 200 ||
    ![7, 30].includes(days) ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 10000
  )
    throw new AdminInputError('应用详情参数无效');
  const item = await db
    .prepare(
      `SELECT p.id,p.name,p.slug,p.status,p.url,p.is_public,p.owner_id,
    u.email AS owner_email,u.display_name AS owner_name,p.category,${languageListSql} AS languages,
    p.created_at,p.last_deployed,p.last_success_at,${projectChannel('ASC')} AS first_channel,
    ${projectChannel('DESC')} AS latest_channel
    FROM projects p LEFT JOIN users u ON u.id=p.owner_id WHERE p.id=? AND (p.is_deleted=0 OR p.is_deleted IS NULL)`
    )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!item) throw new AdminInputError('应用不存在或已删除', 404);
  const from = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  const results = await db.batch<Record<string, unknown>>([
    db.prepare('SELECT COUNT(*) AS total FROM deployment_attempts WHERE project_id=?').bind(id),
    db
      .prepare(
        `SELECT id,status,source_type,${channelSql('client_channel')} AS client_channel,
      error_code,started_at,finished_at,duration_ms FROM deployment_attempts WHERE project_id=?
      ORDER BY started_at DESC,rowid DESC LIMIT 20 OFFSET ?`
      )
      .bind(id, (page - 1) * 20),
    db
      .prepare(
        `SELECT date AS day,human_views AS humanViews,bot_views AS botViews,unique_visitors AS dailyVisitors
      FROM project_daily_stats WHERE slug=? AND date>=? ORDER BY date`
      )
      .bind(item.slug || '', from),
    db
      .prepare(
        'SELECT id,title,status,created_at FROM community_feedback_posts WHERE user_id=? AND deleted_at IS NULL ORDER BY created_at DESC,id LIMIT 6'
      )
      .bind(item.owner_id || ''),
    db
      .prepare(
        'SELECT COUNT(*) AS total FROM community_feedback_posts WHERE user_id=? AND deleted_at IS NULL'
      )
      .bind(item.owner_id || ''),
  ]);
  const rows = new Map(results[2].results.map((row) => [String(row.day), row]));
  return {
    item,
    deployments: {
      items: results[1].results,
      total: Number(results[0].results[0].total),
      page,
      limit: 20,
    },
    traffic: {
      days,
      from,
      hasRecords: results[2].results.length > 0,
      daily: Array.from({ length: days }, (_, i) => {
        const day = new Date(Date.parse(from) + i * 86400000).toISOString().slice(0, 10);
        return rows.get(day) || { day, humanViews: 0, botViews: 0, dailyVisitors: 0 };
      }),
    },
    feedback: { items: results[3].results, total: Number(results[4].results[0].total) },
  };
};

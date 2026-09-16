import { EVENTS } from './contract';
import { dayKey, reserve } from './budget';
import { filterSql, type AnalyticsFilter } from './repository';
import type { summarize } from './report';

type Report = ReturnType<typeof summarize>;
// Aggregation runs inside SQLite, avoiding an unbounded array in the free Worker's CPU/memory budget.
export const querySqlReport = async (
  db: D1Database,
  filter: AnalyticsFilter
): Promise<Report & { rowsRead: number; reservedReads: number }> => {
  const { where, values } = filterSql(filter);
  const countAllowance = (Math.ceil((filter.to - filter.from) / 86400000) + 2) * 4000 + 100;
  if (!(await reserve(db, `reads:${dayKey()}`, countAllowance, 1000000)))
    throw new Error('今日分析查询预算已用完，请明天重试或查看已缓存报表。');
  const count = await db
    .prepare(`SELECT COUNT(*) total FROM product_events WHERE ${where}`)
    .bind(...values)
    .first<{ total: number }>();
  const allowance = (count?.total || 0) * 64 + 100;
  if (!(await reserve(db, `reads:${dayKey()}`, allowance, 1000000)))
    throw new Error('所选范围超过今日剩余查询预算，请缩小日期范围。');
  const base = `WITH f AS MATERIALIZED (SELECT * FROM product_events WHERE ${where}),
    starts AS (SELECT DISTINCT flow_id FROM f WHERE name='deployment_start' AND flow_id IS NOT NULL),
    c0 AS (SELECT session_id,MIN(at) at FROM f WHERE name='project_create_click' GROUP BY session_id),
    c1 AS (SELECT f.session_id,MIN(f.at) at FROM f JOIN c0 ON f.session_id=c0.session_id AND f.at>=c0.at WHERE name='project_created' GROUP BY f.session_id),
    c2 AS (SELECT f.session_id,MIN(f.at) at FROM f JOIN c1 ON f.session_id=c1.session_id AND f.at>=c1.at WHERE name='deployment_start' GROUP BY f.session_id),
    c3 AS (SELECT f.session_id,MIN(f.at) at FROM f JOIN c2 ON f.session_id=c2.session_id AND f.at>=c2.at WHERE name='deployment_success' GROUP BY f.session_id),
    d0 AS (SELECT session_id,MIN(at) at FROM f WHERE name='page_view' GROUP BY session_id),
    d1 AS (SELECT f.session_id,MIN(f.at) at FROM f JOIN d0 ON f.session_id=d0.session_id AND f.at>=d0.at WHERE name='app_preview' GROUP BY f.session_id),
    d2 AS (SELECT f.session_id,MIN(f.at) at FROM f JOIN d1 ON f.session_id=d1.session_id AND f.at>=d1.at WHERE name='app_visit' GROUP BY f.session_id)
    SELECT json_object(
    'summary',json_object('events',COUNT(*),'visitors',COUNT(DISTINCT visitor_id),'sessions',COUNT(DISTINCT session_id),'pageViews',COALESCE(SUM(name='page_view'),0)),
    'daily',(SELECT json_group_array(json_object('day',day,'events',events,'visitors',visitors)) FROM (SELECT strftime('%Y-%m-%d',at/1000,'unixepoch') day,COUNT(*) events,COUNT(DISTINCT visitor_id) visitors FROM f GROUP BY day ORDER BY day)),
    'features',(SELECT json_group_array(json_object('name',name,'events',events,'visitors',visitors)) FROM (SELECT name,COUNT(*) events,COUNT(DISTINCT visitor_id) visitors FROM f GROUP BY name)),
    'dimensions',(SELECT json_group_array(json_object('label',label,'events',events)) FROM (SELECT name||' / '||dimension label,COUNT(*) events FROM f WHERE dimension IS NOT NULL GROUP BY name,dimension ORDER BY events DESC)),
    'devices',(SELECT json_group_array(json_object('device',device,'visitors',visitors)) FROM (SELECT device,COUNT(DISTINCT visitor_id) visitors FROM f GROUP BY device)),
    'referrers',(SELECT json_group_array(json_object('referrer',referrer,'sessions',sessions)) FROM (SELECT referrer,COUNT(DISTINCT session_id) sessions FROM f GROUP BY referrer)),
    'paths',(SELECT json_group_array(json_object('path',path,'transitions',transitions)) FROM (SELECT origin||' → '||destination path,COUNT(*) transitions FROM (SELECT page origin,LEAD(page) OVER (PARTITION BY session_id ORDER BY at,id) destination FROM f WHERE name='page_view') WHERE destination IS NOT NULL AND origin!=destination GROUP BY origin,destination ORDER BY transitions DESC LIMIT 20)),
    'deployment',json_object('started',(SELECT COUNT(*) FROM starts),'succeeded',(SELECT COUNT(DISTINCT flow_id) FROM f WHERE name='deployment_success' AND flow_id IN starts),'failed',(SELECT COUNT(DISTINCT flow_id) FROM f WHERE name='deployment_failure' AND flow_id IN starts),'avgDurationMs',(SELECT ROUND(AVG(duration_ms)) FROM f WHERE name='deployment_success' AND flow_id IN starts)),
    'creation',json_array((SELECT COUNT(*) FROM c0),(SELECT COUNT(*) FROM c1),(SELECT COUNT(*) FROM c2),(SELECT COUNT(*) FROM c3)),
    'discovery',json_array((SELECT COUNT(*) FROM d0),(SELECT COUNT(*) FROM d1),(SELECT COUNT(*) FROM d2))) report FROM f`;
  const result = await db
    .prepare(base)
    .bind(...values)
    .all<{ report: string }>();
  const raw = JSON.parse(result.results[0].report) as Report & {
    creation: number[];
    discovery: number[];
  };
  const counts = new Map(raw.features.map((f) => [f.name, f]));
  const features = Object.entries(EVENTS)
    .map(([name, [label, category, source]]) => ({
      name,
      label,
      category,
      source,
      events: counts.get(name)?.events || 0,
      visitors: counts.get(name)?.visitors || 0,
    }))
    .sort((a, b) => b.events - a.events);
  return {
    ...raw,
    features,
    funnels: {
      creation: [
        'project_create_click',
        'project_created',
        'deployment_start',
        'deployment_success',
      ].map((name, i) => ({ name, sessions: raw.creation[i] })),
      discovery: ['page_view', 'app_preview', 'app_visit'].map((name, i) => ({
        name,
        sessions: raw.discovery[i],
      })),
    },
    generatedAt: Date.now(),
    rowsRead: result.meta.rows_read,
    reservedReads: countAllowance + allowance,
  };
};

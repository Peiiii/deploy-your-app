import { reserve } from '@gemigo/product-analytics';
import type { AdminEnv } from './auth';
import { AdminInputError } from './operations';

type Row = Record<string, string | number | null>;
type WebDay = {
  count: number;
  sum: { visits: number };
  avg: { sampleInterval: number };
  dimensions: { date: string };
};
type Breakdown = {
  count: number;
  sum: { visits: number };
  dimensions: { refererHost?: string; deviceType?: string };
};
type WebData = { platform: WebDay[]; apps: WebDay[]; referrers: Breakdown[]; devices: Breakdown[] };
type WebSnapshot = { from: string; to: string; fetchedAt: number; data: WebData };
const day = (at: number) => new Date(at).toISOString().slice(0, 10);
const DAY = 86400000;
export const growthPeriod = (days: number, now = Date.now()) => {
  if (![7, 30].includes(days)) throw new AdminInputError('请选择近 7 天或 30 天');
  const today = Date.parse(day(now));
  return {
    days,
    today: day(today),
    from: day(today - days * DAY),
    to: day(today - DAY),
    previousFrom: day(today - days * 2 * DAY),
    previousTo: day(today - (days + 1) * DAY),
    rawFrom: day(today - 29 * DAY),
  };
};
const webQuery = `query($account:string!,$start:Date!,$end:Date!,$currentStart:Date!,$platform:string!,$apps:string!){viewer{accounts(filter:{accountTag:$account}){
  platform:rumPageloadEventsAdaptiveGroups(filter:{siteTag:$platform,date_geq:$start,date_leq:$end,bot:0},limit:100,orderBy:[date_ASC]){count sum{visits} avg{sampleInterval} dimensions{date}}
  apps:rumPageloadEventsAdaptiveGroups(filter:{siteTag:$apps,date_geq:$start,date_leq:$end,bot:0},limit:100,orderBy:[date_ASC]){count sum{visits} avg{sampleInterval} dimensions{date}}
  referrers:rumPageloadEventsAdaptiveGroups(filter:{siteTag:$platform,date_geq:$currentStart,date_lt:$end,bot:0},limit:20,orderBy:[sum_visits_DESC]){count sum{visits} dimensions{refererHost}}
  devices:rumPageloadEventsAdaptiveGroups(filter:{siteTag:$platform,date_geq:$currentStart,date_lt:$end,bot:0},limit:20,orderBy:[count_DESC]){count sum{visits} dimensions{deviceType}}
}}}`;
const webAnalytics = async (
  env: AdminEnv,
  period: ReturnType<typeof growthPeriod>,
  now: number
) => {
  const key = `growth_web_${period.days}`;
  const saved = await env.ANALYTICS_DB.prepare('SELECT value FROM analytics_settings WHERE key=?')
    .bind(key)
    .first<{ value: string }>();
  const cached = saved ? (JSON.parse(saved.value) as WebSnapshot) : null;
  if (cached && cached.to === period.today && now - cached.fetchedAt < 30 * 60000)
    return { ...cached, stale: false, error: null };
  try {
    if (
      !env.ANALYTICS_CF_TOKEN ||
      !env.CLOUDFLARE_ACCOUNT_ID ||
      !env.GROWTH_PLATFORM_SITE_TAG ||
      !env.GROWTH_APPS_SITE_TAG
    )
      throw new Error('Missing analytics config');
    const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.ANALYTICS_CF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: webQuery,
        variables: {
          account: env.CLOUDFLARE_ACCOUNT_ID,
          start: period.previousFrom,
          end: period.today,
          currentStart: period.from,
          platform: env.GROWTH_PLATFORM_SITE_TAG,
          apps: env.GROWTH_APPS_SITE_TAG,
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('Analytics upstream unavailable');
    const result = (await response.json()) as {
      errors?: unknown[];
      data?: { viewer?: { accounts?: WebData[] } };
    };
    const data = result.data?.viewer?.accounts?.[0];
    if (
      result.errors?.length ||
      !data ||
      !['platform', 'apps', 'referrers', 'devices'].every((key) =>
        Array.isArray(data[key as keyof WebData])
      )
    )
      throw new Error('Analytics query failed');
    for (const rows of [data.platform, data.apps]) {
      if (
        !rows.every(
          (row) =>
            typeof row.dimensions?.date === 'string' &&
            Number.isFinite(row.count) &&
            row.count >= 0 &&
            Number.isFinite(row.sum?.visits) &&
            row.sum.visits >= 0
        )
      )
        throw new Error('Invalid analytics response');
    }
    const snapshot: WebSnapshot = {
      from: period.previousFrom,
      to: period.today,
      fetchedAt: now,
      data,
    };
    await env.ANALYTICS_DB.prepare(
      'INSERT INTO analytics_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'
    )
      .bind(key, JSON.stringify(snapshot))
      .run();
    return { ...snapshot, stale: false, error: null };
  } catch {
    return {
      ...(cached || { from: '', to: '', fetchedAt: null, data: null }),
      stale: Boolean(cached),
      error: cached
        ? '真人流量暂时无法更新，显示上次成功数据。'
        : '真人流量暂时不可用；注册、部署等业务数据仍可查看。',
    };
  }
};

export const queryGrowth = async (env: AdminEnv, url: URL, now = Date.now()) => {
  const period = growthPeriod(Number(url.searchParams.get('days') || 7), now);
  const db = env.ANALYTICS_DB;
  const bucket = `reads:${day(now)}`;
  if (!(await reserve(db, bucket, 10000, 1000000)))
    throw new AdminInputError('今日分析查询预算已用完，请查看缓存或明天重试', 429);
  const end = day(Date.parse(period.today) + DAY);
  // Count first, as the shared report owner does; reserve for observed rows rather
  // than spending the entire daily allowance on hypothetical collection capacity.
  const size = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM users) AS users,
    (SELECT COUNT(*) FROM projects) AS projects,
    (SELECT COUNT(*) FROM deployment_attempts) AS attempts,
    (SELECT COUNT(*) FROM product_events WHERE at>=? AND at<?) AS events`
    )
    .bind(Math.max(Date.parse(period.previousFrom), Date.parse(period.rawFrom)), Date.parse(end))
    .all<{ users: number; projects: number; attempts: number; events: number }>();
  const rows = size.results[0];
  const queryAllowance = Math.max(
    10000,
    rows.events * 4 +
      (rows.users + rows.projects + rows.attempts) * 10 +
      Math.max(0, size.meta.rows_read - 10000)
  );
  const reservedReads = 10000 + queryAllowance;
  if (!(await reserve(db, bucket, queryAllowance, 1000000)))
    throw new AdminInputError('今日分析查询预算已用完，请查看缓存或明天重试', 429);
  const [web, results] = await Promise.all([
    webAnalytics(env, period, now),
    db.batch<Row>([
      db
        .prepare(
          'SELECT substr(created_at,1,10) AS day,COUNT(*) AS registrations FROM users WHERE created_at>=? AND created_at<? GROUP BY day'
        )
        .bind(period.previousFrom, end),
      db
        .prepare(
          'SELECT substr(created_at,1,10) AS day,COUNT(*) AS projects FROM projects WHERE created_at>=? AND created_at<? AND COALESCE(is_deleted,0)=0 GROUP BY day'
        )
        .bind(period.previousFrom, end),
      db
        .prepare(
          "SELECT substr(started_at,1,10) AS day,COUNT(*) AS attempts,SUM(status='succeeded') AS succeeded FROM deployment_attempts WHERE started_at>=? AND started_at<? GROUP BY day"
        )
        .bind(period.previousFrom, end),
      db
        .prepare(
          `SELECT strftime('%Y-%m-%d',at/1000,'unixepoch') AS day,COUNT(DISTINCT visitor_id) AS uv,COUNT(*) AS observedPv FROM product_events WHERE name='page_view' AND client_channel='web' AND is_admin=0 AND at>=? AND at<? GROUP BY day`
        )
        .bind(
          Math.max(Date.parse(period.previousFrom), Date.parse(period.rawFrom)),
          Date.parse(end)
        ),
      db
        .prepare(
          `SELECT COUNT(*) AS registered,
        SUM(EXISTS(SELECT 1 FROM projects p WHERE p.owner_id=u.id AND COALESCE(p.is_deleted,0)=0 AND p.created_at<?)) AS activated,
        SUM(EXISTS(SELECT 1 FROM deployment_attempts d JOIN projects p ON p.id=d.project_id WHERE d.owner_id=u.id AND p.owner_id=u.id AND COALESCE(p.is_deleted,0)=0 AND d.status='succeeded' AND d.started_at<?)) AS deployed
        FROM users u WHERE u.created_at>=? AND u.created_at<?`
        )
        .bind(period.today, period.today, period.from, period.today),
      db
        .prepare(
          "SELECT COUNT(DISTINCT visitor_id) AS uv FROM product_events WHERE name='page_view' AND client_channel='web' AND is_admin=0 AND at>=? AND at<?"
        )
        .bind(
          Math.max(Date.parse(period.from), Date.parse(period.rawFrom)),
          Date.parse(period.today)
        ),
    ]),
  ]);
  const maps = results
    .slice(0, 4)
    .map((result) => new Map(result.results.map((row) => [String(row.day), row])));
  const platform = new Map((web.data?.platform || []).map((row) => [row.dimensions.date, row]));
  const apps = new Map((web.data?.apps || []).map((row) => [row.dimensions.date, row]));
  const all = Array.from({ length: period.days * 2 + 1 }, (_, i) => {
    const date = day(Date.parse(period.previousFrom) + i * DAY);
    const hasWeb = Boolean(web.data && date >= web.from && date <= web.to);
    return {
      day: date,
      pv: hasWeb ? platform.get(date)?.count || 0 : null,
      visits: hasWeb ? platform.get(date)?.sum.visits || 0 : null,
      appsPv: hasWeb ? apps.get(date)?.count || 0 : null,
      uv: date >= period.rawFrom ? Number(maps[3].get(date)?.uv || 0) : null,
      observedPv: date >= period.rawFrom ? Number(maps[3].get(date)?.observedPv || 0) : null,
      registrations: Number(maps[0].get(date)?.registrations || 0),
      projects: Number(maps[1].get(date)?.projects || 0),
      attempts: Number(maps[2].get(date)?.attempts || 0),
      succeeded: Number(maps[2].get(date)?.succeeded || 0),
    };
  });
  const daily = all.filter((row) => row.day >= period.from && row.day <= period.to);
  const previous = all.filter(
    (row) => row.day >= period.previousFrom && row.day <= period.previousTo
  );
  const totals = (rows: typeof daily) =>
    Object.fromEntries(
      ['pv', 'visits', 'appsPv', 'registrations', 'projects', 'attempts', 'succeeded'].map(
        (key) => [
          key,
          rows.some((row) => row[key as keyof typeof row] === null)
            ? null
            : rows.reduce((sum, row) => sum + Number(row[key as keyof typeof row]), 0),
        ]
      )
    );
  const sources = new Map<string, Breakdown>();
  for (const row of web.data?.referrers || []) {
    let host = (row.dimensions.refererHost || '').toLowerCase();
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) host = '外部 IP 来源';
    if (host.endsWith('.script.googleusercontent.com')) host = 'script.googleusercontent.com';
    const prior = sources.get(host);
    sources.set(host, {
      count: (prior?.count || 0) + row.count,
      sum: { visits: (prior?.sum.visits || 0) + row.sum.visits },
      dimensions: { refererHost: host },
    });
  }
  return {
    period,
    daily,
    today: all[all.length - 1],
    current: totals(daily),
    previous: totals(previous),
    observedUv: Number(results[5].results[0].uv),
    uvPartial: period.from < period.rawFrom,
    cohort: Object.fromEntries(
      ['registered', 'activated', 'deployed'].map((key) => [
        key,
        Number(results[4].results[0][key] || 0),
      ])
    ),
    referrers: [...sources.values()].sort((a, b) => b.sum.visits - a.sum.visits),
    devices: web.data?.devices || [],
    web: { fetchedAt: web.fetchedAt, stale: web.stale, error: web.error, adaptiveSampling: true },
    generatedAt: now,
    reservedReads,
  };
};

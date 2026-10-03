import { reserve, type AcquisitionCounts, type AcquisitionReport } from '@gemigo/product-analytics';
import { AdminInputError } from './operations';

const DAY = 86400000;
// Older signup events used a different definition and excluded OAuth. Do not mix them.
const TRACKING_SETTING = 'acquisition_registration_start';
type Counts = AcquisitionCounts;
type Day = { day: string; available: boolean; registrationsAvailable: boolean; sources: Counts[] };
const date = (at: number) => new Date(at).toISOString().slice(0, 10);
const empty = (source: Counts['source']): Counts => ({
  source,
  visitors: 0,
  sessions: 0,
  eligibleSessions: 0,
  registeredSessions: 0,
  registrations: 0,
  conversionRate: null,
  publishedSessions: null,
});
const withRate = <T extends Counts>(row: T): T => ({
  ...row,
  publishedSessions: row.eligibleSessions ? row.publishedSessions || 0 : null,
  conversionRate: row.eligibleSessions ? row.registeredSessions / row.eligibleSessions : null,
});

export const acquisitionSql = `WITH bounds AS MATERIALIZED (SELECT ? AS start,? AS end,? AS tracked,? AS until), pages AS MATERIALIZED (
  SELECT *,ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY at,id) AS position
  FROM product_events WHERE at>=(SELECT start FROM bounds) AND at<(SELECT end FROM bounds) AND name='page_view' AND client_channel='web' AND is_admin=0
), entries AS MATERIALIZED (
  SELECT session_id,visitor_id,referrer AS source,page,at,strftime('%Y-%m-%d',at/1000,'unixepoch') AS day,
    at>=(SELECT tracked FROM bounds) AS eligible
  FROM pages WHERE position=1 AND referrer IN ('search','ai')
    AND COALESCE(utm_medium,'') NOT IN ('cpc','ppc','paid','paid_search','paidsearch','paid-social','paid_social','display','cpm','sem')
), converted AS MATERIALIZED (
  SELECT e.session_id,COUNT(*) AS registrations,MIN(p.at) AS registered_at
  FROM entries e JOIN product_events p ON p.session_id=e.session_id AND p.at>=e.at AND p.at<(SELECT until FROM bounds)
  WHERE e.eligible=1 AND p.name='signup_success' AND p.dimension IN ('email','google','github') AND p.client_channel='web' AND p.is_admin=0
  GROUP BY e.session_id
), cohorts AS MATERIALIZED (
  SELECT e.*,COALESCE(c.registrations,0) AS registrations,c.registered_at,
    EXISTS(SELECT 1 FROM product_events p JOIN deployment_attempts d ON d.flow_id=p.flow_id
      WHERE p.session_id=e.session_id AND p.at>=c.registered_at AND p.at<(SELECT until FROM bounds)
        AND p.name='deployment_accepted' AND p.source='server' AND p.client_channel='web' AND p.is_admin=0
        AND d.status='succeeded' AND d.client_channel='web'
        AND d.started_at>=strftime('%Y-%m-%dT%H:%M:%fZ',c.registered_at/1000.0,'unixepoch')
        AND d.finished_at<strftime('%Y-%m-%dT%H:%M:%fZ',(SELECT until FROM bounds)/1000.0,'unixepoch')) AS published
  FROM entries e LEFT JOIN converted c ON c.session_id=e.session_id
)
SELECT json_object(
  'summary',(SELECT json_group_array(json_object('source',source,'visitors',visitors,'sessions',sessions,'eligibleSessions',eligibleSessions,'registeredSessions',registeredSessions,'registrations',registrations,'publishedSessions',publishedSessions)) FROM (
    SELECT source,COUNT(DISTINCT visitor_id) AS visitors,COUNT(*) AS sessions,SUM(eligible) AS eligibleSessions,SUM(registrations>0) AS registeredSessions,SUM(registrations) AS registrations,SUM(published) AS publishedSessions FROM cohorts GROUP BY source
  )),
  'daily',(SELECT json_group_array(json_object('day',day,'source',source,'visitors',visitors,'sessions',sessions,'eligibleSessions',eligibleSessions,'registeredSessions',registeredSessions,'registrations',registrations,'publishedSessions',publishedSessions)) FROM (
    SELECT day,source,COUNT(DISTINCT visitor_id) AS visitors,COUNT(*) AS sessions,SUM(eligible) AS eligibleSessions,SUM(registrations>0) AS registeredSessions,SUM(registrations) AS registrations,SUM(published) AS publishedSessions FROM cohorts GROUP BY day,source ORDER BY day,source
  )),
  'landings',(SELECT json_group_array(json_object('page',page,'source',source,'visitors',visitors,'sessions',sessions,'eligibleSessions',eligibleSessions,'registeredSessions',registeredSessions,'registrations',registrations,'publishedSessions',publishedSessions)) FROM (
    SELECT page,source,COUNT(DISTINCT visitor_id) AS visitors,COUNT(*) AS sessions,SUM(eligible) AS eligibleSessions,SUM(registrations>0) AS registeredSessions,SUM(registrations) AS registrations,SUM(published) AS publishedSessions FROM cohorts GROUP BY page,source ORDER BY sessions DESC
  ))) AS report`;

export const queryAcquisition = async (
  db: D1Database,
  days: number,
  now = Date.now()
): Promise<AcquisitionReport> => {
  if (![7, 30].includes(days)) throw new AdminInputError('请选择近 7 天或 30 天');
  const todayStart = Date.parse(date(now));
  const periodStart = todayStart - days * DAY;
  // Raw events have a rolling 30-day TTL. Only whole retained UTC days are comparable.
  const rawStart = Math.ceil((now - 30 * DAY) / DAY) * DAY;
  const availableStart = Math.max(periodStart, rawStart);
  const end = todayStart + DAY;
  const bucket = `reads:${date(now)}`;
  const countAllowance = (days + 3) * 4000 + 100;
  if (!(await reserve(db, bucket, countAllowance, 1000000)))
    throw new AdminInputError('今日分析查询预算已用完，请明天重试', 429);
  const tracking = await db
    .prepare('SELECT value FROM analytics_settings WHERE key=?')
    .bind(TRACKING_SETTING)
    .first<{ value: string }>();
  const trackingTime = tracking ? Date.parse(tracking.value) : NaN;
  const trackingStart = Number.isFinite(trackingTime) ? trackingTime : end;
  const count = await db
    .prepare('SELECT COUNT(*) AS total FROM product_events WHERE at>=? AND at<?')
    .bind(availableStart, end)
    .first<{ total: number }>();
  // Two bounded cohort passes. Publication uses indexed session and unique flow
  // joins in the same D1; 48 rows/event plus 1000 gives lookup headroom.
  const queryAllowance = (count?.total || 0) * 48 + 1000;
  if (!(await reserve(db, bucket, queryAllowance, 1000000)))
    throw new AdminInputError('今日分析查询预算已用完，请缩小范围或明天重试', 429);
  const results = await db
    .prepare(acquisitionSql)
    .bind(availableStart, end, trackingStart, now + 1)
    .all<{ report: string }>();
  const raw = JSON.parse(results.results[0].report) as {
    summary: Counts[];
    daily: (Counts & { day: string })[];
    landings: (Counts & { page: string })[];
  };
  const makeDay = (at: number): Day => {
    const key = date(at);
    return {
      day: key,
      available: at >= rawStart,
      registrationsAvailable: at + DAY > trackingStart,
      sources: (['search', 'ai'] as const).map((source) =>
        withRate(raw.daily.find((row) => row.day === key && row.source === source) || empty(source))
      ),
    };
  };
  const daily = Array.from({ length: days }, (_, index) => makeDay(periodStart + index * DAY));
  // Period UV is deduplicated in SQL, never summed from the daily UV column.
  // Remove today's cohorts from the period via the same query boundary.
  const periodResults = await db
    .prepare(acquisitionSql)
    .bind(availableStart, todayStart, trackingStart, todayStart)
    .all<{ report: string }>();
  const period = JSON.parse(periodResults.results[0].report) as typeof raw;
  return {
    period: {
      days,
      from: date(periodStart),
      to: date(todayStart - DAY),
      availableFrom: date(availableStart),
      partial: availableStart > periodStart,
    },
    summary: (['search', 'ai'] as const).map((source) =>
      withRate(period.summary.find((row) => row.source === source) || empty(source))
    ),
    daily,
    today: makeDay(todayStart),
    landings: period.landings.map(withRate),
    registrationTrackingSince: Number.isFinite(trackingTime)
      ? new Date(trackingTime).toISOString()
      : null,
    searchConsole: {
      connected: false,
      impressions: null,
      clicks: null,
      ctr: null,
      averagePosition: null,
    },
    generatedAt: now,
    reservedReads: countAllowance + queryAllowance,
    rowsRead: results.meta.rows_read + periodResults.meta.rows_read,
  };
};

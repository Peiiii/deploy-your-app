export interface ProjectDailyStatsPoint {
  date: string;
  views: number | null;
  uniqueVisitors: number | null;
  coverage: 'complete' | 'partial' | 'missing';
}

export interface ProjectStats {
  slug: string;
  range: '7d' | '30d';
  from: string;
  to: string;
  pageViews: number | null;
  uniqueVisitors: number | null;
  unidentifiedViews: number;
  lastViewAt?: string;
  coverage: {
    status: 'complete' | 'partial' | 'unavailable';
    startedAt: string | null;
    timezone: 'UTC';
  };
  points: ProjectDailyStatsPoint[];
}

type BrowserStatsRow = {
  slug: string;
  date: string;
  views: number;
  unique_visitors: number;
  unidentified_views: number;
  last_view_at?: string;
};

/** Browser-confirmed traffic, isolated per app and deduped across the full period. */
export async function queryAppTraffic(
  db: D1Database,
  slugs: readonly string[],
  rangeDays: number,
  at = Date.now()
) {
  if (![7, 30].includes(rangeDays)) throw new Error('App traffic supports 7 or 30 days');
  const now = new Date(at);
  const to = now.toISOString().slice(0, 10);
  const from = new Date(`${to}T00:00:00.000Z`);
  from.setUTCDate(from.getUTCDate() - rangeDays + 1);
  const fromDate = from.toISOString().slice(0, 10);
  const collection = await db
    .prepare('SELECT started_at FROM project_analytics_collection WHERE id=1')
    .all<{ started_at: string }>();
  const startedAt = collection.results[0]?.started_at ?? null;
  let rowsRead = collection.meta.rows_read;
  const available = !!startedAt && startedAt <= now.toISOString();
  const effectiveStart =
    startedAt && startedAt > from.toISOString() ? startedAt : from.toISOString();
  const results = available
    ? await db.batch<BrowserStatsRow>([
        db
          .prepare(
            `SELECT slug,substr(viewed_at,1,10) AS date,COUNT(*) AS views,
        COUNT(DISTINCT NULLIF(visitor_hash,'')) AS unique_visitors,
        SUM(visitor_hash='') AS unidentified_views,MAX(viewed_at) AS last_view_at
        FROM project_page_views WHERE slug IN (SELECT value FROM json_each(?)) AND viewed_at>=? AND viewed_at<=? AND is_bot=0
        GROUP BY slug,date ORDER BY date`
          )
          .bind(JSON.stringify(slugs), effectiveStart, now.toISOString()),
        db
          .prepare(
            `SELECT slug,COUNT(*) AS views,COUNT(DISTINCT NULLIF(visitor_hash,'')) AS unique_visitors,
        COALESCE(SUM(visitor_hash=''),0) AS unidentified_views,MAX(viewed_at) AS last_view_at
        FROM project_page_views WHERE slug IN (SELECT value FROM json_each(?)) AND viewed_at>=? AND viewed_at<=? AND is_bot=0
        GROUP BY slug`
          )
          .bind(JSON.stringify(slugs), effectiveStart, now.toISOString()),
      ])
    : null;
  rowsRead += results?.reduce((sum, result) => sum + result.meta.rows_read, 0) ?? 0;
  const rows = results ? { daily: results[0].results, summary: results[1].results } : null;
  const stats = Object.fromEntries(
    [...new Set(slugs)].map((slug) => {
      const daily = new Map(
        rows?.daily.filter((row) => row.slug === slug).map((row) => [row.date, row])
      );
      const summary = rows?.summary.find((row) => row.slug === slug);
      const points: ProjectDailyStatsPoint[] = [];
      for (let i = 0; i < rangeDays; i += 1) {
        const date = new Date(from.getTime() + i * 86400000).toISOString().slice(0, 10);
        const coverage =
          !available || date < startedAt!.slice(0, 10)
            ? 'missing'
            : date === startedAt!.slice(0, 10) && startedAt!.slice(11, 23) !== '00:00:00.000'
              ? 'partial'
              : 'complete';
        const row = daily.get(date);
        points.push({
          date,
          views: coverage === 'missing' ? null : (row?.views ?? 0),
          uniqueVisitors: coverage === 'missing' ? null : (row?.unique_visitors ?? 0),
          coverage,
        });
      }
      const stats: ProjectStats = {
        slug,
        range: rangeDays === 30 ? '30d' : '7d',
        from: fromDate,
        to,
        pageViews: available ? (summary?.views ?? 0) : null,
        uniqueVisitors: available ? (summary?.unique_visitors ?? 0) : null,
        unidentifiedViews: summary?.unidentified_views ?? 0,
        lastViewAt: summary?.last_view_at ?? undefined,
        coverage: {
          status: !available
            ? 'unavailable'
            : points.some((point) => point.coverage !== 'complete')
              ? 'partial'
              : 'complete',
          startedAt,
          timezone: 'UTC',
        },
        points,
      };
      return [slug, stats];
    })
  );
  return { stats, rowsRead };
}

export function appTrafficSlug(project: { id: string; slug?: string; url?: string }): string {
  const explicit = (project.slug ?? '').trim();
  if (explicit) return explicit;

  if (project.url) {
    try {
      const url = new URL(project.url);
      const host = url.hostname;
      const parts = host.split('.');
      if (parts.length >= 3) {
        // Handles patterns like slug.gemigo.app
        const subdomain = parts[0].trim();
        if (subdomain) return subdomain;
      }
    } catch {
      // Ignore invalid URLs and fall back to project.id below.
    }
  }

  return project.id;
}

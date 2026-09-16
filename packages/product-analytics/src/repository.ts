import { EVENTS, type EventBatch, type ProductEvent } from './contract';

export interface Actor {
  signedIn: boolean;
  admin: boolean;
}
export const insertEvents = async (db: D1Database, batch: EventBatch, actor: Actor) => {
  await db.batch(
    batch.events.map((e) =>
      db
        .prepare(
          `INSERT OR IGNORE INTO product_events (id,name,at,received_at,visitor_id,session_id,page,dimension,duration_ms,flow_id,device,referrer,signed_in,is_admin,source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        )
        .bind(
          e.id,
          e.name,
          e.at,
          Date.now(),
          batch.visitorId,
          batch.sessionId,
          e.page,
          e.dimension ?? null,
          e.durationMs ?? null,
          e.flowId ?? null,
          batch.device,
          batch.referrer,
          Number(actor.signedIn),
          Number(actor.admin),
          EVENTS[e.name][2]
        )
    )
  );
};
export const cleanupAnalytics = async (db: D1Database) => {
  await db.batch([
    db.prepare('DELETE FROM product_events WHERE at < ?').bind(Date.now() - 30 * 86400000),
    db.prepare('DELETE FROM product_event_limits WHERE expires_at < ?').bind(Date.now()),
  ]);
};
export interface AnalyticsFilter {
  from: number;
  to: number;
  device: string;
  audience: string;
  includeAdmin: boolean;
}
export const parseFilter = (url: URL): AnalyticsFilter => {
  const end = url.searchParams.get('to') || new Date().toISOString().slice(0, 10);
  const start =
    url.searchParams.get('from') || new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  if (
    ![start, end].every(
      (s) =>
        /^\d{4}-\d{2}-\d{2}$/.test(s) &&
        !Number.isNaN(Date.parse(s)) &&
        new Date(s).toISOString().slice(0, 10) === s
    )
  )
    throw new Error('Invalid date');
  const from = Date.parse(start);
  const to = Date.parse(end) + 86400000;
  if (to <= from || to - from > 30 * 86400000) throw new Error('Choose a range of 1–30 days');
  const device = url.searchParams.get('device') || 'all';
  const audience = url.searchParams.get('audience') || 'all';
  if (
    !['all', 'desktop', 'mobile', 'tablet'].includes(device) ||
    !['all', 'signed_in', 'anonymous'].includes(audience)
  )
    throw new Error('Invalid filter');
  return {
    from,
    to,
    device,
    audience,
    includeAdmin: url.searchParams.get('includeAdmin') === 'true',
  };
};
export const filterSql = (f: AnalyticsFilter) => {
  const clauses = ['at >= ?', 'at < ?'];
  const values: (string | number)[] = [f.from, f.to];
  if (f.device !== 'all') {
    clauses.push('device = ?');
    values.push(f.device);
  }
  if (f.audience !== 'all') {
    clauses.push('signed_in = ?');
    values.push(Number(f.audience === 'signed_in'));
  }
  if (!f.includeAdmin) clauses.push('is_admin = 0');
  return { where: clauses.join(' AND '), values };
};
export const queryEventDetails = async (db: D1Database, filter: AnalyticsFilter, url: URL) => {
  const { where, values } = filterSql(filter);
  const clauses = [where];
  const name = url.searchParams.get('event');
  const session = url.searchParams.get('session');
  if (name) {
    clauses.push('name = ?');
    values.push(name);
  }
  if (session) {
    clauses.push('session_id = ?');
    values.push(session);
  }
  const page = Math.max(1, Math.min(1000, Math.floor(Number(url.searchParams.get('page'))) || 1));
  const limit = url.searchParams.get('export') === 'true' ? 5000 : 50;
  const condition = clauses.join(' AND ');
  const result = await db.batch([
    db.prepare(`SELECT COUNT(*) total FROM product_events WHERE ${condition}`).bind(...values),
    db
      .prepare(
        `SELECT id,name,at,page,dimension,duration_ms durationMs,flow_id flowId,source,session_id sessionId,device,signed_in signedIn FROM product_events WHERE ${condition} ORDER BY at DESC,id DESC LIMIT ? OFFSET ?`
      )
      .bind(...values, limit, (page - 1) * limit),
  ]);
  return {
    total: Number((result[0].results[0] as { total?: number })?.total || 0),
    items: result[1].results,
    page,
    limit,
  };
};
export const makeServerEvent = (
  name: ProductEvent['name'],
  page: ProductEvent['page']
): ProductEvent => ({ id: crypto.randomUUID(), name, page, at: Date.now() });

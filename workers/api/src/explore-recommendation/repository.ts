import type { Interest, Feature } from './ranking';
export interface Settings {
  enabled: number;
  percent: number;
  experiment: string;
  ranker: string;
  embedding: string;
  monthly_micro: number;
}
export interface Batch {
  id: string;
  subject: string;
  filters: string;
  variant: string;
  experiment: string;
  algorithm: string;
  items: string;
  created_at: number;
  expires_at: number;
}

export async function settings(db: D1Database): Promise<Settings> {
  const row = await db.prepare('SELECT * FROM explore_rec_settings WHERE id=1').first<Settings>();
  if (!row) throw new Error('recommendation_schema_missing');
  return row;
}
export async function rateLimit(
  db: D1Database,
  subject: string,
  kind: string,
  limit: number
): Promise<boolean> {
  const minute = Math.floor(Date.now() / 60000);
  const row = await db
    .prepare(
      `INSERT INTO explore_rec_rate(bucket,count,expires_at) VALUES(?,1,?)
    ON CONFLICT(bucket) DO UPDATE SET count=count+1 WHERE count<? RETURNING count`
    )
    .bind(`${kind}:${subject}:${minute}`, (minute + 2) * 60000, limit)
    .first();
  return !!row;
}
export async function interests(db: D1Database, subject: string): Promise<Interest[]> {
  const result = await db
    .prepare(
      `SELECT project_id AS projectId,action,created_at AS at FROM explore_rec_events
    WHERE subject=? AND created_at>? AND action IN ('open','favorite','like','dismiss') ORDER BY created_at DESC LIMIT 200`
    )
    .bind(subject, Date.now() - 35 * 86400000)
    .all<Interest>();
  return result.results || [];
}
let featureCache: { db: D1Database | string; until: number; items: Feature[] } | null = null;
export async function features(
  db: D1Database,
  cacheKey: D1Database | string = db
): Promise<Feature[]> {
  if (featureCache?.db === cacheKey && featureCache.until > Date.now()) return featureCache.items;
  const result = await db.prepare('SELECT * FROM explore_rec_features LIMIT 1500').all<Feature>();
  const items = result.results || [];
  featureCache = { db: cacheKey, until: Date.now() + 30000, items };
  return items;
}
export function invalidateFeatures() {
  featureCache = null;
}
export async function saveBatch(db: D1Database, batch: Batch) {
  await db
    .prepare(
      `INSERT INTO explore_rec_batches(id,subject,filters,variant,experiment,algorithm,items,created_at,expires_at)
    VALUES(?,?,?,?,?,?,?,?,?)`
    )
    .bind(
      batch.id,
      batch.subject,
      batch.filters,
      batch.variant,
      batch.experiment,
      batch.algorithm,
      batch.items,
      batch.created_at,
      batch.expires_at
    )
    .run();
}
export async function getBatch(db: D1Database, id: string, subject: string): Promise<Batch | null> {
  return db
    .prepare('SELECT * FROM explore_rec_batches WHERE id=? AND subject=? AND expires_at>?')
    .bind(id, subject, Date.now())
    .first<Batch>();
}
export async function cleanup(db: D1Database) {
  const now = Date.now();
  await db.batch([
    db.prepare('DELETE FROM explore_rec_events WHERE created_at<?').bind(now - 35 * 86400000),
    db.prepare('DELETE FROM explore_rec_batches WHERE expires_at<?').bind(now),
    db.prepare('DELETE FROM explore_rec_rate WHERE expires_at<?').bind(now),
    db.prepare('DELETE FROM explore_rec_calls WHERE created_at<?').bind(now - 90 * 86400000),
    db.prepare(`DELETE FROM explore_rec_features WHERE project_id NOT IN (SELECT id FROM projects
      WHERE is_public=1 AND status='Live' AND COALESCE(is_deleted,0)=0)`),
  ]);
}

import { insertEvents, type Actor } from './repository';
import type { EventBatch } from './contract';

export interface CollectionSettings {
  enabled: boolean;
  dailyEvents: number;
}
export const DEFAULT_SETTINGS: CollectionSettings = { enabled: true, dailyEvents: 2000 };
export const dayKey = () => new Date().toISOString().slice(0, 10);
export const getSettings = async (db: D1Database): Promise<CollectionSettings> => {
  const row = await db
    .prepare("SELECT value FROM analytics_settings WHERE key='collection'")
    .first<{ value: string }>();
  return row ? JSON.parse(row.value) : DEFAULT_SETTINGS;
};
// Atomic reservation: simultaneous requests cannot exceed a configured budget.
export const reserve = async (db: D1Database, bucket: string, amount: number, maximum: number) => {
  const row = await db
    .prepare(
      `INSERT INTO product_event_limits(bucket,count,expires_at) SELECT ?,?,? WHERE ? <= ?
    ON CONFLICT(bucket) DO UPDATE SET count=count+excluded.count WHERE count+excluded.count <= ? RETURNING count`
    )
    .bind(bucket, amount, Date.now() + 2 * 86400000, amount, maximum, maximum)
    .first<{ count: number }>();
  return row !== null;
};
export const collect = async (
  db: D1Database,
  batch: EventBatch,
  actor: Actor,
  mode: 'piggyback' | 'standalone'
) => {
  const settings = await getSettings(db);
  if (!settings.enabled || !batch.events.length) return;
  const day = dayKey();
  // A browser cannot consume the whole site's allowance. IDs are anonymous and resettable,
  // so the atomic site budget is the authoritative upper bound, not this abuse deterrent.
  if (!(await reserve(db, `visitor:${day}:${batch.visitorId}`, batch.events.length, 200))) return;
  if (!(await reserve(db, `events:${day}`, batch.events.length, settings.dailyEvents))) return;
  await insertEvents(db, batch, actor);
  await reserve(db, `${mode}:${day}`, 1, settings.dailyEvents);
};
export const getBudget = async (db: D1Database) => {
  const day = dayKey();
  const rows = await db
    .prepare('SELECT bucket,count FROM product_event_limits WHERE bucket IN (?,?,?,?)')
    .bind(`events:${day}`, `piggyback:${day}`, `standalone:${day}`, `reads:${day}`)
    .all<{ bucket: string; count: number }>();
  return {
    settings: await getSettings(db),
    used: Object.fromEntries(rows.results.map((r) => [r.bucket.split(':')[0], r.count])),
    retainedDays: 30,
    readBudget: 1000000,
  };
};

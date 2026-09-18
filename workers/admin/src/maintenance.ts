class MaintenanceService {
  runDaily = async (db: D1Database, now = new Date()): Promise<void> => {
    const nowIso = now.toISOString();
    const staleIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const date90 = new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10);
    const hour90 = new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 13);
    await db.batch([
      db.prepare(
        `UPDATE deployment_attempts SET status='failed',finished_at=?,
          duration_ms=CAST((julianday(?) - julianday(started_at))*86400000 AS INTEGER),
          error_code='stale_timeout'
         WHERE status IN ('started','accepted') AND started_at < ?`,
      ).bind(nowIso, nowIso, staleIso),
      db.prepare(
        `UPDATE projects SET status='Failed',updated_at=?
         WHERE status='Building' AND COALESCE(updated_at,last_deployed) < ?`,
      ).bind(nowIso, staleIso),
      db.prepare('DELETE FROM project_view_dedup WHERE expires_at < ?').bind(now.getTime()),
      db.prepare('DELETE FROM project_hourly_stats WHERE hour < ?').bind(hour90),
      db.prepare('DELETE FROM project_traffic_dimensions WHERE hour < ?').bind(hour90),
      db.prepare('DELETE FROM project_traffic_uniques WHERE period < ?').bind(date90),
    ]);
  };
}

export const maintenanceService = new MaintenanceService();


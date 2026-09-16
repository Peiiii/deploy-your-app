import { EVENTS } from './contract';

export interface StoredEvent {
  id: string;
  name: keyof typeof EVENTS;
  at: number;
  received_at: number;
  visitor_id: string;
  session_id: string;
  page: string;
  dimension: string | null;
  duration_ms: number | null;
  flow_id: string | null;
  device: string;
  referrer: string;
  signed_in: number;
  is_admin: number;
  source: string;
}
const unique = (rows: StoredEvent[], field: 'visitor_id' | 'session_id' | 'flow_id') =>
  new Set(rows.map((r) => r[field]).filter(Boolean)).size;
const group = (rows: StoredEvent[], key: (row: StoredEvent) => string) => {
  const result = new Map<string, StoredEvent[]>();
  for (const row of rows) {
    const k = key(row);
    const items = result.get(k) || [];
    items.push(row);
    result.set(k, items);
  }
  return result;
};
export const summarize = (rows: StoredEvent[]) => {
  const sessions = group(rows, (r) => r.session_id);
  const funnel = (steps: string[]) =>
    steps.map((name, index) => ({
      name,
      sessions: [...sessions.values()].filter((events) => {
        let step = 0;
        for (const event of events) {
          if (event.name === steps[step]) step++;
          if (step > index) return true;
        }
        return false;
      }).length,
    }));
  const paths = new Map<string, number>();
  for (const events of sessions.values()) {
    const pages = events.filter((e) => e.name === 'page_view');
    for (let i = 1; i < pages.length; i++) {
      if (pages[i - 1].page === pages[i].page) continue;
      const key = `${pages[i - 1].page} → ${pages[i].page}`;
      paths.set(key, (paths.get(key) || 0) + 1);
    }
  }
  const byName = group(rows, (r) => r.name);
  const started = byName.get('deployment_start') || [];
  const flowIds = new Set(started.map((r) => r.flow_id).filter(Boolean));
  const succeeded = (byName.get('deployment_success') || []).filter((r) => flowIds.has(r.flow_id));
  const failed = (byName.get('deployment_failure') || []).filter((r) => flowIds.has(r.flow_id));
  return {
    summary: {
      events: rows.length,
      visitors: unique(rows, 'visitor_id'),
      sessions: sessions.size,
      pageViews: (byName.get('page_view') || []).length,
    },
    daily: [...group(rows, (r) => new Date(r.at).toISOString().slice(0, 10))].map(
      ([day, events]) => ({ day, events: events.length, visitors: unique(events, 'visitor_id') })
    ),
    features: Object.entries(EVENTS)
      .map(([name, [label, category, source]]) => {
        const events = byName.get(name) || [];
        return {
          name,
          label,
          category,
          source,
          events: events.length,
          visitors: unique(events, 'visitor_id'),
        };
      })
      .sort((a, b) => b.events - a.events),
    dimensions: [
      ...group(
        rows.filter((r) => r.dimension),
        (r) => `${r.name} / ${r.dimension}`
      ),
    ]
      .map(([label, events]) => ({ label, events: events.length }))
      .sort((a, b) => b.events - a.events),
    paths: [...paths]
      .map(([path, transitions]) => ({ path, transitions }))
      .sort((a, b) => b.transitions - a.transitions)
      .slice(0, 20),
    devices: [...group(rows, (r) => r.device)].map(([device, events]) => ({
      device,
      visitors: unique(events, 'visitor_id'),
    })),
    referrers: [...group(rows, (r) => r.referrer)].map(([referrer, events]) => ({
      referrer,
      sessions: unique(events, 'session_id'),
    })),
    funnels: {
      creation: funnel([
        'project_create_click',
        'project_created',
        'deployment_start',
        'deployment_success',
      ]),
      discovery: funnel(['page_view', 'app_preview', 'app_visit']),
    },
    deployment: {
      started: unique(started, 'flow_id'),
      succeeded: unique(succeeded, 'flow_id'),
      failed: unique(failed, 'flow_id'),
      avgDurationMs: succeeded.length
        ? Math.round(succeeded.reduce((n, r) => n + (r.duration_ms || 0), 0) / succeeded.length)
        : null,
    },
    generatedAt: Date.now(),
  };
};

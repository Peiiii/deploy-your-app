import { useAnalyticsStore } from '../stores/analytics.store';
import type { IAnalyticsProvider } from '../services/interfaces';
import { useAuthStore } from '@/features/auth/stores/auth.store';

export class AnalyticsManager {
  private requests = new Map<string, number>();
  private provider: IAnalyticsProvider;
  private loadedAt = new Map<string, number>();
  private pending = new Map<string, { request: Promise<void>; version: number }>();

  loadProjectsStats = async (projectIds: string[], range: '7d' | '30d' = '7d'): Promise<void> => {
    const ownerId = useAuthStore.getState().user?.id;
    if (!ownerId) return;
    const { actions, byProjectId } = useAnalyticsStore.getState();
    const waiting: Promise<void>[] = [];
    const ids = [...new Set(projectIds)].filter((id) => {
      const key = `${ownerId}:${id}:${range}`;
      const pending = this.pending.get(key);
      if (pending && this.requests.get(id) === pending.version) {
        waiting.push(pending.request);
        return false;
      }
      const entry = byProjectId[id];
      return (
        !entry?.stats ||
        entry.stats.range !== range ||
        (entry.isLoading && entry.range !== range) ||
        !!entry.error ||
        Date.now() - (this.loadedAt.get(key) ?? 0) >= 60_000
      );
    });
    for (let offset = 0; offset < ids.length; offset += 100) {
      const batch = ids.slice(offset, offset + 100);
      const versions = new Map(
        batch.map((id) => {
          const version = (this.requests.get(id) ?? 0) + 1;
          this.requests.set(id, version);
          actions.setLoading(id, true, range);
          return [id, version];
        })
      );
      const isCurrent = (id: string) =>
        useAuthStore.getState().user?.id === ownerId && this.requests.get(id) === versions.get(id);
      const request = (async () => {
        // Register the batch before a provider can resolve or throw synchronously.
        await Promise.resolve();
        try {
          const stats = this.provider.getProjectsStats
            ? await this.provider.getProjectsStats(batch, range)
            : Object.fromEntries(
                await Promise.all(
                  batch.map(async (id) => [id, await this.provider.getProjectStats(id, range)])
                )
              );
          for (const id of batch) {
            if (!isCurrent(id)) continue;
            if (!stats[id] || stats[id].range !== range) {
              actions.setError(id, 'Failed to load analytics');
              continue;
            }
            actions.setStats(id, stats[id]);
            this.loadedAt.set(`${ownerId}:${id}:${range}`, Date.now());
          }
        } catch (error) {
          console.error('Failed to load project stats', error);
          for (const id of batch)
            if (isCurrent(id)) actions.setError(id, 'Failed to load analytics');
        } finally {
          for (const id of batch) {
            if (isCurrent(id)) actions.setLoading(id, false, range);
            const key = `${ownerId}:${id}:${range}`;
            if (this.pending.get(key)?.version === versions.get(id)) this.pending.delete(key);
          }
        }
      })();
      for (const id of batch)
        this.pending.set(`${ownerId}:${id}:${range}`, { request, version: versions.get(id)! });
      waiting.push(request);
    }
    await Promise.all(waiting);
  };

  constructor(provider: IAnalyticsProvider) {
    this.provider = provider;
  }

  loadProjectStats = async (projectId: string, range: '7d' | '30d' = '7d'): Promise<void> => {
    const { setLoading, setStats, setError } = useAnalyticsStore.getState().actions;
    const request = (this.requests.get(projectId) ?? 0) + 1;
    this.requests.set(projectId, request);
    setLoading(projectId, true, range);
    try {
      const stats = await this.provider.getProjectStats(projectId, range);
      if (this.requests.get(projectId) === request) setStats(projectId, stats);
    } catch (error) {
      console.error('Failed to load project stats', error);
      if (this.requests.get(projectId) === request) setError(projectId, 'Failed to load analytics');
    } finally {
      if (this.requests.get(projectId) === request) setLoading(projectId, false, range);
    }
  };
}

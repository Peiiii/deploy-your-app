import { useAnalyticsStore } from '../stores/analytics.store';
import type { IAnalyticsProvider } from '../services/interfaces';

export class AnalyticsManager {
  private requests = new Map<string, number>();
  private provider: IAnalyticsProvider;

  constructor(provider: IAnalyticsProvider) {
    this.provider = provider;
  }

  loadProjectStats = async (
    projectId: string,
    range: '7d' | '30d' = '7d',
  ): Promise<void> => {
    const { setLoading, setStats, setError } = useAnalyticsStore.getState()
      .actions;
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


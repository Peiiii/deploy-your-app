import { useAnalyticsStore } from '../stores/analytics-store';
import type { IAnalyticsProvider } from '../services/interfaces';

export class AnalyticsManager {
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
    setLoading(projectId, true);
    try {
      const stats = await this.provider.getProjectStats(projectId, range);
      setStats(projectId, stats);
    } catch (error) {
      console.error('Failed to load project stats', error);
      setError(projectId, 'Failed to load analytics');
    } finally {
      setLoading(projectId, false);
    }
  };
}


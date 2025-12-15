import type { IAnalyticsProvider } from '../interfaces';
import type { ProjectStats } from '../../types';
import { APP_CONFIG, API_ROUTES } from '../../constants';

export class HttpAnalyticsProvider implements IAnalyticsProvider {
  private baseUrl = APP_CONFIG.API_BASE_URL;

  async getProjectStats(
    projectId: string,
    range: '7d' | '30d',
  ): Promise<ProjectStats> {
    const url = new URL(
      `${this.baseUrl}${API_ROUTES.PROJECT_STATS(projectId)}`,
      window.location.origin,
    );
    url.searchParams.set('range', range);

    const response = await fetch(url.toString(), {
      method: 'GET',
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('Failed to load project stats');
    }
    return (await response.json()) as ProjectStats;
  }
}


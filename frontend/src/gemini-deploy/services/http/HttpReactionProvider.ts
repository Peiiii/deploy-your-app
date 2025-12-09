import type { IReactionProvider } from '../interfaces';
import type { ProjectReactions } from '../../types';
import { APP_CONFIG, API_ROUTES } from '../../constants';

export class HttpReactionProvider implements IReactionProvider {
  private baseUrl = APP_CONFIG.API_BASE_URL;

  private buildUrl(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  async getReactionsForProject(projectId: string): Promise<ProjectReactions> {
    const res = await fetch(
      this.buildUrl(API_ROUTES.PROJECT_REACTIONS(projectId)),
      {
        method: 'GET',
        credentials: 'include',
      },
    );
    if (!res.ok) {
      throw new Error('Failed to load reactions');
    }
    return (await res.json()) as ProjectReactions;
  }

  async getReactionsForProjectsBulk(
    projectIds: string[],
  ): Promise<Record<string, ProjectReactions>> {
    if (projectIds.length === 0) {
      return {};
    }

    const params = new URLSearchParams();
    params.set('ids', projectIds.join(','));

    const res = await fetch(
      this.buildUrl(
        `${API_ROUTES.PROJECT_REACTIONS_BULK}?${params.toString()}`,
      ),
      {
        method: 'GET',
        credentials: 'include',
      },
    );

    if (res.status === 401) {
      // Not logged in – caller typically treats this as "no reactions".
      return {};
    }

    if (!res.ok) {
      throw new Error('Failed to load reactions (bulk)');
    }

    return (await res.json()) as Record<string, ProjectReactions>;
  }

  async setLike(
    projectId: string,
    liked: boolean,
  ): Promise<ProjectReactions> {
    const method = liked ? 'POST' : 'DELETE';
    const res = await fetch(
      this.buildUrl(API_ROUTES.PROJECT_LIKE(projectId)),
      {
        method,
        credentials: 'include',
      },
    );
    if (!res.ok) {
      throw new Error('Failed to update like');
    }
    return (await res.json()) as ProjectReactions;
  }

  async setFavorite(
    projectId: string,
    favorited: boolean,
  ): Promise<ProjectReactions> {
    const method = favorited ? 'POST' : 'DELETE';
    const res = await fetch(
      this.buildUrl(API_ROUTES.PROJECT_FAVORITE(projectId)),
      {
        method,
        credentials: 'include',
      },
    );
    if (!res.ok) {
      throw new Error('Failed to update favorite');
    }
    return (await res.json()) as ProjectReactions;
  }

  async getFavoriteProjectIdsForCurrentUser(): Promise<string[]> {
    const res = await fetch(this.buildUrl(API_ROUTES.MY_FAVORITES), {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error('Failed to load favorites');
    }
    const data = (await res.json()) as { projectIds: string[] };
    return data.projectIds ?? [];
  }
}

import { useReactionStore } from '../stores/reactionStore';
import type { IReactionProvider } from '../services/interfaces';
import type { Project } from '../types';

export class ReactionManager {
  private provider: IReactionProvider;

  constructor(provider: IReactionProvider) {
    this.provider = provider;
  }

  /**
   * Seed reaction counts from a list response that already contains
   * aggregated engagement metrics. This avoids an extra network roundtrip
   * just to get likes/favorites counts for public feeds.
   */
  seedCountsFromProjects = (
    projects: Array<
      Project & {
        likesCount?: number;
        favoritesCount?: number;
      }
    >,
  ): void => {
    const { patchReactions } = useReactionStore.getState().actions;
    projects.forEach((project) => {
      const likesCount = project.likesCount ?? 0;
      const favoritesCount = project.favoritesCount ?? 0;
      if (likesCount === 0 && favoritesCount === 0) {
        return;
      }
      patchReactions(project.id, {
        likesCount,
        favoritesCount,
      });
    });
  };

  loadReactionsForProject = async (projectId: string): Promise<void> => {
    const { setLoading, setReactions } = useReactionStore.getState().actions;
    setLoading(projectId, true);
    try {
      const reactions = await this.provider.getReactionsForProject(projectId);
      setReactions(projectId, reactions);
    } catch (error) {
      console.error('Failed to load reactions', error);
      // Leave existing state as-is; errors are non-fatal for core flows.
    } finally {
      setLoading(projectId, false);
    }
  };

  /**
   * Bulk-load per-user reaction state for a set of projects. This is used
   * by Explore/Home feeds to avoid N+1 calls to the reactions endpoint.
   */
  loadReactionsForProjectsBulk = async (
    projectIds: string[],
  ): Promise<void> => {
    if (projectIds.length === 0) return;

    const { setLoading, setReactions, patchReactions } =
      useReactionStore.getState().actions;

    projectIds.forEach((id) => setLoading(id, true));

    try {
      const map = await this.provider.getReactionsForProjectsBulk(projectIds);
      projectIds.forEach((projectId) => {
        const reactions = map[projectId];
        if (reactions) {
          setReactions(projectId, reactions);
        } else {
          // Ensure we at least have a defined entry for the project.
          patchReactions(projectId, {
            likedByCurrentUser: false,
            favoritedByCurrentUser: false,
          });
        }
      });
    } catch (error) {
      console.error('Failed to load reactions (bulk)', error);
      // Leave existing state as-is; we only clear loading flags below.
    } finally {
      projectIds.forEach((id) => setLoading(id, false));
    }
  };

  toggleLike = async (projectId: string): Promise<void> => {
    const { byProjectId, actions } = useReactionStore.getState();
    const entry = byProjectId[projectId];
    const currentlyLiked = entry?.likedByCurrentUser ?? false;
    const nextLiked = !currentlyLiked;

    // Optimistic update of local state
    actions.patchReactions(projectId, {
      likedByCurrentUser: nextLiked,
      likesCount:
        (entry?.likesCount ?? 0) + (nextLiked ? 1 : currentlyLiked ? -1 : 0),
    });

    try {
      const reactions = await this.provider.setLike(projectId, nextLiked);
      actions.setReactions(projectId, reactions);
    } catch (error) {
      console.error('Failed to toggle like', error);
      // Roll back to previous server-synced state by reloading.
      await this.loadReactionsForProject(projectId);
    }
  };

  toggleFavorite = async (projectId: string): Promise<void> => {
    const { byProjectId, actions } = useReactionStore.getState();
    const entry = byProjectId[projectId];
    const currentlyFavorited = entry?.favoritedByCurrentUser ?? false;
    const nextFavorited = !currentlyFavorited;

    actions.patchReactions(projectId, {
      favoritedByCurrentUser: nextFavorited,
    });

    try {
      const reactions = await this.provider.setFavorite(
        projectId,
        nextFavorited,
      );
      actions.setReactions(projectId, reactions);
    } catch (error) {
      console.error('Failed to toggle favorite', error);
      await this.loadReactionsForProject(projectId);
    }
  };

  loadFavoritesForCurrentUser = async (): Promise<void> => {
    try {
      const ids = await this.provider.getFavoriteProjectIdsForCurrentUser();
      const { patchReactions } = useReactionStore.getState().actions;
      ids.forEach((projectId) => {
        patchReactions(projectId, { favoritedByCurrentUser: true });
      });
    } catch (error) {
      console.error('Failed to load favorites for current user', error);
    }
  };
}

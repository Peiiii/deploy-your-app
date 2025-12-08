import { useReactionStore } from '../stores/reactionStore';
import type { IReactionProvider } from '../services/interfaces';

export class ReactionManager {
  private provider: IReactionProvider;

  constructor(provider: IReactionProvider) {
    this.provider = provider;
  }

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

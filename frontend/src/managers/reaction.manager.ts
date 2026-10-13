import { useAuthStore } from '@/features/auth/stores/auth.store';
import { track } from '@/analytics/collector';
import { useReactionStore } from '../stores/reaction.store';
import type { IReactionProvider } from '../services/interfaces';
import type { Project } from '../types';

export class ReactionManager {
  private provider: IReactionProvider;

  private versions = new Map<string, number>();
  private pending = new Set<string>();
  private version = (id: string) => {
    const value = (this.versions.get(id) ?? 0) + 1;
    this.versions.set(id, value);
    return value;
  };
  constructor(
    provider: IReactionProvider,
    private readonly reportError: () => void = () => undefined
  ) {
    this.provider = provider;
    useAuthStore.subscribe((state, previous) => {
      if (state.user?.id === previous.user?.id) return;
      const { byProjectId, actions } = useReactionStore.getState();
      Object.keys(byProjectId).forEach((id) => {
        this.version(id);
        actions.patchReactions(id, { likedByCurrentUser: false, favoritedByCurrentUser: false });
        actions.setLoading(id, false);
      });
      this.pending.clear();
    });
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
    >
  ): void => {
    const { patchReactions } = useReactionStore.getState().actions;
    projects.forEach((project) => {
      const likesCount = project.likesCount ?? 0;
      const favoritesCount = project.favoritesCount ?? 0;
      if (project.likesCount === undefined && project.favoritesCount === undefined) {
        return;
      }
      patchReactions(project.id, {
        likesCount,
        favoritesCount,
      });
    });
  };

  loadReactionsForProject = async (projectId: string): Promise<void> => {
    if (this.pending.has(projectId)) return;
    const version = this.version(projectId);
    const { setLoading, setReactions } = useReactionStore.getState().actions;
    setLoading(projectId, true);
    try {
      const reactions = await this.provider.getReactionsForProject(projectId);
      if (this.versions.get(projectId) === version) setReactions(projectId, reactions);
    } catch (error) {
      console.error('Failed to load reactions', error);
      // Leave existing state as-is; errors are non-fatal for core flows.
    } finally {
      if (this.versions.get(projectId) === version) setLoading(projectId, false);
    }
  };

  /**
   * Bulk-load per-user reaction state for a set of projects. This is used
   * by Explore/Home feeds to avoid N+1 calls to the reactions endpoint.
   */
  loadReactionsForProjectsBulk = async (projectIds: string[]): Promise<void> => {
    projectIds = [...new Set(projectIds)].filter((id) => !this.pending.has(id));
    if (projectIds.length === 0) return;
    const versions = new Map(projectIds.map((id) => [id, this.version(id)]));

    const { setLoading, setReactions, patchReactions } = useReactionStore.getState().actions;

    projectIds.forEach((id) => setLoading(id, true));

    try {
      const map = await this.provider.getReactionsForProjectsBulk(projectIds);
      projectIds.forEach((projectId) => {
        if (versions.get(projectId) !== this.versions.get(projectId)) return;
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
      projectIds.forEach((id) => {
        if (versions.get(id) === this.versions.get(id)) setLoading(id, false);
      });
    }
  };

  private toggle = async (projectId: string, kind: 'like' | 'favorite'): Promise<void> => {
    if (this.pending.has(projectId)) return;
    let entry = useReactionStore.getState().byProjectId[projectId];
    if (entry?.isLoading) return;
    if (!entry?.hasCounts) {
      await this.loadReactionsForProject(projectId);
      entry=useReactionStore.getState().byProjectId[projectId];
      if (!entry?.hasCounts) {this.reportError();return;}
    }
    const {actions}=useReactionStore.getState();
    track('reaction_click', { dimension: kind });
    const version = this.version(projectId);
    const next = !(kind === 'like' ? entry.likedByCurrentUser : entry.favoritedByCurrentUser);
    this.pending.add(projectId);
    actions.patchReactions(
      projectId,
      kind === 'like'
        ? {
            likedByCurrentUser: next,
            likesCount: Math.max(0, entry.likesCount + (next ? 1 : -1)),
          }
        : {
            favoritedByCurrentUser: next,
            favoritesCount: Math.max(0, entry.favoritesCount + (next ? 1 : -1)),
          }
    );
    try {
      const reactions =
        kind === 'like'
          ? await this.provider.setLike(projectId, next)
          : await this.provider.setFavorite(projectId, next);
      if (this.versions.get(projectId) === version) actions.setReactions(projectId, reactions);
    } catch {
      if (this.versions.get(projectId) === version) {
        actions.setReactions(projectId, entry);
        this.reportError();
      }
    } finally {
      if (this.versions.get(projectId) === version) this.pending.delete(projectId);
    }
  };
  toggleLike = (projectId: string) => this.toggle(projectId, 'like');
  toggleFavorite = (projectId: string) => this.toggle(projectId, 'favorite');

  loadFavoritesForCurrentUser = async (): Promise<void> => {
    const userId = useAuthStore.getState().user?.id;
    try {
      const ids = await this.provider.getFavoriteProjectIdsForCurrentUser();
      if (useAuthStore.getState().user?.id !== userId) return;
      const { patchReactions } = useReactionStore.getState().actions;
      ids.forEach((projectId) => {
        patchReactions(projectId, { favoritedByCurrentUser: true });
      });
    } catch (error) {
      console.error('Failed to load favorites for current user', error);
    }
  };
}

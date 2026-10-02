import { usePublicProfileStore } from '@/features/profile/stores/public-profile.store';
import { fetchPublicProfile } from '@/services/http/profile-api';
import type { AuthManager } from '@/features/auth/managers/auth.manager';
import type { ReactionManager } from '@/managers/reaction.manager';

/**
 * PublicProfileManager handles all business logic for the PublicProfile page.
 * All methods are arrow functions to avoid `this` binding issues.
 */
export class PublicProfileManager {
  private authManager: AuthManager;
  private reactionManager: ReactionManager;

  constructor(authManager: AuthManager, reactionManager: ReactionManager) {
    this.authManager = authManager;
    this.reactionManager = reactionManager;
  }

  /**
   * Load a public profile by user ID or handle.
   */
  loadProfile = async (id: string) => {
    const actions = usePublicProfileStore.getState().actions;
    const user = this.authManager.getCurrentUser();

    actions.setIsLoading(true);
    actions.setError(null);

    try {
      const profile = await fetchPublicProfile(id);
      actions.setData(profile);

      // Load reactions if user is logged in
      if (user) {
        const projectIds = profile.projects.map((p) => p.id);
        if (projectIds.length > 0) {
          this.reactionManager.seedCountsFromProjects(profile.projects);
          void this.reactionManager.loadReactionsForProjectsBulk(projectIds);
        }
      }
    } catch (err) {
      console.error('Failed to load public profile', err);
      actions.setError('not_found');
    } finally {
      actions.setIsLoading(false);
    }
  };

  /**
   * Toggle like for a project, requires auth.
   */
  toggleLike = (projectId: string) => {
    const user = this.authManager.getCurrentUser();
    if (!user) {
      this.authManager.openAuthModal('login');
      return;
    }
    void this.reactionManager.toggleLike(projectId);
  };

  /**
   * Toggle favorite for a project, requires auth.
   */
  toggleFavorite = (projectId: string) => {
    const user = this.authManager.getCurrentUser();
    if (!user) {
      this.authManager.openAuthModal('login');
      return;
    }
    void this.reactionManager.toggleFavorite(projectId);
  };

  /**
   * Get pinned and other projects from the loaded profile.
   */
  getProjectGroups = () => {
    const data = usePublicProfileStore.getState().data;
    if (!data) {
      return { pinnedProjects: [], otherProjects: [] };
    }

    const pinnedIds = data.profile.pinnedProjectIds ?? [];
    const pinnedSet = new Set(pinnedIds);
    const pinnedProjects = pinnedIds
      .map((id) => data.projects.find((p) => p.id === id))
      .filter((p): p is (typeof data.projects)[number] => !!p);
    const otherProjects = data.projects.filter((p) => !pinnedSet.has(p.id));

    return { pinnedProjects, otherProjects };
  };
}

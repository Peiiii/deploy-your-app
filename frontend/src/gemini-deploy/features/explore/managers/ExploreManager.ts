import { useExploreStore } from '@/stores/exploreStore';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { mapProjectsToApps } from '@/components/ExploreAppCard';
import { fetchExploreProjects } from '@/services/http/exploreApi';
import type { AuthManager } from './AuthManager';
import type { UIManager } from './UIManager';
import type { ReactionManager } from './ReactionManager';
import i18n from '@i18n/config';

const PAGE_SIZE = 12;

// App metadata for display
const APP_META = [
  { cost: 5, category: 'Development', rating: 4.8, installs: '12k', color: 'from-blue-500 to-cyan-400' },
  { cost: 12, category: 'Image Gen', rating: 4.9, installs: '8.5k', color: 'from-purple-500 to-pink-500' },
  { cost: 8, category: 'Productivity', rating: 4.6, installs: '5k', color: 'from-emerald-500 to-teal-400' },
  { cost: 3, category: 'Marketing', rating: 4.5, installs: '15k', color: 'from-orange-500 to-amber-400' },
  { cost: 20, category: 'Legal', rating: 4.9, installs: '2k', color: 'from-slate-600 to-slate-400' },
  { cost: 10, category: 'Development', rating: 4.7, installs: '4.2k', color: 'from-indigo-500 to-violet-500' },
] as const;

/**
 * ExploreManager handles all business logic for the ExploreApps page.
 * All methods are arrow functions to avoid `this` binding issues.
 */
export class ExploreManager {
  private authManager: AuthManager;
  private uiManager: UIManager;
  private reactionManager: ReactionManager;

  constructor(
    authManager: AuthManager,
    uiManager: UIManager,
    reactionManager: ReactionManager,
  ) {
    this.authManager = authManager;
    this.uiManager = uiManager;
    this.reactionManager = reactionManager;
  }

  /**
   * Load a page of explore apps.
   */
  loadPage = async (pageToLoad: number, append: boolean = false) => {
    const state = useExploreStore.getState();
    const actions = state.actions;
    const currentUser = useAuthStore.getState().user;

    actions.setIsLoading(true);

    try {
      const result = await fetchExploreProjects({
        search: state.searchQuery.trim() || undefined,
        category: state.activeCategory !== 'All Apps' ? state.activeCategory : undefined,
        tag: state.activeTag,
        sort: 'recent',
        page: pageToLoad,
        pageSize: PAGE_SIZE,
      });

      const projects = result.items;
      const pageApps = mapProjectsToApps(projects, APP_META);

      if (append) {
        actions.appendApps(pageApps);
      } else {
        actions.setApps(pageApps);
      }

      actions.setPage(result.page);
      actions.setHasMore(result.page * PAGE_SIZE < result.total);

      // Load reactions if logged in
      if (currentUser) {
        const ids = projects.map((p) => p.id);
        this.reactionManager.loadReactionsForProjectsBulk(ids);
      }

      // Seed counts from engagement data
      if (result.engagement) {
        const projectsWithCounts = projects.map((p) => {
          const counts = result.engagement?.[p.id];
          return {
            ...p,
            likesCount: counts?.likesCount ?? 0,
            favoritesCount: counts?.favoritesCount ?? 0,
          };
        });
        this.reactionManager.seedCountsFromProjects(projectsWithCounts);
      }
    } catch (error) {
      console.error('Failed to load explore apps', error);
    } finally {
      actions.setIsLoading(false);
    }
  };

  /**
   * Load more apps (next page).
   */
  loadMore = () => {
    const state = useExploreStore.getState();
    if (!state.hasMore || state.isLoading) return;
    void this.loadPage(state.page + 1, true);
  };

  /**
   * Refresh with current filters (page 1).
   */
  refresh = () => {
    void this.loadPage(1, false);
  };

  /**
   * Check if user is authenticated and perform action, or prompt login.
   */
  requireAuthAnd = (action: () => void) => {
    const user = this.authManager.getCurrentUser();
    if (!user) {
      const t = i18n.t.bind(i18n);
      this.authManager.openAuthModal('login');
      this.uiManager.showToast(t('deployment.signInRequired'), 'info');
      return;
    }
    action();
  };
}

import { useAppLanguageStore } from '@/features/explore/stores/app-language.store';
import { track } from '@/analytics/collector';
import { useExploreStore } from '@/features/explore/stores/explore.store';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { mapProjectsToApps } from '@/components/explore-app-card';
import { fetchExploreProjects, type ExploreQueryParams } from '@/services/http/explore-api';
import type { CategoryFilter } from '@/constants/app-categories';
import type { AuthManager } from '@/features/auth/managers/auth.manager';
import type { UIManager } from '@/managers/ui.manager';
import type { ReactionManager } from '@/managers/reaction.manager';
import i18n from '@/i18n/config';

const PAGE_SIZE = 12;

/**
 * ExploreManager handles all business logic for the ExploreApps page.
 * All methods are arrow functions to avoid `this` binding issues.
 */
export class ExploreManager {
  private authManager: AuthManager;
  private uiManager: UIManager;
  private reactionManager: ReactionManager;
  private requestId = 0;

  constructor(
    authManager: AuthManager,
    uiManager: UIManager,
    reactionManager: ReactionManager,
  ) {
    this.authManager = authManager;
    this.uiManager = uiManager;
    this.reactionManager = reactionManager;
  }

  private queryForPage = (
    state: ReturnType<typeof useExploreStore.getState>,
    languages: string[] | null,
    page: number,
  ): ExploreQueryParams => ({
    languages,
    search: state.searchQuery.trim() || undefined,
    category: state.activeCategory !== 'All Apps' ? state.activeCategory : undefined,
    tag: state.activeTag,
    sort: 'recent',
    page,
    pageSize: PAGE_SIZE,
  });

  prefetchCategory = (category: CategoryFilter) => {
    const state = useExploreStore.getState();
    if (category === state.activeCategory && !state.activeTag) return;
    void fetchExploreProjects(this.queryForPage(
      { ...state, activeCategory: category, activeTag: null },
      useAppLanguageStore.getState().languages,
      1,
    )).catch(() => { /* Actual selection owns errors and retries. */ });
  };

  /** Load a page while rejecting responses for outdated filters. */
  loadPage = async (pageToLoad: number, append: boolean = false) => {
    const state = useExploreStore.getState();
    const languages = useAppLanguageStore.getState().languages;
    const languageKey = JSON.stringify(languages);
    const actions = state.actions;
    const currentUser = useAuthStore.getState().user;
    const requestId = ++this.requestId;
    const isCurrentRequest = () => {
      const current = useExploreStore.getState();
      return JSON.stringify(useAppLanguageStore.getState().languages) === languageKey && requestId === this.requestId &&
        current.activeCategory === state.activeCategory &&
        current.activeTag === state.activeTag &&
        current.searchQuery === state.searchQuery;
    };

    if (!append) { actions.setApps([]); actions.setHasMore(false); }
    actions.setError(false);
    actions.setIsLoading(true);

    try {
      if (pageToLoad === 1 && state.searchQuery.trim()) track('search_submit');
      const result = await fetchExploreProjects(this.queryForPage(state, languages, pageToLoad));

      if (!isCurrentRequest()) return;

      useAppLanguageStore.getState().actions.setAvailable(result.availableLanguages || []);
      const projects = result.items;
      const pageApps = mapProjectsToApps(projects);

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
      if (!isCurrentRequest()) return;
      actions.setError(true);
      console.error('Failed to load explore apps', error);
    } finally {
      if (isCurrentRequest()) actions.setIsLoading(false);
    }
  };

  /**
   * Load more apps (next page).
   */
  loadMore = () => {
    const state = useExploreStore.getState();
    if (!state.hasMore || state.isLoading) return;
    track('load_more');
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

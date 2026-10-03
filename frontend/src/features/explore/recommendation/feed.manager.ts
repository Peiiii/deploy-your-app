import { create } from 'zustand';
import { APP_CONFIG } from '@/constants';
import type { Project } from '@/types';
import { mapProjectsToApps, type ExploreAppCard } from '@/components/explore-app-card';
import { fetchExploreProjects, type ExploreQueryParams } from '@/services/http/explore-api';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import type { ReactionManager } from '@/managers/reaction.manager';

export type FeedAction =
  | 'exposure'
  | 'open'
  | 'loaded'
  | 'load_error'
  | 'like'
  | 'favorite'
  | 'dismiss'
  | 'dwell';
type Mode = 'experiment' | 'recent' | 'recommended';
interface Response {
  enabled: boolean;
  token?: string;
  variant?: string;
  batch?: string;
  cursor?: string;
  persistent?: boolean;
  items?: Project[];
  hasMore?: boolean;
  engagement?: Record<string, { likesCount: number; favoritesCount: number }>;
}
interface State {
  apps: ExploreAppCard[];
  isLoading: boolean;
  error: boolean;
  hasMore: boolean;
  enabled: boolean;
  mode: Mode;
  persistent: boolean;
  variant: string;
}
const initial: State = {
  apps: [],
  isLoading: true,
  error: false,
  hasMore: false,
  enabled: false,
  mode: 'experiment',
  persistent: true,
  variant: 'control',
};
export const useRecommendationFeedStore = create<State>(() => initial);

/** Independent flow owner; never installed into the home/grid directory manager. */
class RecommendationFeedManager {
  private generation = 0;
  private active = false;
  private filters: ExploreQueryParams = {};
  private reactions: ReactionManager | null = null;
  private cursor: string | null = null;
  private page = 0;
  private token: string | null = null;
  private storageKey = '';
  private currentId: string | null = null;
  private session = crypto.randomUUID();
  private batchByProject = new Map<string, string>();
  private interests: Array<{ projectId: string; action: string; at: number }> = [];
  private pending: Array<{
    id: string;
    batch: string;
    projectId: string;
    action: string;
    durationMs: number;
  }> = [];
  private sent = new Set<string>();
  private pollTimer: ReturnType<typeof setInterval> | undefined;
  private eventTimer: ReturnType<typeof setTimeout> | undefined;
  private pollInFlight = false;

  private post = async (body: Record<string, unknown>): Promise<Response> => {
    const response = await fetch(`${APP_CONFIG.API_BASE_URL}/explore-feed`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error(`feed_${response.status}`);
    return response.json();
  };
  private body = (action: string) => ({
    action,
    token: this.token,
    persistent: useRecommendationFeedStore.getState().persistent,
    session: this.session,
    mode: useRecommendationFeedStore.getState().mode,
    filters: this.filters,
  });

  start = (filters: ExploreQueryParams, reactions: ReactionManager) => {
    this.stop();
    this.active = true;
    this.filters = filters;
    this.reactions = reactions;
    this.cursor = null;
    this.page = 0;
    this.currentId = null;
    this.storageKey = `gemigo.explore-preferences.v1:${useAuthStore.getState().user?.id || 'anonymous'}`;
    let persistent = navigator.doNotTrack !== '1';
    this.token = null;
    try {
      persistent = persistent && localStorage.getItem('gemigo.explore-history') !== 'off';
      const stored = JSON.parse(localStorage.getItem(this.storageKey) || 'null');
      if (persistent && stored?.until > Date.now()) this.token = stored.token;
    } catch {
      /* Browser storage is optional; current-session personalization still works. */ persistent = false;
    }
    useRecommendationFeedStore.setState({ ...initial, persistent });
    this.session = crypto.randomUUID();
    this.interests = [];
    this.sent.clear();
    this.batchByProject.clear();
    this.pending = [];
    void this.load(false);
    this.pollTimer = setInterval(() => void this.poll(), 30000);
  };
  stop = () => {
    this.active = false;
    this.generation++;
    clearInterval(this.pollTimer);
    clearTimeout(this.eventTimer);
    // flush before leaving keeps feedback tied to the original identity/batch.
    void this.flush();
  };
  private remember = (result: Response) => {
    if (!result.token) return;
    this.token = result.token;
    if (useRecommendationFeedStore.getState().persistent) {
      try {
        localStorage.setItem(
          this.storageKey,
          JSON.stringify({ token: this.token, until: Date.now() + 35 * 86400000 })
        );
      } catch {
        /* optional storage */
      }
    }
  };
  private poll = async () => {
    if (this.pollInFlight || !this.active) return;
    this.pollInFlight = true;
    try {
      const result = await this.post({ action: 'status' });
      if (!result.enabled && useRecommendationFeedStore.getState().enabled) await this.disable();
    } catch {
      /* Next batch still checks the server switch. */
    } finally {
      this.pollInFlight = false;
    }
  };
  private disable = async () => {
    const state = useRecommendationFeedStore.getState();
    const index = state.apps.findIndex((p) => p.id === this.currentId);
    const prefix = state.apps.slice(0, Math.max(0, index) + 1);
    this.generation++;
    this.cursor = null;
    this.page = 0;
    this.pending = [];
    this.batchByProject.clear();
    useRecommendationFeedStore.setState({ enabled: false, apps: prefix, isLoading: false });
    await this.loadLegacy(true);
  };
  private loadLegacy = async (append: boolean) => {
    const generation = this.generation;
    useRecommendationFeedStore.setState({ isLoading: true, error: false });
    try {
      const result = await fetchExploreProjects({
        ...this.filters,
        sort: 'recent',
        page: append ? this.page + 1 : 1,
        pageSize: 12,
      });
      if (!this.active || generation !== this.generation) return;
      this.page = result.page;
      const state = useRecommendationFeedStore.getState();
      const existing = append ? state.apps : [];
      const ids = new Set(existing.map((p) => p.id));
      useRecommendationFeedStore.setState({
        apps: [...existing, ...mapProjectsToApps(result.items).filter((p) => !ids.has(p.id))],
        hasMore: result.page * 12 < result.total,
        isLoading: false,
      });
      this.seed(result.items, result.engagement);
    } catch {
      if (this.active && generation === this.generation)
        useRecommendationFeedStore.setState({ error: true, isLoading: false });
    }
  };
  private seed = (projects: Project[], counts: Response['engagement']) => {
    this.reactions?.seedCountsFromProjects(projects.map((p) => ({ ...p, ...counts?.[p.id] })));
    if (useAuthStore.getState().user)
      void this.reactions?.loadReactionsForProjectsBulk(projects.map((p) => p.id));
  };
  load = async (append = true) => {
    if (!this.active || (append && useRecommendationFeedStore.getState().isLoading)) return;
    const generation = this.generation;
    useRecommendationFeedStore.setState({ isLoading: true, error: false });
    try {
      await this.flush();
      const requestBody = {
        ...this.body('feed'),
        sessionInterests: this.interests,
        excludeIds: append
          ? useRecommendationFeedStore
              .getState()
              .apps.map((p) => p.id)
              .slice(-1500)
          : [],
      };
      let result = await this.post({ ...requestBody, cursor: append ? this.cursor : null });
      for (
        let page = 0;
        page < 3 && result.enabled && !result.items?.length && result.cursor;
        page++
      ) {
        if (!this.active || generation !== this.generation) return;
        this.remember(result);
        result = await this.post({ ...requestBody, token: this.token, cursor: result.cursor });
      }
      if (!this.active || generation !== this.generation) return;
      if (!result.enabled) {
        if (append && useRecommendationFeedStore.getState().enabled) await this.disable();
        else {
          useRecommendationFeedStore.setState({ enabled: false, isLoading: false });
          await this.loadLegacy(append);
        }
        return;
      }
      this.remember(result);
      this.cursor = result.cursor || null;
      const previous = append ? useRecommendationFeedStore.getState().apps : [];
      const ids = new Set(previous.map((p) => p.id));
      const projects = result.items || [];
      for (const p of projects) if (result.batch) this.batchByProject.set(p.id, result.batch);
      useRecommendationFeedStore.setState({
        apps: [...previous, ...mapProjectsToApps(projects).filter((p) => !ids.has(p.id))],
        hasMore: !!result.hasMore,
        enabled: true,
        variant: result.variant || 'control',
        isLoading: false,
      });
      this.seed(projects, result.engagement);
    } catch (error) {
      if (!this.active || generation !== this.generation) return;
      // Expired cursor/recommendation service failure never makes the feed inaccessible.
      this.cursor = null;
      if (error instanceof Error && error.message === 'feed_429')
        useRecommendationFeedStore.setState({ isLoading: false, error: true });
      else {
        if (append && useRecommendationFeedStore.getState().enabled) await this.disable();
        else {
          useRecommendationFeedStore.setState({ enabled: false, isLoading: false });
          await this.loadLegacy(append);
        }
      }
    }
  };
  loadMore = () => {
    if (useRecommendationFeedStore.getState().hasMore)
      void (useRecommendationFeedStore.getState().enabled
        ? this.load(true)
        : this.loadLegacy(true));
  };
  retry = () => {
    void (useRecommendationFeedStore.getState().enabled
      ? this.load(!!useRecommendationFeedStore.getState().apps.length)
      : this.loadLegacy(!!useRecommendationFeedStore.getState().apps.length));
  };
  activate = (id: string) => {
    this.currentId = id;
  };
  feedback = (projectId: string, action: FeedAction, durationMs = 0) => {
    if (!this.active || !useRecommendationFeedStore.getState().enabled) return;
    const batch = this.batchByProject.get(projectId);
    if (!batch) return;
    const key = `${batch}:${projectId}:${action}`;
    if (this.sent.has(key)) return;
    this.sent.add(key);
    if (['open', 'favorite', 'like', 'dismiss'].includes(action)) {
      this.interests.unshift({ projectId, action, at: Date.now() });
      this.interests = this.interests.slice(0, 30);
    }
    if (!useRecommendationFeedStore.getState().persistent) return;
    this.pending.push({ id: crypto.randomUUID(), batch, projectId, action, durationMs });
    if (this.pending.length >= 10) void this.flush();
    else {
      clearTimeout(this.eventTimer);
      this.eventTimer = setTimeout(() => void this.flush(), 800);
    }
  };
  private flush = async () => {
    if (!this.pending.length || !this.token) return;
    const generation = this.generation;
    const events = this.pending.splice(0, 20);
    const body = { ...this.body('events'), events };
    try {
      await this.post(body);
    } catch {
      // Keep at most one bounded retry batch, with the same event IDs.
      if (this.active && generation === this.generation && this.pending.length < 20)
        this.pending.unshift(...events);
    }
  };
  setMode = (mode: Mode) => {
    void this.flush();
    this.generation++;
    this.cursor = null;
    this.page = 0;
    useRecommendationFeedStore.setState({ mode, apps: [], isLoading: false, hasMore: false });
    void this.load(false);
  };
  clear = async () => {
    await this.flush();
    await this.post(this.body('reset'));
    this.interests = [];
    this.pending = [];
    this.sent.clear();
    this.batchByProject.clear();
    this.cursor = null;
    this.generation++;
    useRecommendationFeedStore.setState({ apps: [], isLoading: false });
    await this.load(false);
  };
  setPersistent = async (value: boolean) => {
    if (!value) {
      await this.flush();
      await this.post(this.body('reset'));
      this.pending = [];
      this.sent.clear();
      this.batchByProject.clear();
    }
    try {
      localStorage.setItem('gemigo.explore-history', value ? 'on' : 'off');
      localStorage.removeItem(this.storageKey);
    } catch {
      /* optional storage */
    }
    this.token = null;
    useRecommendationFeedStore.setState({ persistent: value && navigator.doNotTrack !== '1' });
    this.generation++;
    this.cursor = null;
    this.interests = [];
    useRecommendationFeedStore.setState({ apps: [], isLoading: false });
    await this.load(false);
  };
}
export const recommendationFeedManager = new RecommendationFeedManager();

import { useAuthStore } from '@/features/auth/stores/auth.store';
import { createStore } from 'zustand/vanilla';
import { APP_CONFIG } from '@/constants';
import type {
  NotificationItem,
  NotificationPage,
  NotificationPreferences,
  NotificationSummary,
} from '@gemigo/notifications';

export async function notificationRequest<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  extraHeaders: Record<string, string> = {}
): Promise<T> {
  const viewer = useAuthStore.getState().user?.id;
  const response = await fetch(APP_CONFIG.API_BASE_URL + path, {
    method,
    credentials: 'include',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(viewer ? { 'X-Gemigo-Viewer': viewer } : {}),
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (viewer !== useAuthStore.getState().user?.id)
    throw new Error('Your session changed. Please try again.');
  if (data.code === 'SESSION_CHANGED' || response.status === 401) {
    useAuthStore.setState({ user: null });
    window.dispatchEvent(new Event('gemigo-session-refresh'));
    throw new Error('Your session changed. Please try again.');
  }
  if (!response.ok) throw new Error(data.error ?? 'Request failed');
  return data as T;
}
export function notificationReceipt(state: unknown, query: URLSearchParams) {
  const receipt = (state as { notification?: { groupKey: string; throughSeq: number } } | null)
    ?.notification;
  const groupKey = receipt?.groupKey ?? query.get('notificationGroup');
  const throughSeq = receipt?.throughSeq ?? Number(query.get('notificationSeq'));
  return typeof groupKey === 'string' && Number.isSafeInteger(throughSeq) && throughSeq > 0
    ? { groupKey, throughSeq }
    : null;
}
interface State {
  items: NotificationItem[];
  summary: NotificationSummary;
  summaryReady: boolean;
  listSnapshot: number;
  cursor: string | null;
  loading: boolean;
  error: string | null;
  category: string;
  needsReply: boolean;
  prefs: NotificationPreferences | null;
  deviceEnabled: boolean;
}
export class NotificationsManager {
  readonly store = createStore<State>(() => ({
    items: [],
    summary: { important: 0, ordinary: 0, snapshotSeq: 0 },
    summaryReady: false,
    listSnapshot: 0,
    cursor: null,
    loading: false,
    error: null,
    category: 'all',
    needsReply: false,
    prefs: null,
    deviceEnabled: false,
  }));
  private userId: string | null = null;
  private generation = 0;
  private listGeneration = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastSummary = 0;
  private summaryLoading = false;
  private focus = () => {
    if (document.visibilityState === 'visible') void this.refreshSummary();
  };
  start = (userId: string | null) => {
    this.stop();
    this.userId = userId;
    this.generation++;
    this.listGeneration++;
    this.store.setState({
      items: [],
      summary: { important: 0, ordinary: 0, snapshotSeq: 0 },
      summaryReady: false,
      listSnapshot: 0,
      cursor: null,
      prefs: null,
      deviceEnabled: false,
      error: null,
      loading: false,
    });
    const generation = this.generation;
    void navigator.serviceWorker
      ?.getRegistration()
      .then((registration) => {
        if (generation !== this.generation) return;
        registration?.active?.postMessage({ type: 'gemigo-active-user', userId });
      })
      .catch(() => undefined);
    if (!userId) return;
    void this.loadDeviceStatus()
      .then(() => this.refreshSummary(true))
      .catch(() => undefined);
    this.lastSummary = 0;
    this.summaryLoading = false;
    void this.refreshSummary();
    document.addEventListener('visibilitychange', this.focus);
    window.addEventListener('focus', this.focus);
    this.timer = setInterval(() => {
      if (document.visibilityState === 'visible') void this.refreshSummary();
    }, 60000);
  };
  stop = () => {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    document.removeEventListener('visibilitychange', this.focus);
    window.removeEventListener('focus', this.focus);
  };
  refreshSummary = async (force = false) => {
    if (!this.userId || this.summaryLoading || (!force && Date.now() - this.lastSummary < 10000))
      return;
    const generation = this.generation;
    this.summaryLoading = true;
    this.lastSummary = Date.now();
    try {
      const summary = await notificationRequest<NotificationSummary>(
        '/notifications/summary',
        'GET',
        undefined,
        document.visibilityState === 'visible' ? { 'X-Gemigo-Visible': '1' } : {}
      );
      if (generation === this.generation) this.store.setState({ summary, summaryReady: true });
    } catch (error) {
      if (generation === this.generation)
        this.store.setState({ error: error instanceof Error ? error.message : 'Request failed' });
    } finally {
      if (generation === this.generation) this.summaryLoading = false;
    }
  };
  load = async (
    category = this.store.getState().category,
    needsReply = this.store.getState().needsReply,
    append = false
  ) => {
    if (!this.userId) return;
    const generation = this.generation,
      listGeneration = ++this.listGeneration;
    const previous = this.store.getState();
    this.store.setState({
      loading: true,
      error: null,
      category,
      needsReply,
      ...(!append ? { items: [], cursor: null } : {}),
    });
    const query = new URLSearchParams({
      category,
      ...(needsReply ? { needsReply: '1' } : {}),
      ...(append && previous.cursor ? { cursor: previous.cursor } : {}),
    });
    try {
      const page = await notificationRequest<NotificationPage>('/notifications?' + query);
      if (generation !== this.generation || listGeneration !== this.listGeneration) return;
      this.store.setState((state) => ({
        items: append
          ? [
              ...state.items,
              ...page.items.filter(
                (item) => !state.items.some((old) => old.groupKey === item.groupKey)
              ),
            ]
          : page.items,
        cursor: page.cursor,
        listSnapshot: append ? state.listSnapshot : page.snapshotSeq,
        summaryReady: true,
        summary: {
          important: page.important,
          ordinary: page.ordinary,
          snapshotSeq: page.snapshotSeq,
        },
      }));
    } catch (error) {
      if (generation === this.generation && listGeneration === this.listGeneration)
        this.store.setState({ error: error instanceof Error ? error.message : 'Request failed' });
    } finally {
      if (generation === this.generation && listGeneration === this.listGeneration)
        this.store.setState({ loading: false });
    }
  };
  read = async (groupKey: string, throughSeq: number) => {
    const generation = this.generation;
    await notificationRequest('/notifications/read', 'POST', { groupKey, throughSeq });
    if (generation !== this.generation) return;
    this.store.setState((state) => ({
      items: state.items.map((item) =>
        item.groupKey === groupKey && item.throughSeq <= throughSeq
          ? { ...item, unread: false, important: false }
          : item
      ),
    }));
    await this.refreshSummary(true);
  };
  readAll = async () => {
    await notificationRequest('/notifications/read', 'POST', {
      all: true,
      throughSeq: this.store.getState().listSnapshot,
    });
    await this.load();
  };
  mute = async (subjectId: string, muted = true) => {
    await notificationRequest('/notification-mutes', muted ? 'POST' : 'DELETE', { subjectId });
    await this.load();
  };
  dismiss = async (commentId: string) => {
    await notificationRequest(
      '/comments/' + encodeURIComponent(commentId) + '/response-disposition',
      'POST',
      { dismiss: true }
    );
    await this.load();
  };
  enableDevice = async () => {
    if (
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    )
      throw new Error('This browser does not support device notifications');
    if (Notification.permission === 'denied')
      throw new Error(
        'Device notifications are blocked. Change this site’s permission in browser settings.'
      );
    const generation = this.generation;
    const userId = this.userId;
    const permission = await Notification.requestPermission();
    if (generation !== this.generation || !userId) return;
    if (permission !== 'granted') throw new Error('Device notification permission was not granted');
    const { publicKey } = await notificationRequest<{ publicKey: string | null }>(
      '/notifications/push-key'
    );
    if (!publicKey) throw new Error('Device notifications are unavailable');
    const registration = await navigator.serviceWorker.register('/notification-sw.js', {
      scope: '/',
    });
    await navigator.serviceWorker.ready;
    const key = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), (char) =>
      char.charCodeAt(0)
    );
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      }));
    if (generation !== this.generation) return;
    await notificationRequest('/notifications/push-subscription', 'POST', subscription.toJSON());
    registration.active?.postMessage({ type: 'gemigo-active-user', userId: this.userId });
    await this.loadPreferences();
    if (generation === this.generation && !this.store.getState().prefs?.timezone)
      await this.savePreferences({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    await this.refreshSummary(true);
  };
  detachDevice = async () => {
    const registration = await navigator.serviceWorker?.getRegistration();
    const subscription = await registration?.pushManager?.getSubscription();
    try {
      if (subscription)
        await notificationRequest(
          '/notifications/push-subscription',
          'DELETE',
          subscription.toJSON()
        );
    } finally {
      if (subscription) await subscription.unsubscribe();
      registration?.active?.postMessage({ type: 'gemigo-active-user', userId: null });
      this.store.setState({ deviceEnabled: false });
    }
  };
  disableDevice = async () => {
    await this.detachDevice();
    await this.savePreferences({
      external: { direct: false, feedback: false, deployment: false, digest: false },
    });
  };
  loadPreferences = async () => {
    const generation = this.generation;
    const prefs = await notificationRequest<NotificationPreferences>('/notification-preferences');
    await this.loadDeviceStatus();
    if (generation === this.generation) this.store.setState({ prefs });
  };
  private loadDeviceStatus = async () => {
    const generation = this.generation;
    const registration = await navigator.serviceWorker?.getRegistration();
    const subscription = await registration?.pushManager?.getSubscription();
    let deviceEnabled = false;
    let hash: string | null = null;
    if (subscription && this.userId) {
      hash = [
        ...new Uint8Array(
          await crypto.subtle.digest('SHA-256', new TextEncoder().encode(subscription.endpoint))
        ),
      ]
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('');
      deviceEnabled = (
        await notificationRequest<{ connected: boolean }>(
          '/notifications/push-subscription?hash=' + hash
        )
      ).connected;
    }
    if (generation === this.generation) {
      this.store.setState({ deviceEnabled });
    }
  };
  savePreferences = async (patch: Partial<NotificationPreferences>, resumeAutomatic = false) => {
    const generation = this.generation;
    const prefs = await notificationRequest<NotificationPreferences>(
      '/notification-preferences',
      'PATCH',
      { ...patch, resumeAutomatic }
    );
    if (generation === this.generation) this.store.setState({ prefs });
  };
}

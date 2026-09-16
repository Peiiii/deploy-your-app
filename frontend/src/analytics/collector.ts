import {
  DIMENSIONS,
  EVENTS,
  normalizePage,
  type EventBatch,
  type EventName,
  type ProductEvent,
} from '@gemigo/product-analytics';

const PREFIX = 'gemigo.analytics.';
const storage = (key: string, fallback: string, session = false) => {
  try {
    const store = session ? sessionStorage : localStorage;
    const existing = store.getItem(PREFIX + key);
    if (existing) return existing;
    store.setItem(PREFIX + key, fallback);
  } catch {
    /* Storage unavailable: memory-only identity. */
  }
  return fallback;
};
const visitorId = storage('visitor', crypto.randomUUID());
const sessionId = storage('session', crypto.randomUUID(), true);
const queue: ProductEvent[] = [];
let installed = false;
let collectionEnabled = true;
const applyPolicy = (response: Response) => {
  const policy = response.headers.get('x-gemigo-collection');
  if (policy !== null) { collectionEnabled = policy === '1'; if (!collectionEnabled) queue.length = 0; }
  return response;
};
let lastPage = '';
const nativeFetch = window.fetch.bind(window);
const referrer = (): EventBatch['referrer'] => {
  if (!document.referrer) return 'direct';
  try {
    const host = new URL(document.referrer).hostname;
    if (host === location.hostname) return 'direct';
    if (/^(www\.)?(google\.[a-z.]+|bing\.com|baidu\.com)$/.test(host)) return 'search';
    if (host === 'github.com') return 'github';
    if (['x.com', 'twitter.com', 'facebook.com', 't.co'].includes(host)) return 'social';
  } catch {
    /* No raw URL is sent. */
  }
  return 'other';
};
const envelope = (events: ProductEvent[]): EventBatch => ({
  visitorId,
  sessionId,
  device: innerWidth < 768 ? 'mobile' : innerWidth < 1024 ? 'tablet' : 'desktop',
  referrer: referrer(),
  events,
});
export const track = (
  name: EventName,
  options: Pick<ProductEvent, 'dimension' | 'durationMs' | 'flowId'> = {}
) => {
  if (!collectionEnabled || navigator.doNotTrack === '1' || !Object.hasOwn(EVENTS, name) || EVENTS[name][2] !== 'browser')
    return;
  const dimension =
    options.dimension && DIMENSIONS.includes(options.dimension as (typeof DIMENSIONS)[number])
      ? options.dimension
      : undefined;
  queue.push({
    id: crypto.randomUUID(),
    name,
    at: Date.now(),
    page: normalizePage(location.pathname),
    ...options,
    dimension,
  });
  if (queue.length > 100) queue.shift();
};
export const trackPage = () => {
  if (lastPage === location.pathname) return;
  lastPage = location.pathname;
  track('page_view');
};
const flush = async () => {
  if (!collectionEnabled || !queue.length) return;
  const send = async () => {
    // Fail closed if shared persistent storage cannot enforce the request budget.
    try {
      const today = new Date().toISOString().slice(0, 10);
      const saved = JSON.parse(localStorage.getItem(PREFIX + 'budget') || '{}') as {
        day?: string;
        count?: number;
        last?: number;
      };
      const count = saved.day === today ? saved.count || 0 : 0;
      if (count >= 6 || Date.now() - (saved.last || 0) < 120000) return;
      localStorage.setItem(
        PREFIX + 'budget',
        JSON.stringify({ day: today, count: count + 1, last: Date.now() })
      );
    } catch {
      return;
    }
    const events = queue.splice(0, 20);
    // No immediate retries; failed analytics must never affect the product.
    await nativeFetch('/api/v1/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(envelope(events)),
      keepalive: true,
    }).then(applyPolicy).catch(() => undefined);
  };
  // Cross-tab serialization avoids spending a separate allowance in each tab.
  if (navigator.locks) await navigator.locks.request(PREFIX + 'flush', send);
};
export const installAnalytics = () => {
  if (installed || navigator.doNotTrack === '1') return;
  installed = true;
  window.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    const eligible =
      url.origin === location.origin &&
      url.pathname.startsWith('/api/v1/') &&
      !url.pathname.includes('/telemetry') &&
      !url.pathname.includes('/sdk/');
    const method = init?.method || (input instanceof Request ? input.method : 'GET');
    const needsContext =
      method.toUpperCase() === 'POST' &&
      [
        '/api/v1/projects/draft',
        '/api/v1/projects',
        '/api/v1/deploy',
        '/api/v1/auth/email/login',
        '/api/v1/auth/email/signup',
      ].includes(url.pathname);
    if (!eligible || (!queue.length && !needsContext && collectionEnabled)) return nativeFetch(input, init);
    const events = queue.splice(0, 20);
    const headers = new Headers(
      init?.headers || (input instanceof Request ? input.headers : undefined)
    );
    headers.set('x-gemigo-events', JSON.stringify(envelope(events)));
    return nativeFetch(input, { ...init, headers }).then(applyPolicy);
  };
  document.addEventListener('click', (event) => {
    const element =
      event.target instanceof Element ? event.target.closest<HTMLElement>('[data-event]') : null;
    if (element && !element.matches(':disabled,[aria-disabled="true"]'))
      track(element.dataset.event as EventName, { dimension: element.dataset.dimension });
  });
  document.addEventListener(
    'submit',
    (event) => {
      const form = event.target;
      if (form instanceof HTMLFormElement && form.dataset.submitEvent)
        track(form.dataset.submitEvent as EventName);
    },
    true
  );
  window.addEventListener('error', () => track('client_error', { dimension: 'runtime' }));
  window.addEventListener('unhandledrejection', () =>
    track('client_error', { dimension: 'promise' })
  );
  window.setInterval(() => {
    void flush();
  }, 120000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  });
};

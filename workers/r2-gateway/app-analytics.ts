export const APP_ANALYTICS_SCRIPT = '/__gemigo/analytics.v2.js';
export const APP_ANALYTICS_BEACON = '/__gemigo/page-view';

/** No URLs, referrers, IPs or account identifiers leave the browser. */
export const APP_ANALYTICS_RUNTIME = String.raw`(() => {
  'use strict';
  if (window.__gemigoPageViews || navigator.webdriver || navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  window.__gemigoPageViews = true;
  const endpoint = new URL('/__gemigo/page-view', document.currentScript.src).href;
  const uuid = () => crypto.randomUUID();
  let visitorId;
  try {
    visitorId = localStorage.getItem('gemigo.app.visitor.v2');
    if (!/^[a-f0-9-]{36}$/.test(visitorId || '')) {
      visitorId = uuid();
      localStorage.setItem('gemigo.app.visitor.v2', visitorId);
    }
  } catch { visitorId = undefined; }
  let lastRoute, queued = false;
  const send = () => {
    queued = false;
    if (document.prerendering || document.visibilityState !== 'visible') return;
    const route = location.pathname + location.hash;
    if (route === lastRoute) return;
    lastRoute = route;
    const body = JSON.stringify({ eventId: uuid(), ...(visitorId ? { visitorId } : {}) });
    const attempt = retry => fetch(endpoint, { method: 'POST', credentials: 'omit',
      headers: { 'content-type': 'application/json' }, body, keepalive: true })
      .then(response => { if (!response.ok && response.status >= 500 && retry) setTimeout(() => attempt(false), 1500); })
      .catch(() => { if (retry) setTimeout(() => attempt(false), 1500); });
    attempt(true);
  };
  const schedule = () => { if (!queued) { queued = true; queueMicrotask(send); } };
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function(...args) { const result = original.apply(this, args); schedule(); return result; };
  }
  addEventListener('popstate', schedule);
  addEventListener('hashchange', schedule);
  addEventListener('pageshow', event => { if (event.persisted) lastRoute = undefined; schedule(); });
  document.addEventListener('visibilitychange', schedule);
  document.addEventListener('prerenderingchange', schedule);
  schedule();
})();`;

export function addAppAnalytics(rewriter: HTMLRewriter, origin: string): HTMLRewriter {
  // CSP remains authoritative: browsers may block this same-origin script/beacon.
  return rewriter.onDocument({ end(end) {
    end.append(`<script defer src="${origin}${APP_ANALYTICS_SCRIPT}" data-gemigo-analytics></script>`, { html: true });
  } });
}

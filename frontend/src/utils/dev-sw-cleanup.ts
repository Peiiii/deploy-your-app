export async function cleanupDevServiceWorker(): Promise<void> {
  if (!import.meta.env.DEV) return;
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  // If there is no controller, a Service Worker is not currently intercepting
  // network requests for this page, so we can skip.
  if (!navigator.serviceWorker.controller) return;

  const sessionKey = '__gemigo_dev_sw_cleanup_v1';
  if (window.sessionStorage.getItem(sessionKey) === '1') return;
  window.sessionStorage.setItem(sessionKey, '1');

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));

    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (err) {
    // Best-effort cleanup. If something fails, we still try to reload
    // to detach from a potentially stale controller.
    console.warn('[dev] failed to cleanup service worker/cache', err);
  }

  // A page reload is required to stop being controlled by an already-active SW.
  window.location.reload();
}


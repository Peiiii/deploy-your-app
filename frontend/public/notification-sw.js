/* GemiGo device notifications: no mail, no background marketing, no private previews. */
self.addEventListener('install', (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('message', (event) => {
  if (event.data?.type === 'gemigo-active-user')
    event.waitUntil(
      caches
        .open('gemigo-notification-user')
        .then((cache) => cache.put('/notification-user', new Response(event.data.userId || '')))
    );
});
self.addEventListener('push', (event) =>
  event.waitUntil(
    (async () => {
      if (!event.data) return;
      const payload = event.data.json();
      const cache = await caches.open('gemigo-notification-user');
      const active = await cache.match('/notification-user');
      const matchesUser = !!active && (await active.text()) === payload.recipientId;
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const foreground = windows.some((client) => client.visibilityState === 'visible');
      const target = new URL(payload.target || '/notifications', self.location.origin);
      if (target.origin !== self.location.origin) return;
      await self.registration.showNotification(payload.title || 'GemiGo', {
        body: matchesUser ? payload.body || '有新的互动' : '打开消息中心查看。',
        silent: foreground || !matchesUser,
        tag: payload.tag,
        data: { target: target.pathname + target.search, recipientId: payload.recipientId },
        icon: '/favicon.svg',
      });
      if (matchesUser && /^gemigo-[0-9a-f-]{36}$/i.test(payload.tag || ''))
        await fetch('/api/v1/notifications/delivery-receipt', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-Gemigo-Viewer': payload.recipientId },
          body: JSON.stringify({ id: payload.tag.slice(7) }),
        }).catch(() => undefined);
    })()
  )
);
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const active = await (
        await caches.open('gemigo-notification-user')
      ).match('/notification-user');
      if (!active || (await active.text()) !== event.notification.data?.recipientId) return;
      const target = new URL(
        event.notification.data?.target || '/notifications',
        self.location.origin
      );
      if (target.origin !== self.location.origin) return;
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((client) => new URL(client.url).origin === target.origin);
      if (existing) {
        await existing.navigate(target.href);
        await existing.focus();
      } else await self.clients.openWindow(target.href);
    })()
  );
});

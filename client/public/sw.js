self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const title = data.title ?? 'كيان';
  const options = {
    body: data.body ?? '',
    icon: '/icons/icon-192x192-v2.png',
    badge: '/icons/icon-192x192-v2.png',
    dir: 'rtl',
    lang: 'ar',
    data: { type: data.type },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    }),
  );
});

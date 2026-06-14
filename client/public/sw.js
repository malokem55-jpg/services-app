/* ─── App-shell precache (offline + instant open) ────────────────────────── */

const PRECACHE = 'kayan-shell-v1';
const FONTS_CACHE = 'kayan-fonts-v1';

// Injected at build time by vite-plugin-pwa: [{ url, revision }, ...]
const precacheEntries = self.__WB_MANIFEST || [];
const precacheUrls = precacheEntries.map((entry) =>
  typeof entry === 'string' ? entry : entry.url,
);

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      await Promise.all(
        precacheUrls.map(async (url) => {
          try {
            // no-cache: bypass the HTTP cache so updates are picked up
            const response = await fetch(url, { cache: 'no-cache' });
            if (response.ok) await cache.put(url, response);
          } catch {
            // skip files that fail; the fetch handler falls back to network
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from older SW versions and stale precache entries
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== PRECACHE && name !== FONTS_CACHE)
          .map((name) => caches.delete(name)),
      );
      const cache = await caches.open(PRECACHE);
      const requests = await cache.keys();
      await Promise.all(
        requests.map((request) => {
          const path = new URL(request.url).pathname;
          if (!precacheUrls.includes(path)) return cache.delete(request);
        }),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Google Fonts: stale-while-revalidate so the font works offline
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(FONTS_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })(),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // API requests always go to the network
  if (url.pathname.startsWith('/api')) return;

  // Navigations: network-first, fall back to the cached shell when offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached =
          (await caches.match('/index.html')) || (await caches.match('/'));
        return cached || Response.error();
      }),
    );
    return;
  }

  // Static assets (hashed filenames): cache-first
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request)),
  );
});

/* ─── Push notifications ─────────────────────────────────────────────────── */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const title = data.title ?? 'كيان';
  const isIOS = /iphone|ipad|ipod/i.test(self.navigator.userAgent || '');

  let body = data.body ?? '';
  // آيفون لا يعرض أزرار الإشعارات، فننبّه المستخدم أن الضغط نفسه يفتح المحادثة.
  if (data.phone && isIOS) {
    body += '\n👆 اضغط لفتح محادثة واتساب مع العميل';
  }

  const options = {
    body,
    icon: '/icons/icon-192x192-v2.png',
    badge: '/icons/icon-192x192-v2.png',
    dir: 'rtl',
    lang: 'ar',
    data: { type: data.type, phone: data.phone, message: data.message, name: data.name },
  };

  if (data.timestamp) options.timestamp = data.timestamp;

  // تحسينات تصميم تنبيه الدفعة الشهرية (أندرويد يطبّقها، وآيفون يتجاهلها):
  // - يبقى الإشعار ظاهراً حتى يتفاعل المستخدم (تذكير مالي مهم)
  // - اهتزاز لطيف عند الوصول
  // - وسم لكل عميل + renotify: يمنع تكدّس إشعارات مكررة لنفس العميل ويستبدل القديم
  // - زر «محادثة العميل» على أندرويد فقط (آيفون لا يعرض الأزرار، فالضغط على الجسم يكفي)
  if (data.phone) {
    options.requireInteraction = true;
    options.vibrate = [200, 100, 200];
    options.tag = `${data.type}:${data.phone}`;
    options.renotify = true;
    if (!isIOS) {
      options.actions = [{ action: 'chat', title: 'محادثة العميل' }];
    }
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const isIOS = /iphone|ipad|ipod/i.test(self.navigator.userAgent || '');

  // فتح محادثة العميل عبر شاشة تأكيد داخل التطبيق (الـ service worker لا يستطيع إظهار
  // نافذة تأكيد نظام)، ومنها ينتقل المستخدم إلى الواتساب. تُفتح في الحالتين:
  // أندرويد بالضغط على زر «محادثة العميل»، وآيفون بالضغط على جسم الإشعار (لا زر فيه).
  if (data.phone && (event.action === 'chat' || (isIOS && !event.action))) {
    const params = new URLSearchParams({
      phone: data.phone,
      message: data.message || '',
      name: data.name || '',
    });
    event.waitUntil(clients.openWindow(`/m/chat?${params.toString()}`));
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    }),
  );
});

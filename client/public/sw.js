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
  const options = {
    body: data.body ?? '',
    icon: '/icons/icon-192x192-v2.png',
    badge: '/icons/icon-192x192-v2.png',
    dir: 'rtl',
    lang: 'ar',
    data: { type: data.type, phone: data.phone, message: data.message },
  };

  // زر «محادثة العميل» يظهر على أندرويد (كروم يدعم أزرار الإشعارات). على آيفون لا
  // يظهر الزر، فبدلاً منه يفتح الضغط على جسم الإشعار محادثة الواتساب (انظر notificationclick).
  if (data.phone) {
    options.actions = [{ action: 'chat', title: 'محادثة العميل' }];
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

// تحويل الرقم المحلي (05xxxxxxxx) إلى رابط wa.me دولي مع رسالة معبأة مسبقاً.
// يطابق منطق client/src/lib/whatsapp.ts؛ نستخدم wa.me دائماً لأن الإشعار يصل على الجوال.
function buildWhatsAppUrl(phone, message) {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = '966' + digits.slice(1);
  else if (digits.startsWith('5') && digits.length === 9) digits = '966' + digits;
  if (digits.length < 8) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${digits}${text}`;
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const isIOS = /iphone|ipad|ipod/i.test(self.navigator.userAgent || '');
  // فتح محادثة العميل: عبر زر «محادثة العميل» على أندرويد، أو بالضغط على جسم الإشعار
  // على آيفون (حيث لا تظهر أزرار الإشعارات). الأنواع الأخرى لا تحمل phone فتسلك الافتراضي.
  if (data.phone && (event.action === 'chat' || (isIOS && !event.action))) {
    const url = buildWhatsAppUrl(data.phone, data.message);
    if (url) {
      event.waitUntil(clients.openWindow(url));
      return;
    }
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

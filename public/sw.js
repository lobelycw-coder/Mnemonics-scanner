const SHELL = 'shell-v1';
const ASSETS = ['/', '/app.js', '/styles.css', '/ui/terminal.js', '/ui/stats.js', '/manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api') || url.pathname === '/ws') return;
  e.respondWith(caches.match(e.request).then((hit) => hit ?? fetch(e.request)));
});

self.addEventListener('push', (e) => {
  const d = e.data?.json() ?? {};
  e.waitUntil(self.registration.showNotification(d.title ?? 'Hit', {
    body: d.body ?? '',
    tag: d.tag ?? 'hit',
    renotify: true,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: d,
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((list) => {
    const open = list.find((c) => c.url.includes(self.location.origin));
    return open ? open.focus() : self.clients.openWindow('/');
  }));
});
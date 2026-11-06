/* Lekhak service worker: cache brand assets; everything else goes to the network (the app is live data). */
const VERSION = 'lekhak-v4';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(['/brand/piramal-ai-lockup.png', '/assets/hero.jpg?v=4', '/assets/orb.jpg?v=4', '/assets/icon-192.png', '/fonts/OpenSans-Variable.woff2'])).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return res; })));
  }
});

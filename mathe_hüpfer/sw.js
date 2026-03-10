const CACHE = 'mathe-huepfer-v2'; // ← v1 → v2 zwingt den Browser zum Neu-Laden!
const FILES = ['./index.html', './manifest.json', './mathe_jump.png', './start.png'];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(FILES))
    );
    self.skipWaiting(); // ← Neue Version sofort aktivieren, nicht warten!
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    );
    self.clients.claim(); // ← Alle offenen Tabs sofort übernehmen
});

self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request).then(r => r || fetch(e.request))
    );
});

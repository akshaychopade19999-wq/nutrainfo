// NutraInfo Service Worker
// ⚠️ BUMP THIS VERSION NUMBER every time you deploy changes
// v1 → v2 → v3 etc. This forces all users to get fresh content.
const VERSION = 'nutrainfo-v3';
const CACHE = VERSION;

// Files to pre-cache on install
const PRECACHE_URLS = ['/', '/index.html', '/manifest.json'];

// ── Install: cache core files ─────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()) // activate immediately, don't wait
  );
});

// ── Activate: delete ALL old caches ──────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE) // delete anything that isn't current version
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      ))
      .then(() => self.clients.claim()) // take control of all open tabs immediately
      .then(() => {
        // Tell all open tabs to reload so they get fresh content
        self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => client.postMessage({ type: 'SW_UPDATED', version: VERSION }));
        });
      })
  );
});

// ── Fetch strategy ────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip non-GET requests and cross-origin requests (analytics, CDN fonts etc.)
  if (e.request.method !== 'GET') return;
  if (!url.origin.includes(self.location.origin) && !url.hostname.includes('vercel')) return;

  // foods.json → Network first, fall back to cache
  // Always try to get fresh data; only use cache if offline
  if (url.pathname.endsWith('foods.json')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // index.html → Network first (so updates always reach users)
  if (url.pathname === '/' || url.pathname.endsWith('index.html')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Everything else → Cache first, fall back to network
  e.respondWith(
    caches.match(e.request)
      .then(cached => cached || fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }))
  );
});

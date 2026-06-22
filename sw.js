// NutraInfo Service Worker
// ⚠️ BUMP VERSION on every deploy
const VERSION = 'nutrainfo-v4';
const CACHE = VERSION;

const PRECACHE_URLS = ['/', '/index.html', '/manifest.json'];

// ── Install ───────────────────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()) // activate immediately
  );
});

// ── Activate: wipe ALL old caches ────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => {
        self.clients.matchAll({type:'window'}).then(clients =>
          clients.forEach(c => c.postMessage({type:'SW_UPDATED', version:VERSION}))
        );
      })
  );
});

// ── Listen for SKIP_WAITING from page ────────────────────────────────────
self.addEventListener('message', e => {
  if(e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── Fetch: Network-first for HTML and JSON, cache-first for assets ────────
self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // index.html and foods.json: ALWAYS try network first — never serve stale
  if(url.pathname === '/' || url.pathname.endsWith('index.html') || url.pathname.endsWith('foods.json')){
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if(res && res.status === 200){
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request)) // offline fallback
    );
    return;
  }

  // Everything else: cache first, network fallback
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

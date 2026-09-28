/*
 * AMS service worker — makes the app an installable PWA and keeps the app shell
 * available offline so a technician can complete a PDI checklist in a signal-dead
 * workshop bay (Feature Spec §Non-functional Requirements).
 *
 * Strategy, deliberately simple because the build hashes asset filenames
 * (outputHashing: "all"), so a static precache manifest can't be authored by hand:
 *
 *   - Navigations (mode === 'navigate'): network-first, falling back to the cached
 *     app shell (index.html) when offline — this is what keeps deep links like
 *     /vehicles/:id/pdi working with no connection.
 *   - Same-origin static assets (GET): stale-while-revalidate — served instantly
 *     from cache, refreshed in the background.
 *   - API calls (/api/*): never touched here. Offline reads/writes are handled at
 *     the application layer (IndexedDB + a replayed mutation queue), which the SW
 *     must not shadow with stale cached responses.
 *
 * There is intentionally no build-time dependency (@angular/service-worker); this
 * file is copied verbatim from apps/web/public into the build output.
 */

const VERSION = 'ams-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const SHELL_URL = '/index.html';

// Minimal precache: the app shell and its static entry points. Hashed JS/CSS are
// picked up at runtime by the stale-while-revalidate handler below.
const PRECACHE_URLS = ['/', SHELL_URL, '/manifest.webmanifest', '/favicon.ico', '/icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

// Allow the page to trigger an immediate activation of a waiting worker.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only GETs are cacheable; everything else (POST/PATCH/DELETE) goes to the network.
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Cross-origin and API requests are left entirely to the network / the app's
  // own IndexedDB offline layer.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api')) {
    return;
  }

  // App navigations: network-first, fall back to the cached shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(SHELL_URL, copy));
          return response;
        })
        .catch(() => caches.match(SHELL_URL).then((cached) => cached || caches.match('/'))),
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  event.respondWith(
    caches.open(ASSET_CACHE).then((cache) =>
      cache.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      }),
    ),
  );
});

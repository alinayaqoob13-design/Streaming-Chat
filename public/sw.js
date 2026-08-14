/**
 * ============================================================================
 * SERVICE WORKER — offline app shell + stale-while-revalidate assets
 * ============================================================================
 *
 * Scope: whole origin; registered only in production (dev server keeps full
 * fidelity for hot reloads).
 *
 * Rules:
 *   - Only same-origin GET requests are handled; API routes are NEVER cached
 *     (streaming responses + health checks must always hit the network).
 *   - Navigations (app shell): network-first, falling back to the cached
 *     shell when offline — updates propagate as soon as the network returns.
 *   - Static assets (JS/CSS/fonts/icons): cache-first, updated in the
 *     background (stale-while-revalidate) — instant repeat loads.
 *
 * Bump CACHE when the asset list or cache policy changes to invalidate old
 * entries cleanly (the activate handler deletes anything not in CACHE).
 * ============================================================================
 */

const CACHE = "notes-buddy-v1";

// Take over immediately so newly-installed workers control the page now,
// not after the next reload.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never touch API routes — POST streaming or GET health checks must be live.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    // App shell: network-first so users always get the latest bundle when
    // online; the response is stashed for offline reloads.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  // Static assets: serve the cached copy instantly, refresh in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("bapsim-shell-v2").then((cache) =>
      cache.addAll(["/", "/admin", "/bapsim-logo.png"])
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== "bapsim-shell-v2") {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  // Network First, falling back to cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Optionally update cache here for dynamic caching, but for now we just return it
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

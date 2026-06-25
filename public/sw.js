self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("bapsim-shell-v1").then((cache) =>
      cache.addAll(["/", "/admin", "/client", "/bapsim-logo.png"])
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request);
    })
  );
});

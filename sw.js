/* PawsForward — installability only; never pin HTML/CSS/JS behind a stale cache */
const CACHE = "pawsforward-shell-v6";
const PRECACHE = [
  "./manifest.webmanifest",
  "./icons/favicon.png",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
];

function isShellAsset(url) {
  try {
    const u = new URL(url);
    if (u.origin !== self.location.origin) return false;
    const path = u.pathname.toLowerCase();
    const leaf = path.split("/").pop() || "";
    const cleanPage = leaf && !leaf.includes(".");
    return (
      path.endsWith(".html") ||
      cleanPage ||
      path.endsWith(".js") ||
      path.endsWith(".css") ||
      path.endsWith(".webmanifest") ||
      path.endsWith("/")
    );
  } catch {
    return false;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => (k === CACHE ? null : caches.delete(k)))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Always hit the network for pages and scripts so deploys show up.
  if (isShellAsset(event.request.url)) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request).then((c) => c || Response.error()))
    );
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        if (response.ok && event.request.url.startsWith(self.location.origin)) {
          caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

/**
 * fashionistas.ai service worker (PWA).
 *
 * Strategy:
 *  - /api/*  -> never intercepted, never cached (auth, billing and listing calls
 *               must always hit the network).
 *  - navigations -> network first, cached shell as the offline fallback.
 *  - static assets (css/js/svg/png/webmanifest) -> stale-while-revalidate.
 *
 * Bump CACHE on every deploy that must reach returning visitors.
 */

const CACHE = "fash-pwa-v1";
const CORE_ASSETS = [
  "/",
  "/site.css",
  "/icon.svg",
  "/manifest.webmanifest",
  "/pricing/",
  "/fees/",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        CORE_ASSETS.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => null)
        )
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name !== CACHE)
          .map((name) => caches.delete(name))
      );
      if (self.clients && self.clients.claim) {
        await self.clients.claim();
      }
    })()
  );
});

function isStatic(request, url) {
  if (url.pathname === "/sw.js") return false;
  return /\.(?:css|js|mjs|svg|png|jpe?g|webp|woff2?|webmanifest|ico)$/i.test(url.pathname);
}

async function networkFirst(request) {
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, fresh.clone()).catch(() => null);
    }
    return fresh;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const shell = await caches.match("/");
    if (shell) return shell;
    return new Response("You are offline.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone()).catch(() => null);
      return res;
    })
    .catch(() => null);
  return cached || (await network) || new Response("", { status: 504 });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // never cache API traffic
  if (url.pathname === "/sw.js") return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isStatic(request, url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

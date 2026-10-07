/* fashionistas.ai service worker: RETIRED (kill switch, v2).
 * An earlier PWA worker (fash-pwa-v1) served CSS/JS stale-while-revalidate, so
 * returning Android Chrome / installed-PWA users kept seeing old layouts after
 * deploys. This worker replaces it, wipes every cache, unregisters itself and
 * reloads open tabs so they fetch fresh from the network. Keep this file served.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try { const n = await caches.keys(); await Promise.all(n.map((k) => caches.delete(k))); } catch (e) {}
    try { await self.clients.claim(); } catch (e) {}
    try { await self.registration.unregister(); } catch (e) {}
    try {
      const cs = await self.clients.matchAll({ type: "window" });
      cs.forEach((c) => { try { c.navigate(c.url); } catch (e) {} });
    } catch (e) {}
  })());
});
/* no fetch handler: everything goes straight to the network */

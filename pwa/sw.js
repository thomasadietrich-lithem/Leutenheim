// Cave Roller : l'appli installée va toujours chercher la DERNIÈRE version en ligne (Thomas, 2026-11-12) ;
// sans réseau, elle ouvre la dernière version gardée.
const CACHE = "cave-roller";
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

// Réseau d'abord (la dernière version), sinon ce qui est gardé. « no-cache » : le téléphone demande seulement si le
// fichier a changé (audit du 2026-11-13 : « no-store » retéléchargeait 300 Ko à chaque ouverture).
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request, { cache: "no-cache" })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match("index.html"))),
  );
});

"use strict";
const NOME = "boat-v6";
const FILE = ["./", "index.html", "style.css", "porti.js", "dati.js", "extra.js", "extra2.js",
              "extra3.js", "extra4.js", "mappa_dati.js", "mappa.js", "vendor/leaflet.js", "vendor/leaflet.css",
              "app.js", "manifest.json", "icona-180.png", "icona-192.png", "icona-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(NOME).then(c => c.addAll(FILE)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(k => Promise.all(k.filter(n => n !== NOME).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Con rete: file sempre freschi. Senza rete: copia salvata.
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(r).then(res => {
      if (res.ok) {
        const copia = res.clone();
        caches.open(NOME).then(c => c.put(r, copia));
      }
      return res;
    }).catch(() => caches.match(r, { ignoreSearch: true }).then(x => x || caches.match("index.html")))
  );
});

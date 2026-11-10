/**
 * sw.js — Service Worker de DinnerKids (Estrategia "Primero Red" con respaldo en caché offline).
 * Permite instalar DinnerKids como aplicación en el móvil y consultar el menú sin cobertura,
 * garantizando que cuando hay internet siempre se cargue la última versión publicada.
 */

const CACHE_NAME = "dinnerkids-pwa-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./privacidad.html",
  "./logic.js",
  "./manifest.webmanifest",
  "./assets/logo.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Estrategia "Primero Red, respaldo en Caché" para no servir código desactualizado
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

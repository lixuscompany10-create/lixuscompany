/* ============================================================
   Lixus Company — Service Worker
   Objetivo: que la app abra aunque la señal falle, pero que los
   DATOS (inventario, ventas) siempre vengan frescos del servidor.
   Nunca se guarda en caché nada de Supabase.
   ============================================================ */

const CACHE = 'lixus-v1';
const BASE = new URL('./', self.location).pathname;

// Archivos propios de la app que sí conviene tener guardados
const APP_SHELL = [
  BASE + 'lixus-inventario.html',
  BASE + 'manifest.json',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(APP_SHELL).catch(() => null))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Datos del negocio: siempre de la red, jamás de caché.
  if (url.hostname.endsWith('supabase.co')) return;

  // Página y archivos propios: primero la red (para recibir las
  // actualizaciones que subes a GitHub), y si no hay señal, la copia guardada.
  const esPropio = url.origin === self.location.origin;
  const esNavegacion = req.mode === 'navigate';

  if (esNavegacion || esPropio) {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copia = res.clone();
            caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match(BASE + 'lixus-inventario.html')))
    );
    return;
  }

  // Librerías externas (Supabase JS, Chart.js, escáner): caché primero,
  // porque no cambian y así la app arranca rápido y sin datos.
  e.respondWith(
    caches.match(req).then(guardado => guardado || fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) {
        const copia = res.clone();
        caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
      }
      return res;
    }).catch(() => guardado))
  );
});

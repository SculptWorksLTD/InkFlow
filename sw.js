// Service worker: l'app funziona anche offline e si aggiorna da sola.
// VERSION viene sostituita a ogni pubblicazione: una versione nuova = cache nuova = aggiornamento.
const VERSION = 'dev';
const CACHE = `inkflow-${VERSION}`;
const SHELL = [
  './', './index.html', './richiesta.html', './manifest.webmanifest', './css/app.css',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './js/app.js', './js/db.js', './js/ui.js', './js/util.js', './js/store.js', './js/icons.js', './js/version.js', './js/form.js',
  './js/logic/defaults.js', './js/logic/automations.js', './js/logic/schedule.js', './js/logic/content.js',
  './js/logic/ads.js', './js/logic/leadParse.js', './js/logic/stats.js',
  './js/views/oggi.js', './js/views/richieste.js', './js/views/agenda.js', './js/views/clienti.js',
  './js/views/contenuti.js', './js/views/sponsorizzate.js', './js/views/offerte.js',
  './js/views/statistiche.js', './js/views/impostazioni.js',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' salta la cache HTTP: la versione nuova scarica davvero i file nuovi.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('inkflow-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // chiamate esterne (es. IA) passano dirette
  e.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') (await caches.open(CACHE)).put(req, res.clone());
      return res;
    } catch {
      return (await caches.match('./index.html')) || Response.error();
    }
  })());
});

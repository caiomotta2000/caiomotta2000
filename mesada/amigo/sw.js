/* Service worker: guarda o app para funcionar offline.
 * Ao lançar versão nova, mude CACHE_NAME (igual ao APP_VERSION). */
const CACHE_NAME = 'mesada-amigo-v1.2.0';
// SDK do Firebase (só baixado quando a sincronização está ligada): guardado para abrir offline
const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/version.js', './js/i18n.js', './js/logic.js', './js/missions.js', './js/lili.js',
  './js/firebase-config.js', './js/adapters/firestore-adapter.js', './js/store.js', './js/sync-core.js', './js/sync.js', './js/ui.js', './js/app.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('mesada-amigo-') && k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method === 'GET' && req.url.startsWith(FIREBASE_SDK)) { // arquivos versionados: cache primeiro
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});

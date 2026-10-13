// Leitura Divertida com a Lili: funciona sem internet.
// Página: tenta a internet primeiro (para pegar versões novas) e usa a cópia guardada se estiver offline.
const CACHE='lili-v1';
const ARQUIVOS=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ARQUIVOS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(req.mode==='navigate' || (url.origin===location.origin && url.pathname.endsWith('.html'))){
    e.respondWith(fetch(req).then(r=>{ const c=r.clone(); caches.open(CACHE).then(k=>k.put('./index.html',c)); return r; })
      .catch(()=>caches.match('./index.html').then(r=>r||caches.match('./'))));
    return;
  }
  if(url.origin===location.origin || url.host.includes('fonts.googleapis.com') || url.host.includes('fonts.gstatic.com')){
    e.respondWith(caches.match(req).then(hit=>{
      const rede=fetch(req).then(r=>{ if(r && (r.ok || r.type==='opaque')){ const c=r.clone(); caches.open(CACHE).then(k=>k.put(req,c)); } return r; }).catch(()=>hit);
      return hit || rede;
    }));
  }
});

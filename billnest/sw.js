/* BillNest installable offline app shell. No cloud or customer responses are cached. */
const CACHE = 'billnest-shell-v35';
const SHELL = [
 './','./index.html','./styles.css?v=32','./auth-ui.css?v=3','./shop-database.css?v=1','./language-ui.css?v=1','./app.bundle.js?v=33',
 './auth-config.js?v=3','./cloud-backup.js?v=33','./shop-database.js?v=1','./auth-ui.js?v=3','./i18n.js?v=3','./qrcode.min.js?v=1','./manifest.webmanifest',
 './logo-mark.svg?v=24','./favicon.svg?v=24','./install-app.js?v=26',
 './icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png'
];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('billnest-shell-')&&key!==CACHE).map(key=>caches.delete(key)))),
  self.clients.claim()
 ]));
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 const scope=new URL(self.registration.scope);
 if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 // Fetch public auth config from the network first so new project settings reach installed PWAs.
 if(url.pathname.endsWith('/auth-config.js')){
  event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}
   return response;
  }).catch(()=>caches.match(request).then(r=>r||Response.error())));
  return;
 }
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',copy));}
   return response;
  }).catch(()=>caches.match('./index.html').then(r=>r||Response.error())));
  return;
 }
 event.respondWith(caches.match(request).then(cached=>{
  if(cached)return cached;
  return fetch(request).then(response=>{
   if(response.ok&&response.type==='basic'&&['script','style','image','manifest'].includes(request.destination)){
    const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));
   }
   return response;
  });
 }));
});

/* BillNest installable offline app shell. No cloud or customer responses are cached. */
const CACHE = 'billnest-shell-v81';
const SHELL = [
 './','./index.html','./styles.css?v=52','./auth-ui.css?v=12','./shop-database.css?v=5','./language-ui.css?v=1','./app.bundle.js?v=48',
 './auth-config.js?v=6','./cloud-backup.js?v=39','./shop-database.js?v=7','./auth-ui.js?v=37','./i18n.js?v=3','./qrcode.min.js?v=1','./manifest.webmanifest',
 './logo-mark.svg?v=24','./favicon.svg?v=24','./install-app.js?v=27',
 './icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png'
];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(async cache=>{for(const path of SHELL){const req=new Request(new URL(path,self.registration.scope),{cache:'reload'});const response=await fetch(req);if(!response.ok)throw Error('Shell asset unavailable: '+path);await cache.put(req,response);}}).then(()=>self.skipWaiting()));
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
 // Online visits use fresh HTML, scripts and CSS; offline visits use the saved shell.
 // Only known static app assets are cached, never authenticated API responses.
 const navigation=request.mode==='navigate';
 const staticCode=['script','style'].includes(request.destination)||/\.(?:js|css)$/.test(url.pathname);
 if(navigation||staticCode){
  const cacheKey=navigation?new URL('index.html',scope).href:request;
  event.respondWith((async()=>{
   const cache=await caches.open(CACHE);
   try{
    const response=await fetch(request,{cache:'no-store'});
    if(response.ok&&response.type==='basic'){try{await cache.put(cacheKey,response.clone());}catch{}}
    if(response.ok||response.status<500)return response;
    return (await cache.match(cacheKey))||response;
   }catch(error){return (await cache.match(cacheKey))||Response.error();}
  })());
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

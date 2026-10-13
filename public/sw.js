const CACHE="investeringsagent-shell-v2";const ASSETS=["/manifest.webmanifest","/icon.svg","/icon-192.png","/icon-512.png"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener("fetch",event=>{if(event.request.method!=="GET"||event.request.mode==="navigate")return;event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request))) });

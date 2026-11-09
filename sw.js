/* 账镜 Service Worker · 零依赖
   策略：页面导航「网络优先、断网回退缓存」；静态资源「缓存优先」。
   发布新版本时改 CACHE 里的版本号即可让旧缓存自动失效。 */
const CACHE = 'ledgerlens-1.1.0';
const SHELL = [
  './', './index.html', './assets/app.css?v=1.1.0', './assets/app.js?v=1.1.0',
  './assets/favicon.svg', './manifest.webmanifest',
  './icon-192.png', './icon-512.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== CACHE).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put('./index.html', copy));
      return res;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok && res.type === 'basic') {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
    }
    return res;
  })));
});

/* Random Diary · 离线缓存（App 外壳） */
const VER = 'rd-v1-20261123';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './favicon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VER);
    // 逐个 add，单个失败不拖垮整体
    await Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VER).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // 页面导航：优先网络，离线时回落到缓存的外壳
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const c = await caches.open(VER);
        c.put('./index.html', fresh.clone()).catch(() => {});
        return fresh;
      } catch (err) {
        const c = await caches.open(VER);
        return (await c.match('./index.html')) ||
               (await c.match('./')) ||
               new Response('', { status: 504, statusText: 'offline' });
      }
    })());
    return;
  }

  // 静态资源：缓存优先，后台更新
  e.respondWith((async () => {
    const c = await caches.open(VER);
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) {
      fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); }).catch(() => {});
      return hit;
    }
    try {
      const r = await fetch(req);
      if (r && r.ok && new URL(req.url).origin === self.location.origin) {
        c.put(req, r.clone()).catch(() => {});
      }
      return r;
    } catch (err) {
      return new Response('', { status: 504, statusText: 'offline' });
    }
  })());
});

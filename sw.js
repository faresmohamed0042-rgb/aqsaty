// ⚠️ ارفع رقم النسخة ده مع كل نشر جديد
const V = 'aqsaty-v4';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './privacy.html'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  const isStorage = /^https:\/\/firebasestorage\.googleapis\.com$/.test(url.origin);
  if (isStorage) { e.respondWith(cacheFirst(request)); return; }

  if (url.origin !== location.origin) return;

  if (request.mode === 'navigate' ||
      (request.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(networkFirstNav(request));
    return;
  }

  if (/\.(png|jpe?g|svg|webp|ico|webmanifest)$/i.test(url.pathname)) {
    e.respondWith(cacheFirst(request));
    return;
  }

  e.respondWith(staleWhileRevalidate(request));
});

async function networkFirstNav(request) {
  const cache = await caches.open(V);
  try {
    const fresh = await fetchWithTimeout(request, 4000);
    if (fresh && fresh.ok) cache.put(request, fresh.clone()).catch(() => {});
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const shell = await cache.match('./index.html');
    if (shell) return shell;
    return new Response(
      '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>بدون اتصال</title>' +
      '<body style="font-family:Cairo,Tahoma,sans-serif;text-align:center;padding:40px">' +
      '<h1>لا يوجد اتصال</h1><p>افتح التطبيق مرة واحدة أونلاين ليتم تخزينه.</p>' +
      '<button onclick="location.reload()" style="padding:12px 24px;border-radius:12px;border:0;background:#0fb67f;color:#fff;font-weight:700">إعادة المحاولة</button>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(V);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone()).catch(() => {});
    return fresh;
  } catch { return new Response('', { status: 504 }); }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(V);
  const cached = await cache.match(request);
  const network = fetch(request).then(res => {
    if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
    return res;
  }).catch(() => null);
  return cached || (await network) || new Response('', { status: 504 });
}

function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(request).then(
      res => { clearTimeout(timer); resolve(res); },
      err => { clearTimeout(timer); reject(err); }
    );
  });
}

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Keeps the door scanner (/scan) on the phone, so it opens even with no
// network (e.g. the tab reloads in a dead spot at the door).
// Registered only by the scanner page, scope '/scan' – the public site is not
// affected. The page sends the list of files it loaded ({ type: 'cache' }).
// API calls (/.netlify/…) are never cached or touched.
const CACHE = 'irottko-scan-v1';
const PAGE = '/scan';
const NAV_WAIT_MS = 3000;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('irottko-scan-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
);

self.addEventListener('message', (e) => {
  if (e.data?.type !== 'cache' || !Array.isArray(e.data.urls)) return;
  const urls = [...new Set(e.data.urls)].filter((u) => {
    try {
      const url = new URL(u, self.location.origin);
      return url.origin === self.location.origin && !url.pathname.startsWith('/.netlify/');
    } catch {
      return false;
    }
  });
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(urls.map((u) => c.add(u).catch(() => {})))));
});

const put = (key, res) => {
  if (res && res.ok && res.type === 'basic') {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(key, copy));
  }
  return res;
};

const withTimeout = (promise, ms) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => (clearTimeout(t), resolve(v)),
      (err) => (clearTimeout(t), reject(err))
    );
  });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/.netlify/')) return;

  // The page: fresh when the network answers in time, the saved copy otherwise.
  if (req.mode === 'navigate') {
    e.respondWith(
      withTimeout(fetch(req), NAV_WAIT_MS)
        .then((res) => put(PAGE, res))
        .catch(() => caches.match(PAGE).then((hit) => hit || fetch(req)))
    );
    return;
  }

  // Built files have a hash in their name: the saved copy is always right.
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => put(req, res))));
    return;
  }

  // Everything else (fonts, icons): network first, saved copy as fallback.
  e.respondWith(fetch(req).then((res) => put(req, res)).catch(() => caches.match(req)));
});

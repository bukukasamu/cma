// Service worker Kas AMU: menyimpan tampilan aplikasi agar cepat dibuka dan bisa dipasang.
// Data kas tetap diambil langsung dari Firebase. Naikkan VERSION setiap kali merilis versi baru.
const VERSION = "kas-amu-2.1.0";
const SHELL = [
  "./", "./index.html", "./app.js", "./style.css", "./firebase-config.js", "./manifest.json",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png", "./icons/apple-touch-icon.png"
];
const CDN = ["www.gstatic.com", "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", e => { if (e.data === "skip") self.skipWaiting(); });

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // File aplikasi sendiri: ambil versi terbaru dulu, pakai cadangan saat offline
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req).then(m => m || caches.match("./index.html")))
    );
    return;
  }

  // Pustaka dari CDN: pakai simpanan, perbarui di belakang
  if (CDN.includes(url.hostname)) {
    e.respondWith(
      caches.match(req).then(cached => {
        const net = fetch(req).then(res => {
          if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
          return res;
        }).catch(() => cached);
        return cached || net;
      })
    );
  }
});

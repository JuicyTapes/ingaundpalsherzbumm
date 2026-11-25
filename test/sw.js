// Offline-Unterstützung: Seite + gespeicherte Kapitel auch ohne Internet (inkl. Vor-/Zurückspulen).
var SHELL = 'hb-shell-v1', AUDIO = 'hb-audio-v1';
var SHELL_FILES = ['./', 'index.html', 'cover.jpg', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(SHELL).then(function (c) { return c.addAll(SHELL_FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
function rangeResponse(resp, rangeHeader) {
  return resp.arrayBuffer().then(function (buf) {
    var m = /bytes=(\d*)-(\d*)/.exec(rangeHeader) || [];
    var start = m[1] ? parseInt(m[1], 10) : 0;
    var end = m[2] ? parseInt(m[2], 10) : buf.byteLength - 1;
    if (end >= buf.byteLength) end = buf.byteLength - 1;
    var part = buf.slice(start, end + 1);
    return new Response(part, { status: 206, headers: {
      'Content-Type': 'audio/mpeg', 'Content-Length': String(part.byteLength),
      'Content-Range': 'bytes ' + start + '-' + end + '/' + buf.byteLength, 'Accept-Ranges': 'bytes' } });
  });
}
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (/\/audio\/[^/]+\.mp3$/.test(url.pathname)) {
    e.respondWith(caches.open(AUDIO).then(function (c) {
      return c.match(url.pathname.replace(/^.*\/(audio\/)/, '$1')).then(function (hit) {
        if (!hit) return fetch(req);
        var r = req.headers.get('range');
        return r ? rangeResponse(hit.clone(), r) : hit;
      });
    }));
    return;
  }
  // Seite & Bilder: erst Netz (damit Änderungen ankommen), sonst gespeicherte Kopie
  e.respondWith(fetch(req).then(function (resp) {
    var copy = resp.clone();
    if (resp.ok) caches.open(SHELL).then(function (c) { c.put(req, copy); });
    return resp;
  }).catch(function () { return caches.match(req, { ignoreSearch: true }).then(function (h) { return h || caches.match('index.html'); }); }));
});

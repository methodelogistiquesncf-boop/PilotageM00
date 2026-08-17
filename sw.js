/* sw.js — Service worker : versionning, mise à jour auto, mode hors-ligne */
importScripts('version.js');

var VERSION = self.APP_VERSION || 'dev';
var CACHE_NAME = 'pilotage-m00-' + VERSION;

var CORE = [
  'suivi.html', 'login.html',
  'manifest.json', 'icons/logo.svg',
  'suivi.css', 'version.js',
  'main.js', 'state.js', 'firebase.js', 'chart.js', 'stats.js',
  'ui-supermarche.js', 'ui-rassemblement.js', 'ui-actions.js', 'ui-users.js',
  'responsable-field.js', 'recette.js', 'fusion-emplacement.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(CORE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; })
                               .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  /* 🔑 Network-first : toujours la dernière version en ligne, cache hors-ligne */
  event.respondWith(
    fetch(event.request, { cache: 'no-store' }).then(function (res) {
      var clone = res.clone();
      caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, clone); });
      return res;
    }).catch(function () {
      return caches.match(event.request);
    })
  );
});

// sw.js — Service Worker Pilotage M00 (PWA)
var CACHE = 'pilotage-m00-v1';
var APP_SHELL = [
  'login.html',
  'suivi.html',
  'suivi.css',
  'main.js',
  'state.js',
  'firebase.js',
  'ui-supermarche.js',
  'ui-rassemblement.js',
  'ui-actions.js',
  'ui-users.js',
  'stats.js',
  'chart.js',
  'responsable-field.js',
  'manifest.json',
  'icons/logo.svg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (cache) { return cache.addAll(APP_SHELL); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Réseau d'abord (toujours à jour), cache en secours (hors-ligne)
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req).then(function (response) {
      if (response && response.ok) {
        var clone = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put(req, clone); });
      }
      return response;
    }).catch(function () {
      return caches.match(req).then(function (cached) {
        if (cached) return cached;
        if (req.mode === 'navigate') return caches.match('suivi.html');
        return Response.error();
      });
    })
  );
});

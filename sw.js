/* sw.js — versionning + mise à jour auto + hors-ligne + déploiement forcé */
importScripts('version.js');
var VERSION = self.APP_VERSION || 'dev';
var CACHE_NAME = 'pilotage-m00-' + VERSION;
var CORE = ['suivi.html','login.html','indicateurs.html','manifest.json','icons/logo.svg','suivi.css','version.js','main.js','indicateurs.js','indicateurs-data.js','state.js','firebase.js','chart.js','stats.js','ui-supermarche.js','ui-rassemblement.js','ui-actions.js','ui-users.js','responsable-field.js','recette.js','fusion-emplacement.js'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (c) { return c.addAll(CORE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (k) {
      return Promise.all(
        k.filter(function (x) { return x !== CACHE_NAME; })
         .map(function (x) { return caches.delete(x); })
      );
    })
    .then(function () { return self.clients.claim(); })
    // ─── NOUVEAU : rechargement automatique de tous les onglets ouverts ───
    .then(function () { return self.clients.matchAll({ type: 'window', includeUncontrolled: true }); })
    .then(function (clients) {
      clients.forEach(function (client) {
        client.navigate(client.url).catch(function () {});
      });
    })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request, { cache: 'no-store' }).then(function (res) {
      var cl = res.clone();
      caches.open(CACHE_NAME).then(function (c) { c.put(e.request, cl); });
      return res;
    }).catch(function () { return caches.match(e.request); })
  );
});

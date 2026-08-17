#!/usr/bin/env python3
"""
setup-versionning.py — installe le versionning + mise à jour auto des postes.
Crée version.js, remplace sw.js, met à jour suivi.html (et login.html si présent).

Usage :
    python3 setup-versionning.py --dry     # aperçu
    python3 setup-versionning.py           # applique (+ backups)
"""
import sys, re, shutil
from pathlib import Path
from datetime import datetime, date

TS = datetime.now().strftime("%Y%m%d-%H%M%S")

def find(name):
    p = Path.cwd() / name
    if p.is_file(): return p
    f = list(Path.cwd().rglob(name))
    return f[0] if f else None

def today_version():
    d = date.today()
    return f"v{d.year}.{d.month:02d}.{d.day:02d}-1"

VERSION_JS = ("/* version.js — version de l'application (affichée + service worker) */\n"
              "/* 🔑 Gérée automatiquement par deploy.py */\n"
              "self.APP_VERSION = '{version}';\n")

SW_JS = r"""/* sw.js — Service worker : versionning, mise à jour auto, mode hors-ligne */
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
"""

NEW_HEAD_BLOCK = """<script src="version.js"></script>
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      var vEl = document.getElementById('appVersion');
      if (vEl && window.APP_VERSION) vEl.textContent = window.APP_VERSION;

      var hadController = !!navigator.serviceWorker.controller;
      var reloading = false;

      navigator.serviceWorker.register('sw.js').then(function (reg) {
        setInterval(function () { reg.update(); }, 60000);
      }).catch(function (e) { console.error('SW :', e); });

      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (!hadController || reloading) return;
        reloading = true;
        var go = function () { window.location.reload(); };
        if (typeof window.saveFirebase === 'function') {
          Promise.resolve(window.saveFirebase()).then(go).catch(go);
        } else { go(); }
      });
    });
  }
</script>"""

OLD_SUB = '<div class="subtitle">Mise à jour quotidienne</div>'
NEW_SUB = '<div class="subtitle">Mise à jour quotidienne <span id="appVersion" style="margin-left:8px;font-weight:700;color:#2563eb;"></span></div>'

def backup(p):
    b = p.parent / (p.name + '.bak-' + TS)
    shutil.copy2(p, b)
    return b.name

def replace_sw_block(html):
    idx = html.find("navigator.serviceWorker.register")
    if idx == -1: return html, False
    start = html.rfind("<script>", 0, idx)
    end = html.find("</script>", idx)
    if start == -1 or end == -1: return html, False
    end += len("</script>")
    return html[:start] + NEW_HEAD_BLOCK + html[end:], True

def main():
    dry = '--dry' in sys.argv
    version = today_version()
    if '--version' in sys.argv:
        version = sys.argv[sys.argv.index('--version') + 1]

    actions = []

    # 1) version.js
    vfile = Path.cwd() / 'version.js'
    if not vfile.exists():
        if not dry: vfile.write_text(VERSION_JS.format(version=version), encoding='utf-8')
        actions.append(f"✅ version.js créé ({version})")
    else:
        actions.append("ℹ️ version.js existe déjà (conservé)")

    # 2) sw.js
    sw = find('sw.js')
    if sw:
        c = sw.read_text(encoding='utf-8')
        if "importScripts('version.js')" not in c:
            if not dry:
                backup(sw); sw.write_text(SW_JS, encoding='utf-8')
            actions.append("✅ sw.js remplacé (network-first + versionning)")
        else:
            actions.append("ℹ️ sw.js déjà à jour")
    else:
        if not dry: (Path.cwd() / 'sw.js').write_text(SW_JS, encoding='utf-8')
        actions.append("✅ sw.js créé")

    # 3) suivi.html + login.html
    for name in ('suivi.html', 'login.html'):
        p = find(name)
        if not p: continue
        html = p.read_text(encoding='utf-8')
        changed = False
        if 'controllerchange' not in html:
            html, ok = replace_sw_block(html)
            changed = changed or ok
        if name == 'suivi.html' and 'appVersion' not in html and OLD_SUB in html:
            html = html.replace(OLD_SUB, NEW_SUB); changed = True
        if changed:
            if not dry:
                backup(p); p.write_text(html, encoding='utf-8')
            actions.append(f"✅ {name} mis à jour (SW auto-update" + (" + badge version" if name == 'suivi.html' else "") + ")")
        else:
            actions.append(f"ℹ️ {name} déjà à jour ou bloc SW introuvable")

    # 4) .gitignore : ne jamais committer les backups
    gi = Path.cwd() / '.gitignore'
    existing = gi.read_text(encoding='utf-8') if gi.exists() else ''
    if '*.bak-*' not in existing:
        if not dry:
            gi.write_text(existing + ('\n' if existing and not existing.endswith('\n') else '') + '*.bak-*\n', encoding='utf-8')
        actions.append("✅ .gitignore : backups exclus des commits")

    print("\n".join(actions))
    if dry:
        print("\n🟡 DRY-RUN : aucune modification effectuée.")
    else:
        print("\n🚀 Commit initial du système :")
        print('   git add -A && git commit -m "feat: versionning + mise à jour auto des postes" && git push origin main')

if __name__ == "__main__":
    main()
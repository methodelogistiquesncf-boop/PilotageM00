#!/usr/bin/env python3
"""
setup-versionning.py v2
- version.js + versions.json (historique des push)
- sw.js network-first (mise à jour auto des postes)
- suivi.html : la version REMPLACE "Mise à jour quotidienne",
  cliquable → modal avec le détail des push
Usage : python3 setup-versionning.py --dry | python3 setup-versionning.py
"""
import sys, re, shutil, json
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

SW_JS = r"""/* sw.js — versionning + mise à jour auto + hors-ligne */
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
      var vEl = document.getElementById('appVersionBtn');
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

VERSION_BTN = '<button class="subtitle version-link" id="appVersionBtn" onclick="openVersions()" title="Historique des versions">…</button>'

TAIL_BLOCK = """
<!-- Modal Historique des versions -->
<div class="modal-overlay" id="versionsOverlay">
  <div class="modal-box">
    <button class="close-btn" onclick="closeVersions()">&#x2715;</button>
    <h2>📦 Historique des versions</h2>
    <div id="versionsList" class="versions-list"></div>
  </div>
</div>
<style>
  .version-link { background:none; border:none; cursor:pointer; font-size:13px; color:var(--accent); font-weight:700; padding:0; font-family:inherit; }
  .version-link:hover { text-decoration:underline; }
  .versions-list { display:flex; flex-direction:column; gap:12px; max-height:60vh; overflow-y:auto; }
  .version-entry { border:1px solid var(--border); border-radius:var(--radius-md); padding:12px 16px; background:var(--surface2); }
  .version-entry.current { border-color:var(--accent); background:var(--accent-light); }
  .version-head { display:flex; align-items:center; gap:10px; margin-bottom:4px; }
  .version-tag { font-weight:700; color:var(--text); }
  .version-current { font-size:10px; font-weight:700; text-transform:uppercase; color:var(--accent); }
  .version-date { margin-left:auto; font-size:12px; color:var(--muted); }
  .version-msg { font-size:13px; color:var(--text); }
</style>
<script>
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function openVersions() {
    var hist = window.APP_HISTORY || [];
    var cur = window.APP_VERSION || 'dev';
    var list = document.getElementById('versionsList');
    if (!hist.length) {
      list.innerHTML = '<p style="color:var(--muted)">Aucun historique disponible.</p>';
    } else {
      list.innerHTML = hist.map(function (h) {
        var d = h.date ? new Date(h.date) : null;
        var ds = d ? d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
        return '<div class="version-entry' + (h.version === cur ? ' current' : '') + '">' +
          '<div class="version-head"><span class="version-tag">' + esc(h.version) + '</span>' +
          (h.version === cur ? '<span class="version-current">actuelle</span>' : '') +
          '<span class="version-date">' + ds + '</span></div>' +
          '<div class="version-msg">' + esc(h.message || '') + '</div></div>';
      }).join('');
    }
    document.getElementById('versionsOverlay').classList.add('open');
  }
  function closeVersions() { document.getElementById('versionsOverlay').classList.remove('open'); }
  document.getElementById('versionsOverlay').addEventListener('click', function (e) {
    if (e.target === this) closeVersions();
  });
</script>
"""

def backup(p):
    b = p.parent / (p.name + '.bak-' + TS)
    shutil.copy2(p, b)

def replace_head_block(html):
    reg = html.find("navigator.serviceWorker.register")
    if reg == -1:
        return html.replace('</head>', NEW_HEAD_BLOCK + '\n</head>', 1), True
    start = html.find('<script src="version.js"></script>')
    if start == -1 or start > reg:
        start = html.rfind('<script>', 0, reg)
    end = html.find('</script>', reg)
    if start == -1 or end == -1: return html, False
    return html[:start] + NEW_HEAD_BLOCK + html[end + len('</script>'):], True

def main():
    dry = '--dry' in sys.argv
    version = today_version()
    actions = []

    # 1) versions.json + version.js
    hfile = Path.cwd() / 'versions.json'
    vfile = Path.cwd() / 'version.js'
    if not hfile.exists():
        history = [{"version": version, "date": datetime.now().isoformat(timespec='seconds'),
                    "message": "Mise en place du versionning automatique"}]
        if not dry:
            hfile.write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding='utf-8')
            vfile.write_text("/* version.js — généré automatiquement par deploy.py */\n"
                             f"self.APP_VERSION = '{version}';\n"
                             "self.APP_HISTORY = " + json.dumps(history, ensure_ascii=False) + ";\n",
                             encoding='utf-8')
        actions.append(f"✅ version.js + versions.json créés ({version})")
    else:
        actions.append("ℹ️ versions.json existe déjà (conservé)")

    # 2) sw.js
    sw = find('sw.js') or (Path.cwd() / 'sw.js')
    if not sw.exists() or "importScripts('version.js')" not in sw.read_text(encoding='utf-8'):
        if not dry:
            if sw.exists(): backup(sw)
            sw.write_text(SW_JS, encoding='utf-8')
        actions.append("✅ sw.js remplacé (network-first + purge des anciens caches)")
    else:
        actions.append("ℹ️ sw.js déjà à jour")

    # 3) suivi.html
    p = find('suivi.html')
    if p:
        html = p.read_text(encoding='utf-8')
        changed = False
        if "getElementById('appVersionBtn')" not in html:
            html, ok = replace_head_block(html)
            changed = changed or ok
        if 'appVersionBtn' not in html:
            html, n = re.subn(r'<div class="subtitle">.*?</div>', VERSION_BTN, html, count=1, flags=re.DOTALL)
            changed = changed or (n > 0)
        if 'versionsOverlay' not in html:
            html = html.replace('</body>', TAIL_BLOCK + '</body>', 1)
            changed = True
        if changed:
            if not dry:
                backup(p); p.write_text(html, encoding='utf-8')
            actions.append("✅ suivi.html : version cliquable + modal historique")
        else:
            actions.append("ℹ️ suivi.html déjà à jour")

    # 4) .gitignore backups
    gi = Path.cwd() / '.gitignore'
    ex = gi.read_text(encoding='utf-8') if gi.exists() else ''
    if '*.bak-*' not in ex:
        if not dry:
            gi.write_text(ex + ('\n' if ex and not ex.endswith('\n') else '') + '*.bak-*\n', encoding='utf-8')
        actions.append("✅ .gitignore : backups exclus")

    print("\n".join(actions))
    if dry:
        print("\n🟡 DRY-RUN : aucune modification.")
    else:
        print("\n🚀 Commit initial :")
        print('   git add -A && git commit -m "feat: versionning + historique cliquable + MAJ auto" && git push origin main')
        print("\n⚠️ Une seule fois par poste : F12 → Application → Service Workers → Unregister, puis Ctrl+Shift+R")

if __name__ == "__main__":
    main()
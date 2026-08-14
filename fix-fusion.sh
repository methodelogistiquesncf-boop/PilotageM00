#!/bin/bash
# ============================================================
#  fix-fusion.sh — vérifie, répare, commit et pousse
#  Utilisation : bash fix-fusion.sh
# ============================================================
set -e

echo "🔎 1/3 — Vérification du fichier local ..."
if [ -s fusion-emplacement.js ]; then
  echo "   ✅ présent ($(wc -c < fusion-emplacement.js) octets)"
else
  echo "   ⚠️  manquant ou vide → recréation ..."
  cat > fusion-emplacement.js << 'EOF'
/* fusion-emplacement.js : champ éditable + ENGIN dans la même case */
(function () {
  'use strict';

  var style = document.createElement('style');
  style.textContent =
    '.engin-label{font-weight:700;color:#111827;margin-left:10px;' +
    'font-size:12px;text-transform:uppercase;}' +
    'td.empl-fusion{white-space:nowrap;}';
  document.head.appendChild(style);

  var LABELS = ['ENGIN', 'APPROS', 'PIECES DEPOSEES', 'PIÈCES DÉPOSÉES'];
  function norm(t) { return (t || '').trim().toUpperCase().replace(/\s+/g, ' '); }

  function isEmplRow(row) {
    if (!row.cells || row.cells.length < 2) return false;
    var firstTxt = row.cells[0].textContent.trim();
    if (!firstTxt) return false;
    if (LABELS.indexOf(norm(firstTxt)) !== -1) return false;
    for (var i = 1; i < row.cells.length; i++) {
      if (row.cells[i].textContent.trim() !== '') return false;
    }
    return true;
  }

  function processTable(table) {
    var rows = table.rows;
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (!row.cells || !row.cells[0]) continue;
      var first = row.cells[0];
      if (norm(first.textContent) !== 'ENGIN') continue;
      if (first.dataset.emplDone) continue;
      first.dataset.emplDone = '1';

      var next = rows[i + 1];
      if (!next || !isEmplRow(next)) continue;

      var src = next.cells[0];
      first.classList.add('empl-fusion');
      first.textContent = '';
      while (src.firstChild) first.appendChild(src.firstChild);

      var lbl = document.createElement('span');
      lbl.className = 'engin-label';
      lbl.textContent = 'ENGIN';
      first.appendChild(lbl);

      next.remove();
    }
  }

  function processAll() {
    var tables = document.querySelectorAll('table');
    for (var t = 0; t < tables.length; t++) processTable(tables[t]);
  }

  var timer = null;
  var obs = new MutationObserver(function () {
    if (timer) clearTimeout(timer);
    timer = setTimeout(processAll, 250);
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processAll);
  } else { processAll(); }
})();
EOF
  echo "   ✅ fichier recréé"
fi

echo "📤 2/3 — Commit + push ..."
git add fusion-emplacement.js suivi.html
git commit -m "Correctif fusion emplacement + ENGIN" || echo "   ⏭️ rien à committer"
git push

echo "🌐 3/3 — Test de mise en ligne (attend ~10 s) ..."
sleep 10
curl -s -o /dev/null -w "   HTTP %{http_code} → fusion-emplacement.js\n" \
  "https://methodelogistiquesncf-boop.github.io/PilotageM00-recette/fusion-emplacement.js"

echo ""
echo "✅ Sur suivi.html : Ctrl+Maj+R (rechargement forcé)."
echo "   Si le code HTTP n'est pas 200, attendez 1-2 min que GitHub Pages déploie."
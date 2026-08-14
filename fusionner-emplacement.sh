#!/bin/bash
# ============================================================
#  fusionner-emplacement.sh
#  ➜ Met le champ éditable "V16 P18" + le texte "ENGIN"
#    DANS LA MÊME CASE, puis supprime la ligne d'en dessous.
#  Utilisation : bash fusionner-emplacement.sh
# ============================================================
set -e

echo "🧹 Retrait de l'ancienne version (si présente) ..."
if grep -q "emplacement-colonne.js" suivi.html; then
  sed -i '/emplacement-colonne.js/d' suivi.html
  rm -f emplacement-colonne.js
  echo "   ✅ ancien script retiré"
fi

echo "🎨 1/2 — Création de fusion-emplacement.js ..."
cat > fusion-emplacement.js << 'EOF'
/* ==========================================================
   fusion-emplacement.js
   Fusionne le champ éditable "emplacement" (V16 P18…)
   avec le texte "ENGIN" dans la MÊME cellule,
   puis supprime la ligne qui restait en dessous.
   ========================================================== */
(function () {
  'use strict';

  /* ----- petit style pour la case fusionnée ----- */
  var style = document.createElement('style');
  style.textContent =
    '.engin-label{font-weight:700;color:#111827;margin-left:10px;' +
    'font-size:12px;text-transform:uppercase;}' +
    'td.empl-fusion{white-space:nowrap;}';
  document.head.appendChild(style);

  var LABELS = ['ENGIN', 'APPROS', 'PIECES DEPOSEES', 'PIÈCES DÉPOSÉES'];

  function norm(t) { return (t || '').trim().toUpperCase().replace(/\s+/g, ' '); }

  /* Ligne "emplacement" : 1ère cellule remplie, toutes les autres vides */
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

      /* Déplace le champ éditable (nœuds vivants => garde ses événements) */
      var src = next.cells[0];
      first.classList.add('empl-fusion');
      first.textContent = '';                      /* enlève le texte ENGIN seul */
      while (src.firstChild) first.appendChild(src.firstChild);

      /* Rajoute "ENGIN" en information non éditable */
      var lbl = document.createElement('span');
      lbl.className = 'engin-label';
      lbl.textContent = 'ENGIN';
      first.appendChild(lbl);

      /* Supprime la ligne qui serait restée blanche */
      next.parentNode.deleteRow(next.rowIndex);
    }
  }

  function processAll() {
    var tables = document.querySelectorAll('table');
    for (var t = 0; t < tables.length; t++) processTable(tables[t]);
  }

  /* Se ré-applique après chaque synchro / changement d'onglet */
  var timer = null;
  var obs = new MutationObserver(function () {
    if (timer) clearTimeout(timer);
    timer = setTimeout(processAll, 250);
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processAll);
  } else {
    processAll();
  }
})();
EOF
echo "   ✅ fusion-emplacement.js créé"

echo "🔗 2/2 — Ajout du <script> dans suivi.html ..."
if ! grep -q "fusion-emplacement.js" suivi.html; then
  sed -i 's|</body>|<script src="fusion-emplacement.js"></script>\n</body>|' suivi.html
  echo "   ✅ suivi.html mis à jour"
fi

echo ""
echo "🎉 Terminé ! Rechargez la page : chaque case contient"
echo "   « V16 P18  ENGIN » et la ligne blanche a disparu."
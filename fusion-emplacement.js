/* fusion-emplacement.js — v2 : gère les champs <input> */
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

  /* Texte visible d'une case, Y COMPRIS la valeur d'un champ <input> */
  function cellText(cell) {
    var t = (cell.textContent || '').trim();
    if (t) return t;
    var inp = cell.querySelector('input, textarea');
    if (inp && (inp.value || '').trim()) return inp.value.trim();
    return '';
  }

  function isEmplRow(row) {
    if (!row.cells || row.cells.length < 2) return false;
    var firstTxt = cellText(row.cells[0]);
    if (!firstTxt) return false;
    if (LABELS.indexOf(norm(firstTxt)) !== -1) return false;
    for (var i = 1; i < row.cells.length; i++) {
      if (cellText(row.cells[i]) !== '') return false;
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

      /* Déplace le champ éditable (nœud vivant => garde valeur + événements) */
      var src = next.cells[0];
      first.classList.add('empl-fusion');
      first.textContent = '';
      while (src.firstChild) first.appendChild(src.firstChild);

      /* "ENGIN" reste en information non éditable */
      var lbl = document.createElement('span');
      lbl.className = 'engin-label';
      lbl.textContent = 'ENGIN';
      first.appendChild(lbl);

      /* Supprime la ligne qui resterait blanche */
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

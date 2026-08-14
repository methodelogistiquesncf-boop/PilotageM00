/* fusion-emplacement.js — v4 : application immédiate, sans flash */
(function () {
  'use strict';

  /* ---------- Styles ---------- */
  var style = document.createElement('style');
  style.textContent =
    'td.empl-fusion{white-space:nowrap;}' +
    'td.empl-fusion input,td.empl-fusion textarea{width:90px !important;margin-right:8px;}' +
    '.station-fine{padding-top:2px !important;padding-bottom:2px !important;height:auto !important;}' +
    '.station-bleu{background:#6666ff !important;color:#ffffff !important;}' +
    '.station-jaune{background:#ffff33 !important;color:#111827 !important;}' +
    '.station-vert{background:#00a300 !important;color:#ffffff !important;}' +
    '.station-bleu,.station-jaune,.station-vert{border:1px solid #000 !important;box-shadow:0 -2px 0 0 #000 !important;}';
  document.head.appendChild(style);

  var LABELS = ['ENGIN', 'APPROS', 'PIECES DEPOSEES', 'PIÈCES DÉPOSÉES'];
  function norm(t) { return (t || '').trim().toUpperCase().replace(/\s+/g, ' '); }

  function cellText(cell) {
    var t = (cell.textContent || '').trim();
    if (t) return t;
    var inp = cell.querySelector('input, textarea');
    if (inp && (inp.value || '').trim()) return inp.value.trim();
    return '';
  }

  function isEmplRow(row) {
    if (!row.cells || row.cells.length < 2) return false;
    var f = cellText(row.cells[0]);
    if (!f) return false;
    if (LABELS.indexOf(norm(f)) !== -1) return false;
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

      /* Bandeaux stations : fins + colorés + liseré noir */
      if (row.cells.length === 1 && first.colSpan > 1) {
        var t = norm(first.textContent);
        first.classList.add('station-fine');
        if (t.indexOf('SOUS-CAISSE') !== -1) first.classList.add('station-bleu');
        if (t.indexOf('TOITURE') !== -1) first.classList.add('station-jaune');
        if (t.indexOf('TERRE-PLEIN') !== -1) first.classList.add('station-vert');
        continue;
      }

      /* Fusion champ emplacement + ENGIN dans la même case */
      if (norm(first.textContent) !== 'ENGIN') continue;
      if (row.dataset.emplDone) continue;
      var next = rows[i + 1];
      if (!next || !isEmplRow(next)) continue;
      row.dataset.emplDone = '1';
      first.classList.add('empl-fusion');
      var src = next.cells[0];
      var nodes = [];
      while (src.firstChild) nodes.push(src.removeChild(src.firstChild));
      for (var k = 0; k < nodes.length; k++) first.insertBefore(nodes[k], first.firstChild);
      next.remove();
    }
  }

  function processAll() {
    var tables = document.querySelectorAll('table');
    for (var t = 0; t < tables.length; t++) processTable(tables[t]);
  }

  /* IMMÉDIAT : appliqué avant même que l'écran ne s'affiche */
  var obs = new MutationObserver(function () { processAll(); });
  obs.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processAll);
  } else {
    processAll();
  }
})();

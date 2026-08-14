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

/* ===== Colonnes de dates élargies de 30 % ===== */
(function () {
  function widen(table) {
    if (table.dataset.wide) return;
    var r = null;
    for (var i = 0; i < table.rows.length; i++) {
      if (table.rows[i].cells.length > 2) { r = table.rows[i]; break; }
    }
    if (!r) return;

    /* 1) mesurer les largeurs actuelles */
    var w = [];
    for (var c = 0; c < r.cells.length; c++) {
      w.push(r.cells[c].getBoundingClientRect().width);
    }
    /* 2) +30 % uniquement sur les colonnes de dates (pas la 1ère colonne) */
    for (c = 1; c < r.cells.length; c++) {
      r.cells[c].style.minWidth = Math.round(w[c] * 1.3) + 'px';
    }
    table.dataset.wide = '1';
  }

  function widenAll() {
    var tables = document.querySelectorAll('table');
    for (var t = 0; t < tables.length; t++) widen(tables[t]);
  }

  var obs2 = new MutationObserver(function () { widenAll(); });
  obs2.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', widenAll);
  } else { widenAll(); }
})();

/* ===== Rassemblement : SYMBOLE +10 %, QTÉ +20 % ===== */
(function () {
  function tune(table) {
    if (table.dataset.rasTuned) return;

    /* Trouver la ligne d'en-têtes (ENGIN | KIT | SYMBOLE…) */
    var header = null;
    for (var i = 0; i < table.rows.length; i++) {
      var r = table.rows[i];
      if (!r.cells || r.cells.length < 3) continue;
      var c0 = (r.cells[0].textContent || '').trim().toUpperCase();
      var c1 = (r.cells[1].textContent || '').trim().toUpperCase();
      if (c0 === 'ENGIN' && c1.indexOf('KIT') !== -1) { header = r; break; }
    }
    if (!header) return;
    table.dataset.rasTuned = '1';

    /* Annule le +30 % générique sur ce tableau */
    for (var c = 0; c < header.cells.length; c++) header.cells[c].style.minWidth = '';

    /* Repérer les colonnes SYMBOLE et QTÉ */
    var idxSym = -1, idxQte = -1;
    for (c = 0; c < header.cells.length; c++) {
      var txt = (header.cells[c].textContent || '').trim().toUpperCase();
      if (txt.indexOf('SYMBOLE') !== -1) idxSym = c;
      if (txt.indexOf('QT') !== -1) idxQte = c;
    }

    /* Mesurer les largeurs naturelles */
    var w = [];
    for (c = 0; c < header.cells.length; c++) {
      w.push(header.cells[c].getBoundingClientRect().width);
    }

    /* Appliquer +10 % / +20 % */
    if (idxSym >= 0) header.cells[idxSym].style.minWidth = Math.round(w[idxSym] * 1.1) + 'px';
    if (idxQte >= 0) header.cells[idxQte].style.minWidth = Math.round(w[idxQte] * 1.2) + 'px';
  }

  function tuneAll() {
    var tables = document.querySelectorAll('table');
    for (var t = 0; t < tables.length; t++) tune(tables[t]);
  }

  var obs3 = new MutationObserver(function () { tuneAll(); });
  obs3.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tuneAll);
  } else { tuneAll(); }
})();

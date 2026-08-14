/* fusion-emplacement.js — v5 : gère les onglets cachés */
(function () {
  'use strict';

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

  /* ----- Fusion ENGIN + bandeaux stations ----- */
  function processTable(table) {
    var rows = table.rows;
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (!row.cells || !row.cells[0]) continue;
      var first = row.cells[0];

      if (row.cells.length === 1 && first.colSpan > 1) {
        var t = norm(first.textContent);
        first.classList.add('station-fine');
        if (t.indexOf('SOUS-CAISSE') !== -1) first.classList.add('station-bleu');
        if (t.indexOf('TOITURE') !== -1) first.classList.add('station-jaune');
        if (t.indexOf('TERRE-PLEIN') !== -1) first.classList.add('station-vert');
        continue;
      }

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

  /* ----- Largeurs des colonnes ----- */
  function firstMultiRow(table) {
    for (var i = 0; i < table.rows.length; i++) {
      if (table.rows[i].cells.length > 2) return table.rows[i];
    }
    return null;
  }

  function isDateRow(r) {
    for (var c = 0; c < r.cells.length; c++) {
      var t = (r.cells[c].textContent || '').trim();
      if (/\d{2}\/\d{2}/.test(t) || /^J-\d+$/.test(t) || /^J\d+$/.test(t)) return true;
    }
    return false;
  }

  /* Supermarché : +30 % sur les colonnes de dates seulement */
  function widenDates(table) {
    if (table.dataset.wide) return;
    var r = firstMultiRow(table);
    if (!r || !isDateRow(r)) return;
    if (r.getBoundingClientRect().width === 0) return; /* onglet caché */
    var w = [];
    for (var c = 0; c < r.cells.length; c++) w.push(r.cells[c].getBoundingClientRect().width);
    for (c = 1; c < r.cells.length; c++) r.cells[c].style.minWidth = Math.round(w[c] * 1.3) + 'px';
    table.dataset.wide = '1';
  }

  /* Rassemblement : SYMBOLE +10 %, QTÉ +20 % */
  function tuneRas(table) {
    if (table.dataset.rasTuned) return;
    var header = null;
    for (var i = 0; i < table.rows.length; i++) {
      var r = table.rows[i];
      if (!r.cells || r.cells.length < 3) continue;
      var c0 = (r.cells[0].textContent || '').trim().toUpperCase();
      var c1 = (r.cells[1].textContent || '').trim().toUpperCase();
      if (c0 === 'ENGIN' && c1.indexOf('KIT') !== -1) { header = r; break; }
    }
    if (!header) return;
    if (header.getBoundingClientRect().width === 0) return; /* onglet caché */
    var idxSym = -1, idxQte = -1, c;
    for (c = 0; c < header.cells.length; c++) {
      var txt = (header.cells[c].textContent || '').trim().toUpperCase();
      if (txt.indexOf('SYMBOLE') !== -1) idxSym = c;
      if (txt.indexOf('QT') !== -1) idxQte = c;
    }
    var w = [];
    for (c = 0; c < header.cells.length; c++) w.push(header.cells[c].getBoundingClientRect().width);
    if (idxSym >= 0) header.cells[idxSym].style.minWidth = Math.round(w[idxSym] * 1.4) + 'px';
    if (idxQte >= 0) header.cells[idxQte].style.minWidth = Math.round(w[idxQte] * 1.6) + 'px';
    table.dataset.rasTuned = '1';
  }

  function applyAll() {
    var tables = document.querySelectorAll('table');
    for (var t = 0; t < tables.length; t++) {
      processTable(tables[t]);
      widenDates(tables[t]);
      tuneRas(tables[t]);
    }
  }

  /* Surveille aussi les changements d'onglets (class "active") */
  var obs = new MutationObserver(function () { applyAll(); });
  obs.observe(document.documentElement, {
    childList: true, subtree: true,
    attributes: false
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyAll);
  } else { applyAll(); }
})();

/* ===== Largeurs Rassemblement : vérification périodique douce ===== */
(function () {
  function tune(table) {
    if (table.dataset.rasTuned) return;
    var header = null;
    for (var i = 0; i < table.rows.length; i++) {
      var r = table.rows[i];
      if (!r.cells || r.cells.length < 3) continue;
      var c0 = (r.cells[0].textContent || '').trim().toUpperCase();
      var c1 = (r.cells[1].textContent || '').trim().toUpperCase();
      if (c0 === 'ENGIN' && c1.indexOf('KIT') !== -1) { header = r; break; }
    }
    if (!header) return;
    if (header.getBoundingClientRect().width === 0) return; /* onglet caché */
    var idxSym = -1, idxQte = -1, c;
    for (c = 0; c < header.cells.length; c++) {
      var txt = (header.cells[c].textContent || '').trim().toUpperCase();
      if (txt.indexOf('SYMBOLE') !== -1) idxSym = c;
      if (txt.indexOf('QT') !== -1) idxQte = c;
    }
    var w = [];
    for (c = 0; c < header.cells.length; c++) w.push(header.cells[c].getBoundingClientRect().width);
    if (idxSym >= 0) header.cells[idxSym].style.minWidth = Math.round(w[idxSym] * 1.4) + 'px';
    if (idxQte >= 0) header.cells[idxQte].style.minWidth = Math.round(w[idxQte] * 1.6) + 'px';
    table.dataset.rasTuned = '1';
  }

  setInterval(function () {
    var tables = document.querySelectorAll('table');
    for (var t = 0; t < tables.length; t++) tune(tables[t]);
  }, 600);
})();

/* ===== Redimensionnement manuel des colonnes (glisser) + mémoire par utilisateur ===== */
(function () {
  var css = document.createElement('style');
  css.textContent =
    '.col-resize-handle{position:absolute;top:0;right:-3px;width:7px;height:100%;' +
    'cursor:col-resize;user-select:none;z-index:9;}' +
    '.col-resize-handle:hover,.col-resize-handle.active{background:rgba(0,0,0,.3);}';
  document.head.appendChild(css);

  function firstMultiRow(table) {
    for (var i = 0; i < table.rows.length; i++) {
      if (table.rows[i].cells.length > 2) return table.rows[i];
    }
    return null;
  }

  function tableKey(table) {
    var r = firstMultiRow(table);
    if (!r) return null;
    var txt = [];
    for (var c = 0; c < r.cells.length; c++) txt.push((r.cells[c].textContent || '').trim().toUpperCase());
    var j = txt.join('|');
    if (/\d{2}\/\d{2}/.test(j)) return 'cols-supermarche';
    if (j.indexOf('KIT') !== -1) return 'cols-rassemblement';
    return null;
  }

  function setColWidth(table, idx, w) {
    var cols = table.querySelectorAll('col');
    if (cols.length > idx) cols[idx].style.width = w + 'px';
    var r = firstMultiRow(table);
    if (r && r.cells[idx]) {
      r.cells[idx].style.width = w + 'px';
      r.cells[idx].style.minWidth = w + 'px';
    }
  }

  function restore(table) {
    var key = tableKey(table);
    if (!key) return;
    try {
      var saved = localStorage.getItem(key);
      if (!saved) return;
      var widths = JSON.parse(saved);
      for (var c = 0; c < widths.length; c++) {
        if (widths[c] > 30) setColWidth(table, c, widths[c]);
      }
    } catch (e) {}
  }

  function save(table) {
    var key = tableKey(table);
    var r = firstMultiRow(table);
    if (!key || !r) return;
    try {
      var widths = [];
      for (var c = 0; c < r.cells.length; c++) {
        widths.push(Math.round(r.cells[c].getBoundingClientRect().width));
      }
      localStorage.setItem(key, JSON.stringify(widths));
    } catch (e) {}
  }

  function makeResizable(table) {
    if (table.dataset.resizable) return;
    var r = firstMultiRow(table);
    if (!r) return;
    if (r.getBoundingClientRect().width === 0) return; /* onglet caché */
    table.dataset.resizable = '1';
    restore(table);

    Array.prototype.forEach.call(r.cells, function (cell, idx) {
      cell.style.position = 'relative';
      var h = document.createElement('div');
      h.className = 'col-resize-handle';
      cell.appendChild(h);
      h.addEventListener('mousedown', function (e) {
        e.preventDefault(); e.stopPropagation();
        h.classList.add('active');
        var startX = e.pageX;
        var startW = cell.getBoundingClientRect().width;
        function move(ev) {
          var w = Math.max(40, startW + (ev.pageX - startX));
          setColWidth(table, idx, w);
        }
        function up() {
          h.classList.remove('active');
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', up);
          save(table);
        }
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      });
    });
  }

  function run() {
    var tables = document.querySelectorAll('table');
    for (var t = 0; t < tables.length; t++) makeResizable(tables[t]);
  }
  setInterval(run, 800);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();

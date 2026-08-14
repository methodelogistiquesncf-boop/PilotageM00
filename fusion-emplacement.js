/* fusion-emplacement.js — v6 : resize uniquement RAS + jamais hors de la carte */
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
    '.station-bleu,.station-jaune,.station-vert{border:1px solid #000 !important;box-shadow:0 -2px 0 0 #000 !important;}' +
    '.col-resize-handle{position:absolute;top:0;right:-3px;width:7px;height:100%;cursor:col-resize;user-select:none;z-index:9;}' +
    '.col-resize-handle:hover,.col-resize-handle.active{background:rgba(0,0,0,.3);}';
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

  function isRasTable(table) {
    var r = firstMultiRow(table);
    if (!r || r.cells.length < 2) return false;
    return (r.cells[0].textContent || '').trim().toUpperCase() === 'ENGIN' &&
           (r.cells[1].textContent || '').trim().toUpperCase().indexOf('KIT') !== -1;
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

  /* ----- Supermarché : +30 % sur les colonnes de dates ----- */
  function widenDates(table) {
    if (table.dataset.wide) return;
    var r = firstMultiRow(table);
    if (!r || !isDateRow(r)) return;
    if (r.getBoundingClientRect().width === 0) return;
    var w = [];
    for (var c = 0; c < r.cells.length; c++) w.push(r.cells[c].getBoundingClientRect().width);
    for (c = 1; c < r.cells.length; c++) r.cells[c].style.minWidth = Math.round(w[c] * 1.3) + 'px';
    table.dataset.wide = '1';
  }

  /* ----- Largeur disponible dans la carte ----- */
  function availWidth(table) {
    var el = table.parentElement;
    if (!el) return 10000;
    var cs = getComputedStyle(el);
    var pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    return el.clientWidth - pad;
  }

  function setRasColWidth(table, idx, w) {
    var cols = table.querySelectorAll('col');
    if (cols.length > idx) cols[idx].style.width = (w === '' ? '' : w + 'px');
    var r = firstMultiRow(table);
    if (r && r.cells[idx]) {
      r.cells[idx].style.width = (w === '' ? '' : w + 'px');
      r.cells[idx].style.minWidth = (w === '' ? '' : w + 'px');
    }
  }

  function clearRasWidths(table) {
    var r = firstMultiRow(table);
    var cols = table.querySelectorAll('col');
    for (var c = 0; c < cols.length; c++) cols[c].style.width = '';
    if (r) for (c = 0; c < r.cells.length; c++) {
      r.cells[c].style.width = '';
      r.cells[c].style.minWidth = '';
    }
  }

  function restoreRas(table) {
    try {
      var saved = localStorage.getItem('cols-rassemblement');
      if (!saved) return false;
      var widths = JSON.parse(saved);
      var r = firstMultiRow(table);
      if (!r) return false;
      for (var c = 0; c < widths.length && c < r.cells.length; c++) {
        if (widths[c] > 30) setRasColWidth(table, c, widths[c]);
      }
      /* petit écran : si ça déborde de la carte, on revient à l'auto */
      if (table.getBoundingClientRect().width > availWidth(table) + 4) {
        clearRasWidths(table);
        return false;
      }
      return true;
    } catch (e) { return false; }
  }

  function saveRas(table) {
    var r = firstMultiRow(table);
    if (!r) return;
    try {
      var widths = [];
      for (var c = 0; c < r.cells.length; c++) {
        widths.push(Math.round(r.cells[c].getBoundingClientRect().width));
      }
      localStorage.setItem('cols-rassemblement', JSON.stringify(widths));
    } catch (e) {}
  }

  /* ----- Poignées de resize : RASSEMBLEMENT uniquement ----- */
  function makeResizable(table) {
    if (table.dataset.resizable) return;
    if (!isRasTable(table)) return;               /* PAS sur Supermarché */
    var r = firstMultiRow(table);
    if (!r) return;
    if (r.getBoundingClientRect().width === 0) return;
    table.dataset.resizable = '1';
    restoreRas(table);

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
        var avail = availWidth(table);
        function move(ev) {
          var w = Math.max(40, startW + (ev.pageX - startX));
          var projected = table.getBoundingClientRect().width - startW + w;
          if (projected > avail) w = Math.max(40, w - (projected - avail)); /* bloqué au bord de la carte */
          setRasColWidth(table, idx, w);
        }
        function up() {
          h.classList.remove('active');
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', up);
          saveRas(table);
        }
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      });
    });
  }

  function applyAll() {
    var tables = document.querySelectorAll('table');
    for (var t = 0; t < tables.length; t++) {
      processTable(tables[t]);
      widenDates(tables[t]);
      makeResizable(tables[t]);
    }
  }

  var obs = new MutationObserver(function () { applyAll(); });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(applyAll, 800); /* pour les onglets cachés */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyAll);
  } else { applyAll(); }
})();

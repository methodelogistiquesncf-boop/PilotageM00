/* fusion-emplacement.js — v7 : plus de rétrécissement au clic */
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

  /* ----- Supermarché : +30 % mémorisé, réappliqué après chaque reconstruction ----- */
  function widenDates(table) {
    var r = firstMultiRow(table);
    if (!r || !isDateRow(r)) return;
    if (r.getBoundingClientRect().width === 0) return;
    if (!table.dataset.baseW) {
      var w = [];
      for (var c = 0; c < r.cells.length; c++) w.push(Math.round(r.cells[c].getBoundingClientRect().width));
      table.dataset.baseW = JSON.stringify(w);
    }
    var base = JSON.parse(table.dataset.baseW);
    for (c = 1; c < r.cells.length && c < base.length; c++) {
      var target = Math.round(base[c] * 1.3) + 'px';
      if (r.cells[c].style.minWidth !== target) r.cells[c].style.minWidth = target;
    }
  }

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

  function makeResizable(table) {
    if (table.dataset.resizable) return;
    if (!isRasTable(table)) return;
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
          if (projected > avail) w = Math.max(40, w - (projected - avail));
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
      /* Rassemblement : réapplique les tailles mémorisées si l'appli a reconstruit */
      if (tables[t].dataset.resizable) {
        var rr = firstMultiRow(tables[t]);
        if (rr && rr.cells[0] && rr.cells[0].style.width === '') restoreRas(tables[t]);
      }
    }
  }

  var obs = new MutationObserver(function () { applyAll(); });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(applyAll, 800);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyAll);
  } else { applyAll(); }
})();

/* ===== Actions : ACTION renommée KIT + nouvelle colonne SYMBOLE ===== */
(function () {
  function findActionHeader(table) {
    for (var i = 0; i < table.rows.length; i++) {
      var r = table.rows[i];
      for (var c = 0; c < r.cells.length; c++) {
        var t = (r.cells[c].textContent || '').trim().toUpperCase();
        if (t === 'ACTION' || t === 'ACTIONS') return { row: r, idx: c };
      }
    }
    return null;
  }

  function hasSymbole(table) {
    for (var i = 0; i < table.rows.length; i++) {
      var r = table.rows[i];
      for (var c = 0; c < r.cells.length; c++) {
        if ((r.cells[c].textContent || '').trim().toUpperCase() === 'SYMBOLE') return true;
      }
    }
    return false;
  }

  function fixTable(table) {
    var h = findActionHeader(table);
    if (!h) return;                /* pas de colonne ACTION (ou déjà transformé) */
    if (hasSymbole(table)) return; /* sécurité */

    /* 1) Renomme ACTION -> KIT */
    h.row.cells[h.idx].textContent = 'KIT';

    /* 2) Insère l'en-tête SYMBOLE juste à côté */
    var ref = h.row.cells[h.idx];
    var newH;
    if (ref.tagName === 'TH') {
      newH = document.createElement('th');
      newH.textContent = 'SYMBOLE';
      if (ref.nextSibling) ref.parentNode.insertBefore(newH, ref.nextSibling);
      else ref.parentNode.appendChild(newH);
    } else {
      newH = h.row.insertCell(h.idx + 1);
      newH.textContent = 'SYMBOLE';
    }
    newH.className = ref.className;

    /* 3) Ajoute une cellule vide à toutes les autres lignes (alignement) */
    for (var i = 0; i < table.rows.length; i++) {
      var r = table.rows[i];
      if (r === h.row) continue;
      if (r.cells.length === 1 && r.cells[0].colSpan > 1) { r.cells[0].colSpan += 1; continue; }
      if (r.cells.length < h.row.cells.length) {
        var nc = r.insertCell(Math.min(h.idx + 1, r.cells.length));
        nc.className = (r.cells[h.idx] ? r.cells[h.idx].className : '');
      }
    }
  }

  function run() {
    var tables = document.querySelectorAll('table');
    for (var t = 0; t < tables.length; t++) fixTable(tables[t]);
  }

  var obs4 = new MutationObserver(function () { run(); });
  obs4.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(run, 800);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();

/* ===== Supermarché : + ligne = KIT + SYMBOLE (sans remarque), envoi vers Actions ===== */
(function () {
  var css = document.createElement('style');
  css.textContent =
    '.kit-field,.sym-field{display:block;width:110px;margin:0 0 4px;padding:2px 6px;' +
    'font-size:12px;border:1px solid #bbb;border-radius:4px;}';
  document.head.appendChild(css);

  /* 1) Remplace visuellement la remarque par KIT + SYMBOLE */
  function enhanceLines() {
    var tas = document.querySelectorAll('#panelSuivi table textarea');
    for (var i = 0; i < tas.length; i++) {
      var ta = tas[i];
      if (ta.dataset.kitDone) continue;
      ta.dataset.kitDone = '1';
      var kit = document.createElement('input');
      kit.className = 'kit-field'; kit.placeholder = 'KIT';
      var sym = document.createElement('input');
      sym.className = 'sym-field'; sym.placeholder = 'SYMBOLE';
      ta.parentNode.insertBefore(kit, ta);
      ta.parentNode.insertBefore(sym, ta);
      ta.style.display = 'none'; /* remarque masquée */
    }
  }

  /* 2) À l'appui sur la flèche : met KIT§§SYMBOLE dans le transport caché */
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('button') : null;
    if (!btn || (btn.textContent || '').indexOf('→') === -1) return;
    var node = btn.parentElement, found = null;
    while (node && node.tagName !== 'TD' && node.tagName !== 'TABLE') {
      if (node.querySelector('textarea') && node.querySelector('.kit-field')) { found = node; break; }
      node = node.parentElement;
    }
    if (!found) return;
    var ta = found.querySelector('textarea');
    var kit = found.querySelector('.kit-field');
    var sym = found.querySelector('.sym-field');
    ta.value = (kit ? kit.value : '') + '§§' + (sym ? sym.value : '');
    try { ta.dispatchEvent(new Event('input', { bubbles: true })); } catch (err) {}
  }, true);

  /* 3) Dans Actions : éclate le transport vers les colonnes KIT et SYMBOLE */
  function setCell(row, idx, value) {
    var cell = row.cells[idx];
    if (!cell) return;
    var inp = cell.querySelector('input, textarea');
    if (inp) {
      inp.value = value;
      try { inp.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    } else {
      cell.textContent = value;
    }
  }

  function fixActionsRows() {
    var tables = document.querySelectorAll('table');
    for (var t = 0; t < tables.length; t++) {
      var table = tables[t];
      var idxKit = -1, idxSym = -1;
      for (var i = 0; i < table.rows.length; i++) {
        var r = table.rows[i];
        for (var c = 0; c < r.cells.length; c++) {
          var txt = (r.cells[c].textContent || '').trim().toUpperCase();
          if (txt === 'KIT') idxKit = c;
          if (txt === 'SYMBOLE') idxSym = c;
        }
        if (idxKit !== -1) break;
      }
      if (idxKit === -1 || idxSym === -1) continue;

      for (i = 0; i < table.rows.length; i++) {
        var row = table.rows[i];
        if (row.dataset.payloadDone) continue;
        for (c = 0; c < row.cells.length; c++) {
          var cell = row.cells[c];
          var inp = cell.querySelector('input, textarea');
          var val = inp ? inp.value : cell.textContent;
          if ((val || '').indexOf('§§') === -1) continue;
          var parts = (val || '').split('§§');
          setCell(row, idxKit, parts[0] || '');
          setCell(row, idxSym, parts.slice(1).join('') || '');
          if (inp) inp.value = ''; else cell.textContent = '';
          row.dataset.payloadDone = '1';
          break;
        }
      }
    }
  }

  function run() { enhanceLines(); fixActionsRows(); }
  var obs5 = new MutationObserver(function () { run(); });
  obs5.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(run, 800);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();


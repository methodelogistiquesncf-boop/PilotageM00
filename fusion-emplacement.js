/* fusion-emplacement.js — v9 : resize Rassemblement sans débordement + message d'aide */
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
    '.col-resize-handle:hover,.col-resize-handle.active{background:rgba(0,0,0,.3);}' +
    '.ras-resize-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(8px);' +
    'background:#111827;color:#fff;font-size:12px;font-weight:600;padding:8px 16px;border-radius:20px;' +
    'opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.25);}' +
    '.ras-resize-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}';
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

  /* ----- Message d'aide (toast) ----- */
  var toastEl = null, toastTimer = null;
  function showToast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'ras-resize-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2000);
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
    table.style.width = '';
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

  function restoreRas(table) {
    try {
      var savedRaw = localStorage.getItem('cols-rassemblement');
      if (!savedRaw) return false;
      var saved = JSON.parse(savedRaw);
      var widths = Array.isArray(saved) ? saved : (saved.cols || []);
      var r = firstMultiRow(table);
      if (!r) return false;
      for (var c = 0; c < widths.length && c < r.cells.length; c++) {
        if (widths[c] > 30) setRasColWidth(table, c, widths[c]);
      }
      return true;
    } catch (e) { return false; }
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
        var warned = false;
        function move(ev) {
          var w = Math.max(40, startW + (ev.pageX - startX));
          setRasColWidth(table, idx, w);
          /* 🔑 v9 : si le tableau déborde du conteneur, on rétrécit au max possible */
          var tw = table.getBoundingClientRect().width;
          if (tw > avail + 2) {
            w = Math.max(40, w - (tw - avail));
            setRasColWidth(table, idx, w);
            if (!warned) {
              warned = true;
              showToast('⚠️ Place maximale atteinte — réduisez d\u2019autres colonnes pour agrandir celle-ci');
            }
          }
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

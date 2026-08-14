/* fusion-emplacement.js — v3 */
(function () {
  'use strict';

  var style = document.createElement('style');
  style.textContent =
    'td.empl-fusion{white-space:nowrap;}' +
    'td.empl-fusion input,td.empl-fusion textarea{width:90px !important;margin-right:8px;}' ;
  document.head.appendChild(style);

  var LABELS = ['ENGIN', 'APPROS', 'PIECES DEPOSEES', 'PIÈCES DÉPOSÉES'];
  function norm(t) { return (t || '').trim().toUpperCase().replace(/\s+/g, ' '); }

  /* Texte visible d'une case, y compris la valeur d'un <input> */
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
      if (norm(first.textContent) !== 'ENGIN') continue;
      if (row.dataset.emplDone) continue;
      var next = rows[i + 1];
      if (!next || !isEmplRow(next)) continue;

      row.dataset.emplDone = '1';
      first.classList.add('empl-fusion');

      /* Déplace le champ éditable AVANT le texte ENGIN (même case) */
      var src = next.cells[0];
      var nodes = [];
      while (src.firstChild) nodes.push(src.removeChild(src.firstChild));
      for (var k = 0; k < nodes.length; k++) {
        first.insertBefore(nodes[k], first.firstChild);
      }

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

/* ===== Bandeau station plus fin ===== */
(function () {
  var st = document.createElement('style');
  st.textContent = '.station-fine{padding-top:2px !important;padding-bottom:2px !important;height:auto !important;}';
  document.head.appendChild(st);

  function tag() {
    document.querySelectorAll('table').forEach(function (tb) {
      Array.prototype.forEach.call(tb.rows, function (r) {
        if (r.cells.length === 1 && r.cells[0].colSpan > 1) {
          r.cells[0].classList.add('station-fine');
        }
      });
    });
  }

  var t = null;
  var obs = new MutationObserver(function () {
    if (t) clearTimeout(t);
    t = setTimeout(tag, 250);
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  tag();
})();

/* ===== Bandeau Terre-plein en vert ===== */
(function () {
  var st = document.createElement('style');
  st.textContent = '.station-vert{background:#00a300 !important;color:#ffffff !important;}';
  document.head.appendChild(st);

  function tag() {
    document.querySelectorAll('table').forEach(function (tb) {
      Array.prototype.forEach.call(tb.rows, function (r) {
        if (r.cells.length === 1 && r.cells[0].colSpan > 1) {
          var t = (r.cells[0].textContent || '').toUpperCase();
          if (t.indexOf('TERRE-PLEIN') !== -1) {
            r.cells[0].classList.add('station-vert');
          }
        }
      });
    });
  }

  var t = null;
  var obs = new MutationObserver(function () {
    if (t) clearTimeout(t);
    t = setTimeout(tag, 250);
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  tag();
})();

/* ===== Bandeaux : Sous-caisse bleu, Toiture jaune ===== */
(function () {
  var st = document.createElement('style');
  st.textContent =
    '.station-bleu{background:#6666ff !important;color:#ffffff !important;}' +
    '.station-jaune{background:#ffff33 !important;color:#111827 !important;}';
  document.head.appendChild(st);

  function tag() {
    document.querySelectorAll('table').forEach(function (tb) {
      Array.prototype.forEach.call(tb.rows, function (r) {
        if (r.cells.length === 1 && r.cells[0].colSpan > 1) {
          var t = (r.cells[0].textContent || '').toUpperCase();
          if (t.indexOf('SOUS-CAISSE') !== -1) r.cells[0].classList.add('station-bleu');
          if (t.indexOf('TOITURE') !== -1) r.cells[0].classList.add('station-jaune');
        }
      });
    });
  }

  var t = null;
  var obs = new MutationObserver(function () {
    if (t) clearTimeout(t);
    t = setTimeout(tag, 250);
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  tag();
})();

/* ===== Bordures des bandeaux stations ===== */
(function () {
  var st = document.createElement('style');
  st.textContent =
    '.station-bleu{border:1px solid #000000 !important;}' +
    '.station-jaune{border:1px solid #000000 !important;}' +
    '.station-vert{border:1px solid #000000 !important;}';
  document.head.appendChild(st);
})();

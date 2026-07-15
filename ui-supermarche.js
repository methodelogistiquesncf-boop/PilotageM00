// ui-supermarche.js — onglet "Supermarché" : tableau principal, colonnes de synthèse,
// export CSV et modal Historique.

import {
  state, ENGINS_CONFIG, D_FIXED, isoToDisplay, autoResize,
  makeSynthColData, initState, markDirty
} from './state.js';
import { sendToAction } from './ui-actions.js';

export function build() {
  buildHeader();
  buildBody();
}

function buildHeader() {
  var row = document.getElementById('headerRow');
  while (row.children.length > 1) row.removeChild(row.lastChild);

  for (var d = 0; d < D_FIXED; d++) {
    var th = document.createElement('th');
    th.className = 'th-top';

    var display = document.createElement('span');
    display.className = 'th-date-display';
    display.textContent = isoToDisplay(state.headersData.dates[d]) || '—/—';

    var picker = document.createElement('input');
    picker.type = 'date';
    picker.className = 'th-date-picker';
    picker.value = state.headersData.dates[d] || '';

    (function (sp, pk, idx) {
      sp.onclick = function () {
        pk.classList.add('visible');
        pk.focus();
        try { pk.showPicker && pk.showPicker(); } catch (e) {}
      };
      pk.onchange = function () {
        state.headersData.dates[idx] = pk.value;
        sp.textContent = isoToDisplay(pk.value) || '—/—';
        pk.classList.remove('visible');
        markDirty();
      };
      pk.onblur = function () { pk.classList.remove('visible'); };
    })(display, picker, d);

    th.appendChild(display);
    th.appendChild(picker);
    th.appendChild(makeInput('th-header-input th-j', state.headersData.jours[d], 'Jour', makeJourUpdater(d)));
    row.appendChild(th);
  }

  state.synthCols.forEach(function (col) {
    var th = document.createElement('th');
    th.className = 'th-top synth-col';

    var display = document.createElement('span');
    display.className = 'th-date-display';
    display.textContent = isoToDisplay(col.date) || col.date || '—/—';

    var picker = document.createElement('input');
    picker.type = 'date';
    picker.className = 'th-date-picker';
    picker.value = col.date || '';

    (function (sp, pk, c) {
      sp.onclick = function () {
        pk.classList.add('visible');
        pk.focus();
        try { pk.showPicker && pk.showPicker(); } catch (e) {}
      };
      pk.onchange = function () {
        c.date = pk.value;
        sp.textContent = isoToDisplay(pk.value) || '—/—';
        pk.classList.remove('visible');
        markDirty();
      };
      pk.onblur = function () { pk.classList.remove('visible'); };
    })(display, picker, col);

    th.appendChild(display);
    th.appendChild(picker);
    th.appendChild(makeInput('th-header-input th-j', col.jour, 'Jour', function (v) { col.jour = v; markDirty(); }));

    var delBtn = document.createElement('button');
    delBtn.className = 'btn-del-col';
    delBtn.textContent = '✕ Supprimer';
    (function (c) {
      delBtn.onclick = function () {
        state.synthCols = state.synthCols.filter(function (x) { return x.id !== c.id; });
        build();
        markDirty();
      };
    })(col);
    th.appendChild(delBtn);
    row.appendChild(th);
  });
}

function makeInput(cls, val, placeholder, onInput) {
  var inp = document.createElement('input');
  inp.type = 'text'; inp.className = cls; inp.placeholder = placeholder; inp.value = val || '';
  inp.oninput = function (e) { onInput(e.target.value); };
  return inp;
}
function makeJourUpdater(idx) { return function (v) { state.headersData.jours[idx] = v; markDirty(); }; }

function buildBody() {
  var tb = document.getElementById('tbody');
  tb.innerHTML = '';
  ENGINS_CONFIG.forEach(function (e) {
    var rEngin = document.createElement('tr'); rEngin.className = 'row-engin';
    var tdLbl = document.createElement('td'); tdLbl.textContent = 'ENGIN'; rEngin.appendChild(tdLbl);
    for (var d = 0; d < D_FIXED; d++) {
      var td = document.createElement('td'); td.className = 'loco-cell';
      td.appendChild(makeLoco_fixed(e.id, state.colOrder[d])); rEngin.appendChild(td);
    }
    state.synthCols.forEach(function (col) {
      var td = document.createElement('td'); td.className = 'loco-cell'; td.style.background = '#d4dff0';
      td.appendChild(makeLoco_synth(col, e.id)); rEngin.appendChild(td);
    });
    tb.appendChild(rEngin);

    var rTitle = document.createElement('tr'); rTitle.className = 'row-label';
    var tdT = document.createElement('td'); tdT.className = 'label';
    tdT.appendChild(makeEnginLabelInput(e.id)); rTitle.appendChild(tdT);
    for (var d2 = 0; d2 < D_FIXED; d2++) { var td2 = document.createElement('td'); td2.className = 'data-cell'; rTitle.appendChild(td2); }
    state.synthCols.forEach(function () { var td = document.createElement('td'); td.className = 'data-cell synth-cell'; rTitle.appendChild(td); });
    tb.appendChild(rTitle);

    e.sections.forEach(function (s) {
      var rNote = document.createElement('tr'); rNote.className = 'row-label';
      var tdSL = document.createElement('td'); tdSL.className = 'label'; tdSL.textContent = s; rNote.appendChild(tdSL);
      for (var d3 = 0; d3 < D_FIXED; d3++) {
        var td3 = document.createElement('td'); td3.className = 'data-cell';
        td3.appendChild(makeNoteList_fixed(e.id, s, state.colOrder[d3], d3)); rNote.appendChild(td3);
      }
      state.synthCols.forEach(function (col) {
        var td = document.createElement('td'); td.className = 'data-cell synth-cell';
        td.appendChild(makeNoteList_synth(col, e.id, s)); rNote.appendChild(td);
      });
      tb.appendChild(rNote);

      var rScore = document.createElement('tr'); rScore.className = 'row-score';
      var tdSS = document.createElement('td'); tdSS.className = 'label'; rScore.appendChild(tdSS);
      for (var d4 = 0; d4 < D_FIXED; d4++) {
        var td4 = document.createElement('td');
        td4.appendChild(makeScoreInner_fixed(e.id, s, state.colOrder[d4], d4)); rScore.appendChild(td4);
      }
      state.synthCols.forEach(function (col) {
        var td = document.createElement('td'); td.className = 'synth-cell';
        td.appendChild(makeScoreInner_synth(col, e.id, s)); rScore.appendChild(td);
      });
      tb.appendChild(rScore);
    });
  });
}

// ─── Helpers DOM : colonne "fixe" vs colonne "synthèse" ───────────────────
// Les paires *_fixed / *_synth partagent la même logique, seule la source de
// données change. Gardées séparées (plutôt qu'un accessor générique unique)
// pour rester proche du comportement d'origine — à fusionner dans une passe
// suivante si besoin (ex: un helper prenant {get,set} en paramètre).

function makeLoco_fixed(eid, p) {
  var inp = document.createElement('input');
  inp.className = 'loco'; inp.type = 'text'; inp.placeholder = 'N° engin...'; inp.value = state.S[eid].loco[p];
  (function (ei, pi) { inp.oninput = function () { state.S[ei].loco[pi] = inp.value; markDirty(); }; })(eid, p);
  return inp;
}
function makeLoco_synth(col, eid) {
  var inp = document.createElement('input');
  inp.className = 'loco'; inp.type = 'text'; inp.placeholder = 'N° engin...'; inp.value = col.enginData[eid].loco;
  inp.oninput = function () { col.enginData[eid].loco = inp.value; markDirty(); };
  return inp;
}
// ─── Notes : liste de lignes éditables ─────────────────────────────────────
// Chaque cellule de remarque contient désormais une petite liste de lignes
// (au lieu d'un textarea unique), pour que chaque sujet distinct puisse être
// envoyé individuellement vers Actions. Les anciennes notes (simple texte)
// sont migrées en place vers une liste à une seule ligne, sans être découpées.
function genId() { return 'ni_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6); }

function ensureNoteItems(obj) {
  if (!Array.isArray(obj.note)) {
    var txt = obj.note;
    obj.note = (txt && String(txt).trim()) ? [{ id: genId(), texte: String(txt) }] : [];
  }
  return obj.note;
}

function noteToText(noteVal) {
  if (Array.isArray(noteVal)) return noteVal.map(function (it) { return (it.texte || '').trim(); }).filter(Boolean).join(' | ');
  return noteVal || '';
}

function noteToActionText(noteVal) {
  var items = Array.isArray(noteVal) ? noteVal : [];
  return items.map(function (it) { return (it.texte || '').trim(); }).filter(Boolean).join('\n');
}

// container : liste de lignes ; onDelete supprime l'item ; getMeta() renvoie
// à l'instant T {engin, poste, date, jour} pour cette colonne (fonction, pas
// valeur figée, pour rester à jour si le n° d'engin est modifié après coup).
function buildNoteItemEl(item, onDelete, getMeta, section) {
  var row = document.createElement('div');
  row.className = 'note-item';

  var ta = document.createElement('textarea');
  ta.className = 'note-line';
  ta.placeholder = 'Remarque...';
  ta.value = item.texte || '';
  ta.oninput = function () { item.texte = ta.value; autoResize(ta); markDirty(); };
  requestAnimationFrame(function () { autoResize(ta); });
  row.appendChild(ta);

  var actions = document.createElement('div');
  actions.className = 'note-item-actions';

  var sendBtn = document.createElement('button');
  sendBtn.type = 'button'; sendBtn.className = 'note-send-btn'; sendBtn.textContent = '→';
  sendBtn.title = 'Envoyer cette ligne vers Actions';
  sendBtn.onclick = function () {
    var meta = getMeta();
    sendToAction({ engin: meta.engin, poste: meta.poste, section: section, date: meta.date, jour: meta.jour, texte: item.texte || '' });
  };
  actions.appendChild(sendBtn);

  var delBtn = document.createElement('button');
  delBtn.type = 'button'; delBtn.className = 'note-del-btn'; delBtn.textContent = '✕';
  delBtn.title = 'Supprimer cette ligne';
  delBtn.onclick = onDelete;
  actions.appendChild(delBtn);

  row.appendChild(actions);
  return row;
}

function buildNoteList(items, getMeta, section) {
  var container = document.createElement('div');
  container.className = 'note-list';

  function render() {
    container.innerHTML = '';
    items.forEach(function (item, idx) {
      container.appendChild(buildNoteItemEl(item, function () {
        items.splice(idx, 1); markDirty(); render();
      }, getMeta, section));
    });
    var addBtn = document.createElement('button');
    addBtn.type = 'button'; addBtn.className = 'btn-add-line';
    addBtn.textContent = '+ ligne';
    addBtn.onclick = function () {
      items.push({ id: genId(), texte: '' });
      markDirty(); render();
      var tas = container.querySelectorAll('textarea.note-line');
      if (tas.length) tas[tas.length - 1].focus();
    };
    container.appendChild(addBtn);
  }
  render();
  return container;
}

function makeNoteList_fixed(eid, s, p, d) {
  var obj = state.S[eid][s][p];
  var items = ensureNoteItems(obj);
  return buildNoteList(items, function () { return actionMetaFixed(eid, p, d); }, s);
}
function makeNoteList_synth(col, eid, s) {
  var obj = col.enginData[eid][s];
  var items = ensureNoteItems(obj);
  return buildNoteList(items, function () { return actionMetaSynth(col, eid); }, s);
}
function makeEnginLabelInput(eid) {
  var inp = document.createElement('input');
  inp.className = 'engin-label-input'; inp.type = 'text'; inp.value = state.enginLabels[eid] || '';
  inp.oninput = function () { state.enginLabels[eid] = inp.value; markDirty(); };
  return inp;
}
function makeDot(getVal, setVal, color) {
  var btn = document.createElement('button');
  btn.className = 'dot-btn ' + (getVal() === color ? color : 'off');
  btn.title = color === 'green' ? 'OK' : 'NOK';
  btn.setAttribute('aria-label', color === 'green' ? 'OK' : 'NOK');
  btn.onclick = function () { setVal(getVal() === color ? null : color); build(); markDirty(); };
  return btn;
}
function enginLabelOf(eid) {
  var cfg = ENGINS_CONFIG.find(function (c) { return c.id === eid; });
  return state.enginLabels[eid] || (cfg ? cfg.defaultLabel : eid);
}
function actionMetaFixed(eid, p, d) {
  return {
    engin: state.S[eid].loco[p] || enginLabelOf(eid),
    poste: enginLabelOf(eid),
    date: isoToDisplay(state.headersData.dates[d]) || '',
    jour: state.headersData.jours[d] || ''
  };
}
function actionMetaSynth(col, eid) {
  return {
    engin: col.enginData[eid].loco || enginLabelOf(eid),
    poste: enginLabelOf(eid),
    date: isoToDisplay(col.date) || '',
    jour: col.jour || ''
  };
}

// Bouton "→" au niveau de la cellule score : envoie TOUTES les lignes de
// remarque de la cellule d'un coup (une par ligne, jointes). Complète les
// boutons "→" individuels de chaque ligne de remarque.
function makeActionBtn(getDot, getData) {
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-action' + (getDot() === 'red' ? ' alert' : '');
  btn.textContent = '→';
  btn.title = 'Envoyer toutes les lignes vers Actions';
  btn.onclick = function (e) { e.stopPropagation(); sendToAction(getData()); };
  return btn;
}

function makeScoreInner_fixed(eid, s, p, d) {
  var inner = document.createElement('div'); inner.className = 'score-inner';
  (function (ei, si, pi, di) {
    inner.appendChild(makeDot(function () { return state.S[ei][si][pi].dot; }, function (v) { state.S[ei][si][pi].dot = v; }, 'green'));
    inner.appendChild(makeDot(function () { return state.S[ei][si][pi].dot; }, function (v) { state.S[ei][si][pi].dot = v; }, 'red'));
    var inp = document.createElement('input');
    inp.className = 'score'; inp.type = 'text'; inp.placeholder = '0/0'; inp.value = state.S[ei][si][pi].score;
    inp.oninput = function () { state.S[ei][si][pi].score = inp.value; markDirty(); };
    inner.appendChild(inp);
    inner.appendChild(makeActionBtn(
      function () { return state.S[ei][si][pi].dot; },
      function () {
        var meta = actionMetaFixed(ei, pi, di);
        return {
          engin: meta.engin,
          poste: meta.poste,
          section: si,
          date: meta.date,
          jour: meta.jour,
          texte: noteToActionText(ensureNoteItems(state.S[ei][si][pi]))
        };
      }
    ));
  })(eid, s, p, d);
  return inner;
}
function makeScoreInner_synth(col, eid, s) {
  var data = col.enginData[eid][s];
  var inner = document.createElement('div'); inner.className = 'score-inner';
  inner.appendChild(makeDot(function () { return data.dot; }, function (v) { data.dot = v; }, 'green'));
  inner.appendChild(makeDot(function () { return data.dot; }, function (v) { data.dot = v; }, 'red'));
  var inp = document.createElement('input');
  inp.className = 'score'; inp.type = 'text'; inp.placeholder = '0/0'; inp.value = data.score;
  inp.oninput = function () { data.score = inp.value; markDirty(); };
  inner.appendChild(inp);
  inner.appendChild(makeActionBtn(
    function () { return data.dot; },
    function () {
      var meta = actionMetaSynth(col, eid);
      return {
        engin: meta.engin,
        poste: meta.poste,
        section: s,
        date: meta.date,
        jour: meta.jour,
        texte: noteToActionText(ensureNoteItems(data))
      };
    }
  ));
  return inner;
}

export function addSynthCol() { state.synthCols.push(makeSynthColData()); build(); markDirty(); }

export function resetAll() {
  if (!confirm('Réinitialiser toutes les données du tableau ?\n(L\'historique est conservé)')) return;
  initState(); state.synthCols = []; build(); markDirty();
}

// ─── Export CSV ────────────────────────────────────────────────────────────
export function exportCSV() {
  var rows = [['Engin', 'Section', 'Jour', 'Date', 'N° Engin', 'Remarque', 'Score', 'Statut']];
  ENGINS_CONFIG.forEach(function (e) {
    e.sections.forEach(function (s) {
      for (var d = 0; d < D_FIXED; d++) {
        var p = state.colOrder[d];
        var c = state.S[e.id][s][p];
        rows.push([state.enginLabels[e.id] || e.defaultLabel, s, state.headersData.jours[d] || 'J-' + d, isoToDisplay(state.headersData.dates[d]) || '', state.S[e.id].loco[p] || '', noteToText(c.note), c.score || '', c.dot === 'green' ? 'OK' : c.dot === 'red' ? 'NOK' : '']);
      }
    });
  });
  state.synthCols.forEach(function (col, ci) {
    ENGINS_CONFIG.forEach(function (e) {
      e.sections.forEach(function (s) {
        var data = col.enginData[e.id][s];
        rows.push([state.enginLabels[e.id] || e.defaultLabel, s, col.jour || 'Synthèse ' + (ci + 1), isoToDisplay(col.date) || '', col.enginData[e.id].loco || '', noteToText(data.note), data.score || '', data.dot === 'green' ? 'OK' : data.dot === 'red' ? 'NOK' : '']);
      });
    });
  });
  downloadCSV(rows, 'suivi_prod_' + (document.getElementById('dateJour').value || 'export') + '.csv');
}

function downloadCSV(rows, filename) {
  var csv = '\ufeff' + rows.map(function (r) { return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(';'); }).join('\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click(); URL.revokeObjectURL(url);
}

// ─── Modal Historique ───────────────────────────────────────────────────────
export function openHistorique() {
  document.getElementById('histOverlay').classList.add('open');
  renderHistTable();
}
export function closeHistorique() { document.getElementById('histOverlay').classList.remove('open'); }

export function clearHistFilter() {
  document.getElementById('histFrom').value = '';
  document.getElementById('histTo').value = '';
  renderHistTable();
}

export function renderHistTable() {
  var from = document.getElementById('histFrom').value;
  var to = document.getElementById('histTo').value;
  var wrap = document.getElementById('histTableWrap');

  var entries = Object.values(state.historique).sort(function (a, b) { return a.date.localeCompare(b.date); });
  if (from) entries = entries.filter(function (e) { return e.date >= from; });
  if (to) entries = entries.filter(function (e) { return e.date <= to; });

  if (entries.length === 0) {
    wrap.innerHTML = '<div class="hist-empty">Aucune entrée dans l\'historique pour cette période.</div>';
    return;
  }

  var sections = [];
  ENGINS_CONFIG.forEach(function (e) {
    e.sections.forEach(function (s) { sections.push({ eid: e.id, label: (state.enginLabels[e.id] || e.defaultLabel) + ' — ' + s, sec: s }); });
  });

  var html = '<table class="hist-table"><thead><tr>';
  html += '<th>Date</th><th>Heure save</th>';
  sections.forEach(function (col) { html += '<th>' + col.label + '</th>'; });
  html += '<th></th></tr></thead><tbody>';

  entries.forEach(function (entry) {
    var heure = entry.savedAt ? new Date(entry.savedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
    var dateAff = entry.date ? entry.date.split('-').reverse().join('/') : '—';
    html += '<tr>';
    html += '<td><strong>' + dateAff + '</strong></td><td>' + heure + '</td>';
    sections.forEach(function (col) {
      var eg = entry.engins && entry.engins[col.eid];
      var sc = eg && eg[col.sec];
      var score = sc ? (sc.score || '—') : '—';
      var dot = sc ? (sc.dot || 'none') : 'none';
      html += '<td class="dot-cell"><span class="hist-dot ' + dot + '"></span> ' + score + '</td>';
    });
    html += '<td><button class="hist-del-btn" data-date="' + entry.date + '">Supprimer</button></td>';
    html += '</tr>';
  });

  html += '</tbody></table>';
  wrap.innerHTML = html;

  // Boutons "Supprimer" branchés par référence (plutôt que par attribut onclick="",
  // qui ne fonctionne pas pour une fonction module non exposée sur window).
  wrap.querySelectorAll('.hist-del-btn').forEach(function (btn) {
    btn.onclick = function () { deleteHistEntry(btn.getAttribute('data-date')); };
  });
}

function deleteHistEntry(date) {
  if (!confirm('Supprimer l\'entrée du ' + date.split('-').reverse().join('/') + ' de l\'historique ?')) return;
  delete state.historique[date];
  renderHistTable();
  markDirty();
}

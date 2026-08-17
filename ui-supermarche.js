// ui-supermarche.js — onglet "Supermarché" : tableau principal, colonnes de synthèse,
// export CSV et modal Historique.

import {
  state, ENGINS_CONFIG, D_FIXED, isoToDisplay, autoResize,
  makeSynthColData, initState, markDirty
} from './state.js';
import { sendToAction } from './ui-actions.js';

export function build() {
  buildBody();
  buildHeader();
}

function fillHeaderRow(row) {
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
        markDirty();
        buildHeader();
      };
      pk.onblur = function () { pk.classList.remove('visible'); };
    })(display, picker, d);

    th.appendChild(display);
    th.appendChild(picker);
    var jourInp = makeInput('th-header-input th-j', state.headersData.jours[d], 'Jour', makeJourUpdater(d));
    jourInp.setAttribute('data-jour-kind', 'fixed');
    jourInp.setAttribute('data-jour-idx', String(d));
    th.appendChild(jourInp);
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
        markDirty();
        buildHeader();
      };
      pk.onblur = function () { pk.classList.remove('visible'); };
    })(display, picker, col);

    th.appendChild(display);
    th.appendChild(picker);
    var jourInp = makeInput('th-header-input th-j', col.jour, 'Jour', function (v) {
      col.jour = v;
      syncJourInputs('synth', col.id, v);
      markDirty();
    });
    jourInp.setAttribute('data-jour-kind', 'synth');
    jourInp.setAttribute('data-jour-idx', col.id);
    th.appendChild(jourInp);

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

function buildHeader() {
  var mainRow = document.getElementById('headerRow');
  if (mainRow) mainRow.classList.add('header-row');
  var rows = document.querySelectorAll('tr.header-row');
  for (var i = 0; i < rows.length; i++) fillHeaderRow(rows[i]);
}

function syncJourInputs(kind, idx, value) {
  var sel = 'tr.header-row input.th-j[data-jour-kind="' + kind + '"][data-jour-idx="' + idx + '"]';
  var inputs = document.querySelectorAll(sel);
  for (var i = 0; i < inputs.length; i++) {
    if (inputs[i].value !== value) inputs[i].value = value;
  }
}

function makeInput(cls, val, placeholder, onInput) {
  var inp = document.createElement('input');
  inp.type = 'text'; inp.className = cls; inp.placeholder = placeholder; inp.value = val || '';
  inp.oninput = function (e) { onInput(e.target.value); };
  return inp;
}
function makeJourUpdater(idx) {
  return function (v) {
    state.headersData.jours[idx] = v;
    syncJourInputs('fixed', String(idx), v);
    markDirty();
  };
}

function buildBody() {
  var firstTable = document.getElementById('mainTable');
  var wrap = firstTable.parentNode;

  wrap.querySelectorAll('.zone-spacer, .zone-table').forEach(function (el) { el.remove(); });

  var tb = document.getElementById('tbody');
  tb.innerHTML = '';

  var zones = [
    { id: 'SC', label: 'Station Sous-caisse', data: state.S_SC, labels: state.enginLabels_SC },
    { id: 'TP', label: 'Station Terre-plein', data: state.S, labels: state.enginLabels },
    { id: 'TT', label: 'Station Toiture', data: state.S_TT, labels: state.enginLabels_TT }
  ];

  var currentTbody = tb;

  zones.forEach(function (zone, index) {

    if (index > 0) {
      var lastTable = currentTbody.parentNode;

      var spacer = document.createElement('div');
      spacer.className = 'zone-spacer';
      spacer.style.height = '40px';
      wrap.insertBefore(spacer, lastTable.nextSibling);

      var newTable = firstTable.cloneNode(false);
      newTable.classList.add('zone-table');

      var newThead = document.createElement('thead');
      var newRow = document.createElement('tr');
      newRow.className = 'header-row';
      var thLabel = document.createElement('th');
      thLabel.className = 'th-top th-label';
      thLabel.style.width = '110px';
      newRow.appendChild(thLabel);
      newThead.appendChild(newRow);
      newTable.appendChild(newThead);

      var newTbody = document.createElement('tbody');
      newTable.appendChild(newTbody);

      wrap.insertBefore(newTable, spacer.nextSibling);
      currentTbody = newTbody;
    }

    var rZone = document.createElement('tr');
    var tdZone = document.createElement('td');
    tdZone.colSpan = 1 + D_FIXED + state.synthCols.length;
    tdZone.textContent = zone.label;
    tdZone.style.background = '#2c3e50';
    tdZone.style.color = 'white';
    tdZone.style.padding = '10px';
    tdZone.style.fontWeight = 'bold';
    tdZone.style.fontSize = '1.1em';
    rZone.appendChild(tdZone);
    currentTbody.appendChild(rZone);

    ENGINS_CONFIG.forEach(function (e) {
      var rEngin = document.createElement('tr'); rEngin.className = 'row-engin';
      var tdLbl = document.createElement('td'); tdLbl.textContent = 'ENGIN'; rEngin.appendChild(tdLbl);
      for (var d = 0; d < D_FIXED; d++) {
        var td = document.createElement('td'); td.className = 'loco-cell';
        td.appendChild(makeLoco_fixed(zone.data, e.id, state.colOrder[d])); rEngin.appendChild(td);
      }
      state.synthCols.forEach(function (col) {
        var td = document.createElement('td'); td.className = 'loco-cell'; td.style.background = '#d4dff0';
        td.appendChild(makeLoco_synth(col, e.id)); rEngin.appendChild(td);
      });
      currentTbody.appendChild(rEngin);

      var rTitle = document.createElement('tr'); rTitle.className = 'row-label';
      var tdT = document.createElement('td'); tdT.className = 'label';
      tdT.appendChild(makeEnginLabelInput(zone.labels, e.id)); rTitle.appendChild(tdT);
      for (var d2 = 0; d2 < D_FIXED; d2++) { var td2 = document.createElement('td'); td2.className = 'data-cell'; rTitle.appendChild(td2); }
      state.synthCols.forEach(function () { var td = document.createElement('td'); td.className = 'data-cell synth-cell'; rTitle.appendChild(td); });
      currentTbody.appendChild(rTitle);

      e.sections.forEach(function (s) {
        var rNote = document.createElement('tr'); rNote.className = 'row-label';
        var tdSL = document.createElement('td'); tdSL.className = 'label'; tdSL.textContent = s; rNote.appendChild(tdSL);
        for (var d3 = 0; d3 < D_FIXED; d3++) {
          var td3 = document.createElement('td'); td3.className = 'data-cell';
          td3.appendChild(makeNoteList_fixed(zone.labels, zone.data, e.id, s, state.colOrder[d3], d3)); rNote.appendChild(td3);
        }
        state.synthCols.forEach(function (col) {
          var td = document.createElement('td'); td.className = 'data-cell synth-cell';
          td.appendChild(makeNoteList_synth(col, e.id, s)); rNote.appendChild(td);
        });
        currentTbody.appendChild(rNote);

        var rScore = document.createElement('tr'); rScore.className = 'row-score';
        var tdSS = document.createElement('td'); tdSS.className = 'label'; rScore.appendChild(tdSS);
        for (var d4 = 0; d4 < D_FIXED; d4++) {
          var td4 = document.createElement('td');
          td4.appendChild(makeScoreInner_fixed(zone.labels, zone.data, e.id, s, state.colOrder[d4], d4)); rScore.appendChild(td4);
        }
        state.synthCols.forEach(function (col) {
          var td = document.createElement('td'); td.className = 'synth-cell';
          td.appendChild(makeScoreInner_synth(col, e.id, s)); rScore.appendChild(td);
        });
        currentTbody.appendChild(rScore);
      });
    });
  });
}

function makeLoco_fixed(dataObj, eid, p) {
  var inp = document.createElement('input');
  inp.className = 'loco'; inp.type = 'text'; inp.placeholder = 'N° engin...'; inp.value = dataObj[eid].loco[p];
  (function (obj, ei, pi) { inp.oninput = function () { obj[ei].loco[pi] = inp.value; markDirty(); }; })(dataObj, eid, p);
  return inp;
}
function makeLoco_synth(col, eid) {
  var inp = document.createElement('input');
  inp.className = 'loco'; inp.type = 'text'; inp.placeholder = 'N° engin...'; inp.value = col.enginData[eid].loco;
  inp.oninput = function () { col.enginData[eid].loco = inp.value; markDirty(); };
  return inp;
}

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

function buildNoteItemEl(item, onDelete, getMeta, section) {
  var row = document.createElement('div');
  row.className = 'note-item';

  // 🔑 Section PIECES DEPOSEES : champ KIT uniquement (pas de SYMBOLE)
  var secNorm = (section || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
  var withSymbole = secNorm.indexOf('PIECES DEPOSEES') === -1;

  var kitInp = document.createElement('textarea'); kitInp.rows = 1;
  kitInp.className = 'note-kit';
  kitInp.placeholder = 'KIT';
  kitInp.value = item.kit || '';
  kitInp.oninput = function () { item.kit = kitInp.value; autoResize(kitInp); markDirty(); };
  requestAnimationFrame(function () { autoResize(kitInp); });
  row.appendChild(kitInp);

  if (withSymbole) {
    var symInp = document.createElement('textarea'); symInp.rows = 1;
    symInp.className = 'note-sym';
    symInp.placeholder = 'SYMBOLE';
    symInp.value = item.symbole || '';
    symInp.oninput = function () { item.symbole = symInp.value; autoResize(symInp); markDirty(); };
    requestAnimationFrame(function () { autoResize(symInp); });
    row.appendChild(symInp);
  }

  var actions = document.createElement('div');
  actions.className = 'note-item-actions';

  var sendBtn = document.createElement('button');
  sendBtn.type = 'button'; sendBtn.className = 'note-send-btn'; sendBtn.textContent = '→';
  sendBtn.title = 'Envoyer cette ligne vers Actions';
  sendBtn.onclick = function () {
    var meta = getMeta();
    sendToAction({ engin: meta.engin, poste: meta.poste, section: section, date: meta.date, jour: meta.jour, kit: item.kit || '', symbole: item.symbole || '' });
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

function makeNoteList_fixed(labelsObj, dataObj, eid, s, p, d) {
  var obj = dataObj[eid][s][p];
  var items = ensureNoteItems(obj);
  return buildNoteList(items, function () { return actionMetaFixed(labelsObj, dataObj, eid, p, d); }, s);
}
function makeNoteList_synth(col, eid, s) {
  var obj = col.enginData[eid][s];
  var items = ensureNoteItems(obj);
  return buildNoteList(items, function () { return actionMetaSynth(col, eid); }, s);
}

function makeEnginLabelInput(labelsObj, eid) {
  var inp = document.createElement('input');
  inp.className = 'engin-label-input'; inp.type = 'text'; inp.value = labelsObj[eid] || '';
  inp.oninput = function () { labelsObj[eid] = inp.value; markDirty(); };
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

function actionMetaFixed(labelsObj, dataObj, eid, p, d) {
  var lbl = labelsObj[eid] || enginLabelOf(eid);
  return {
    engin: dataObj[eid].loco[p] || lbl,
    poste: lbl,
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

function makeActionBtn(getDot, getData) {
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-action' + (getDot() === 'red' ? ' alert' : '');
  btn.textContent = '→';
  btn.title = 'Envoyer toutes les lignes vers Actions';
  btn.onclick = function (e) { e.stopPropagation(); sendToAction(getData()); };
  return btn;
}

function makeScoreInner_fixed(labelsObj, dataObj, eid, s, p, d) {
  var inner = document.createElement('div'); inner.className = 'score-inner';
  (function (lb, obj, ei, si, pi, di) {
    inner.appendChild(makeDot(function () { return obj[ei][si][pi].dot; }, function (v) { obj[ei][si][pi].dot = v; }, 'green'));
    inner.appendChild(makeDot(function () { return obj[ei][si][pi].dot; }, function (v) { obj[ei][si][pi].dot = v; }, 'red'));
    var inp = document.createElement('input');
    inp.className = 'score'; inp.type = 'text'; inp.placeholder = '0/0'; inp.value = obj[ei][si][pi].score;
    inp.oninput = function () { obj[ei][si][pi].score = inp.value; markDirty(); };
    inner.appendChild(inp);
    inner.appendChild(makeActionBtn(
      function () { return obj[ei][si][pi].dot; },
      function () {
        var meta = actionMetaFixed(lb, obj, ei, pi, di);
        var items = ensureNoteItems(obj[ei][si][pi]);
        var kitAll = items.map(function(it) { return (it.kit || '').trim(); }).filter(Boolean).join('\n');
        var symAll = items.map(function(it) { return (it.symbole || '').trim(); }).filter(Boolean).join('\n');
        return {
          engin: meta.engin,
          poste: meta.poste,
          section: si,
          date: meta.date,
          jour: meta.jour,
          kit: kitAll,
          symbole: symAll
        };
      }
    ));
  })(labelsObj, dataObj, eid, s, p, d);
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

export function exportCSV() {
  var rows = [['Zone', 'Engin', 'Section', 'Jour', 'Date', 'N° Engin', 'Remarque', 'Score', 'Statut']];

  var zones = [
    { label: 'Station Sous-caisse', data: state.S_SC, labels: state.enginLabels_SC },
    { label: 'Station Terre-plein', data: state.S, labels: state.enginLabels },
    { label: 'Station Toiture', data: state.S_TT, labels: state.enginLabels_TT }
  ];

  zones.forEach(function(zone) {
    ENGINS_CONFIG.forEach(function (e) {
      e.sections.forEach(function (s) {
        for (var d = 0; d < D_FIXED; d++) {
          var p = state.colOrder[d];
          var c = zone.data[e.id][s][p];
          rows.push([zone.label, zone.labels[e.id] || e.defaultLabel, s, state.headersData.jours[d] || 'J-' + d, isoToDisplay(state.headersData.dates[d]) || '', zone.data[e.id].loco[p] || '', noteToText(c.note), c.score || '', c.dot === 'green' ? 'OK' : c.dot === 'red' ? 'NOK' : '']);
        }
      });
    });
  });

  state.synthCols.forEach(function (col, ci) {
    ENGINS_CONFIG.forEach(function (e) {
      e.sections.forEach(function (s) {
        var data = col.enginData[e.id][s];
        rows.push(['Synthèse', state.enginLabels[e.id] || e.defaultLabel, s, col.jour || 'Synthèse ' + (ci + 1), isoToDisplay(col.date) || '', col.enginData[e.id].loco || '', noteToText(data.note), data.score || '', data.dot === 'green' ? 'OK' : data.dot === 'red' ? 'NOK' : '']);
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

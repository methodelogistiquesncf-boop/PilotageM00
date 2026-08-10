// ui-rassemblement.js — onglet "Rassemblement" : articles manquants groupés par date

import { state, markDirty, todayISO, isoToDisplay, autoResize } from './state.js';
import { ensureAgentEmailsLoaded, buildResponsableCell } from './responsable-field.js';

// Recalcule la hauteur d'une textarea "commentaire" dès qu'elle est
// effectivement dans le DOM (layout final connu — la première mesure prise
// immédiatement après l'insertion peut être fausse) et à chaque fois que la
// largeur de sa cellule change ensuite (redimensionnement de la fenêtre,
// ajout/suppression d'une colonne comme "Responsable"...). Sans ça, le texte
// peut rester coupé après un changement de largeur de colonne.
function observeCommentSize(td, textarea) {
  requestAnimationFrame(function () { requestAnimationFrame(function () { autoResize(textarea); }); });
  if (typeof ResizeObserver === 'undefined') return;
  var lastWidth = null;
  var ro = new ResizeObserver(function (entries) {
    var w = entries[0].contentRect.width;
    if (w !== lastWidth) { lastWidth = w; autoResize(textarea); }
  });
  ro.observe(td);
}

function makeRassemRow() {
  return { id: 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), engin: '', kit: '', symbole: '', designation: '', qte: '', commentaire: '', responsable: '', recu: false, dateRecu: '' };
}
function makeRassemSection(dateISO) {
  return { id: 'rs_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), date: dateISO || '', jour: '', rows: [] };
}

export function addRassemSection() {
  var sec = makeRassemSection(todayISO());
  sec.rows.push(makeRassemRow());
  state.rassemblement.push(sec);
  buildRassemblement();
  markDirty();
}

export function addRassemRow(sectionId) {
  var sec = state.rassemblement.find(function (s) { return s.id === sectionId; });
  if (!sec) return;
  sec.rows.push(makeRassemRow());
  buildRassemblement();
  markDirty();
}

export function deleteRassemRow(sectionId, rowId) {
  var sec = state.rassemblement.find(function (s) { return s.id === sectionId; });
  if (!sec) return;
  sec.rows = sec.rows.filter(function (r) { return r.id !== rowId; });
  buildRassemblement();
  markDirty();
}

export function deleteRassemSection(sectionId) {
  if (!confirm('Supprimer cette section de date et toutes ses lignes ?')) return;
  state.rassemblement = state.rassemblement.filter(function (s) { return s.id !== sectionId; });
  buildRassemblement();
  markDirty();
}

export function toggleRecu(sectionId, rowId) {
  var sec = state.rassemblement.find(function (s) { return s.id === sectionId; });
  if (!sec) return;
  var row = sec.rows.find(function (r) { return r.id === rowId; });
  if (!row) return;
  row.recu = !row.recu;
  row.dateRecu = row.recu ? todayISO() : '';
  buildRassemblement();
  markDirty();
}

export function toggleShowRecus() {
  state.showRecus = !state.showRecus;
  var btn = document.getElementById('btnToggleRecus');
  btn.textContent = state.showRecus ? '👁 Masquer les reçus' : '👁 Afficher les reçus';
  btn.classList.toggle('btn-primary', state.showRecus);
  btn.classList.toggle('btn-ghost', !state.showRecus);
  buildRassemblement();
}

function updateRassemCount() {
  var total = state.rassemblement.reduce(function (sum, sec) {
    return sum + sec.rows.filter(function (r) { return !r.recu; }).length;
  }, 0);
  var badge = document.getElementById('manquantsCount');
  if (total > 0) { badge.style.display = 'inline-block'; badge.textContent = total; }
  else { badge.style.display = 'none'; }
}

export function buildRassemblement() {
  var wrap = document.getElementById('rassemblementSections');
  wrap.innerHTML = '';
  updateRassemCount();
  ensureAgentEmailsLoaded();

  if (state.rassemblement.length === 0) {
    wrap.innerHTML = '<div class="manquants-empty">Aucune date ajoutée. Clique sur « + Ajouter une date » pour commencer.</div>';
    return;
  }

  var ordered = state.rassemblement.slice().sort(function (a, b) {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });

  function isSectionFullyRecu(sec) {
    return sec.rows.length > 0 && sec.rows.every(function (r) { return r.recu; });
  }

  var visibleSections = state.showRecus ? ordered : ordered.filter(function (sec) { return !isSectionFullyRecu(sec); });
  var hiddenCount = ordered.length - visibleSections.length;

  if (visibleSections.length === 0) {
    var msg = document.createElement('div');
    msg.className = 'manquants-empty';
    msg.textContent = hiddenCount > 0
      ? 'Toutes les dates sont soldées (tous les articles reçus). Clique sur « Afficher les reçus » pour les revoir.'
      : 'Aucune date ajoutée. Clique sur « + Ajouter une date » pour commencer.';
    wrap.appendChild(msg);
  } else {
    visibleSections.forEach(function (sec) { wrap.appendChild(buildRassemSectionEl(sec)); });
  }

  if (hiddenCount > 0 && !state.showRecus && visibleSections.length > 0) {
    var note = document.createElement('div');
    note.className = 'rassem-hidden-note';
    note.textContent = hiddenCount + ' date' + (hiddenCount > 1 ? 's' : '') + ' soldée' + (hiddenCount > 1 ? 's' : '') + ' masquée' + (hiddenCount > 1 ? 's' : '') + ' — « Afficher les reçus » pour les revoir.';
    wrap.appendChild(note);
  }
}

function buildRassemSectionEl(sec) {
  var box = document.createElement('div');
  box.className = 'rassem-section';

  var head = document.createElement('div');
  head.className = 'rassem-section-head';

  var display = document.createElement('span');
  display.className = 'rassem-date-display';
  display.textContent = isoToDisplay(sec.date) ? (sec.date.split('-').reverse().join('/')) : '— Choisir une date —';

  var picker = document.createElement('input');
  picker.type = 'date';
  picker.className = 'rassem-date-picker';
  picker.value = sec.date || '';

  (function (sp, pk, s) {
    sp.onclick = function () {
      pk.classList.add('visible');
      pk.focus();
      try { pk.showPicker && pk.showPicker(); } catch (e) {}
    };
    pk.onchange = function () {
      s.date = pk.value;
      sp.textContent = pk.value ? pk.value.split('-').reverse().join('/') : '— Choisir une date —';
      pk.classList.remove('visible');
      buildRassemblement();
      markDirty();
    };
    pk.onblur = function () { pk.classList.remove('visible'); };
  })(display, picker, sec);

  var jourInput = document.createElement('input');
  jourInput.type = 'text';
  jourInput.className = 'rassem-jour-input';
  jourInput.placeholder = 'Repère';
  jourInput.value = sec.jour || '';
  jourInput.oninput = function () { sec.jour = jourInput.value; markDirty(); };

  var activeCount = sec.rows.filter(function (r) { return !r.recu; }).length;
  var recuCount = sec.rows.length - activeCount;
  var count = document.createElement('span');
  count.className = 'rassem-count';
  count.textContent = activeCount + (activeCount === 1 ? ' article' : ' articles') + (recuCount > 0 ? ' · ' + recuCount + ' reçu' + (recuCount > 1 ? 's' : '') : '');

  var actions = document.createElement('div');
  actions.className = 'rassem-section-actions';
  var delSecBtn = document.createElement('button');
  delSecBtn.className = 'btn-del-section';
  delSecBtn.textContent = '✕ Supprimer la date';
  delSecBtn.onclick = function () { deleteRassemSection(sec.id); };
  actions.appendChild(delSecBtn);

  head.appendChild(display);
  head.appendChild(picker);
  head.appendChild(jourInput);
  head.appendChild(count);
  head.appendChild(actions);
  box.appendChild(head);

  var table = document.createElement('table');
  table.className = 'manquants-table';
  var thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Engin</th><th>Kit</th><th>Symbole</th><th>Désignation</th><th>Qté</th><th>Commentaire</th><th>Responsable</th><th>Reçu</th><th></th></tr>';
  table.appendChild(thead);

  var visibleRows = state.showRecus ? sec.rows : sec.rows.filter(function (r) { return !r.recu; });

  var tbody = document.createElement('tbody');
  if (visibleRows.length === 0) {
    var trEmpty = document.createElement('tr');
    var tdEmpty = document.createElement('td');
    tdEmpty.colSpan = 9;
    tdEmpty.className = 'manquants-empty';
    tdEmpty.textContent = sec.rows.length === 0
      ? 'Aucun article manquant pour cette date.'
      : 'Tous les articles de cette date ont été reçus.';
    trEmpty.appendChild(tdEmpty);
    tbody.appendChild(trEmpty);
  } else {
    visibleRows.forEach(function (row) { tbody.appendChild(buildRassemRowEl(sec, row)); });
  }
  table.appendChild(tbody);
  box.appendChild(table);

  var footer = document.createElement('div');
  footer.className = 'rassem-section-footer';
  var addBtn = document.createElement('button');
  addBtn.className = 'btn-add-row';
  addBtn.textContent = '+ Ajouter une ligne';
  addBtn.onclick = function () { addRassemRow(sec.id); };
  footer.appendChild(addBtn);
  box.appendChild(footer);

  return box;
}

function buildRassemRowEl(sec, row) {
  var tr = document.createElement('tr');
  if (row.recu) tr.className = 'row-recu';

  function fieldCell(field, type) {
    var td = document.createElement('td');
    var inp = document.createElement('input');
    inp.type = type || 'text';
    inp.value = row[field] || '';
    inp.disabled = !!row.recu;
    inp.oninput = function () { row[field] = inp.value; markDirty(); };
    td.appendChild(inp);
    return td;
  }

  tr.appendChild(fieldCell('engin'));
  tr.appendChild(fieldCell('kit'));
  tr.appendChild(fieldCell('symbole'));

  var tdDesc = document.createElement('td');
  var inpDesc = document.createElement('input');
  inpDesc.type = 'text';
  inpDesc.placeholder = 'Désignation...';
  inpDesc.value = row.designation || '';
  inpDesc.disabled = !!row.recu;
  inpDesc.oninput = function () { row.designation = inpDesc.value; markDirty(); };
  tdDesc.appendChild(inpDesc);
  tr.appendChild(tdDesc);

  tr.appendChild(fieldCell('qte', 'number'));

  var tdComment = document.createElement('td');
  var inpComment = document.createElement('textarea');
  inpComment.className = 'comment-area';
  inpComment.rows = 1;
  inpComment.placeholder = 'Commentaire...';
  inpComment.value = row.commentaire || '';
  inpComment.disabled = !!row.recu;
  inpComment.oninput = function () { row.commentaire = inpComment.value; autoResize(inpComment); markDirty(); };
  tdComment.appendChild(inpComment);
  tr.appendChild(tdComment);
  observeCommentSize(tdComment, inpComment);

  tr.appendChild(buildResponsableCell(row, 'responsable', !!row.recu));

  var tdRecu = document.createElement('td');
  tdRecu.className = 'recu-cell';
  var checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'recu-checkbox';
  checkbox.checked = !!row.recu;
  checkbox.title = row.recu ? 'Marquer comme non reçu' : 'Marquer comme reçu';
  checkbox.onchange = function () { toggleRecu(sec.id, row.id); };
  tdRecu.appendChild(checkbox);
  if (row.recu && row.dateRecu) {
    var recuDate = document.createElement('span');
    recuDate.className = 'recu-date';
    recuDate.textContent = 'le ' + row.dateRecu.split('-').reverse().join('/');
    tdRecu.appendChild(recuDate);
  }
  tr.appendChild(tdRecu);

  var tdDel = document.createElement('td');
  tdDel.style.textAlign = 'center';
  var delBtn = document.createElement('button');
  delBtn.className = 'manquants-del-btn';
  delBtn.textContent = '✕';
  delBtn.title = 'Supprimer la ligne';
  delBtn.onclick = function () { deleteRassemRow(sec.id, row.id); };
  tdDel.appendChild(delBtn);
  tr.appendChild(tdDel);

  return tr;
}

export function exportManquantsCSV() {
  var rows = [['Date manquant', 'Repère', 'Engin', 'Kit', 'Symbole', 'Désignation', 'Qté', 'Commentaire', 'Responsable', 'Statut', 'Date reçu']];
  var ordered = state.rassemblement.slice().sort(function (a, b) {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });
  ordered.forEach(function (sec) {
    var dateAff = sec.date ? sec.date.split('-').reverse().join('/') : '';
    sec.rows.forEach(function (row) {
      var dateRecuAff = row.dateRecu ? row.dateRecu.split('-').reverse().join('/') : '';
      rows.push([dateAff, sec.jour || '', row.engin || '', row.kit || '', row.symbole || '', row.designation || '', row.qte || '', row.commentaire || '', row.responsable || '', row.recu ? 'Reçu' : 'Manquant', dateRecuAff]);
    });
  });
  var csv = '\ufeff' + rows.map(function (r) { return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(';'); }).join('\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'rassemblement_' + (document.getElementById('dateJour').value || 'export') + '.csv';
  a.click(); URL.revokeObjectURL(url);
}

export function printRassemblement() {
  document.body.classList.add('print-rassemblement');
  window.print();
}
window.addEventListener('afterprint', function () {
  document.body.classList.remove('print-rassemblement');
});

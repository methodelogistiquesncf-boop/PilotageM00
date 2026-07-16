// ui-actions.js — onglet "Actions" : liste des remarques envoyées depuis le tableau
// Supermarché (bouton "→" sur les cellules score / lignes de remarque), avec
// statut Fait / Pas fait, responsable, échéance, filtres et export CSV.
// Les actions peuvent aussi être créées manuellement via "+ Ajouter une action".
//
// Une action est une COPIE FIGÉE de la remarque au moment de l'envoi (Engin, Section,
// Date, Texte). Elle vit indépendamment des cellules du tableau : elle ne
// disparaît donc pas quand la case d'origine est réutilisée le lendemain.

import { state, markDirty, todayISO, isoToDisplay, showConfirm, ROLES } from './state.js';
import { tryLoadUserDirectory } from './firebase.js';

// Filtres de vue (état d'affichage uniquement, pas persisté)
var currentFilterPoste = '';
var currentFilterSection = '';

// ─── Suggestions pour le champ "Responsable" ───────────────────────────────
// null = pas encore chargé, tableau = chargé (éventuellement vide si les
// règles Firestore refusent le list() aux comptes non-Administrateur).
var cachedAgentDirectory = null;

function ensureAgentEmailsLoaded() {
  if (cachedAgentDirectory !== null) return;
  cachedAgentDirectory = []; // évite les appels concurrents pendant le chargement
  tryLoadUserDirectory().then(function (directory) {
    cachedAgentDirectory = directory;
  });
}

// Rôles + noms des comptes (prénom + nom si renseignés, sinon email en repli)
// + noms déjà saisis dans d'autres actions, dédupliqués et triés. isRole
// permet d'afficher un petit badge distinctif dans le menu déroulant custom.
function buildResponsableOptions() {
  var seen = new Set();
  var options = [];
  ROLES.forEach(function (r) {
    if (!seen.has(r)) { seen.add(r); options.push({ value: r, isRole: true }); }
  });
  cachedAgentDirectory.forEach(function (u) {
    var fullName = (u.prenom + ' ' + u.nom).trim();
    var display = fullName || u.email;
    if (display && !seen.has(display)) { seen.add(display); options.push({ value: display, isRole: false }); }
  });
  state.actions.forEach(function (a) {
    var v = a.responsable && a.responsable.trim();
    if (v && !seen.has(v)) { seen.add(v); options.push({ value: v, isRole: false }); }
  });
  options.sort(function (a, b) { return a.value.localeCompare(b.value, 'fr'); });
  return options;
}

function makeActionItem(data) {
  return {
    id: 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    engin: data.engin || '',
    poste: data.poste || '',
    section: data.section || '',
    date: data.date || '',
    texte: data.texte || '',
    commentaire: data.commentaire || '',
    responsable: '',
    echeance: '',
    done: false,
    manual: !!data.manual,
    createdAt: new Date().toISOString(),
    doneAt: ''
  };
}

// Appelée depuis ui-supermarche.js par les boutons "→" (par ligne ou global cellule).
export function sendToAction(data) {
  if (!data.texte || !data.texte.trim()) return;

  // Anti-doublon : si une action identique et non faite existe déjà, on ne
  // recrée pas de ligne (utile si on reclique par erreur).
  var doublon = state.actions.find(function (a) {
    return !a.done && a.engin === data.engin && a.section === data.section &&
      a.date === data.date && a.texte === data.texte;
  });
  if (doublon) { buildActions(); return; }

  state.actions.push(makeActionItem(data));
  buildActions();
  markDirty();
}

// Appelée par le bouton "+ Ajouter une action" : crée une ligne vide, entièrement
// éditable directement dans le tableau (contrairement aux actions envoyées depuis
// le Supermarché, ici tous les champs sont saisis à la main).
export function addManualAction() {
  var item = makeActionItem({ date: isoToDisplay(todayISO()), manual: true });
  state.actions.unshift(item);
  buildActions();
  markDirty();
}

export function toggleActionDone(id) {
  var a = state.actions.find(function (x) { return x.id === id; });
  if (!a) return;
  a.done = !a.done;
  a.doneAt = a.done ? new Date().toISOString() : '';
  buildActions();
  markDirty();
}

export async function deleteAction(id) {
  var ok = await showConfirm('Cette action sera définitivement supprimée. Cette opération est irréversible.', { title: 'Supprimer cette action ?' });
  if (!ok) return;
  state.actions = state.actions.filter(function (a) { return a.id !== id; });
  buildActions();
  markDirty();
}

export function toggleShowDoneActions() {
  state.showDoneActions = !state.showDoneActions;
  var btn = document.getElementById('btnToggleActionsDone');
  btn.textContent = state.showDoneActions ? '👁 Masquer les faites' : '👁 Afficher les faites';
  btn.classList.toggle('btn-primary', state.showDoneActions);
  btn.classList.toggle('btn-ghost', !state.showDoneActions);
  buildActions();
}

function updateActionsCount() {
  var total = state.actions.filter(function (a) { return !a.done; }).length;
  var badge = document.getElementById('actionsCount');
  if (!badge) return;
  if (total > 0) { badge.style.display = 'inline-block'; badge.textContent = total; }
  else { badge.style.display = 'none'; }
}

// ─── Filtres (poste / section) ─────────────────────────────────────────────
function fillSelect(id, values, allLabel, current) {
  var sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML = '';
  var optAll = document.createElement('option'); optAll.value = ''; optAll.textContent = allLabel;
  sel.appendChild(optAll);
  values.forEach(function (v) {
    var o = document.createElement('option'); o.value = v; o.textContent = v;
    sel.appendChild(o);
  });
  sel.value = values.indexOf(current) >= 0 ? current : '';
}

function setupFilters() {
  var postes = Array.from(new Set(state.actions.map(function (a) { return a.poste; }).filter(Boolean))).sort();
  var sections = Array.from(new Set(state.actions.map(function (a) { return a.section; }).filter(Boolean))).sort();
  fillSelect('actionsFilterPoste', postes, 'Tous les postes', currentFilterPoste);
  fillSelect('actionsFilterSection', sections, 'Toutes sections', currentFilterSection);

  var selPoste = document.getElementById('actionsFilterPoste');
  var selSection = document.getElementById('actionsFilterSection');
  if (selPoste) selPoste.onchange = function () { currentFilterPoste = selPoste.value; buildActions(); };
  if (selSection) selSection.onchange = function () { currentFilterSection = selSection.value; buildActions(); };
}

export function buildActions() {
  updateActionsCount();
  setupFilters();
  ensureAgentEmailsLoaded();

  var wrap = document.getElementById('actionsTableWrap');
  if (!wrap) return;
  wrap.innerHTML = '';

  var list = state.actions.slice();
  if (currentFilterPoste) list = list.filter(function (a) { return a.poste === currentFilterPoste; });
  if (currentFilterSection) list = list.filter(function (a) { return a.section === currentFilterSection; });

  list.sort(function (a, b) {
    if (a.done !== b.done) return a.done ? 1 : -1;
    var d = (b.date || '').localeCompare(a.date || '');
    if (d !== 0) return d;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
  if (!state.showDoneActions) list = list.filter(function (a) { return !a.done; });

  if (list.length === 0) {
    var msg = state.actions.length === 0
      ? 'Aucune action pour le moment. Utilise le bouton « → » sur une remarque du tableau Supermarché, ou « + Ajouter une action » pour en créer une manuellement.'
      : (currentFilterPoste || currentFilterSection)
        ? 'Aucune action ne correspond aux filtres sélectionnés.'
        : 'Toutes les actions sont faites. « Afficher les faites » pour les revoir.';
    var emptyDiv = document.createElement('div');
    emptyDiv.className = 'manquants-empty';
    emptyDiv.textContent = msg;
    wrap.appendChild(emptyDiv);
    return;
  }

  var table = document.createElement('table');
  table.className = 'actions-table';
  var thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Engin</th><th>Poste</th><th>Section</th><th>Date</th>' +
    '<th>Action</th><th>Commentaire</th><th>Responsable</th><th>Échéance</th><th>Fait</th><th></th></tr>';
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  list.forEach(function (a) { tbody.appendChild(buildActionRow(a)); });
  table.appendChild(tbody);
  wrap.appendChild(table);
}

function textInputCell(a, field, placeholder, className, lockableIfAuto) {
  var td = document.createElement('td');
  var inp = document.createElement('input');
  inp.type = 'text';
  inp.className = className || 'action-input';
  if (placeholder) inp.placeholder = placeholder;
  inp.value = a[field] || '';
  var locked = lockableIfAuto && !a.manual;
  inp.disabled = !!a.done || locked;
  if (locked) inp.title = 'Rempli automatiquement depuis le Supermarché — non modifiable';
  inp.oninput = function () { a[field] = inp.value; markDirty(); };
  td.appendChild(inp);
  return td;
}

// Champ "Responsable" : saisie libre + menu déroulant custom stylé (rôles,
// emails des comptes, noms déjà utilisés). Remplace le <datalist> natif du
// navigateur, non personnalisable visuellement.
function buildResponsableCell(a) {
  var td = document.createElement('td');
  var box = document.createElement('div');
  box.className = 'resp-autocomplete';

  var input = document.createElement('input');
  input.type = 'text';
  input.className = 'action-input';
  input.placeholder = 'Nom ou rôle...';
  input.setAttribute('autocomplete', 'off');
  input.value = a.responsable || '';
  input.disabled = !!a.done;

  var dropdown = document.createElement('div');
  dropdown.className = 'resp-autocomplete-dropdown';
  var activeIndex = -1;
  var currentItems = [];

  function closeDropdown() {
    dropdown.classList.remove('open');
    dropdown.innerHTML = '';
    activeIndex = -1;
    currentItems = [];
  }

  function selectValue(value) {
    input.value = value;
    a.responsable = value;
    markDirty();
    closeDropdown();
  }

  function setActive(idx) {
    currentItems.forEach(function (el, i) { el.classList.toggle('active', i === idx); });
    activeIndex = idx;
  }

  function openDropdown() {
    var q = input.value.trim().toLowerCase();
    var options = buildResponsableOptions();
    var filtered = q ? options.filter(function (o) { return o.value.toLowerCase().indexOf(q) !== -1; }) : options;

    dropdown.innerHTML = '';
    currentItems = [];
    if (filtered.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'resp-autocomplete-empty';
      empty.textContent = 'Aucune suggestion — le nom saisi sera conservé tel quel.';
      dropdown.appendChild(empty);
      dropdown.classList.add('open');
      return;
    }
    filtered.slice(0, 40).forEach(function (opt) {
      var item = document.createElement('div');
      item.className = 'resp-autocomplete-item';
      var label = document.createElement('span');
      label.textContent = opt.value;
      item.appendChild(label);
      if (opt.isRole) {
        var tag = document.createElement('span');
        tag.className = 'resp-tag-role';
        tag.textContent = 'Rôle';
        item.appendChild(tag);
      }
      item.onmousedown = function (e) { e.preventDefault(); selectValue(opt.value); };
      dropdown.appendChild(item);
      currentItems.push(item);
    });
    dropdown.classList.add('open');
  }

  input.oninput = function () {
    a.responsable = input.value;
    markDirty();
    openDropdown();
  };
  input.onfocus = function () { if (!input.disabled) openDropdown(); };
  input.onblur = function () { closeDropdown(); };
  input.onkeydown = function (e) {
    if (!dropdown.classList.contains('open')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(activeIndex + 1, currentItems.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(activeIndex - 1, 0)); }
    else if (e.key === 'Enter') { if (activeIndex >= 0 && currentItems[activeIndex]) { e.preventDefault(); currentItems[activeIndex].onmousedown(e); } }
    else if (e.key === 'Escape') { closeDropdown(); input.blur(); }
  };

  box.appendChild(input);
  box.appendChild(dropdown);
  td.appendChild(box);
  return td;
}

function buildActionRow(a) {
  var tr = document.createElement('tr');
  var isOverdue = !a.done && a.echeance && a.echeance < todayISO();
  if (a.done) tr.className = 'action-done';
  else if (isOverdue) tr.className = 'action-overdue';

  tr.appendChild(textInputCell(a, 'engin', 'Engin...', null, true));
  tr.appendChild(textInputCell(a, 'poste', 'Poste...', null, true));
  tr.appendChild(textInputCell(a, 'section', 'Section...', null, true));

  tr.appendChild(textInputCell(a, 'date', 'jj/mm...', null, true));
  tr.appendChild(textInputCell(a, 'texte', 'Action...', 'action-input action-texte-input', true));
  tr.appendChild(textInputCell(a, 'commentaire', 'Commentaire...'));

  tr.appendChild(buildResponsableCell(a));

  var tdEch = document.createElement('td');
  var echInput = document.createElement('input');
  echInput.type = 'date'; echInput.className = 'action-input action-date-input';
  echInput.value = a.echeance || '';
  echInput.disabled = !!a.done;
  echInput.onchange = function () { a.echeance = echInput.value; markDirty(); buildActions(); };
  tdEch.appendChild(echInput);
  if (isOverdue) {
    var warn = document.createElement('span');
    warn.className = 'action-overdue-tag';
    warn.textContent = 'En retard';
    tdEch.appendChild(warn);
  }
  tr.appendChild(tdEch);

  var tdDone = document.createElement('td'); tdDone.className = 'action-done-cell';
  var checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'action-checkbox';
  checkbox.checked = !!a.done;
  checkbox.title = a.done ? 'Marquer comme non fait' : 'Marquer comme fait';
  checkbox.onchange = function () { toggleActionDone(a.id); };
  tdDone.appendChild(checkbox);
  tr.appendChild(tdDone);

  var tdDel = document.createElement('td'); tdDel.style.textAlign = 'center';
  var delBtn = document.createElement('button');
  delBtn.className = 'actions-del-btn';
  delBtn.textContent = '✕';
  delBtn.title = 'Supprimer';
  delBtn.onclick = function () { deleteAction(a.id); };
  tdDel.appendChild(delBtn);
  tr.appendChild(tdDel);

  return tr;
}

// ─── Export CSV ─────────────────────────────────────────────────────────────
export function exportActionsCSV() {
  var rows = [['Engin', 'Poste', 'Section', 'Date', 'Action', 'Commentaire', 'Responsable', 'Échéance', 'Statut']];
  state.actions.forEach(function (a) {
    var echAff = a.echeance ? a.echeance.split('-').reverse().join('/') : '';
    rows.push([a.engin, a.poste, a.section, a.date || '', a.texte, a.commentaire || '', a.responsable || '', echAff, a.done ? 'Fait' : 'À faire']);
  });
  var csv = '\ufeff' + rows.map(function (r) { return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(';'); }).join('\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'actions_' + (document.getElementById('dateJour').value || 'export') + '.csv';
  a.click(); URL.revokeObjectURL(url);
}

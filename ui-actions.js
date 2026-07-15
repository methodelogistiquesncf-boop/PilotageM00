// ui-actions.js — onglet "Actions" : liste des remarques envoyées depuis le tableau
// Supermarché (bouton "→" sur les cellules score), avec statut Fait / Pas fait.
//
// Une action est une COPIE FIGÉE de la remarque au moment de l'envoi (Engin, Section,
// Date, Repère, Texte). Elle vit indépendamment des cellules du tableau : elle ne
// disparaît donc pas quand la case d'origine est réutilisée le lendemain.

import { state, markDirty } from './state.js';

function makeActionItem(data) {
  return {
    id: 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    engin: data.engin || '',
    section: data.section || '',
    date: data.date || '',
    jour: data.jour || '',
    texte: data.texte || '',
    done: false,
    createdAt: new Date().toISOString(),
    doneAt: ''
  };
}

// Appelée depuis ui-supermarche.js par le bouton "→" des cellules score.
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

export function toggleActionDone(id) {
  var a = state.actions.find(function (x) { return x.id === id; });
  if (!a) return;
  a.done = !a.done;
  a.doneAt = a.done ? new Date().toISOString() : '';
  buildActions();
  markDirty();
}

export function deleteAction(id) {
  if (!confirm('Supprimer cette action ?')) return;
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

export function buildActions() {
  updateActionsCount();
  var wrap = document.getElementById('actionsTableWrap');
  if (!wrap) return;
  wrap.innerHTML = '';

  var list = state.actions.slice().sort(function (a, b) {
    if (a.done !== b.done) return a.done ? 1 : -1;
    var d = (b.date || '').localeCompare(a.date || '');
    if (d !== 0) return d;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
  if (!state.showDoneActions) list = list.filter(function (a) { return !a.done; });

  if (list.length === 0) {
    wrap.innerHTML = '<div class="manquants-empty">' +
      (state.actions.length === 0
        ? 'Aucune action pour le moment. Utilise le bouton « → » sur une remarque du tableau Supermarché pour en créer une.'
        : 'Toutes les actions sont faites. « Afficher les faites » pour les revoir.') +
      '</div>';
    return;
  }

  var table = document.createElement('table');
  table.className = 'actions-table';
  var thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Engin</th><th>Section</th><th>Date</th><th>Repère</th><th>Action</th><th>Fait</th><th></th></tr>';
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  list.forEach(function (a) { tbody.appendChild(buildActionRow(a)); });
  table.appendChild(tbody);
  wrap.appendChild(table);
}

function buildActionRow(a) {
  var tr = document.createElement('tr');
  if (a.done) tr.className = 'action-done';

  var tdEngin = document.createElement('td'); tdEngin.textContent = a.engin; tr.appendChild(tdEngin);
  var tdSection = document.createElement('td'); tdSection.textContent = a.section; tr.appendChild(tdSection);
  var tdDate = document.createElement('td'); tdDate.textContent = a.date || '—'; tr.appendChild(tdDate);
  var tdJour = document.createElement('td'); tdJour.textContent = a.jour || '—'; tr.appendChild(tdJour);
  var tdTexte = document.createElement('td'); tdTexte.className = 'action-texte'; tdTexte.textContent = a.texte; tr.appendChild(tdTexte);

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

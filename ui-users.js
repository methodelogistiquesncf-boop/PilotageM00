// ui-users.js — onglet "Utilisateurs" : liste des comptes s'étant déjà connectés
// à l'application, avec attribution d'un rôle. Onglet visible uniquement pour
// les comptes ayant le rôle "Administrateur" (voir main.js).
//
// Un utilisateur n'apparaît dans la liste qu'après sa toute première connexion
// (sa fiche est créée automatiquement à ce moment-là, voir ensureUserDoc dans
// firebase.js) : il n'est pas possible de lister les comptes Firebase Auth qui
// ne se sont jamais connectés depuis le client.

import { state } from './state.js';
import { ROLES } from './state.js';
import { loadUsersList, updateUserRole } from './firebase.js';

let cachedUsers = [];

export async function buildUsers() {
  var wrap = document.getElementById('usersTableWrap');
  if (!wrap) return;

  if (state.currentUserRole !== 'Administrateur') {
    wrap.innerHTML = '<div class="manquants-empty">Accès réservé aux comptes Administrateur.</div>';
    return;
  }

  wrap.innerHTML = '<div class="manquants-empty">Chargement...</div>';
  try {
    cachedUsers = await loadUsersList();
  } catch (e) {
    console.error(e);
    wrap.innerHTML = '<div class="manquants-empty">Erreur de chargement des utilisateurs.</div>';
    return;
  }
  renderUsersTable();
}

function renderUsersTable() {
  var wrap = document.getElementById('usersTableWrap');
  wrap.innerHTML = '';

  if (cachedUsers.length === 0) {
    wrap.innerHTML = '<div class="manquants-empty">Aucun utilisateur ne s\'est encore connecté.</div>';
    return;
  }

  var table = document.createElement('table');
  table.className = 'actions-table users-table';
  var thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Utilisateur</th><th>Rôle</th><th>Dernière connexion</th></tr>';
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  cachedUsers.slice().sort(function (a, b) { return (a.email || '').localeCompare(b.email || ''); })
    .forEach(function (u) { tbody.appendChild(buildUserRow(u)); });
  table.appendChild(tbody);
  wrap.appendChild(table);
}

function buildUserRow(u) {
  var tr = document.createElement('tr');

  var tdEmail = document.createElement('td');
  tdEmail.textContent = u.email || u.uid;
  if (u.uid === state.currentUserUid) {
    var tag = document.createElement('span');
    tag.className = 'user-you-tag';
    tag.textContent = 'vous';
    tdEmail.appendChild(document.createTextNode(' '));
    tdEmail.appendChild(tag);
  }
  tr.appendChild(tdEmail);

  var tdRole = document.createElement('td');
  var sel = document.createElement('select');
  sel.className = 'actions-filter-select user-role-select';
  var optNone = document.createElement('option');
  optNone.value = ''; optNone.textContent = '— Aucun rôle —';
  sel.appendChild(optNone);
  ROLES.forEach(function (r) {
    var o = document.createElement('option'); o.value = r; o.textContent = r;
    sel.appendChild(o);
  });
  sel.value = u.role || '';
  sel.onchange = function () {
    var previous = u.role || '';
    var next = sel.value;
    updateUserRole(u.uid, next).then(function () {
      u.role = next;
      if (u.uid === state.currentUserUid && next !== 'Administrateur') {
        // On vient de se retirer soi-même le rôle Administrateur : l'onglet
        // doit disparaître et la vue basculer ailleurs pour éviter un état incohérent.
        buildUsers();
        var tabBtn = document.getElementById('tabViewUsers');
        if (tabBtn) tabBtn.style.display = 'none';
        window.switchMainTab('suivi');
      }
    }).catch(function (e) {
      console.error(e);
      sel.value = previous;
      alert('Erreur lors de la mise à jour du rôle.');
    });
  };
  tdRole.appendChild(sel);
  tr.appendChild(tdRole);

  var tdLast = document.createElement('td');
  tdLast.textContent = u.lastLogin ? new Date(u.lastLogin).toLocaleString('fr-FR') : '—';
  tr.appendChild(tdLast);

  return tr;
}

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
import { loadUsersList, updateUserRole, createUser } from './firebase.js';

let cachedUsers = [];

export async function buildUsers() {
  var wrap = document.getElementById('usersTableWrap');
  if (!wrap) return;

  if (state.currentUserRole !== 'Administrateur') {
    wrap.innerHTML = '<div class="manquants-empty">Accès réservé aux comptes Administrateur.</div>';
    return;
  }

  wrap.innerHTML = '';
  wrap.appendChild(buildAddUserForm());

  var tableZone = document.createElement('div');
  tableZone.id = 'usersTableZone';
  tableZone.innerHTML = '<div class="manquants-empty">Chargement...</div>';
  wrap.appendChild(tableZone);

  try {
    cachedUsers = await loadUsersList();
  } catch (e) {
    console.error(e);
    tableZone.innerHTML = '<div class="manquants-empty">Erreur de chargement des utilisateurs.</div>';
    return;
  }
  renderUsersTable();
}

// ─── Formulaire "+ Ajouter un utilisateur" ─────────────────────────────────
// Crée un compte Firebase Auth (mot de passe aléatoire jamais communiqué) et
// envoie un e-mail à la personne pour qu'elle définisse elle-même son mot de
// passe. Ne fonctionne que pour une adresse qui n'a pas encore de compte.
function buildAddUserForm() {
  var box = document.createElement('div');
  box.className = 'users-toolbar-top';

  var toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'btn btn-primary';
  toggleBtn.textContent = '+ Ajouter un utilisateur';

  var form = document.createElement('div');
  form.className = 'user-add-form';
  form.style.display = 'none';

  var emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.className = 'action-input user-add-email';
  emailInput.placeholder = 'adresse@exemple.fr';

  var roleSelect = document.createElement('select');
  roleSelect.className = 'actions-filter-select';
  var optNone = document.createElement('option'); optNone.value = ''; optNone.textContent = '— Aucun rôle —';
  roleSelect.appendChild(optNone);
  ROLES.forEach(function (r) {
    var o = document.createElement('option'); o.value = r; o.textContent = r;
    roleSelect.appendChild(o);
  });

  var submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.className = 'btn btn-primary';
  submitBtn.textContent = 'Créer le compte';

  var msg = document.createElement('span');
  msg.className = 'user-add-msg';

  toggleBtn.onclick = function () {
    var show = form.style.display === 'none';
    form.style.display = show ? 'flex' : 'none';
    if (show) emailInput.focus();
  };

  submitBtn.onclick = function () {
    var email = emailInput.value.trim();
    if (!email) { msg.className = 'user-add-msg err'; msg.textContent = 'Adresse e-mail requise.'; return; }
    submitBtn.disabled = true;
    msg.className = 'user-add-msg';
    msg.textContent = 'Création en cours...';
    createUser(email, roleSelect.value).then(function () {
      msg.className = 'user-add-msg ok';
      msg.textContent = '✓ Compte créé — e-mail de définition du mot de passe envoyé à ' + email + '.';
      emailInput.value = '';
      roleSelect.value = '';
      buildUsers();
    }).catch(function (e) {
      msg.className = 'user-add-msg err';
      if (e && e.code === 'auth/email-already-in-use') {
        msg.textContent = 'Ce compte existe déjà — il apparaîtra automatiquement dans la liste à sa 1ère connexion.';
      } else if (e && e.code === 'auth/invalid-email') {
        msg.textContent = 'Adresse e-mail invalide.';
      } else {
        msg.textContent = 'Erreur lors de la création du compte.';
        console.error(e);
      }
    }).finally(function () {
      submitBtn.disabled = false;
    });
  };

  form.appendChild(emailInput);
  form.appendChild(roleSelect);
  form.appendChild(submitBtn);
  form.appendChild(msg);

  box.appendChild(toggleBtn);
  box.appendChild(form);
  return box;
}

function renderUsersTable() {
  var wrap = document.getElementById('usersTableZone');
  if (!wrap) return;
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

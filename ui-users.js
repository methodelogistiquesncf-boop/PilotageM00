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
import { loadUsersList, updateUserRole, updateUserProfile, createUser, deleteUserDoc, updateUserBadge } from './firebase.js';

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

  var prenomInput = document.createElement('input');
  prenomInput.type = 'text';
  prenomInput.className = 'action-input user-add-prenom';
  prenomInput.placeholder = 'Prénom';

  var nomInput = document.createElement('input');
  nomInput.type = 'text';
  nomInput.className = 'action-input user-add-nom';
  nomInput.placeholder = 'Nom';

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
    if (show) prenomInput.focus();
  };

  submitBtn.onclick = function () {
    var email = emailInput.value.trim();
    if (!email) { msg.className = 'user-add-msg err'; msg.textContent = 'Adresse e-mail requise.'; return; }
    submitBtn.disabled = true;
    msg.className = 'user-add-msg';
    msg.textContent = 'Création en cours...';
    createUser(email, roleSelect.value, prenomInput.value, nomInput.value).then(function () {
      msg.className = 'user-add-msg ok';
      msg.textContent = '✓ Compte créé — e-mail de définition du mot de passe envoyé à ' + email + '.';
      prenomInput.value = '';
      nomInput.value = '';
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

  form.appendChild(prenomInput);
  form.appendChild(nomInput);
  form.appendChild(emailInput);
  form.appendChild(roleSelect);
  form.appendChild(submitBtn);
  form.appendChild(msg);

  box.appendChild(toggleBtn);
  box.appendChild(form);
  return box;
}

// Supprime la fiche d'un utilisateur après confirmation. On ne peut pas se
// supprimer soi-même (le bouton est désactivé dans buildUserRow pour ce cas).
function removeUser(u) {
  if (!confirm('Supprimer la fiche de ' + (u.email || u.uid) + ' ?\n\nSon rôle sera retiré. Si cette personne se reconnecte, elle réapparaîtra dans la liste sans rôle.')) return;
  deleteUserDoc(u.uid).then(function () {
    cachedUsers = cachedUsers.filter(function (x) { return x.uid !== u.uid; });
    renderUsersTable();
  }).catch(function (e) {
    console.error(e);
    alert('Erreur lors de la suppression de la fiche.');
  });
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
  thead.innerHTML = '<tr><th>Prénom</th><th>Nom</th><th>Utilisateur</th><th>Rôle</th><th>Dernière connexion</th><th></th></tr>';
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  cachedUsers.slice().sort(function (a, b) {
    var na = ((a.nom || '') + (a.prenom || '')) || a.email || '';
    var nb = ((b.nom || '') + (b.prenom || '')) || b.email || '';
    return na.localeCompare(nb, 'fr');
  }).forEach(function (u) { tbody.appendChild(buildUserRow(u)); });
  table.appendChild(tbody);
  wrap.appendChild(table);
}

// Champ texte éditable (Prénom / Nom), sauvegardé sur Firestore au blur (ou
// à la touche Entrée).
function editableNameCell(u, field, placeholder) {
  var td = document.createElement('td');
  var inp = document.createElement('input');
  inp.type = 'text';
  inp.className = 'action-input';
  inp.placeholder = placeholder;
  var original = u[field] || '';
  inp.value = original;

  function save() {
    var value = inp.value.trim();
    if (value === original) return; // rien n'a changé : pas d'appel réseau inutile
    var previous = original;
    original = value; // évite un double-envoi si save() est rappelée avant la réponse
    u[field] = value;
    updateUserProfile(u.uid, { [field]: value }).then(function () {
      if (u.uid === state.currentUserUid) {
        if (field === 'prenom') state.currentUserPrenom = value;
        if (field === 'nom') state.currentUserNom = value;
        updateUserBadge();
      }
    }).catch(function (e) {
      console.error(e);
      original = previous;
      u[field] = previous;
      inp.value = previous;
      alert('Erreur lors de la mise à jour.');
    });
  }

  inp.onblur = save;
  inp.onkeydown = function (e) { if (e.key === 'Enter') inp.blur(); };

  td.appendChild(inp);
  return td;
}

function buildUserRow(u) {
  var tr = document.createElement('tr');

  tr.appendChild(editableNameCell(u, 'prenom', 'Prénom...'));
  tr.appendChild(editableNameCell(u, 'nom', 'Nom...'));

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

  var tdDel = document.createElement('td');
  tdDel.style.textAlign = 'center';
  var isSelf = u.uid === state.currentUserUid;
  var delBtn = document.createElement('button');
  delBtn.className = 'actions-del-btn';
  delBtn.textContent = '✕';
  delBtn.title = isSelf ? 'Impossible de supprimer sa propre fiche' : 'Supprimer cette fiche';
  delBtn.disabled = isSelf;
  delBtn.onclick = function () { removeUser(u); };
  tdDel.appendChild(delBtn);
  tr.appendChild(tdDel);

  return tr;
}

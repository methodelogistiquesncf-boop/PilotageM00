// ui-roles.js — gestion des rôles (Administrateurs) : création + suppression de TOUT rôle
import { state, ROLES, BASE_ROLES, setCustomRoles, setRemovedRoles, markDirty, showConfirm } from './state.js';
import { loadUsersList, updateUserRole } from './firebase.js';
import { buildUsers } from './ui-users.js';

function addCustomRole(name) {
  if (!name) return;
  if (ROLES.indexOf(name) !== -1) { alert('Ce rôle existe déjà.'); return; }
  var customs = (state.customRoles || []).slice();
  customs.push(name);
  setCustomRoles(customs);
  markDirty();
  buildRolesAdmin();
  buildUsers();
}

async function removeRole(name) {
  var users = [];
  try { users = await loadUsersList(); } catch (e) {}
  var affected = users.filter(function (u) { return u.role === name; });

  var msg;
  if (affected.length) {
    msg = affected.length + ' personne(s) ont actuellement le rôle « ' + name + ' ».\n' +
          'En supprimant ce rôle, leur rôle sera effacé et il faudra le leur réaffecter.\nContinuer ?';
  } else {
    msg = 'Supprimer le rôle « ' + name + ' » ? Il disparaîtra de tous les menus déroulants.';
  }
  if (name === 'Administrateur') {
    msg += '\n\n⚠️ Attention : sans rôle Administrateur, plus personne ne pourra gérer les utilisateurs tant qu\u2019il n\u2019est pas réattribué.';
  }
  var ok = await showConfirm(msg, { title: 'Supprimer ce rôle ?', okLabel: 'Supprimer le rôle' });
  if (!ok) return;

  if (BASE_ROLES.indexOf(name) !== -1) {
    var removed = (state.removedRoles || []).slice();
    if (removed.indexOf(name) === -1) removed.push(name);
    setRemovedRoles(removed);
  } else {
    setCustomRoles((state.customRoles || []).filter(function (r) { return r !== name; }));
  }

  // 🔑 efface le rôle chez les personnes affectées (à réaffecter ensuite)
  for (var i = 0; i < affected.length; i++) {
    try { await updateUserRole(affected[i].uid, ''); } catch (e) {}
  }

  markDirty();
  buildRolesAdmin();
  buildUsers();
}

export function buildRolesAdmin() {
  var wrap = document.getElementById('rolesAdminWrap');
  if (!wrap) return;
  wrap.innerHTML = '';

  var box = document.createElement('div');
  box.className = 'aide-section';
  box.style.padding = '16px 20px';

  var title = document.createElement('h3');
  title.style.cssText = 'font-size:14px;margin:0 0 10px;';
  title.textContent = '🎭 Gestion des rôles';
  box.appendChild(title);

  var hint = document.createElement('p');
  hint.style.cssText = 'font-size:12px;color:var(--muted);margin:0 0 12px;';
  hint.textContent = 'Le ✕ supprime n\u2019importe quel rôle. Si des personnes l\u2019ont, une confirmation le précise et leur rôle sera à réaffecter.';
  box.appendChild(hint);

  var list = document.createElement('div');
  list.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;';
  ROLES.slice().forEach(function (r) {
    var isCustom = BASE_ROLES.indexOf(r) === -1;
    var chip = document.createElement('span');
    chip.style.cssText = 'display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:4px 10px;border-radius:12px;' +
      (isCustom
        ? 'background:var(--accent-light);color:var(--accent-dark);'
        : 'background:var(--surface2);color:var(--text);border:1px solid var(--border);');
    chip.appendChild(document.createTextNode(r));
    var del = document.createElement('button');
    del.type = 'button';
    del.textContent = '✕';
    del.title = 'Supprimer ce rôle';
    del.style.cssText = 'border:none;background:transparent;cursor:pointer;color:var(--danger);font-weight:700;padding:0;';
    del.onclick = function () { removeRole(r); };
    chip.appendChild(del);
    list.appendChild(chip);
  });
  if (!ROLES.length) {
    var none = document.createElement('span');
    none.style.cssText = 'font-size:13px;color:var(--muted);';
    none.textContent = 'Tous les rôles ont été supprimés.';
    list.appendChild(none);
  }
  box.appendChild(list);

  var row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;';
  var inp = document.createElement('input');
  inp.type = 'text';
  inp.className = 'user-add-prenom';
  inp.placeholder = 'Nouveau rôle (ex : Chef d\u2019équipe)';
  var add = document.createElement('button');
  add.className = 'btn btn-primary';
  add.textContent = '+ Ajouter le rôle';
  add.onclick = function () { addCustomRole(inp.value.trim()); inp.value = ''; };
  inp.onkeydown = function (e) { if (e.key === 'Enter') { addCustomRole(inp.value.trim()); inp.value = ''; } };
  row.appendChild(inp);
  row.appendChild(add);
  box.appendChild(row);

  wrap.appendChild(box);
}

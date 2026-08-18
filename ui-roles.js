// ui-roles.js — gestion des rôles personnalisés (Administrateurs, onglet Utilisateurs)
import { state, ROLES, setCustomRoles, markDirty, showConfirm } from './state.js';

function addCustomRole(name) {
  if (!name) return;
  if (ROLES.indexOf(name) !== -1) { alert('Ce rôle existe déjà.'); return; }
  state.customRoles = (state.customRoles || []).slice();
  state.customRoles.push(name);
  setCustomRoles(state.customRoles);
  markDirty();
  buildRolesAdmin();
}

async function removeCustomRole(name) {
  var ok = await showConfirm('Le rôle « ' + name + ' » sera retiré de la liste. Les utilisateurs qui le portent le conserveront jusqu\u2019à changement.', { title: 'Supprimer ce rôle ?' });
  if (!ok) return;
  state.customRoles = (state.customRoles || []).filter(function (r) { return r !== name; });
  setCustomRoles(state.customRoles);
  markDirty();
  buildRolesAdmin();
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
  title.textContent = '🎭 Rôles personnalisés';
  box.appendChild(title);

  var list = document.createElement('div');
  list.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;';
  var customs = state.customRoles || [];
  if (!customs.length) {
    var none = document.createElement('span');
    none.style.cssText = 'font-size:13px;color:var(--muted);';
    none.textContent = 'Aucun rôle personnalisé pour l\u2019instant (les 5 rôles standards restent disponibles).';
    list.appendChild(none);
  }
  customs.forEach(function (r) {
    var chip = document.createElement('span');
    chip.style.cssText = 'display:inline-flex;align-items:center;gap:6px;background:var(--accent-light);color:var(--accent-dark);font-size:12px;font-weight:600;padding:4px 10px;border-radius:12px;';
    chip.appendChild(document.createTextNode(r));
    var del = document.createElement('button');
    del.type = 'button';
    del.textContent = '✕';
    del.title = 'Supprimer ce rôle';
    del.style.cssText = 'border:none;background:transparent;cursor:pointer;color:var(--danger);font-weight:700;padding:0;';
    del.onclick = function () { removeCustomRole(r); };
    chip.appendChild(del);
    list.appendChild(chip);
  });
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

// responsable-field.js — champ "Responsable" réutilisable : saisie libre +
// menu déroulant custom stylé (rôles, e-mails/noms des comptes, noms déjà
// utilisés ailleurs dans l'appli). Remplace le <datalist> natif du navigateur,
// non personnalisable visuellement. Partagé entre l'onglet Actions et
// l'onglet Rassemblement pour que les deux proposent les mêmes suggestions.

import { state, markDirty, ROLES } from './state.js';
import { tryLoadUserDirectory } from './firebase.js';

// null = pas encore chargé, tableau = chargé (éventuellement vide si les
// règles Firestore refusent le list() aux comptes non-Administrateur).
var cachedAgentDirectory = null;

export function ensureAgentEmailsLoaded() {
  if (cachedAgentDirectory !== null) return;
  cachedAgentDirectory = []; // évite les appels concurrents pendant le chargement
  tryLoadUserDirectory().then(function (directory) {
    cachedAgentDirectory = directory;
  });
}

// Rôles + noms des comptes (prénom + nom si renseignés, sinon email en repli)
// + noms déjà saisis dans les Actions et le Rassemblement, dédupliqués et
// triés. isRole permet d'afficher un petit badge distinctif dans le menu.
export function buildResponsableOptions() {
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
  state.rassemblement.forEach(function (sec) {
    sec.rows.forEach(function (row) {
      var v = row.responsable && row.responsable.trim();
      if (v && !seen.has(v)) { seen.add(v); options.push({ value: v, isRole: false }); }
    });
  });
  options.sort(function (a, b) { return a.value.localeCompare(b.value, 'fr'); });
  return options;
}

// obj/field : l'objet et le nom de la propriété à éditer (ex. action a +
// 'responsable', ou ligne de rassemblement row + 'responsable').
// disabled : désactive le champ (action faite / article reçu).
export function buildResponsableCell(obj, field, disabled) {
  var td = document.createElement('td');
  var box = document.createElement('div');
  box.className = 'resp-autocomplete';

  var input = document.createElement('input');
  input.type = 'text';
  input.className = 'action-input';
  input.placeholder = 'Nom ou rôle...';
  input.setAttribute('autocomplete', 'off');
  input.value = obj[field] || '';
  input.disabled = !!disabled;

  var dropdown = document.createElement('div');
  dropdown.className = 'resp-autocomplete-dropdown';
  var activeIndex = -1;
  var currentItems = [];

  function closeDropdown() {
    window.removeEventListener('scroll', onWindowScroll, true);
    window.removeEventListener('resize', onWindowScroll);
    dropdown.classList.remove('open');
    dropdown.innerHTML = '';
    activeIndex = -1;
    currentItems = [];
    if (dropdown.parentNode) dropdown.parentNode.removeChild(dropdown);
  }

  function onWindowScroll() { closeDropdown(); }

  function positionDropdown() {
    var rect = input.getBoundingClientRect();
    dropdown.style.top = (rect.bottom + 4) + 'px';
    dropdown.style.left = rect.left + 'px';
    dropdown.style.minWidth = rect.width + 'px';
  }

  function selectValue(value) {
    input.value = value;
    obj[field] = value;
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
      document.body.appendChild(dropdown);
      positionDropdown();
      dropdown.classList.add('open');
      window.addEventListener('scroll', onWindowScroll, true);
      window.addEventListener('resize', onWindowScroll);
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
    document.body.appendChild(dropdown);
    positionDropdown();
    dropdown.classList.add('open');
    window.addEventListener('scroll', onWindowScroll, true);
    window.addEventListener('resize', onWindowScroll);
  }

  input.oninput = function () {
    obj[field] = input.value;
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
  td.appendChild(box);
  return td;
}

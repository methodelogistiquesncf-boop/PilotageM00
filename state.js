// state.js — état central partagé entre tous les modules de Pilotage M00

export const ENGINS_CONFIG = [
  { id: 'p18', defaultLabel: 'V16 P18', sections: ['APPROS', 'PIECES DEPOSEES'] },
  { id: 'p26', defaultLabel: 'V16 P26', sections: ['APPROS', 'PIECES DEPOSEES'] },
  { id: 'e3', defaultLabel: 'ENGIN 3', sections: ['APPROS', 'PIECES DEPOSEES'] },
  { id: 'e4', defaultLabel: 'ENGIN 4', sections: ['APPROS', 'PIECES DEPOSEES'] },
];
export const D_FIXED = 4;

export const BASE_ROLES = ['Approvisionneur', 'Ordonnanceur', 'Responsable', 'Opérateur', 'Administrateur'];
export const ROLES = BASE_ROLES.slice();
export function setCustomRoles(list) {
  state.customRoles = list || [];
  rebuildRoles();
}
export function setRemovedRoles(list) {
  state.removedRoles = list || [];
  rebuildRoles();
}
export function rebuildRoles() {
  ROLES.length = 0;
  BASE_ROLES.forEach(function (r) {
    if ((state.removedRoles || []).indexOf(r) === -1) ROLES.push(r);
  });
  (state.customRoles || []).forEach(function (r) { if (ROLES.indexOf(r) === -1) ROLES.push(r); });
}

export const state = {
  S: {},
  S_SC: {},
  S_TT: {},
  headersData: { dates: [], jours: [] },
  enginLabels: {},
  enginLabels_SC: {},
  enginLabels_TT: {},
  synthCols: [],
  colOrder: [0, 1, 2, 3],
  historique: {},
  rassemblement: [],
  showRecus: false,
  actions: [],
  showDoneActions: false,
  customRoles: [],
  currentUserUid: '',
  currentUserEmail: '',
  currentUserRole: '',
  currentUserPrenom: '',
  currentUserNom: '',
};

export function setState(partial) {
  Object.keys(partial).forEach(function (k) { state[k] = partial[k]; });
}

const dirtyListeners = [];
export function onDirty(fn) { dirtyListeners.push(fn); }
export function markDirty() { dirtyListeners.forEach(function (fn) { fn(); }); }

export function initState() {
  state.S = {};
  state.S_SC = {};
  state.S_TT = {};
  state.enginLabels = {};
  state.enginLabels_SC = {};
  state.enginLabels_TT = {};

  ENGINS_CONFIG.forEach(function (e) {
    [state.enginLabels, state.enginLabels_SC, state.enginLabels_TT].forEach(function (lbl) {
      lbl[e.id] = e.defaultLabel;
    });

    [state.S, state.S_SC, state.S_TT].forEach(function (dataObj) {
      dataObj[e.id] = { loco: Array(D_FIXED).fill('') };
      e.sections.forEach(function (s) {
        dataObj[e.id][s] = Array.from({ length: D_FIXED }, function () {
          return { note: [], score: '', dot: null };
        });
      });
    });
  });

  state.headersData = { dates: Array(D_FIXED).fill(''), jours: ['J0', 'J-1', 'J-2', 'J-3'] };
  state.colOrder = [0, 1, 2, 3];
}

// 🔑 Complète la structure si des engins ont été ajoutés à ENGINS_CONFIG
// après une sauvegarde ancienne (évite tout crash au chargement).
export function ensureFullStructure() {
  [state.S, state.S_SC, state.S_TT].forEach(function (dataObj) {
    if (!dataObj) return;
    ENGINS_CONFIG.forEach(function (e) {
      if (!dataObj[e.id]) dataObj[e.id] = { loco: Array(D_FIXED).fill('') };
      if (!Array.isArray(dataObj[e.id].loco)) dataObj[e.id].loco = Array(D_FIXED).fill('');
      e.sections.forEach(function (s) {
        if (!dataObj[e.id][s]) {
          dataObj[e.id][s] = Array.from({ length: D_FIXED }, function () {
            return { note: [], score: '', dot: null };
          });
        }
      });
    });
  });

  [state.enginLabels, state.enginLabels_SC, state.enginLabels_TT].forEach(function (lbl) {
    if (!lbl) return;
    ENGINS_CONFIG.forEach(function (e) { if (!lbl[e.id]) lbl[e.id] = e.defaultLabel; });
  });

  (state.synthCols || []).forEach(function (col) {
    ENGINS_CONFIG.forEach(function (e) {
      if (!col.enginData[e.id]) {
        col.enginData[e.id] = { loco: '' };
        e.sections.forEach(function (s) { col.enginData[e.id][s] = { note: [], dot: null, score: '' }; });
      }
    });
  });
}

export function makeSynthColData() {
  var col = { id: 'sc_' + Date.now(), date: '', jour: '', enginData: {} };
  ENGINS_CONFIG.forEach(function (e) {
    col.enginData[e.id] = { loco: '' };
    e.sections.forEach(function (s) { col.enginData[e.id][s] = { note: [], dot: null, score: '' }; });
  });
  return col;
}

export function isoToDisplay(iso) {
  if (!iso) return '';
  var parts = iso.split('-');
  if (parts.length === 3) return parts[2] + '/' + parts[1];
  return iso;
}

export function todayISO() {
  var now = new Date();
  return now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);
}

export function autoResize(ta) {
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}

export function showConfirm(message, opts) {
  opts = opts || {};
  return new Promise(function (resolve) {
    var overlay = document.getElementById('confirmOverlay');
    var titleEl = document.getElementById('confirmTitle');
    var msgEl = document.getElementById('confirmMessage');
    var btnOk = document.getElementById('confirmBtnOk');
    var btnCancel = document.getElementById('confirmBtnCancel');

    titleEl.textContent = opts.title || 'Confirmation';
    msgEl.textContent = message || '';
    btnOk.textContent = opts.okLabel || 'Supprimer';
    btnCancel.textContent = opts.cancelLabel || 'Annuler';
    overlay.classList.add('open');

    function cleanup(result) {
      overlay.classList.remove('open');
      btnOk.onclick = null;
      btnCancel.onclick = null;
      overlay.onclick = null;
      document.removeEventListener('keydown', onKey);
      resolve(result);
    }
    function onKey(e) {
      if (e.key === 'Escape') cleanup(false);
      if (e.key === 'Enter') cleanup(true);
    }

    btnOk.onclick = function () { cleanup(true); };
    btnCancel.onclick = function () { cleanup(false); };
    overlay.onclick = function (e) { if (e.target === overlay) cleanup(false); };
    document.addEventListener('keydown', onKey);
  });
}

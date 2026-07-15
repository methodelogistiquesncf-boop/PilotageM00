// state.js — état central partagé entre tous les modules de Pilotage M00

export const ENGINS_CONFIG = [
  { id: 'p18', defaultLabel: 'V16 P18', sections: ['APPROS', 'PIECES DEPOSEES'] },
  { id: 'p26', defaultLabel: 'V16 P26', sections: ['APPROS', 'PIECES DEPOSEES'] },
];
export const D_FIXED = 4;

// Objet unique, muté en place par tous les modules. On ne le réassigne jamais
// depuis l'extérieur : on modifie ses propriétés via setState().
export const state = {
  S: {},
  headersData: { dates: [], jours: [] },
  enginLabels: {},
  synthCols: [],
  colOrder: [0, 1, 2, 3],
  historique: {},
  rassemblement: [],
  showRecus: false,
  actions: [],
  showDoneActions: false,
};

// Remplace en bloc une ou plusieurs propriétés de state (utilisé au chargement
// Firebase/local, quand on reçoit un objet complet depuis le serveur).
export function setState(partial) {
  Object.keys(partial).forEach(function (k) { state[k] = partial[k]; });
}

// ─── Notification de changement ──────────────────────────────────────────
// Remplace les dizaines d'appels épars à scheduleAutoSave() dans l'ancien
// code : chaque module appelle markDirty() après une modification, et
// firebase.js s'abonne via onDirty() pour déclencher la sauvegarde.
const dirtyListeners = [];
export function onDirty(fn) { dirtyListeners.push(fn); }
export function markDirty() { dirtyListeners.forEach(function (fn) { fn(); }); }

// ─── Init / reset des données du tableau Supermarché ─────────────────────
export function initState() {
  state.S = {};
  state.enginLabels = {};
  ENGINS_CONFIG.forEach(function (e) {
    state.enginLabels[e.id] = e.defaultLabel;
    state.S[e.id] = { loco: Array(D_FIXED).fill('') };
    e.sections.forEach(function (s) {
      state.S[e.id][s] = Array.from({ length: D_FIXED }, function () {
        return { note: [], score: '', dot: null };
      });
    });
  });
  state.headersData = { dates: Array(D_FIXED).fill(''), jours: ['J0', 'J-1', 'J-2', 'J-3'] };
  state.colOrder = [0, 1, 2, 3];
}

export function makeSynthColData() {
  var col = { id: 'sc_' + Date.now(), date: '', jour: '', enginData: {} };
  ENGINS_CONFIG.forEach(function (e) {
    col.enginData[e.id] = { loco: '' };
    e.sections.forEach(function (s) { col.enginData[e.id][s] = { note: [], dot: null, score: '' }; });
  });
  return col;
}

// ─── Helpers date partagés ────────────────────────────────────────────────
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

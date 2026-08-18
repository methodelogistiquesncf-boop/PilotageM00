// main.js — boot de l'application + reconstruction des vues pour le temps réel

import { initState, state, markDirty } from './state.js';
import { initAuth, doLogout, saveFirebase } from './firebase.js';
import {
  build, addSynthCol, resetAll, exportCSV,
  openHistorique, closeHistorique, renderHistTable, clearHistFilter
} from './ui-supermarche.js';
import { openChart, closeChart, switchSection, switchTab } from './chart.js';
import {
  buildRassemblement, addRassemSection, toggleShowRecus,
  exportManquantsCSV, printRassemblement
} from './ui-rassemblement.js';
import { openStats, closeStats, switchStatsTab } from './stats.js';
import { buildActions, toggleShowDoneActions, exportActionsCSV, addManualAction } from './ui-actions.js';
import { buildUsers } from './ui-users.js';

function switchMainTab(tab) {
  document.getElementById('tabViewSuivi').classList.toggle('active', tab === 'suivi');
  document.getElementById('tabViewManquants').classList.toggle('active', tab === 'manquants');
  document.getElementById('tabViewActions').classList.toggle('active', tab === 'actions');
  document.getElementById('tabViewUsers').classList.toggle('active', tab === 'users');
  document.getElementById('tabViewAide').classList.toggle('active', tab === 'aide');
  document.getElementById('panelSuivi').classList.toggle('active', tab === 'suivi');
  document.getElementById('panelManquants').classList.toggle('active', tab === 'manquants');
  document.getElementById('panelActions').classList.toggle('active', tab === 'actions');
  document.getElementById('panelUsers').classList.toggle('active', tab === 'users');
  document.getElementById('panelAide').classList.toggle('active', tab === 'aide');
  if (tab === 'actions') buildActions();
  if (tab === 'users') buildUsers();
}

// 🔑 Temps réel : appelé par firebase.js quand des données collègues arrivent
window.rebuildAllViews = function () {
  build();
  buildRassemblement();
  buildActions();
  if (state.currentUserRole === 'Administrateur' &&
      document.getElementById('panelUsers').classList.contains('active')) buildUsers();
  if (document.getElementById('histOverlay').classList.contains('open')) renderHistTable();
};

Object.assign(window, {
  switchMainTab,
  doLogout,
  saveFirebase,
  resetAll,
  exportCSV,
  openHistorique,
  closeHistorique,
  renderHistTable,
  clearHistFilter,
  addSynthCol,
  openChart,
  closeChart,
  switchSection,
  switchTab,
  addRassemSection,
  toggleShowRecus,
  exportManquantsCSV,
  printRassemblement,
  openStats,
  closeStats,
  switchStatsTab,
  toggleShowDoneActions,
  exportActionsCSV,
  addManualAction,
});

['histOverlay', 'chartOverlay', 'statsOverlay'].forEach(function (id) {
  document.getElementById(id).addEventListener('click', function (e) {
    if (e.target === this) this.classList.remove('open');
  });
});

document.getElementById('dateJour').addEventListener('change', function () { markDirty(); });

function finishBoot() {
  build();
  buildRassemblement();
  buildActions();
  document.getElementById('tabViewUsers').style.display = state.currentUserRole === 'Administrateur' ? '' : 'none';
}

var now = new Date();
document.getElementById('dateJour').value = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);
initState();

initAuth(function () {
  finishBoot();
  var h = (location.hash || '').replace('#', '');
  if (h === 'users' && state.currentUserRole !== 'Administrateur') h = '';
  if (['manquants', 'actions', 'users', 'aide'].indexOf(h) !== -1) switchMainTab(h);
});

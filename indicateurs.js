// indicateurs.js — page Indicateurs (contenu à venir sur consigne)
import { state } from './state.js';
import { initAuth, doLogout, saveFirebase } from './firebase.js';

window.doLogout = doLogout;
window.saveFirebase = saveFirebase;

initAuth(function () {
  document.getElementById('tabViewUsers').style.display = state.currentUserRole === 'Administrateur' ? '' : 'none';
  document.body.classList.add('ready');
});

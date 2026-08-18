// indicateurs.js — page Indicateurs (contenu à venir sur consigne)
import { state } from './state.js';
import { initAuth, doLogout, saveFirebase } from './firebase.js';

window.doLogout = doLogout;
window.saveFirebase = saveFirebase;

// 🔑 Affichage rapide : révèle la page dès que la session est reconnue
// (badge utilisateur affiché), sans attendre la charge Firestore complète.
(function () {
  var b = document.getElementById('userBadge');
  function reveal() { document.body.classList.add('ready'); }
  if (b && b.style.display !== 'none') { reveal(); return; }
  if (b) {
    var obs = new MutationObserver(function () {
      if (b.style.display !== 'none') { reveal(); obs.disconnect(); }
    });
    obs.observe(b, { attributes: true, attributeFilter: ['style'] });
  }
  setTimeout(reveal, 900); // filet de sécurité
})();

initAuth(function () {
  document.getElementById('tabViewUsers').style.display = state.currentUserRole === 'Administrateur' ? '' : 'none';
  document.body.classList.add('ready');
});

// firebase.js — authentification, chargement/sauvegarde Firestore et backup localStorage
//
// Dépend des scripts compat Firebase (firebase-app-compat.js, firebase-auth-compat.js,
// firebase-firestore-compat.js) chargés en <script> classiques AVANT ce module dans le HTML :
// ils exposent la variable globale `firebase`, visible ici sans import.

import { state, setState, onDirty, ENGINS_CONFIG } from './state.js';

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAYRfaLdg--2SkTCyeNa1Xsq2vpSRBz8kY",
  authDomain: "pilotagem00.firebaseapp.com",
  projectId: "pilotagem00",
  storageBucket: "pilotagem00.firebasestorage.app",
  messagingSenderId: "455481915450",
  appId: "1:455481915450:web:cbc9430df70b6f4107dd03"
};
const FIRESTORE_DOC = "suivi/default";

let db = null;
let saveTimer = null;
let auth = null;

function setStatus(type, msg) {
  var el = document.getElementById('fbStatus');
  el.className = type;
  el.textContent = msg;
}

export function doLogout() {
  auth.signOut().then(function () { window.location.href = 'login.html'; });
}

// onLogin() est appelé une fois l'utilisateur authentifié ET les données Firestore chargées.
export function initAuth(onLogin) {
  firebase.initializeApp(FIREBASE_CONFIG);
  auth = firebase.auth();
  auth.onAuthStateChanged(function (user) {
    if (!user) { window.location.href = 'login.html'; return; }
    document.getElementById('userEmail').textContent = '👤 ' + user.email;
    document.getElementById('userBadge').style.display = 'flex';
    db = firebase.firestore();
    setStatus('sync', 'Chargement...');
    loadFirebase().then(function () { onLogin(user); });
  });
}

export async function loadFirebase() {
  try {
    var parts = FIRESTORE_DOC.split('/');
    var snap = await db.collection(parts[0]).doc(parts[1]).get();
    if (snap.exists) {
      var data = snap.data();
      var patch = {};
      if (data.S) patch.S = data.S;
      if (data.headersData) patch.headersData = data.headersData;
      if (data.enginLabels) patch.enginLabels = data.enginLabels;
      if (data.synthCols) patch.synthCols = data.synthCols;
      if (data.historique) patch.historique = data.historique;
      if (data.colOrder) patch.colOrder = data.colOrder;
      if (data.rassemblement) patch.rassemblement = data.rassemblement;
      setState(patch);
      if (data.dateJour) document.getElementById('dateJour').value = data.dateJour;
      setStatus('ok', '✓ Synchronisé');
    } else {
      setStatus('ok', 'Nouveau document');
    }
  } catch (e) {
    setStatus('err', 'Erreur lecture Firebase');
    console.error(e);
    loadLocal();
  }
}

export async function saveFirebase() {
  var dateJour = document.getElementById('dateJour').value;

  if (dateJour) {
    var p0 = state.colOrder[0];
    var entree = { date: dateJour, savedAt: new Date().toISOString(), engins: {} };
    ENGINS_CONFIG.forEach(function (e) {
      entree.engins[e.id] = { loco: state.S[e.id] ? (state.S[e.id].loco[p0] || '') : '' };
      e.sections.forEach(function (sec) {
        var cell = state.S[e.id] && state.S[e.id][sec] ? state.S[e.id][sec][p0] : { score: '', dot: null };
        entree.engins[e.id][sec] = { score: cell.score || '', dot: cell.dot || null };
      });
    });
    state.historique[dateJour] = entree;
  }

  var payload = {
    S: state.S,
    headersData: state.headersData,
    enginLabels: state.enginLabels,
    synthCols: state.synthCols,
    historique: state.historique,
    colOrder: state.colOrder,
    rassemblement: state.rassemblement,
    dateJour: dateJour,
    savedAt: new Date().toISOString()
  };
  localStorage.setItem('sp_backup', JSON.stringify(payload));

  if (!db) { setStatus('err', 'Firebase non connecté'); return; }
  try {
    setStatus('sync', 'Sauvegarde...');
    var parts = FIRESTORE_DOC.split('/');
    await db.collection(parts[0]).doc(parts[1]).set(payload);
    setStatus('ok', '✓ Sauvegardé ' + new Date().toLocaleTimeString('fr-FR'));
  } catch (e) {
    setStatus('err', 'Erreur sauvegarde');
    console.error(e);
  }
}

function scheduleAutoSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function () { saveFirebase(); }, 3000);
  setStatus('sync', 'Modifications en cours...');
}
// Chaque markDirty() appelé depuis les autres modules déclenche l'autosave debouncé.
onDirty(scheduleAutoSave);

export function loadLocal() {
  try {
    var bk = localStorage.getItem('sp_backup');
    if (!bk) return;
    var data = JSON.parse(bk);
    var patch = {};
    if (data.S) patch.S = data.S;
    if (data.headersData) patch.headersData = data.headersData;
    if (data.enginLabels) patch.enginLabels = data.enginLabels;
    if (data.synthCols) patch.synthCols = data.synthCols;
    if (data.historique) patch.historique = data.historique;
    if (data.colOrder) patch.colOrder = data.colOrder;
    if (data.rassemblement) patch.rassemblement = data.rassemblement;
    setState(patch);
    if (data.dateJour) document.getElementById('dateJour').value = data.dateJour;
  } catch (e) { console.error(e); }
}

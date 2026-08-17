// firebase.js — v2 : split Firestore (historique + actions en collections séparées)
// + purge automatique des données anciennes + backup localStorage

import { state, setState, onDirty, markDirty, ENGINS_CONFIG, ensureFullStructure } from './state.js';

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDIOc6PJ42tmuEejKxph3bPKbgBJGWM-aw",
  authDomain: "pilotagem00-recette.firebaseapp.com",
  projectId: "pilotagem00-recette",
  storageBucket: "pilotagem00-recette.firebasestorage.app",
  messagingSenderId: "848268615763",
  appId: "1:848268615763:web:757d9dd5a0e3c3b28a26a6"
};
const FIRESTORE_DOC = "suivi/default";

let db = null;
let saveTimer = null;
let auth = null;
let loadedActionIds = [];
let loadedHistDates = [];

function setStatus(type, msg) {
  var el = document.getElementById('fbStatus');
  el.className = type;
  el.textContent = msg;
}

export function doLogout() {
  auth.signOut().then(function () { window.location.href = 'login.html'; });
}

export function initAuth(onLogin) {
  firebase.initializeApp(FIREBASE_CONFIG);
  auth = firebase.auth();
  auth.onAuthStateChanged(function (user) {
    if (!user) { window.location.href = 'login.html'; return; }
    document.getElementById('userBadge').style.display = 'flex';
    db = firebase.firestore();
    setStatus('sync', 'Chargement...');
    ensureUserDoc(user)
      .then(function () { updateUserBadge(); return loadFirebase(); })
      .then(function () { onLogin(user); });
  });
}

export function updateUserBadge() {
  var el = document.getElementById('userEmail');
  if (!el) return;
  var fullName = (state.currentUserPrenom + ' ' + state.currentUserNom).trim();
  el.textContent = '👤 ' + (fullName || state.currentUserEmail);
}

async function ensureUserDoc(user) {
  var userRef = db.collection('users').doc(user.uid);
  var bootstrapRef = db.collection('meta').doc('bootstrap');
  try {
    await db.runTransaction(async function (tx) {
      var userSnap = await tx.get(userRef);
      if (userSnap.exists) {
        tx.update(userRef, { lastLogin: new Date().toISOString(), email: user.email });
        return;
      }
      var bootSnap = await tx.get(bootstrapRef);
      var isFirstEver = !bootSnap.exists;
      tx.set(userRef, {
        email: user.email,
        role: isFirstEver ? 'Administrateur' : '',
        prenom: '',
        nom: '',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      });
      if (isFirstEver) {
        tx.set(bootstrapRef, { adminAssigned: true, assignedTo: user.uid, assignedAt: new Date().toISOString() });
      }
    });
    var finalSnap = await userRef.get();
    var data = finalSnap.data();
    state.currentUserUid = user.uid;
    state.currentUserEmail = data.email || user.email;
    state.currentUserRole = data.role || '';
    state.currentUserPrenom = data.prenom || '';
    state.currentUserNom = data.nom || '';
  } catch (e) {
    console.error('Erreur ensureUserDoc', e);
    state.currentUserUid = user.uid;
    state.currentUserEmail = user.email;
    state.currentUserRole = '';
    state.currentUserPrenom = '';
    state.currentUserNom = '';
  }
}

export async function createUser(email, role, prenom, nom) {
  var tempPassword = generateTempPassword();
  var secondaryApp = firebase.initializeApp(FIREBASE_CONFIG, 'secondary_' + Date.now());
  try {
    var secondaryAuth = secondaryApp.auth();
    var cred = await secondaryAuth.createUserWithEmailAndPassword(email, tempPassword);
    var uid = cred.user.uid;
    await db.collection('users').doc(uid).set({
      email: email,
      role: role || '',
      prenom: (prenom || '').trim(),
      nom: (nom || '').trim(),
      createdAt: new Date().toISOString(),
      lastLogin: '',
      createdBy: state.currentUserUid
    });
    await secondaryAuth.signOut();
    await auth.sendPasswordResetEmail(email);
    return { uid: uid };
  } finally {
    await secondaryApp.delete();
  }
}

function generateTempPassword() {
  var arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
}

export async function loadUsersList() {
  var snap = await db.collection('users').orderBy('email').get();
  return snap.docs.map(function (d) { return Object.assign({ uid: d.id }, d.data()); });
}

export async function tryLoadUserDirectory() {
  if (!db) return [];
  try {
    var snap = await db.collection('users').orderBy('email').get();
    return snap.docs.map(function (d) {
      var data = d.data();
      return { email: data.email || '', prenom: data.prenom || '', nom: data.nom || '' };
    }).filter(function (u) { return u.email; });
  } catch (e) {
    return [];
  }
}

export async function updateUserRole(uid, role) {
  await db.collection('users').doc(uid).update({ role: role });
  if (uid === state.currentUserUid) state.currentUserRole = role;
}

export async function updateUserProfile(uid, patch) {
  await db.collection('users').doc(uid).update(patch);
}

export async function deleteUserDoc(uid) {
  await db.collection('users').doc(uid).delete();
}

// ─── Purge automatique des données anciennes ────────────────────────────────
function isoDaysAgo(n) {
  var d = new Date(); d.setDate(d.getDate() - n);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

function purgeOldData() {
  var changed = false;
  var cut90 = isoDaysAgo(90);
  var cut540 = isoDaysAgo(540);

  var nAct = state.actions.length;
  state.actions = state.actions.filter(function (a) {
    return !(a.done && (a.doneAt || '').slice(0, 10) && (a.doneAt || '').slice(0, 10) < cut90);
  });
  if (state.actions.length !== nAct) changed = true;

  Object.keys(state.historique).forEach(function (d) {
    if (d < cut540) { delete state.historique[d]; changed = true; }
  });

  var nRas = state.rassemblement.length;
  state.rassemblement = state.rassemblement.filter(function (sec) {
    var allRecu = sec.rows && sec.rows.length > 0 && sec.rows.every(function (r) { return r.recu; });
    return !(allRecu && sec.date && sec.date < cut90);
  });
  if (state.rassemblement.length !== nRas) changed = true;

  if (changed) {
    console.info('🧹 Purge automatique des données anciennes effectuée');
    markDirty();
  }
}

// ─── Chargement (3 lectures parallèles : courant + historique + actions) ────
export async function loadFirebase() {
  try {
    var parts = FIRESTORE_DOC.split('/');
    var snap = await db.collection(parts[0]).doc(parts[1]).get();
    var patch = {};
    var dateJourSaved = '';
    if (snap.exists) {
      var data = snap.data() || {};
      ['S', 'S_SC', 'S_TT', 'headersData', 'enginLabels', 'enginLabels_SC', 'enginLabels_TT', 'synthCols', 'colOrder', 'rassemblement'].forEach(function (k) {
        if (data[k] !== undefined) patch[k] = data[k];
      });
      dateJourSaved = data.dateJour || '';
    }

    state.historique = {};
    loadedHistDates = [];
    var histSnap = await db.collection('historique').get();
    histSnap.forEach(function (d) { state.historique[d.id] = d.data(); loadedHistDates.push(d.id); });

    state.actions = [];
    loadedActionIds = [];
    var actSnap = await db.collection('actions').get();
    actSnap.forEach(function (d) {
      var a = d.data() || {};
      if (!a.id) a.id = d.id;
      state.actions.push(a);
      loadedActionIds.push(d.id);
    });

    setState(patch);
    ensureFullStructure();
    purgeOldData();
    if (dateJourSaved) document.getElementById('dateJour').value = dateJourSaved;
    setStatus('ok', '✓ Synchronisé');
  } catch (e) {
    setStatus('err', 'Erreur lecture Firebase');
    console.error(e);
    loadLocal();
  }
}

// ─── Sauvegarde (courant + historique du jour + sync actions) ───────────────
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

  try {
    localStorage.setItem('sp_backup', JSON.stringify({
      S: state.S, S_SC: state.S_SC, S_TT: state.S_TT,
      headersData: state.headersData,
      enginLabels: state.enginLabels, enginLabels_SC: state.enginLabels_SC, enginLabels_TT: state.enginLabels_TT,
      synthCols: state.synthCols, historique: state.historique,
      colOrder: state.colOrder, rassemblement: state.rassemblement, actions: state.actions,
      dateJour: dateJour, savedAt: new Date().toISOString()
    }));
  } catch (e) {}

  if (!db) { setStatus('err', 'Firebase non connecté'); return; }
  try {
    setStatus('sync', 'Sauvegarde...');
    var parts = FIRESTORE_DOC.split('/');

    // 1) Document courant (taille bornée : plus d'historique ni d'actions dedans)
    await db.collection(parts[0]).doc(parts[1]).set({
      S: state.S, S_SC: state.S_SC, S_TT: state.S_TT,
      headersData: state.headersData,
      enginLabels: state.enginLabels, enginLabels_SC: state.enginLabels_SC, enginLabels_TT: state.enginLabels_TT,
      synthCols: state.synthCols,
      colOrder: state.colOrder,
      rassemblement: state.rassemblement,
      dateJour: dateJour,
      savedAt: new Date().toISOString()
    });

    // 2) Historique du jour (1 doc par date)
    if (dateJour && state.historique[dateJour]) {
      await db.collection('historique').doc(dateJour).set(state.historique[dateJour]);
    }

    // 3) Sync des actions (écritures + suppressions)
    await syncActions();

    // 4) Suppressions d'historique (purge ou bouton Supprimer du modal)
    var currentDates = Object.keys(state.historique);
    for (var i = 0; i < loadedHistDates.length; i++) {
      if (currentDates.indexOf(loadedHistDates[i]) === -1) {
        await db.collection('historique').doc(loadedHistDates[i]).delete();
      }
    }
    loadedHistDates = currentDates;

    setStatus('ok', '✓ Sauvegardé ' + new Date().toLocaleTimeString('fr-FR'));
  } catch (e) {
    setStatus('err', 'Erreur sauvegarde');
    console.error(e);
  }
}

async function syncActions() {
  var currentIds = {};
  state.actions.forEach(function (a) { if (a.id) currentIds[a.id] = true; });
  var ops = [];
  loadedActionIds.forEach(function (id) { if (!currentIds[id]) ops.push({ del: id }); });
  state.actions.forEach(function (a) { if (a.id) ops.push({ set: a }); });
  for (var s = 0; s < ops.length; s += 450) {
    var batch = db.batch();
    ops.slice(s, s + 450).forEach(function (op) {
      if (op.del) batch.delete(db.collection('actions').doc(op.del));
      else batch.set(db.collection('actions').doc(op.set.id), op.set);
    });
    await batch.commit();
  }
  loadedActionIds = Object.keys(currentIds);
}

function scheduleAutoSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function () { saveFirebase(); }, 3000);
  setStatus('sync', 'Modifications en cours...');
}
onDirty(scheduleAutoSave);

export function loadLocal() {
  try {
    var bk = localStorage.getItem('sp_backup');
    if (!bk) return;
    var data = JSON.parse(bk);
    var patch = {};
    ['S', 'S_SC', 'S_TT', 'headersData', 'enginLabels', 'enginLabels_SC', 'enginLabels_TT', 'synthCols', 'historique', 'colOrder', 'rassemblement', 'actions'].forEach(function (k) {
      if (data[k] !== undefined) patch[k] = data[k];
    });
    setState(patch); ensureFullStructure();
    if (data.dateJour) document.getElementById('dateJour').value = data.dateJour;
  } catch (e) { console.error(e); }
}

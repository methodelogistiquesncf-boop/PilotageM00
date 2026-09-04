// firebase.js — v6.1 : anti-écrasement (fenêtre 6s + stale mode + tombstones synthCols)
import { state, setState, onDirty, markDirty, ENGINS_CONFIG, ensureFullStructure, setCustomRoles, setRemovedRoles } from './state.js';

console.info('%c🔥 firebase.js v6.1 — anti-écrasement', 'background:#1a4fa0;color:#fff;font-weight:bold;padding:2px 8px;border-radius:4px');

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
let loadedActionIds = [];
let loadedHistDates = [];
let dirty = false;
let pendingApply = false;
let lastLocalSavedAt = '';
let rtStarted = false;
let pullTimer = null;
let usersCache = { data: [], ts: 0 };
let userDirectoryCache = { data: [], ts: 0 };
const USERS_CACHE_TTL = 5 * 60 * 1000;

// ────────────────────────────────────────────────────────────────────────────
// 🛡️ NOUVEAUX VERROUS v6.1
// ────────────────────────────────────────────────────────────────────────────
// 🛡️ Verrou B : si le serveur a échoué au chargement, on bloque les sauvegardes
//    pour éviter qu'un poste obsolète écrase les données des autres.
let staleMode = false;
let staleModeReason = '';

// 🛡️ Verrou A : on compte les modifications locales pour détecter les
//    écrasements en fenêtre 6s. Un snapshot entrant pendant la fenêtre
//    d'auto-save ne doit pas écraser les colonnes créées localement.
let localVersionCounter = 0;
let lastCommittedLocalVersion = 0;

// Cache persistant
let dataCache = JSON.parse(localStorage.getItem('dataCache') || '{}');
let lastSyncTimestamp = localStorage.getItem('lastSyncTimestamp') || '0';
let lastSavedActionJson = {};

// ─── Réparation auto du cache local (dédoublonnage + tombstones) ───────────
(function repairCache() {
  if (Array.isArray(dataCache.actions)) {
    var seenIds = {};
    dataCache.actions = dataCache.actions.filter(function (a) {
      if (!a || !a.id || a.deleted || seenIds[a.id]) return false;
      seenIds[a.id] = true;
      return true;
    });
  }
  if (dataCache.historique) {
    Object.keys(dataCache.historique).forEach(function (k) {
      if (!dataCache.historique[k] || dataCache.historique[k].deleted) delete dataCache.historique[k];
    });
  }
  saveToCache();
})();

function saveToCache() {
  try {
    localStorage.setItem('dataCache', JSON.stringify(dataCache));
    localStorage.setItem('lastSyncTimestamp', lastSyncTimestamp);
  } catch (e) {
    console.warn('Cache localStorage plein');
  }
}

export function getDb() { return db; }

function setStatus(type, msg) {
  var el = document.getElementById('fbStatus');
  if (!el) return;
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
  var rb = document.getElementById('userRoleBadge');
  if (rb) {
    var r = (state.currentUserRole || '').trim();
    rb.textContent = r;
    rb.style.display = r ? 'inline-block' : 'none';
  }
}

async function ensureUserDoc(user) {
  var userRef = db.collection('users').doc(user.uid);
  var bootstrapRef = db.collection('meta').doc('bootstrap');
  try {
    await db.runTransaction(async function (tx) {
      var userSnap = await tx.get(userRef);
      if (userSnap.exists) {
        tx.update(userRef, { lastLogin: new Date().toISOString(), email: user.email, appVersion: 'v6.1', lastSeen: new Date().toISOString() });
        return;
      }
      var bootSnap = await tx.get(bootstrapRef);
      var isFirstEver = !bootSnap.exists;
      tx.set(userRef, {
        email: user.email,
        role: isFirstEver ? 'Administrateur' : '',
        prenom: '',
        nom: '',
        appVersion: 'v6.1',
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
    usersCache.ts = 0;
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
  var now = Date.now();
  if (usersCache.data.length && (now - usersCache.ts) < USERS_CACHE_TTL) {
    return usersCache.data;
  }
  var snap = await db.collection('users').orderBy('email').get();
  usersCache.data = snap.docs.map(function (d) { return Object.assign({ uid: d.id }, d.data()); });
  usersCache.ts = now;
  return usersCache.data;
}

export async function tryLoadUserDirectory() {
  if (!db) return [];
  var now = Date.now();
  if (userDirectoryCache.data.length && (now - userDirectoryCache.ts) < USERS_CACHE_TTL) {
    return userDirectoryCache.data;
  }
  try {
    var snap = await db.collection('users').orderBy('email').get();
    userDirectoryCache.data = snap.docs.map(function (d) {
      var data = d.data();
      return { email: data.email || '', prenom: data.prenom || '', nom: data.nom || '' };
    }).filter(function (u) { return u.email; });
    userDirectoryCache.ts = now;
    return userDirectoryCache.data;
  } catch (e) {
    return [];
  }
}

export async function updateUserRole(uid, role) {
  await db.collection('users').doc(uid).update({ role: role });
  if (uid === state.currentUserUid) { state.currentUserRole = role; updateUserBadge(); }
  usersCache.ts = 0;
}

export async function updateUserProfile(uid, patch) {
  await db.collection('users').doc(uid).update(patch);
  usersCache.ts = 0;
}

export async function deleteUserDoc(uid) {
  await db.collection('users').doc(uid).delete();
  usersCache.ts = 0;
}

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
    console.info('🧹 Purge automatique');
    // ⚠️ Ne plus appeler markDirty() ici : purgeOldData est appelé APRÈS
    // une synchronisation réussie. Si on re-marque dirty immédiatement,
    // on déclenche un nouveau cycle de sauvegarde inutile.
    // On se contente d'écrire directement pour ne pas casser l'état.
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 🛡️ MERGE synthCols : fusion intelligente (tombstones + union par id)
// ────────────────────────────────────────────────────────────────────────────
// Règle d'or : on ne perd jamais une colonne non supprimée.
// - une colonne marquée {deleted: true} reste supprimée
// - une colonne absente côté serveur mais présente localement est préservée
// - une colonne présente côté serveur mais inconnue localement est ajoutée
function mergeSynthCols(localCols, remoteCols) {
  var local = Array.isArray(localCols) ? localCols : [];
  var remote = Array.isArray(remoteCols) ? remoteCols : [];
  var localById = {};
  local.forEach(function (c) { if (c && c.id) localById[c.id] = c; });

  var remoteById = {};
  remote.forEach(function (c) { if (c && c.id) remoteById[c.id] = c; });

  // Cas 1 : serveur dit explicitement "deleted" → on accepte la suppression
  // Cas 2 : serveur a la colonne mais pas locale → on la prend (c'est qu'un collègue l'a ajoutée)
  // Cas 3 : serveur n'a pas la colonne mais locale l'a → on la conserve (création locale en attente d'envoi)
  // Cas 4 : des deux côtés → on prend la version serveur (considérée comme la plus à jour)
  //          SAUF si la locale n'est pas "deleted" et la serveur l'est → on garde locale (récupération)
  var merged = [];
  var seenIds = {};

  remote.forEach(function (c) {
    if (!c || !c.id) return;
    seenIds[c.id] = true;
    if (c.deleted) {
      // suppression serveur acceptée
      merged.push(c);
    } else {
      // colonne vivante côté serveur : on prend la version serveur (la plus à jour)
      merged.push(c);
    }
  });

  local.forEach(function (c) {
    if (!c || !c.id || seenIds[c.id]) return;
    // colonne locale absente côté serveur : elle n'a pas encore été envoyée
    // ou elle a été "oubliée" côté serveur (snapshot obsolète).
    // On la conserve pour ne pas perdre la création locale.
    if (!c.deleted) {
      merged.push(c);
    }
  });

  return merged;
}

// ─── Lecture initiale avec cache (fusion par id, zéro doublon) ─────────────
async function fetchAll() {
  var parts = FIRESTORE_DOC.split('/');
  var snap = await db.collection(parts[0]).doc(parts[1]).get();
  var patch = {};
  var dateJourSaved = '';
  var savedAt = '';

  if (snap.exists) {
    var data = snap.data() || {};
    ['S', 'S_SC', 'S_TT', 'headersData', 'enginLabels', 'enginLabels_SC', 'enginLabels_TT', 'synthCols', 'colOrder', 'rassemblement', 'customRoles', 'removedRoles'].forEach(function (k) {
      if (data[k] !== undefined) patch[k] = data[k];
    });
    dateJourSaved = data.dateJour || '';
    savedAt = data.savedAt || '';
  }

  var hist, acts;

  function upsertAct(a) {
    var idx = acts.findIndex(function (x) { return x.id === a.id; });
    if (a.deleted) { if (idx >= 0) acts.splice(idx, 1); return; }
    if (idx >= 0) acts[idx] = a; else acts.push(a);
  }
  function upsertHist(id, d) {
    if (d && d.deleted) { delete hist[id]; return; }
    hist[id] = d;
  }

  if (lastSyncTimestamp !== '0') {
    hist = dataCache.historique || {};
    acts = dataCache.actions || [];

    var histSnap = await db.collection('historique').where('updatedAt', '>', lastSyncTimestamp).get();
    histSnap.forEach(function (d) { upsertHist(d.id, d.data()); });

    var actSnap = await db.collection('actions').where('updatedAt', '>', lastSyncTimestamp).get();
    actSnap.forEach(function (d) {
      var a = d.data() || {};
      if (!a.id) a.id = d.id;
      upsertAct(a);
    });
  } else {
    hist = {};
    acts = [];

    var histSnapFull = await db.collection('historique').get();
    histSnapFull.forEach(function (d) { upsertHist(d.id, d.data()); });

    var actSnapFull = await db.collection('actions').get();
    actSnapFull.forEach(function (d) {
      var a = d.data() || {};
      if (!a.id) a.id = d.id;
      upsertAct(a);
    });
  }

  dataCache.historique = hist;
  dataCache.actions = acts;
  lastSyncTimestamp = new Date().toISOString();
  saveToCache();

  var actIds = acts.map(function (a) { return a.id; });
  return { patch: patch, dateJourSaved: dateJourSaved, savedAt: savedAt, hist: hist, acts: acts, actIds: actIds };
}

function applyFetched(r) {
  // 🛡️ Pour synthCols : on merge intelligemment (pas d'écrasement brutal)
  if (r.patch.synthCols !== undefined) {
    r.patch.synthCols = mergeSynthCols(state.synthCols, r.patch.synthCols);
  }

  setState(r.patch);
  state.historique = r.hist;
  loadedHistDates = Object.keys(r.hist);
  state.actions = r.acts;
  loadedActionIds = r.actIds;
  ensureFullStructure();
  setCustomRoles(state.customRoles || []);
  setRemovedRoles(state.removedRoles || []);
  if (r.dateJourSaved) document.getElementById('dateJour').value = r.dateJourSaved;
  lastLocalSavedAt = r.savedAt;

  // 🛡️ On marque l'état comme "à jour" : tout ce qui est dans l'état actuel
  // peut être considéré comme envoyé. Les modifs qui arriveront après
  // incrémenteront localVersionCounter et seront protégées.
  localVersionCounter++;
  lastCommittedLocalVersion = localVersionCounter;

  // Référence pour la sauvegarde différentielle
  lastSavedActionJson = {};
  state.actions.forEach(function (a) {
    if (a.id) lastSavedActionJson[a.id] = JSON.stringify(a);
  });
}

function rebuildUI() {
  if (typeof window.rebuildAllViews === 'function') window.rebuildAllViews();
}

export async function loadFirebase() {
  try {
    var r = await fetchAll();
    staleMode = false;             // 🛡️ Lecture serveur OK : on sort du mode obsolète
    staleModeReason = '';
    applyFetched(r);
    purgeOldData();
    setStatus('ok', '✓ Synchronisé');
    startRealtime();
  } catch (e) {
    staleMode = true;              // 🛡️ Lecture échouée : on bascule en mode protégé
    staleModeReason = 'lecture serveur échouée';
    setStatus('err', '⚠️ Mode hors ligne (sauvegarde bloquée)');
    console.error('loadFirebase :', e);
    loadLocal();
  }
}

// ─── v6.1 : listener avec MERGE (plus jamais d'écrasement brutal) ──────────
function startRealtime() {
  if (rtStarted || !db) return;
  rtStarted = true;

  db.collection('suivi').doc('default').onSnapshot(function (snap) {
    if (!snap.exists) return;
    var data = snap.data() || {};
    if (data.savedAt && data.savedAt === lastLocalSavedAt) return;

    var patch = {};
    ['S', 'S_SC', 'S_TT', 'headersData', 'enginLabels', 'enginLabels_SC', 'enginLabels_TT', 'synthCols', 'colOrder', 'rassemblement', 'customRoles', 'removedRoles'].forEach(function (k) {
      if (data[k] !== undefined) patch[k] = data[k];
    });

    // 🛡️ MERGE des synthCols : jamais d'écrasement
    if (patch.synthCols !== undefined) {
      patch.synthCols = mergeSynthCols(state.synthCols, patch.synthCols);
    }

    // 🛡️ Si on a des modifs locales non envoyées (dirty) ou très récentes,
    // on préserve aussi les données des cellules en cours de saisie (S, S_SC, S_TT).
    // Un collègue qui sauvegarde ne doit pas écraver la case qu'on est en train
    // de remplir (et qui partira dans 6s).
    var hasPendingLocalWrites = dirty || (localVersionCounter !== lastCommittedLocalVersion);
    if (hasPendingLocalWrites) {
      ['S', 'S_SC', 'S_TT'].forEach(function (k) {
        if (patch[k] !== undefined && state[k] && typeof state[k] === 'object') {
          // fusion profonde : pour chaque engin, pour chaque section,
          // on garde la version locale des cellules modifiées (non vides)
          var merged = {};
          Object.keys(state[k]).forEach(function (eid) {
            merged[eid] = Object.assign({}, patch[k][eid] || {}, state[k][eid]);
          });
          Object.keys(patch[k]).forEach(function (eid) {
            if (!merged[eid]) merged[eid] = patch[k][eid];
          });
          patch[k] = merged;
        }
      });
    }

    setState(patch);
    ensureFullStructure();
    if (data.dateJour) document.getElementById('dateJour').value = data.dateJour;
    lastLocalSavedAt = data.savedAt;
    rebuildUI();

    schedulePull();
  }, function (e) { console.error('RT suivi :', e); });
}

function schedulePull() {
  clearTimeout(pullTimer);
  pullTimer = setTimeout(pullChanges, 600);
}

async function pullChanges() {
  if (!db) return;
  try {
    var histSnap = await db.collection('historique').where('updatedAt', '>', lastSyncTimestamp).get();
    histSnap.forEach(function (d) {
      var data = d.data();
      if (data && data.deleted) {
        delete state.historique[d.id];
        if (dataCache.historique) delete dataCache.historique[d.id];
      } else {
        state.historique[d.id] = data;
        dataCache.historique = dataCache.historique || {};
        dataCache.historique[d.id] = data;
      }
    });

    var actSnap = await db.collection('actions').where('updatedAt', '>', lastSyncTimestamp).get();
    actSnap.forEach(function (d) {
      var a = Object.assign({ id: d.id }, d.data() || {});
      var idx = state.actions.findIndex(function (x) { return x.id === a.id; });
      dataCache.actions = dataCache.actions || [];
      var cIdx = dataCache.actions.findIndex(function (x) { return x.id === a.id; });

      if (a.deleted) {
        if (idx >= 0) state.actions.splice(idx, 1);
        if (cIdx >= 0) dataCache.actions.splice(cIdx, 1);
        delete lastSavedActionJson[a.id];
      } else {
        if (idx >= 0) state.actions[idx] = a; else state.actions.push(a);
        if (cIdx >= 0) dataCache.actions[cIdx] = a; else dataCache.actions.push(a);
        lastSavedActionJson[a.id] = JSON.stringify(a);
      }
    });

    lastSyncTimestamp = new Date().toISOString();
    loadedHistDates = Object.keys(state.historique);
    loadedActionIds = state.actions.map(function (a) { return a.id; });
    saveToCache();
    rebuildUI();
  } catch (e) {
    console.error('pullChanges :', e);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 🛡️ Sauvegarde : avec gardes staleMode + tombstones synthCols
// ────────────────────────────────────────────────────────────────────────────
export async function saveFirebase() {
  // 🛡️ Verrou B : si on est en mode obsolète, on refuse de sauvegarder
  // pour ne pas écraser les données des autres avec notre état périmé.
  if (staleMode) {
    setStatus('err', '⚠️ ' + staleModeReason + ' — rechargez (F5)');
    return;
  }

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

  // 🛡️ On marque l'état comme "à jour" avant la sauvegarde : les colonnes
  // locales qui viennent d'être créées et qui sont sur le point d'être envoyées
  // sont maintenant considérées comme "envoyées" (prochain RT snapshot ne les
  // verra plus comme "locales récentes").
  lastCommittedLocalVersion = localVersionCounter;

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
    var savedAt = new Date().toISOString();
    var parts = FIRESTORE_DOC.split('/');

    // 🛡️ On sauvegarde les synthCols AVANT filtrage (avec les tombstones)
    // pour que les autres postes reçoivent les suppressions intentionnelles.
    await db.collection(parts[0]).doc(parts[1]).set({
      S: state.S, S_SC: state.S_SC, S_TT: state.S_TT,
      headersData: state.headersData,
      enginLabels: state.enginLabels, enginLabels_SC: state.enginLabels_SC, enginLabels_TT: state.enginLabels_TT,
      synthCols: state.synthCols,
      colOrder: state.colOrder,
      rassemblement: state.rassemblement,
      customRoles: state.customRoles || [],
      removedRoles: state.removedRoles || [],
      dateJour: dateJour,
      savedAt: savedAt
    });
    lastLocalSavedAt = savedAt;

    if (dateJour && state.historique[dateJour]) {
      await db.collection('historique').doc(dateJour).set({
        ...state.historique[dateJour],
        updatedAt: savedAt
      });
    }

    await syncActions();

    // Suppression fiable (marqueur deleted au lieu de delete brut)
    var currentDates = Object.keys(state.historique);
    for (var i = 0; i < loadedHistDates.length; i++) {
      if (currentDates.indexOf(loadedHistDates[i]) === -1) {
        await db.collection('historique').doc(loadedHistDates[i]).set({ deleted: true, updatedAt: savedAt });
      }
    }
    loadedHistDates = currentDates;

    dirty = false;
    setStatus('ok', '✓ Sauvegardé ' + new Date().toLocaleTimeString('fr-FR'));
  } catch (e) {
    setStatus('err', 'Erreur sauvegarde');
    console.error(e);
  }
}

// v6 : écritures différentielles (seules les actions modifiées sont écrites)
async function syncActions() {
  var currentIds = {};
  state.actions.forEach(function (a) { if (a.id) currentIds[a.id] = true; });
  var ops = [];
  var written = [];
  loadedActionIds.forEach(function (id) { if (!currentIds[id]) ops.push({ del: id }); });
  state.actions.forEach(function (a) {
    if (!a.id) return;
    var j = JSON.stringify(a);
    if (lastSavedActionJson[a.id] !== j) {
      ops.push({ set: Object.assign({}, a, { updatedAt: new Date().toISOString() }) });
      written.push({ id: a.id, json: j });
    }
  });

  for (var s = 0; s < ops.length; s += 450) {
    var batch = db.batch();
    ops.slice(s, s + 450).forEach(function (op) {
      if (op.del) batch.set(db.collection('actions').doc(op.del), { id: op.del, deleted: true, updatedAt: new Date().toISOString() });
      else batch.set(db.collection('actions').doc(op.set.id), op.set);
    });
    await batch.commit();
  }

  written.forEach(function (w) { lastSavedActionJson[w.id] = w.json; });
  ops.forEach(function (op) { if (op.del) delete lastSavedActionJson[op.del]; });
  loadedActionIds = Object.keys(currentIds);
}

function scheduleAutoSave() {
  // 🛡️ En mode obsolète, on ne laisse pas partir d'auto-save (protection B)
  if (staleMode) {
    setStatus('err', '⚠️ Mode hors ligne — sauvegarde bloquée');
    return;
  }
  dirty = true;
  localVersionCounter++;  // 🛡️ Marquer qu'une modification locale est en attente
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function () { saveFirebase(); }, 6000);
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

// ────────────────────────────────────────────────────────────────────────────
// 🛡️ API helper pour supprimer une synthCol avec tombstone
// ────────────────────────────────────────────────────────────────────────────
// À utiliser dans ui-supermarche.js au lieu de faire :
//   state.synthCols = state.synthCols.filter(x => x.id !== c.id);
// Ce helper marque la colonne {deleted: true} au lieu de la retirer,
// pour que les autres postes reçoivent l'information "cette colonne
// a été supprimée" et ne la recréent pas à partir d'un snapshot obsolète.
export function removeSynthCol(colId) {
  if (!Array.isArray(state.synthCols)) return;
  state.synthCols = state.synthCols.map(function (c) {
    if (c.id === colId) return Object.assign({}, c, { deleted: true, deletedAt: new Date().toISOString() });
    return c;
  });
  markDirty();
}

// Purge des tombstones synthCols vieux de plus de N jours
export function purgeSynthColTombstones(daysOld) {
  if (!Array.isArray(state.synthCols)) return false;
  daysOld = daysOld || 14;
  var cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;
  var before = state.synthCols.length;
  state.synthCols = state.synthCols.filter(function (c) {
    if (!c.deleted) return true;
    if (!c.deletedAt) return false;
    return new Date(c.deletedAt).getTime() > cutoff;
  });
  return state.synthCols.length !== before;
}

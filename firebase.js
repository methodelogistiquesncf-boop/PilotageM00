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
    ensureUserDoc(user)
      .then(function () { updateUserBadge(); return loadFirebase(); })
      .then(function () { onLogin(user); });
  });
}

// Affiche "Prénom Nom" dans le badge en haut à droite si ces champs sont
// renseignés (onglet Utilisateurs), sinon l'e-mail en repli. Appelée après
// ensureUserDoc() et aussi depuis ui-users.js quand on modifie son propre profil.
export function updateUserBadge() {
  var el = document.getElementById('userEmail');
  if (!el) return;
  var fullName = (state.currentUserPrenom + ' ' + state.currentUserNom).trim();
  el.textContent = '👤 ' + (fullName || state.currentUserEmail);
}

// Crée la fiche Firestore de l'utilisateur à sa toute première connexion (email,
// rôle vide), ou met à jour sa date de dernière connexion si elle existe déjà.
// Le tout premier utilisateur jamais connecté sur l'appli est promu Administrateur
// automatiquement, pour amorcer la gestion des rôles sans intervention manuelle.
//
// Détection du "premier utilisateur" via un document sentinelle meta/bootstrap
// plutôt qu'une requête list() sur la collection users : un nouvel utilisateur
// n'est pas encore admin au moment de cette vérification, donc un list() serait
// refusé par les règles de sécurité (allow list: if isAdmin()). Un get() sur un
// document précis, lui, reste autorisé.
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

// Crée un nouveau compte (email + rôle + nom/prénom) depuis l'onglet Utilisateurs,
// réservé aux Administrateurs. Utilise une instance Firebase secondaire temporaire pour
// que la création du compte (createUserWithEmailAndPassword) ne déconnecte pas
// la session de l'admin en cours — sinon la connexion active basculerait sur le
// nouveau compte. Le mot de passe généré n'est jamais communiqué : un e-mail de
// réinitialisation est envoyé pour que la personne définisse elle-même le sien.
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
    // Envoyé via l'instance principale : pas besoin d'être connecté en tant que
    // ce compte pour lui envoyer un lien de définition de mot de passe.
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

// Liste tous les profils utilisateurs (pour l'onglet Utilisateurs, réservé aux Administrateurs).
export async function loadUsersList() {
  var snap = await db.collection('users').orderBy('email').get();
  return snap.docs.map(function (d) { return Object.assign({ uid: d.id }, d.data()); });
}

// Variante tolérante utilisée pour l'autocomplétion du champ "Responsable"
// (onglet Actions) : contrairement à loadUsersList(), on l'appelle pour tous
// les rôles, pas seulement les Administrateurs. Les règles Firestore refusant
// le list() sur la collection users aux non-admins, on échoue silencieusement
// et on retourne un tableau vide plutôt que de propager l'erreur.
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

// Met à jour le rôle d'un utilisateur donné.
export async function updateUserRole(uid, role) {
  await db.collection('users').doc(uid).update({ role: role });
  if (uid === state.currentUserUid) state.currentUserRole = role;
}

// Met à jour le prénom et/ou le nom d'un utilisateur (édition directe dans le
// tableau de l'onglet Utilisateurs). patch ex : { prenom: 'Jean' } ou { nom: 'Dupont' }.
export async function updateUserProfile(uid, patch) {
  await db.collection('users').doc(uid).update(patch);
}

// Supprime la fiche Firestore d'un utilisateur (son rôle et ses infos).
// Ne supprime PAS son compte de connexion Firebase Authentication : si la
// personne se reconnecte ensuite, sa fiche est recréée automatiquement (sans
// rôle) par ensureUserDoc, comme pour tout nouvel utilisateur.
export async function deleteUserDoc(uid) {
  await db.collection('users').doc(uid).delete();
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
      if (data.actions) patch.actions = data.actions;
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
    actions: state.actions,
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
    if (data.actions) patch.actions = data.actions;
    setState(patch);
    if (data.dateJour) document.getElementById('dateJour').value = data.dateJour;
  } catch (e) { console.error(e); }
}

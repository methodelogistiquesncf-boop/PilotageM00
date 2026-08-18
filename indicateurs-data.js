// indicateurs-data.js — calcul + enregistrement des points J-0 / J-3
import { state, ENGINS_CONFIG, showConfirm } from './state.js';
import { getDb } from './firebase.js';

function parseScore(str) {
  if (!str || !String(str).trim()) return null;
  var m = String(str).trim().match(/^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)$/);
  if (!m) return null;
  var num = parseFloat(m[1].replace(',', '.'));
  var den = parseFloat(m[2].replace(',', '.'));
  if (!den) return null;
  return { num: num, den: den };
}
function fmt(v) { return (typeof v === 'number') ? String(v).replace('.', ',') + ' %' : '—'; }

var MOIS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
function monthLabel(key) {
  var p = String(key).split('-');
  return (MOIS_FR[parseInt(p[1], 10) - 1] || p[1]) + ' ' + p[0];
}

// 🔑 % = somme(num) / somme(den) × 100 sur les 3 stations × 4 engins de la colonne
export function computeColPct(p, section) {
  var num = 0, den = 0;
  [state.S_SC, state.S, state.S_TT].forEach(function (z) {
    ENGINS_CONFIG.forEach(function (e) {
      var cell = z[e.id] && z[e.id][section] ? z[e.id][section][p] : null;
      var sc = parseScore(cell ? cell.score : '');
      if (sc) { num += sc.num; den += sc.den; }
    });
  });
  return den > 0 ? Math.round((num / den) * 1000) / 10 : null;
}

var toastEl = null, toastTimer = null;
function toast(msg) {
  if (!document.getElementById('indToastStyle')) {
    var st = document.createElement('style');
    st.id = 'indToastStyle';
    st.textContent = '.ind-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(8px);background:#111827;color:#fff;font-size:12px;font-weight:600;padding:8px 16px;border-radius:20px;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.25);white-space:pre-line;text-align:center;max-width:80%;}';
    document.head.appendChild(st);
  }
  if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'ind-toast'; document.body.appendChild(toastEl); }
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 3000);
}

export async function recordJourPoint(kind, idx, j) {
  if (kind !== 'fixed') { toast('Boutons J-0 / J-3 :\ndisponibles sur les colonnes de dates uniquement'); return; }
  var p = state.colOrder[parseInt(idx, 10)];
  var dateISO = state.headersData.dates[parseInt(idx, 10)];
  if (!dateISO) { toast('Aucune date sur cette colonne'); return; }

  var monthKey = dateISO.slice(0, 7);
  var dayKey = String(parseInt(dateISO.slice(8, 10), 10));
  var line = (j === '0') ? 'j0' : 'j3';
  var db = getDb();
  if (!db) { toast('Firebase non connecté'); return; }

  var ref = db.collection('indicateurs').doc(monthKey);
  var snap = await ref.get();
  var doc = snap.exists ? (snap.data() || {}) : {};
  var jours = doc.jours || {};
  var entry = jours[dayKey] || { appro: {}, pieces: {} };

  var newVals = {
    appro: computeColPct(p, 'APPROS'),
    pieces: computeColPct(p, 'PIECES DEPOSEES')
  };

  var existing = (entry.appro && entry.appro[line] !== undefined) || (entry.pieces && entry.pieces[line] !== undefined);
  if (existing) {
    var lblLine = (line === 'j0') ? 'J-0' : 'J-3';
    var ok = await showConfirm(
      'Une valeur existe déjà pour le ' + dayKey + ' ' + monthLabel(monthKey) + ' :\n' +
      'APPROS (' + lblLine + ') : ' + fmt(entry.appro[line]) + ' → ' + fmt(newVals.appro) + '\n' +
      'PIÈCES DÉPOSÉES (' + lblLine + ') : ' + fmt(entry.pieces[line]) + ' → ' + fmt(newVals.pieces) + '\n\n' +
      'Remplacer par les nouvelles valeurs ?',
      { title: 'Confirmer le remplacement', okLabel: 'Remplacer' }
    );
    if (!ok) return;
  }

  entry.appro = entry.appro || {}; entry.pieces = entry.pieces || {};
  entry.appro[line] = newVals.appro;
  entry.pieces[line] = newVals.pieces;
  jours[dayKey] = entry;

  await ref.set({ mois: monthKey, jours: jours, updatedAt: new Date().toISOString() });
  toast('✓ Point ' + line.toUpperCase() + ' enregistré le ' + dayKey + '\nAPPROS : ' + fmt(newVals.appro) + '  •  PIÈCES : ' + fmt(newVals.pieces));
}

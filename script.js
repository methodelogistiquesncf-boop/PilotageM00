const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAYRfaLdg--2SkTCyeNa1Xsq2vpSRBz8kY",
  authDomain: "pilotagem00.firebaseapp.com",
  projectId: "pilotagem00",
  storageBucket: "pilotagem00.firebasestorage.app",
  messagingSenderId: "455481915450",
  appId: "1:455481915450:web:cbc9430df70b6f4107dd03"
};

const FIRESTORE_DOC = "suivi/default";

const ENGINS_CONFIG = [
  { id:'p18', defaultLabel:'V16 P18', sections:['APPROS','PIECES DEPOSEES'] },
  { id:'p26', defaultLabel:'V16 P26', sections:['APPROS','PIECES DEPOSEES'] },
];
const D_FIXED = 4;

let S = {};
let headersData = { dates: [], jours: [] };
let enginLabels = {};
let synthCols = [];
let colOrder = [0,1,2,3];
let historique = {};
let db = null;
let saveTimer = null;
let currentChartTab = 'courant';
let currentChartSection = 'APPROS';

// ─── AUTH ───────────────────────────────────────────────────────────────────
firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();

auth.onAuthStateChanged(function(user) {
  if (!user) { window.location.href = 'login.html'; return; }
  document.getElementById('userEmail').textContent = '👤 ' + user.email;
  document.getElementById('userBadge').style.display = 'flex';
  db = firebase.firestore();
  setStatus('sync', 'Chargement...');
  loadFirebase();
});

function doLogout() {
  auth.signOut().then(function() { window.location.href = 'login.html'; });
}

function setStatus(type, msg) {
  var el = document.getElementById('fbStatus');
  if(el) {
    el.className = type;
    el.textContent = msg;
  }
}

// ─── FIREBASE LOAD ───────────────────────────────────────────────────────────
async function loadFirebase() {
  try {
    var parts = FIRESTORE_DOC.split('/');
    var snap = await db.collection(parts[0]).doc(parts[1]).get();
    if (snap.exists) {
      var data = snap.data();
      if (data.S)           S           = data.S;
      if (data.headersData) headersData = data.headersData;
      if (data.enginLabels) enginLabels = data.enginLabels;
      if (data.synthCols)   synthCols   = data.synthCols;
      if (data.historique)  historique  = data.historique;
      if (data.colOrder)    colOrder    = data.colOrder;
      if (data.dateJour)    document.getElementById('dateJour').value = data.dateJour;
      setStatus('ok', '✓ Synchronisé');
    } else {
      setStatus('ok', 'Nouveau document');
      init();
    }
  } catch(e) {
    setStatus('err', 'Erreur lecture Firebase');
    console.error(e);
    loadLocal();
  }
  finishBoot();
}

// ─── FIREBASE SAVE ───────────────────────────────────────────────────────────
async function saveFirebase() {
  var dateJour = document.getElementById('dateJour').value;

  if (dateJour) {
    var p0 = colOrder[0];
    var entree = { date: dateJour, savedAt: new Date().toISOString(), engins: {} };
    ENGINS_CONFIG.forEach(function(e) {
      entree.engins[e.id] = { loco: S[e.id] ? (S[e.id].loco[p0] || '') : '' };
      e.sections.forEach(function(sec) {
        var cell = S[e.id] && S[e.id][sec] ? S[e.id][sec][p0] : { score:'', dot:null };
        entree.engins[e.id][sec] = { score: cell.score || '', dot: cell.dot || null };
      });
    });
    historique[dateJour] = entree;
  }

  var payload = {
    S: S,
    headersData: headersData,
    enginLabels: enginLabels,
    synthCols: synthCols,
    historique: historique,
    colOrder: colOrder,
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
  } catch(e) {
    setStatus('err', 'Erreur sauvegarde');
    console.error(e);
  }
}

function scheduleAutoSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function() { saveFirebase(); }, 3000);
  setStatus('sync', 'Modifications en cours...');
}

function loadLocal() {
  try {
    var bk = localStorage.getItem('sp_backup');
    if (!bk) return;
    var data = JSON.parse(bk);
    if (data.S)           S           = data.S;
    if (data.headersData) headersData = data.headersData;
    if (data.enginLabels) enginLabels = data.enginLabels;
    if (data.synthCols)   synthCols   = data.synthCols;
    if (data.historique)  historique  = data.historique;
    if (data.colOrder)    colOrder    = data.colOrder;
    if (data.dateJour)    document.getElementById('dateJour').value = data.dateJour;
  } catch(e) { console.error(e); }
}

function init() {
  S = {}; enginLabels = {};
  ENGINS_CONFIG.forEach(function(e) {
    enginLabels[e.id] = e.defaultLabel;
    S[e.id] = { loco: Array(D_FIXED).fill('') };
    e.sections.forEach(function(s) {
      S[e.id][s] = Array.from({length: D_FIXED}, function() { return {note:'',score:'',dot:null}; });
    });
  });
  headersData = { dates: Array(D_FIXED).fill(''), jours: ['J0','J-1','J-2','J-3'] };
  colOrder = [0,1,2,3];
}

function makeSynthColData() {
  var col = { id: 'sc_' + Date.now(), date: '', jour: '', enginData: {} };
  ENGINS_CONFIG.forEach(function(e) {
    col.enginData[e.id] = { loco: '' };
    e.sections.forEach(function(s) { col.enginData[e.id][s] = { note:'', dot:null, score:'' }; });
  });
  return col;
}

function isoToDisplay(iso) {
  if (!iso) return '';
  var parts = iso.split('-');
  if (parts.length === 3) return parts[2] + '/' + parts[1];
  return iso;
}

function build() { buildHeader(); buildBody(); }

function buildHeader() {
  var row = document.getElementById('headerRow');
  if(!row) return;
  while (row.children.length > 1) row.removeChild(row.lastChild);

  for (var d=0; d<D_FIXED; d++) {
    var th = document.createElement('th');
    th.className = 'th-top';
    var display = document.createElement('span');
    display.className = 'th-date-display';
    display.textContent = isoToDisplay(headersData.dates[d]) || '—/—';
    var picker = document.createElement('input');
    picker.type = 'date';
    picker.className = 'th-date-picker';
    picker.value = headersData.dates[d] || '';

    (function(sp, pk, idx) {
      sp.onclick = function() {
        pk.classList.add('visible');
        pk.focus();
        try { pk.showPicker && pk.showPicker(); } catch(e) {}
      };
      pk.onchange = function() {
        headersData.dates[idx] = pk.value;
        sp.textContent = isoToDisplay(pk.value) || '—/—';
        pk.classList.remove('visible');
        scheduleAutoSave();
      };
      pk.onblur = function() { pk.classList.remove('visible'); };
    })(display, picker, d);

    th.appendChild(display);
    th.appendChild(picker);
    th.appendChild(makeInput('th-header-input th-j', headersData.jours[d], 'Jour', makeJourUpdater(d)));
    row.appendChild(th);
  }

  synthCols.forEach(function(col) {
    var th = document.createElement('th');
    th.className = 'th-top synth-col';
    var display = document.createElement('span');
    display.className = 'th-date-display';
    display.textContent = isoToDisplay(col.date) || col.date || '—/—';
    var picker = document.createElement('input');
    picker.type = 'date';
    picker.className = 'th-date-picker';
    picker.value = col.date || '';

    (function(sp, pk, c) {
      sp.onclick = function() {
        pk.classList.add('visible');
        pk.focus();
        try { pk.showPicker && pk.showPicker(); } catch(e) {}
      };
      pk.onchange = function() {
        c.date = pk.value;
        sp.textContent = isoToDisplay(pk.value) || '—/—';
        pk.classList.remove('visible');
        scheduleAutoSave();
      };
      pk.onblur = function() { pk.classList.remove('visible'); };
    })(display, picker, col);

    th.appendChild(display);
    th.appendChild(picker);
    th.appendChild(makeInput('th-header-input th-j', col.jour, 'Jour', function(v){ col.jour=v; scheduleAutoSave(); }));
    var delBtn = document.createElement('button');
    delBtn.className = 'btn-del-col';
    delBtn.textContent = '✕ Supprimer';
    (function(c){ delBtn.onclick = function(){ synthCols = synthCols.filter(function(x){ return x.id!==c.id; }); build(); scheduleAutoSave(); }; })(col);
    th.appendChild(delBtn);
    row.appendChild(th);
  });
}

function makeInput(cls, val, placeholder, onInput) {
  var inp = document.createElement('input');
  inp.type = 'text'; inp.className = cls; inp.placeholder = placeholder; inp.value = val || '';
  inp.oninput = function(e) { onInput(e.target.value); };
  return inp;
}

function makeJourUpdater(idx) { return function(v){ headersData.jours[idx]=v; scheduleAutoSave(); }; }

function buildBody() {
  var tb = document.getElementById('tbody');
  if(!tb) return;
  tb.innerHTML = '';
  ENGINS_CONFIG.forEach(function(e) {
    var rEngin = document.createElement('tr'); rEngin.className = 'row-engin';
    var tdLbl = document.createElement('td'); tdLbl.textContent = 'ENGIN'; rEngin.appendChild(tdLbl);
    for (var d=0; d<D_FIXED; d++) {
      var td = document.createElement('td'); td.className = 'loco-cell';
      td.appendChild(makeLoco_fixed(e.id, colOrder[d])); rEngin.appendChild(td);
    }
    synthCols.forEach(function(col) {
      var td = document.createElement('td'); td.className = 'loco-cell'; td.style.background='#d4dff0';
      td.appendChild(makeLoco_synth(col, e.id)); rEngin.appendChild(td);
    });
    tb.appendChild(rEngin);

    var rTitle = document.createElement('tr'); rTitle.className = 'row-label';
    var tdT = document.createElement('td'); tdT.className = 'label';
    tdT.appendChild(makeEnginLabelInput(e.id)); rTitle.appendChild(tdT);
    for (var d2=0; d2<D_FIXED; d2++) { var td2=document.createElement('td'); td2.className='data-cell'; rTitle.appendChild(td2); }
    synthCols.forEach(function(){ var td=document.createElement('td'); td.className='data-cell synth-cell'; rTitle.appendChild(td); });
    tb.appendChild(rTitle);

    e.sections.forEach(function(s) {
      var rNote = document.createElement('tr'); rNote.className = 'row-label';
      var tdSL = document.createElement('td'); tdSL.className = 'label'; tdSL.textContent = s; rNote.appendChild(tdSL);
      for (var d3=0; d3<D_FIXED; d3++) {
        var td3 = document.createElement('td'); td3.className = 'data-cell';
        td3.appendChild(makeNote_fixed(e.id, s, colOrder[d3])); rNote.appendChild(td3);
      }
      synthCols.forEach(function(col) {
        var td = document.createElement('td'); td.className = 'data-cell synth-cell';
        td.appendChild(makeNote_synth(col, e.id, s)); rNote.appendChild(td);
      });
      tb.appendChild(rNote);

      var rScore = document.createElement('tr'); rScore.className = 'row-score';
      var tdSS = document.createElement('td'); tdSS.className = 'label'; rScore.appendChild(tdSS);
      for (var d4=0; d4<D_FIXED; d4++) {
        var td4 = document.createElement('td');
        td4.appendChild(makeScoreInner_fixed(e.id, s, colOrder[d4])); rScore.appendChild(td4);
      }
      synthCols.forEach(function(col) {
        var td = document.createElement('td'); td.className = 'synth-cell';
        td.appendChild(makeScoreInner_synth(col, e.id, s)); rScore.appendChild(td);
      });
      tb.appendChild(rScore);
    });
  });
}

function autoResize(ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }

function makeLoco_fixed(eid, p) {
  var inp = document.createElement('input');
  inp.className='loco'; inp.type='text'; inp.placeholder='N° engin...'; inp.value=S[eid].loco[p] || '';
  (function(ei,pi){ inp.oninput = function(){ S[ei].loco[pi]=inp.value; scheduleAutoSave(); }; })(eid,p);
  return inp;
}

function makeLoco_synth(col, eid) {
  var inp = document.createElement('input');
  inp.className='loco'; inp.type='text'; inp.placeholder='N° engin...'; inp.value=col.enginData[eid].loco || '';
  inp.oninput = function(){ col.enginData[eid].loco=inp.value; scheduleAutoSave(); };
  return inp;
}

function makeNote_fixed(eid, s, p) {
  var ta = document.createElement('textarea');
  ta.className='note'; ta.placeholder='Remarque...'; ta.value=S[eid][s][p].note || '';
  (function(ei,si,pi){ ta.oninput = function(){ S[ei][si][pi].note=ta.value; autoResize(ta); scheduleAutoSave(); }; })(eid,s,p);
  requestAnimationFrame(function(){ autoResize(ta); });
  return ta;
}

function makeNote_synth(col, eid, s) {
  var ta = document.createElement('textarea');
  ta.className='note'; ta.placeholder='Remarque...'; ta.value=col.enginData[eid][s].note || '';
  ta.oninput = function(){ col.enginData[eid][s].note=ta.value; autoResize(ta); scheduleAutoSave(); };
  requestAnimationFrame(function(){ autoResize(ta); });
  return ta;
}

function makeEnginLabelInput(eid) {
  var inp = document.createElement('input');
  inp.className='engin-label-input'; inp.type='text'; inp.value=enginLabels[eid]||'';
  inp.oninput = function(){ enginLabels[eid]=inp.value; scheduleAutoSave(); };
  return inp;
}

function makeDot(getVal, setVal, color) {
  var btn = document.createElement('button');
  btn.className = 'dot-btn ' + (getVal()===color ? color : 'off');
  btn.onclick = function(){ setVal(getVal()===color ? null : color); build(); scheduleAutoSave(); };
  return btn;
}

function makeScoreInner_fixed(eid, s, p) {
  var inner = document.createElement('div'); inner.className = 'score-inner';
  (function(ei,si,pi){
    inner.appendChild(makeDot(function(){ return S[ei][si][pi].dot; }, function(v){ S[ei][si][pi].dot=v; }, 'green'));
    inner.appendChild(makeDot(function(){ return S[ei][si][pi].dot; }, function(v){ S[ei][si][pi].dot=v; }, 'red'));
    var inp = document.createElement('input');
    inp.className='score'; inp.type='text'; inp.placeholder='0/0'; inp.value=S[ei][si][pi].score || '';
    inp.oninput = function(){ S[ei][si][pi].score=inp.value; scheduleAutoSave(); };
    inner.appendChild(inp);
  })(eid,s,p);
  return inner;
}

function makeScoreInner_synth(col, eid, s) {
  var data = col.enginData[eid][s];
  var inner = document.createElement('div'); inner.className = 'score-inner';
  inner.appendChild(makeDot(function(){ return data.dot; }, function(v){ data.dot=v; }, 'green'));
  inner.appendChild(makeDot(function(){ return data.dot; }, function(v){ data.dot=v; }, 'red'));
  var inp = document.createElement('input');
  inp.className='score'; inp.type='text'; inp.placeholder='0/0'; inp.value=data.score || '';
  inp.oninput = function(){ data.score=inp.value; scheduleAutoSave(); };
  inner.appendChild(inp);
  return inner;
}

function addSynthCol() { synthCols.push(makeSynthColData()); build(); scheduleAutoSave(); }

function resetAll() {
  if (!confirm('Réinitialiser toutes les données du tableau ?')) return;
  init(); synthCols = []; build(); scheduleAutoSave();
}

function exportCSV() {
  var rows = [['Engin','Section','Jour','Date','N° Engin','Remarque','Score','Statut']];
  ENGINS_CONFIG.forEach(function(e) {
    e.sections.forEach(function(s) {
      for (var d=0; d<D_FIXED; d++) {
        var p = colOrder[d];
        var c = S[e.id][s][p];
        rows.push([enginLabels[e.id]||e.defaultLabel, s, headersData.jours[d]||'J-'+d, isoToDisplay(headersData.dates[d])||'', S[e.id].loco[p]||'', c.note||'', c.score||'', c.dot==='green'?'OK':c.dot==='red'?'NOK':'']);
      }
    });
  });
  synthCols.forEach(function(col, ci) {
    ENGINS_CONFIG.forEach(function(e) {
      e.sections.forEach(function(s) {
        var data = col.enginData[e.id][s];
        rows.push([enginLabels[e.id]||e.defaultLabel, s, col.jour||'Synthèse '+(ci+1), isoToDisplay(col.date)||'', col.enginData[e.id].loco||'', data.note||'', data.score||'', data.dot==='green'?'OK':data.dot==='red'?'NOK':'']);
      });
    });
  });
  var csv = '\ufeff' + rows.map(function(r){ return r.map(function(v){ return '"'+String(v).replace(/"/g,'""')+'"'; }).join(';'); }).join('\n');
  var blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href=url; a.download='suivi_prod_'+(document.getElementById('dateJour').value||'export')+'.csv';
  a.click(); URL.revokeObjectURL(url);
}

function openHistorique() {
  document.getElementById('histOverlay').classList.add('open');
  renderHistTable();
}
function closeHistorique() { document.getElementById('histOverlay').classList.remove('open'); }

function renderHistTable() {
  var from = document.getElementById('histFrom').value;
  var to   = document.getElementById('histTo').value;
  var wrap = document.getElementById('histTableWrap');
  var entries = Object.values(historique).sort(function(a,b){ return a.date.localeCompare(b.date); });
  if (from) entries = entries.filter(function(e){ return e.date >= from; });
  if (to)   entries = entries.filter(function(e){ return e.date <= to; });

  if (entries.length === 0) {
    wrap.innerHTML = '<div class="hist-empty">Aucune entrée.</div>';
    return;
  }
  var html = '<table class="hist-table"><thead><tr><th>Date</th><th>Score</th><th></th></tr></thead><tbody>';
  entries.forEach(function(entry) {
    html += '<tr><td>'+entry.date+'</td><td>Score détaillé ici...</td><td><button onclick="deleteHistEntry(\''+entry.date+'\')">X</button></td></tr>';
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;
}

function deleteHistEntry(date) {
  if (!confirm('Supprimer ?')) return;
  delete historique[date];
  renderHistTable();
  scheduleAutoSave();
}

function parseScore(str) {
  if (!str) return null;
  var m = str.trim().match(/^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)$/);
  if (!m) return null;
  var num = parseFloat(m[1].replace(',','.')), den = parseFloat(m[2].replace(',','.'));
  return den === 0 ? null : { num:num, den:den };
}

function drawChart() {
    // Logique simplifiée du dessin du graphique (Chart.js ou Canvas manuel)
    var canvas = document.getElementById('approsChart');
    if(!canvas) return;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillText("Graphique en cours de génération...", 10, 50);
}

function openChart() { document.getElementById('chartOverlay').classList.add('open'); drawChart(); }
function closeChart() { document.getElementById('chartOverlay').classList.remove('open'); }

function switchSection(sec) { currentChartSection = sec; drawChart(); }
function switchTab(tab) { currentChartTab = tab; drawChart(); }

function passerJourSuivant() {
  var dateActuelle = document.getElementById("dateJour").value;
  if (!dateActuelle) return;
  if (!confirm("Passer au jour suivant ?")) return;

  colOrder = [colOrder[3], colOrder[0], colOrder[1], colOrder[2]];
  var d = new Date(dateActuelle + "T00:00:00");
  d.setDate(d.getDate() + 1);
  document.getElementById("dateJour").value = d.toISOString().split('T')[0];

  build();
  saveFirebase();
}

function finishBoot() {
  build();
}

// Initialisation par défaut
var now = new Date();
var inputDate = document.getElementById('dateJour');
if(inputDate) inputDate.value = now.toISOString().split('T')[0];

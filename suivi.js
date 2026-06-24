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
let rassemblement = [];   // [{ id, date, jour, rows:[{id,engin,kit,symbole,designation,qte,commentaire,recu,dateRecu}] }]
let showRecus = false;
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
  el.className = type;
  el.textContent = msg;
}

// ─── ONGLETS PRINCIPAUX ───────────────────────────────────────────────────
function switchMainTab(tab) {
  var isSuivi = tab === 'suivi';
  document.getElementById('tabViewSuivi').classList.toggle('active', isSuivi);
  document.getElementById('tabViewManquants').classList.toggle('active', !isSuivi);
  document.getElementById('panelSuivi').classList.toggle('active', isSuivi);
  document.getElementById('panelManquants').classList.toggle('active', !isSuivi);
}

// ─── FIREBASE LOAD ───────────────────────────────────────────────────────────
async function loadFirebase() {
  try {
    var parts = FIRESTORE_DOC.split('/');
    var snap = await db.collection(parts[0]).doc(parts[1]).get();
    if (snap.exists) {
      var data = snap.data();
      if (data.S)            S            = data.S;
      if (data.headersData)  headersData  = data.headersData;
      if (data.enginLabels)  enginLabels  = data.enginLabels;
      if (data.synthCols)    synthCols    = data.synthCols;
      if (data.historique)   historique   = data.historique;
      if (data.colOrder)     colOrder     = data.colOrder;
      if (data.rassemblement) rassemblement = data.rassemblement;
      if (data.dateJour)     document.getElementById('dateJour').value = data.dateJour;
      setStatus('ok', '✓ Synchronisé');
    } else {
      setStatus('ok', 'Nouveau document');
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
    rassemblement: rassemblement,
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
    if (data.S)            S            = data.S;
    if (data.headersData)  headersData  = data.headersData;
    if (data.enginLabels)  enginLabels  = data.enginLabels;
    if (data.synthCols)    synthCols    = data.synthCols;
    if (data.historique)   historique   = data.historique;
    if (data.colOrder)     colOrder     = data.colOrder;
    if (data.rassemblement) rassemblement = data.rassemblement;
    if (data.dateJour)     document.getElementById('dateJour').value = data.dateJour;
  } catch(e) { console.error(e); }
}

// ─── INIT ────────────────────────────────────────────────────────────────────
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

// ─── BUILD TABLE (Supermarché) ───────────────────────────────────────────────
function build() { buildHeader(); buildBody(); }

function buildHeader() {
  var row = document.getElementById('headerRow');
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
      pk.onblur = function() {
        pk.classList.remove('visible');
      };
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

function makeUpdater(arr, idx) { return function(v){ arr[idx]=v; scheduleAutoSave(); }; }
function makeJourUpdater(idx) { return function(v){ headersData.jours[idx]=v; scheduleAutoSave(); }; }

function buildBody() {
  var tb = document.getElementById('tbody');
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

// ─── HELPERS DOM (Supermarché) ───────────────────────────────────────────────
function makeInput(cls, val, placeholder, onInput) {
  var inp = document.createElement('input');
  inp.type = 'text'; inp.className = cls; inp.placeholder = placeholder; inp.value = val || '';
  inp.oninput = function(e) { onInput(e.target.value); };
  return inp;
}
function autoResize(ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }

function makeLoco_fixed(eid, p) {
  var inp = document.createElement('input');
  inp.className='loco'; inp.type='text'; inp.placeholder='N° engin...'; inp.value=S[eid].loco[p];
  (function(ei,pi){ inp.oninput = function(){ S[ei].loco[pi]=inp.value; scheduleAutoSave(); }; })(eid,p);
  return inp;
}
function makeLoco_synth(col, eid) {
  var inp = document.createElement('input');
  inp.className='loco'; inp.type='text'; inp.placeholder='N° engin...'; inp.value=col.enginData[eid].loco;
  inp.oninput = function(){ col.enginData[eid].loco=inp.value; scheduleAutoSave(); };
  return inp;
}
function makeNote_fixed(eid, s, p) {
  var ta = document.createElement('textarea');
  ta.className='note'; ta.placeholder='Remarque...'; ta.value=S[eid][s][p].note;
  (function(ei,si,pi){ ta.oninput = function(){ S[ei][si][pi].note=ta.value; autoResize(ta); scheduleAutoSave(); }; })(eid,s,p);
  requestAnimationFrame(function(){ autoResize(ta); });
  return ta;
}
function makeNote_synth(col, eid, s) {
  var ta = document.createElement('textarea');
  ta.className='note'; ta.placeholder='Remarque...'; ta.value=col.enginData[eid][s].note;
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
  btn.title = color==='green'?'OK':'NOK';
  btn.setAttribute('aria-label', color==='green'?'OK':'NOK');
  btn.onclick = function(){ setVal(getVal()===color ? null : color); build(); scheduleAutoSave(); };
  return btn;
}
function makeScoreInner_fixed(eid, s, p) {
  var inner = document.createElement('div'); inner.className = 'score-inner';
  (function(ei,si,pi){
    inner.appendChild(makeDot(function(){ return S[ei][si][pi].dot; }, function(v){ S[ei][si][pi].dot=v; }, 'green'));
    inner.appendChild(makeDot(function(){ return S[ei][si][pi].dot; }, function(v){ S[ei][si][pi].dot=v; }, 'red'));
    var inp = document.createElement('input');
    inp.className='score'; inp.type='text'; inp.placeholder='0/0'; inp.value=S[ei][si][pi].score;
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
  inp.className='score'; inp.type='text'; inp.placeholder='0/0'; inp.value=data.score;
  inp.oninput = function(){ data.score=inp.value; scheduleAutoSave(); };
  inner.appendChild(inp);
  return inner;
}

function addSynthCol() { synthCols.push(makeSynthColData()); build(); scheduleAutoSave(); }

function resetAll() {
  if (!confirm('Réinitialiser toutes les données du tableau ?\n(L\'historique est conservé)')) return;
  init(); synthCols = []; build(); scheduleAutoSave();
}

// ─── EXPORT CSV (Supermarché) ─────────────────────────────────────────────────
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

// ─── HISTORIQUE MODAL (Supermarché) ───────────────────────────────────────────
function openHistorique() {
  document.getElementById('histOverlay').classList.add('open');
  renderHistTable();
}
function closeHistorique() { document.getElementById('histOverlay').classList.remove('open'); }
document.getElementById('histOverlay').addEventListener('click', function(e){ if(e.target===this) closeHistorique(); });

function clearHistFilter() {
  document.getElementById('histFrom').value = '';
  document.getElementById('histTo').value = '';
  renderHistTable();
}

function renderHistTable() {
  var from = document.getElementById('histFrom').value;
  var to   = document.getElementById('histTo').value;
  var wrap = document.getElementById('histTableWrap');

  var entries = Object.values(historique).sort(function(a,b){ return a.date.localeCompare(b.date); });
  if (from) entries = entries.filter(function(e){ return e.date >= from; });
  if (to)   entries = entries.filter(function(e){ return e.date <= to; });

  if (entries.length === 0) {
    wrap.innerHTML = '<div class="hist-empty">Aucune entrée dans l\'historique pour cette période.</div>';
    return;
  }

  var sections = [];
  ENGINS_CONFIG.forEach(function(e) {
    e.sections.forEach(function(s) { sections.push({ eid: e.id, label: (enginLabels[e.id]||e.defaultLabel)+' — '+s, sec: s }); });
  });

  var html = '<table class="hist-table"><thead><tr>';
  html += '<th>Date</th><th>Heure save</th>';
  sections.forEach(function(col) { html += '<th>'+col.label+'</th>'; });
  html += '<th></th></tr></thead><tbody>';

  entries.forEach(function(entry) {
    var heure = entry.savedAt ? new Date(entry.savedAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '—';
    var dateAff = entry.date ? entry.date.split('-').reverse().join('/') : '—';
    html += '<tr>';
    html += '<td><strong>'+dateAff+'</strong></td><td>'+heure+'</td>';
    sections.forEach(function(col) {
      var eg = entry.engins && entry.engins[col.eid];
      var sc = eg && eg[col.sec];
      var score = sc ? (sc.score||'—') : '—';
      var dot   = sc ? (sc.dot||'none') : 'none';
      html += '<td class="dot-cell"><span class="hist-dot '+dot+'"></span> '+score+'</td>';
    });
    html += '<td><button class="hist-del-btn" onclick="deleteHistEntry(\''+entry.date+'\')">Supprimer</button></td>';
    html += '</tr>';
  });

  html += '</tbody></table>';
  wrap.innerHTML = html;
}

function deleteHistEntry(date) {
  if (!confirm('Supprimer l\'entrée du '+date.split('-').reverse().join('/')+' de l\'historique ?')) return;
  delete historique[date];
  renderHistTable();
  scheduleAutoSave();
}

// ─── GRAPHIQUE (Supermarché) ──────────────────────────────────────────────────
function parseScore(str) {
  if (!str || !str.trim()) return null;
  var m = str.trim().match(/^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)$/);
  if (!m) return null;
  var num = parseFloat(m[1].replace(',','.')), den = parseFloat(m[2].replace(',','.'));
  if (den===0) return null;
  return { num:num, den:den };
}

function buildChartData_courant() {
  var cols = [];
  for (var d=0; d<D_FIXED; d++) {
    (function(di){
      var p = colOrder[di];
      cols.push({ label: isoToDisplay(headersData.dates[di])||headersData.jours[di]||('J-'+di), getScore: function(eid,sec){ return S[eid][sec][p].score; } });
    })(d);
  }
  synthCols.forEach(function(col) {
    cols.push({ label: isoToDisplay(col.date)||col.jour||'Synthèse', getScore: function(eid,sec){ return col.enginData[eid][sec].score; } });
  });
  return computeChartSeries(cols, currentChartSection);
}

function buildChartData_historique() {
  var entries = Object.values(historique).sort(function(a,b){ return a.date.localeCompare(b.date); });
  var cols = entries.map(function(entry) {
    return {
      label: entry.date ? entry.date.slice(5).split('-').reverse().join('/') : '?',
      getScore: function(eid, sec) {
        var eg = entry.engins && entry.engins[eid];
        return eg && eg[sec] ? eg[sec].score : '';
      }
    };
  });
  return computeChartSeries(cols, currentChartSection);
}

function computeChartSeries(cols, section) {
  var series = {};
  series["total"] = { label: "Total " + section, values: [] };
  var labels = cols.map(function(col) { return col.label; });
  cols.forEach(function(col) {
    var totalNum=0, totalDen=0, totalHas=false;
    ENGINS_CONFIG.forEach(function(e) {
      var p = parseScore(col.getScore(e.id, section));
      if (p) { totalNum+=p.num; totalDen+=p.den; totalHas=true; }
    });
    series["total"].values.push(totalHas && totalDen>0 ? Math.round((totalNum/totalDen)*1000)/10 : null);
  });
  return { labels:labels, series:series };
}

function switchSection(section) {
  currentChartSection = section;
  var sectionTabs = document.getElementById('sectionTabs');
  Array.prototype.forEach.call(sectionTabs.children, function(btn) {
    btn.classList.toggle('active', btn.id === 'sec' + section.replace(/\s+/g, '_'));
  });
  document.getElementById('chartTitle').textContent = 'Taux de réalisation ' + section;
  drawChart();
}

function switchTab(tab) {
  currentChartTab = tab;
  document.getElementById('tabCourant').classList.toggle('active', tab==='courant');
  document.getElementById('tabHistorique').classList.toggle('active', tab==='historique');
  drawChart();
}

function openChart()  { document.getElementById('chartOverlay').classList.add('open'); drawChart(); }
function closeChart() { document.getElementById('chartOverlay').classList.remove('open'); }
document.getElementById('chartOverlay').addEventListener('click', function(e){ if(e.target===this) closeChart(); });

var SERIES_COLORS = ['#1a4fa0','#f5a623','#22a050','#d03030','#9b59b6'];

function drawChart() {
  var data = currentChartTab === 'historique' ? buildChartData_historique() : buildChartData_courant();
  var labels = data.labels;
  var seriesKeys = Object.keys(data.series);

  var canvas = document.getElementById('approsChart');
  var ctx = canvas.getContext('2d');
  var W = canvas.offsetWidth || 860, H = 340;
  canvas.width = W; canvas.height = H;

  var PAD = { top:40, right:30, bottom:55, left:55 };
  var cW = W-PAD.left-PAD.right, cH = H-PAD.top-PAD.bottom;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H);

  var n = labels.length;
  if (n===0) {
    ctx.fillStyle='#888'; ctx.font='13px Segoe UI,sans-serif'; ctx.textAlign='center';
    ctx.fillText('Aucune donnée disponible', W/2, H/2); return;
  }

  for (var pct=0; pct<=100; pct+=10) {
    var y = PAD.top+cH-(pct/100)*cH;
    ctx.strokeStyle='#e0ddd6'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(PAD.left,y); ctx.lineTo(PAD.left+cW,y); ctx.stroke();
    ctx.fillStyle='#888'; ctx.font='11px Segoe UI,sans-serif'; ctx.textAlign='right';
    ctx.fillText(pct+'%', PAD.left-6, y+4);
  }

  ctx.strokeStyle='#aaa'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(PAD.left,PAD.top); ctx.lineTo(PAD.left,PAD.top+cH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(PAD.left,PAD.top+cH); ctx.lineTo(PAD.left+cW,PAD.top+cH); ctx.stroke();

  var step = n > 1 ? cW/(n-1) : 0;
  ctx.fillStyle='#555'; ctx.font='10px Segoe UI,sans-serif'; ctx.textAlign='center';
  labels.forEach(function(lbl,i) {
    var x = n===1 ? PAD.left+cW/2 : PAD.left+i*step;
    ctx.save();
    if (n > 15) { ctx.translate(x, H-PAD.bottom+10); ctx.rotate(-Math.PI/4); ctx.textAlign='right'; ctx.fillText(lbl,0,0); ctx.restore(); }
    else { ctx.fillText(lbl, x, H-PAD.bottom+18); ctx.restore(); }
  });

  seriesKeys.forEach(function(key, ki) {
    var serie = data.series[key];
    var color = SERIES_COLORS[ki % SERIES_COLORS.length];
    var pts = serie.values.map(function(v,i) {
      if (v===null) return null;
      return { x: n===1?PAD.left+cW/2:PAD.left+i*step, y: PAD.top+cH-(v/100)*cH, v:v };
    });

    ctx.strokeStyle=color; ctx.lineWidth=2.5;
    ctx.setLineDash([]);
    ctx.lineJoin='round'; ctx.lineCap='round';
    ctx.beginPath(); var started=false;
    pts.forEach(function(pt){ if(!pt){started=false;return;} if(!started){ctx.moveTo(pt.x,pt.y);started=true;}else ctx.lineTo(pt.x,pt.y); });
    ctx.stroke();

    pts.forEach(function(pt) {
      if (!pt) return;
      ctx.beginPath(); ctx.arc(pt.x,pt.y,4.5,0,Math.PI*2);
      ctx.fillStyle=color; ctx.fill();
      ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.stroke();
      ctx.fillStyle='#1a1917'; ctx.font='bold 10px Segoe UI,sans-serif'; ctx.textAlign='center';
      ctx.fillText(pt.v+'%', pt.x, pt.y-9);
    });
  });

  var legX = PAD.left, legY = PAD.top - 20;
  seriesKeys.forEach(function(key, ki) {
    var serie = data.series[key];
    var color = SERIES_COLORS[ki % SERIES_COLORS.length];
    ctx.fillStyle=color; ctx.fillRect(legX,legY-8,14,3);
    ctx.beginPath(); ctx.arc(legX+7,legY-6.5,3.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#333'; ctx.font='10px Segoe UI,sans-serif'; ctx.textAlign='left';
    ctx.fillText(serie.label, legX+18, legY-3);
    legX += ctx.measureText(serie.label).width + 40;
  });
}

// ─── RASSEMBLEMENT : sections groupées par date ──────────────────────────────
function todayISO() {
  var now = new Date();
  return now.getFullYear()+'-'+('0'+(now.getMonth()+1)).slice(-2)+'-'+('0'+now.getDate()).slice(-2);
}

function makeRassemRow() {
  return { id: 'r_'+Date.now()+'_'+Math.random().toString(36).slice(2,7), engin:'', kit:'', symbole:'', designation:'', qte:'', commentaire:'', recu:false, dateRecu:'' };
}

function makeRassemSection(dateISO) {
  return { id: 'rs_'+Date.now()+'_'+Math.random().toString(36).slice(2,7), date: dateISO || '', jour: '', rows: [] };
}

function addRassemSection() {
  var sec = makeRassemSection(todayISO());
  sec.rows.push(makeRassemRow());
  rassemblement.push(sec);
  buildRassemblement();
  scheduleAutoSave();
}

function addRassemRow(sectionId) {
  var sec = rassemblement.find(function(s){ return s.id === sectionId; });
  if (!sec) return;
  sec.rows.push(makeRassemRow());
  buildRassemblement();
  scheduleAutoSave();
}

function deleteRassemRow(sectionId, rowId) {
  var sec = rassemblement.find(function(s){ return s.id === sectionId; });
  if (!sec) return;
  sec.rows = sec.rows.filter(function(r){ return r.id !== rowId; });
  buildRassemblement();
  scheduleAutoSave();
}

function deleteRassemSection(sectionId) {
  if (!confirm('Supprimer cette section de date et toutes ses lignes ?')) return;
  rassemblement = rassemblement.filter(function(s){ return s.id !== sectionId; });
  buildRassemblement();
  scheduleAutoSave();
}

function toggleRecu(sectionId, rowId) {
  var sec = rassemblement.find(function(s){ return s.id === sectionId; });
  if (!sec) return;
  var row = sec.rows.find(function(r){ return r.id === rowId; });
  if (!row) return;
  row.recu = !row.recu;
  row.dateRecu = row.recu ? todayISO() : '';
  buildRassemblement();
  scheduleAutoSave();
}

function toggleShowRecus() {
  showRecus = !showRecus;
  var btn = document.getElementById('btnToggleRecus');
  btn.textContent = showRecus ? '👁 Masquer les reçus' : '👁 Afficher les reçus';
  btn.classList.toggle('btn-primary', showRecus);
  btn.classList.toggle('btn-ghost', !showRecus);
  buildRassemblement();
}

function updateRassemCount() {
  var total = rassemblement.reduce(function(sum, sec){
    return sum + sec.rows.filter(function(r){ return !r.recu; }).length;
  }, 0);
  var badge = document.getElementById('manquantsCount');
  if (total > 0) { badge.style.display = 'inline-block'; badge.textContent = total; }
  else { badge.style.display = 'none'; }
}

function buildRassemblement() {
  var wrap = document.getElementById('rassemblementSections');
  wrap.innerHTML = '';
  updateRassemCount();

  if (rassemblement.length === 0) {
    wrap.innerHTML = '<div class="manquants-empty">Aucune date ajoutée. Clique sur « + Ajouter une date » pour commencer.</div>';
    return;
  }

  // Tri par date croissante (les sections sans date restent en fin de liste, dans l'ordre d'ajout)
  var ordered = rassemblement.slice().sort(function(a,b) {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });

  ordered.forEach(function(sec) {
    wrap.appendChild(buildRassemSectionEl(sec));
  });
}

function buildRassemSectionEl(sec) {
  var box = document.createElement('div');
  box.className = 'rassem-section';

  // ── Header de section ──
  var head = document.createElement('div');
  head.className = 'rassem-section-head';

  var display = document.createElement('span');
  display.className = 'rassem-date-display';
  display.textContent = isoToDisplay(sec.date) ? (sec.date.split('-').reverse().join('/')) : '— Choisir une date —';

  var picker = document.createElement('input');
  picker.type = 'date';
  picker.className = 'rassem-date-picker';
  picker.value = sec.date || '';

  (function(sp, pk, s) {
    sp.onclick = function() {
      pk.classList.add('visible');
      pk.focus();
      try { pk.showPicker && pk.showPicker(); } catch(e) {}
    };
    pk.onchange = function() {
      s.date = pk.value;
      sp.textContent = pk.value ? pk.value.split('-').reverse().join('/') : '— Choisir une date —';
      pk.classList.remove('visible');
      buildRassemblement();
      scheduleAutoSave();
    };
    pk.onblur = function() { pk.classList.remove('visible'); };
  })(display, picker, sec);

  var jourInput = document.createElement('input');
  jourInput.type = 'text';
  jourInput.className = 'rassem-jour-input';
  jourInput.placeholder = 'Repère';
  jourInput.value = sec.jour || '';
  jourInput.oninput = function() { sec.jour = jourInput.value; scheduleAutoSave(); };

  var activeCount = sec.rows.filter(function(r){ return !r.recu; }).length;
  var recuCount = sec.rows.length - activeCount;
  var count = document.createElement('span');
  count.className = 'rassem-count';
  count.textContent = activeCount + (activeCount === 1 ? ' article' : ' articles') + (recuCount > 0 ? ' · ' + recuCount + ' reçu' + (recuCount>1?'s':'') : '');

  var actions = document.createElement('div');
  actions.className = 'rassem-section-actions';
  var delSecBtn = document.createElement('button');
  delSecBtn.className = 'btn-del-section';
  delSecBtn.textContent = '✕ Supprimer la date';
  delSecBtn.onclick = function() { deleteRassemSection(sec.id); };
  actions.appendChild(delSecBtn);

  head.appendChild(display);
  head.appendChild(picker);
  head.appendChild(jourInput);
  head.appendChild(count);
  head.appendChild(actions);
  box.appendChild(head);

  // ── Table des lignes ──
  var table = document.createElement('table');
  table.className = 'manquants-table';
  var thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Engin</th><th>Kit</th><th>Symbole</th><th>Désignation</th><th>Qté</th><th>Commentaire</th><th>Reçu</th><th></th></tr>';
  table.appendChild(thead);

  var visibleRows = showRecus ? sec.rows : sec.rows.filter(function(r){ return !r.recu; });

  var tbody = document.createElement('tbody');
  if (visibleRows.length === 0) {
    var trEmpty = document.createElement('tr');
    var tdEmpty = document.createElement('td');
    tdEmpty.colSpan = 8;
    tdEmpty.className = 'manquants-empty';
    tdEmpty.textContent = sec.rows.length === 0
      ? 'Aucun article manquant pour cette date.'
      : 'Tous les articles de cette date ont été reçus.';
    trEmpty.appendChild(tdEmpty);
    tbody.appendChild(trEmpty);
  } else {
    visibleRows.forEach(function(row) {
      tbody.appendChild(buildRassemRowEl(sec, row));
    });
  }
  table.appendChild(tbody);
  box.appendChild(table);

  var footer = document.createElement('div');
  footer.className = 'rassem-section-footer';
  var addBtn = document.createElement('button');
  addBtn.className = 'btn-add-row';
  addBtn.textContent = '+ Ajouter une ligne';
  addBtn.onclick = function() { addRassemRow(sec.id); };
  footer.appendChild(addBtn);
  box.appendChild(footer);

  return box;
}

function buildRassemRowEl(sec, row) {
  var tr = document.createElement('tr');
  if (row.recu) tr.className = 'row-recu';

  function fieldCell(field, type) {
    var td = document.createElement('td');
    var inp = document.createElement('input');
    inp.type = type || 'text';
    inp.value = row[field] || '';
    inp.disabled = !!row.recu;
    inp.oninput = function() { row[field] = inp.value; scheduleAutoSave(); };
    td.appendChild(inp);
    return td;
  }

  tr.appendChild(fieldCell('engin'));
  tr.appendChild(fieldCell('kit'));
  tr.appendChild(fieldCell('symbole'));

  var tdDesc = document.createElement('td');
  var inpDesc = document.createElement('input');
  inpDesc.type = 'text';
  inpDesc.placeholder = 'Désignation...';
  inpDesc.value = row.designation || '';
  inpDesc.disabled = !!row.recu;
  inpDesc.oninput = function() { row.designation = inpDesc.value; scheduleAutoSave(); };
  tdDesc.appendChild(inpDesc);
  tr.appendChild(tdDesc);

  tr.appendChild(fieldCell('qte', 'number'));

  // Désignation et Commentaire séparés en deux colonnes distinctes
  var tdComment = document.createElement('td');
  var inpComment = document.createElement('input');
  inpComment.type = 'text';
  inpComment.placeholder = 'Commentaire...';
  inpComment.value = row.commentaire || '';
  inpComment.disabled = !!row.recu;
  inpComment.oninput = function() { row.commentaire = inpComment.value; scheduleAutoSave(); };
  tdComment.appendChild(inpComment);
  tr.appendChild(tdComment);

  // ── Cellule Reçu : case à cocher + date de réception ──
  var tdRecu = document.createElement('td');
  tdRecu.className = 'recu-cell';
  var checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'recu-checkbox';
  checkbox.checked = !!row.recu;
  checkbox.title = row.recu ? 'Marquer comme non reçu' : 'Marquer comme reçu';
  checkbox.onchange = function() { toggleRecu(sec.id, row.id); };
  tdRecu.appendChild(checkbox);
  if (row.recu && row.dateRecu) {
    var recuDate = document.createElement('span');
    recuDate.className = 'recu-date';
    recuDate.textContent = 'le ' + row.dateRecu.split('-').reverse().join('/');
    tdRecu.appendChild(recuDate);
  }
  tr.appendChild(tdRecu);

  var tdDel = document.createElement('td');
  tdDel.style.textAlign = 'center';
  var delBtn = document.createElement('button');
  delBtn.className = 'manquants-del-btn';
  delBtn.textContent = '✕';
  delBtn.title = 'Supprimer la ligne';
  delBtn.onclick = function() { deleteRassemRow(sec.id, row.id); };
  tdDel.appendChild(delBtn);
  tr.appendChild(tdDel);

  return tr;
}

function exportManquantsCSV() {
  var rows = [['Date manquant','Repère','Engin','Kit','Symbole','Désignation','Qté','Commentaire','Statut','Date reçu']];
  var ordered = rassemblement.slice().sort(function(a,b) {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });
  ordered.forEach(function(sec) {
    var dateAff = sec.date ? sec.date.split('-').reverse().join('/') : '';
    sec.rows.forEach(function(row) {
      var dateRecuAff = row.dateRecu ? row.dateRecu.split('-').reverse().join('/') : '';
      rows.push([dateAff, sec.jour||'', row.engin||'', row.kit||'', row.symbole||'', row.designation||'', row.qte||'', row.commentaire||'', row.recu?'Reçu':'Manquant', dateRecuAff]);
    });
  });
  var csv = '\ufeff' + rows.map(function(r){ return r.map(function(v){ return '"'+String(v).replace(/"/g,'""')+'"'; }).join(';'); }).join('\n');
  var blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'rassemblement_'+(document.getElementById('dateJour').value||'export')+'.csv';
  a.click(); URL.revokeObjectURL(url);
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────
function finishBoot() {
  build();
  buildRassemblement();
}

var now = new Date();
document.getElementById('dateJour').value = now.getFullYear()+'-'+('0'+(now.getMonth()+1)).slice(-2)+'-'+('0'+now.getDate()).slice(-2);
init();

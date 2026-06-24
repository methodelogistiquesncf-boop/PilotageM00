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
let rassemblement = [];
let showRecus = false;
let db = null;
let saveTimer = null;
let currentChartTab = 'courant';
let currentChartSection = 'APPROS';
let currentStatsTab = 'global';

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

  var ordered = rassemblement.slice().sort(function(a,b) {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });

  function isSectionFullyRecu(sec) {
    return sec.rows.length > 0 && sec.rows.every(function(r){ return r.recu; });
  }

  var visibleSections = showRecus ? ordered : ordered.filter(function(sec){ return !isSectionFullyRecu(sec); });
  var hiddenCount = ordered.length - visibleSections.length;

  if (visibleSections.length === 0) {
    var msg = document.createElement('div');
    msg.className = 'manquants-empty';
    msg.textContent = hiddenCount > 0
      ? 'Toutes les dates sont soldées (tous les articles reçus). Clique sur « Afficher les reçus » pour les revoir.'
      : 'Aucune date ajoutée. Clique sur « + Ajouter une date » pour commencer.';
    wrap.appendChild(msg);
  } else {
    visibleSections.forEach(function(sec) {
      wrap.appendChild(buildRassemSectionEl(sec));
    });
  }

  if (hiddenCount > 0 && !showRecus && visibleSections.length > 0) {
    var note = document.createElement('div');
    note.className = 'rassem-hidden-note';
    note.textContent = hiddenCount + ' date' + (hiddenCount>1?'s':'') + ' soldée' + (hiddenCount>1?'s':'') + ' masquée' + (hiddenCount>1?'s':'') + ' — « Afficher les reçus » pour les revoir.';
    wrap.appendChild(note);
  }
}

function buildRassemSectionEl(sec) {
  var box = document.createElement('div');
  box.className = 'rassem-section';

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

  var tdComment = document.createElement('td');
  var inpComment = document.createElement('input');
  inpComment.type = 'text';
  inpComment.placeholder = 'Commentaire...';
  inpComment.value = row.commentaire || '';
  inpComment.disabled = !!row.recu;
  inpComment.oninput = function() { row.commentaire = inpComment.value; scheduleAutoSave(); };
  tdComment.appendChild(inpComment);
  tr.appendChild(tdComment);

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

// ─── STATISTIQUES RASSEMBLEMENT ───────────────────────────────────────────────

function openStats() {
  document.getElementById('statsOverlay').classList.add('open');
  switchStatsTab('global');
}
function closeStats() {
  document.getElementById('statsOverlay').classList.remove('open');
}
document.getElementById('statsOverlay').addEventListener('click', function(e){ if(e.target===this) closeStats(); });

function switchStatsTab(tab) {
  currentStatsTab = tab;
  ['global','delais','engins','cadence','top'].forEach(function(t) {
    document.getElementById('statsTab_'+t).classList.toggle('active', t===tab);
    document.getElementById('statsPanel_'+t).classList.toggle('active', t===tab);
  });
  renderStatsTab(tab);
}

// ── Calcul des données de base ────────────────────────────────────────────────
function getAllRows() {
  var rows = [];
  rassemblement.forEach(function(sec) {
    sec.rows.forEach(function(row) {
      rows.push({ sec: sec, row: row });
    });
  });
  return rows;
}

function diffDays(isoA, isoB) {
  if (!isoA || !isoB) return null;
  var a = new Date(isoA), b = new Date(isoB);
  return Math.round((b - a) / 86400000);
}

function todayStr() { return todayISO(); }

function renderStatsTab(tab) {
  if (tab === 'global')   renderStatsGlobal();
  if (tab === 'delais')   renderStatsDelais();
  if (tab === 'engins')   renderStatsEngins();
  if (tab === 'cadence')  renderStatsCadence();
  if (tab === 'top')      renderStatsTop();
}

// ── Tab : Vue globale ─────────────────────────────────────────────────────────
function renderStatsGlobal() {
  var all = getAllRows();
  var total = all.length;
  var recus = all.filter(function(x){ return x.row.recu; }).length;
  var actifs = total - recus;
  var tauxReception = total > 0 ? Math.round((recus/total)*100) : 0;

  var today = todayStr();
  var enRetard = all.filter(function(x){
    if (x.row.recu) return false;
    if (!x.sec.date) return false;
    var d = diffDays(x.sec.date, today);
    return d !== null && d > 3;
  }).length;

  var delaisMoy = null;
  var delaisList = all.filter(function(x){ return x.row.recu && x.sec.date && x.row.dateRecu; })
    .map(function(x){ return diffDays(x.sec.date, x.row.dateRecu); })
    .filter(function(d){ return d !== null && d >= 0; });
  if (delaisList.length > 0) {
    delaisMoy = Math.round(delaisList.reduce(function(s,d){ return s+d; },0) / delaisList.length * 10) / 10;
  }

  // Nb dates distinctes
  var datesSet = {};
  rassemblement.forEach(function(sec){ if(sec.date) datesSet[sec.date]=true; });
  var nbDates = Object.keys(datesSet).length;

  var w = document.getElementById('statsPanel_global');
  w.innerHTML = '';

  // KPI cards
  var kpis = [
    { label: 'Articles totaux', value: total, color: '#1a4fa0', icon: '📦' },
    { label: 'Reçus', value: recus, color: '#22a050', icon: '✅' },
    { label: 'En attente', value: actifs, color: actifs > 0 ? '#d03030' : '#22a050', icon: '⏳' },
    { label: 'En retard (> 3j)', value: enRetard, color: enRetard > 0 ? '#d03030' : '#22a050', icon: '🚨' },
    { label: 'Taux de réception', value: tauxReception + '%', color: tauxReception >= 80 ? '#22a050' : tauxReception >= 50 ? '#f5a623' : '#d03030', icon: '📊' },
    { label: 'Délai moyen', value: delaisMoy !== null ? delaisMoy + ' j' : '—', color: '#7a776f', icon: '⏱' },
    { label: 'Dates de rassemblement', value: nbDates, color: '#1a4fa0', icon: '📅' },
  ];

  var grid = document.createElement('div');
  grid.className = 'stats-kpi-grid';
  kpis.forEach(function(k) {
    var card = document.createElement('div');
    card.className = 'stats-kpi-card';
    card.innerHTML = '<div class="kpi-icon">'+k.icon+'</div>'
      +'<div class="kpi-value" style="color:'+k.color+'">'+k.value+'</div>'
      +'<div class="kpi-label">'+k.label+'</div>';
    grid.appendChild(card);
  });
  w.appendChild(grid);

  // Barre de progression globale
  var barWrap = document.createElement('div');
  barWrap.className = 'stats-progress-wrap';
  barWrap.innerHTML = '<div class="stats-progress-label">Avancement global</div>'
    +'<div class="stats-progress-bar"><div class="stats-progress-fill" style="width:'+tauxReception+'%;background:'+(tauxReception>=80?'#22a050':tauxReception>=50?'#f5a623':'#d03030')+'"></div></div>'
    +'<div class="stats-progress-pct">'+tauxReception+'% reçus ('+recus+' / '+total+')</div>';
  w.appendChild(barWrap);

  // Canvas : Donut
  if (total > 0) {
    var canvasWrap = document.createElement('div');
    canvasWrap.className = 'stats-donut-wrap';
    var canvas = document.createElement('canvas');
    canvas.id = 'donutGlobal';
    canvas.width = 220; canvas.height = 220;
    canvasWrap.appendChild(canvas);
    w.appendChild(canvasWrap);
    requestAnimationFrame(function() { drawDonut(canvas, recus, actifs, enRetard); });
  }

  if (total === 0) {
    var empty = document.createElement('div');
    empty.className = 'stats-empty';
    empty.textContent = 'Aucun article dans le Rassemblement.';
    w.appendChild(empty);
  }
}

function drawDonut(canvas, recus, actifs_sans_retard, enRetard) {
  // actifs_sans_retard ici = actifs totaux, on ne distingue pas pour le donut mais on peut
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  var cx = W/2, cy = H/2, R = 80, r = 48;
  ctx.clearRect(0,0,W,H);

  var segments = [];
  if (recus > 0)       segments.push({ v: recus, color: '#22a050', label: 'Reçus' });
  if (enRetard > 0)    segments.push({ v: enRetard, color: '#d03030', label: 'Retard >3j' });
  var actifs_ok = (actifs_sans_retard) - enRetard;
  if (actifs_ok > 0)   segments.push({ v: actifs_ok, color: '#f5a623', label: 'En attente' });

  var total = segments.reduce(function(s,x){ return s+x.v; },0);
  if (total === 0) return;

  var angle = -Math.PI/2;
  segments.forEach(function(seg) {
    var sweep = (seg.v / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, angle, angle+sweep);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    angle += sweep;
  });

  // Trou
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.fillStyle = '#fff';
  ctx.fill();

  // Centre
  var tauxGlobal = Math.round((recus/total)*100);
  ctx.fillStyle = '#1a1917';
  ctx.font = 'bold 22px Segoe UI,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tauxGlobal+'%', cx, cy-6);
  ctx.font = '10px Segoe UI,sans-serif';
  ctx.fillStyle = '#7a776f';
  ctx.fillText('réceptionné', cx, cy+10);

  // Légende
  var legY = H - 38;
  var legX = 10;
  segments.forEach(function(seg) {
    ctx.fillStyle = seg.color;
    ctx.fillRect(legX, legY, 12, 12);
    ctx.fillStyle = '#333';
    ctx.font = '10px Segoe UI,sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(seg.label+' ('+seg.v+')', legX+16, legY+1);
    legX += ctx.measureText(seg.label+' ('+seg.v+')').width + 30;
  });
}

// ── Tab : Délais ──────────────────────────────────────────────────────────────
function renderStatsDelais() {
  var all = getAllRows();
  var today = todayStr();
  var w = document.getElementById('statsPanel_delais');
  w.innerHTML = '';

  // Articles en attente avec délai
  var enAttente = all.filter(function(x){ return !x.row.recu && x.sec.date; });
  enAttente.sort(function(a,b){ return a.sec.date.localeCompare(b.sec.date); });

  // Délai de réception
  var delaisRecu = all.filter(function(x){ return x.row.recu && x.sec.date && x.row.dateRecu; })
    .map(function(x){
      return { row: x.row, sec: x.sec, jours: diffDays(x.sec.date, x.row.dateRecu) };
    }).filter(function(x){ return x.jours !== null && x.jours >= 0; });

  // Stats délais
  if (delaisRecu.length > 0) {
    var vals = delaisRecu.map(function(x){ return x.jours; });
    var moy = Math.round(vals.reduce(function(s,v){ return s+v; },0)/vals.length * 10)/10;
    var max = Math.max.apply(null, vals);
    var min = Math.min.apply(null, vals);

    var statsBar = document.createElement('div');
    statsBar.className = 'stats-kpi-grid stats-kpi-grid-small';
    [
      { label: 'Délai moyen', value: moy + ' j', color: '#1a4fa0', icon: '⏱' },
      { label: 'Délai min', value: min + ' j', color: '#22a050', icon: '⚡' },
      { label: 'Délai max', value: max + ' j', color: '#d03030', icon: '🐢' },
      { label: 'Réceptions analysées', value: delaisRecu.length, color: '#7a776f', icon: '📋' },
    ].forEach(function(k) {
      var card = document.createElement('div');
      card.className = 'stats-kpi-card';
      card.innerHTML = '<div class="kpi-icon">'+k.icon+'</div><div class="kpi-value" style="color:'+k.color+'">'+k.value+'</div><div class="kpi-label">'+k.label+'</div>';
      statsBar.appendChild(card);
    });
    w.appendChild(statsBar);

    // Histogramme des délais
    var title = document.createElement('div');
    title.className = 'stats-section-title';
    title.textContent = 'Distribution des délais de réception';
    w.appendChild(title);

    var canvasWrap = document.createElement('div'); canvasWrap.style.marginBottom = '20px';
    var canvas = document.createElement('canvas');
    canvas.style.width = '100%'; canvas.height = 160;
    canvasWrap.appendChild(canvas);
    w.appendChild(canvasWrap);
    requestAnimationFrame(function() { drawDelaisHisto(canvas, vals); });
  }

  // Articles en attente avec ancienneté
  if (enAttente.length > 0) {
    var title2 = document.createElement('div');
    title2.className = 'stats-section-title';
    title2.textContent = 'Articles en attente — ancienneté';
    w.appendChild(title2);

    var table = document.createElement('table');
    table.className = 'stats-table';
    table.innerHTML = '<thead><tr><th>Date</th><th>Engin</th><th>Kit</th><th>Désignation</th><th>Ancienneté</th><th>Statut</th></tr></thead>';
    var tbody = document.createElement('tbody');
    enAttente.forEach(function(x) {
      var jours = diffDays(x.sec.date, today);
      var statut = jours === null ? '—' : jours > 7 ? '🔴 '+jours+'j' : jours > 3 ? '🟠 '+jours+'j' : '🟢 '+jours+'j';
      var tr = document.createElement('tr');
      if (jours !== null && jours > 7) tr.className = 'stats-row-alert';
      else if (jours !== null && jours > 3) tr.className = 'stats-row-warn';
      tr.innerHTML = '<td>'+(x.sec.date ? x.sec.date.split('-').reverse().join('/') : '—')+'</td>'
        +'<td>'+(x.row.engin||'—')+'</td>'
        +'<td>'+(x.row.kit||'—')+'</td>'
        +'<td>'+(x.row.designation||'—')+'</td>'
        +'<td>'+statut+'</td>'
        +'<td><span class="stats-badge stats-badge-pending">En attente</span></td>';
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    w.appendChild(table);
  }

  if (delaisRecu.length === 0 && enAttente.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'stats-empty';
    empty.textContent = 'Pas assez de données pour calculer les délais.';
    w.appendChild(empty);
  }
}

function drawDelaisHisto(canvas, vals) {
  var ctx = canvas.getContext('2d');
  var W = canvas.offsetWidth || 800;
  canvas.width = W;
  var H = canvas.height;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,W,H);

  // Buckets : 0j, 1j, 2j, 3j, 4-7j, >7j
  var buckets = [
    { label:'0 j', min:0, max:0 }, { label:'1 j', min:1, max:1 },
    { label:'2 j', min:2, max:2 }, { label:'3 j', min:3, max:3 },
    { label:'4-7 j', min:4, max:7 }, { label:'>7 j', min:8, max:9999 }
  ];
  var counts = buckets.map(function(b){ return vals.filter(function(v){ return v>=b.min && v<=b.max; }).length; });
  var maxCount = Math.max.apply(null, counts) || 1;

  var PAD = { top:20, right:20, bottom:35, left:40 };
  var cW = W-PAD.left-PAD.right, cH = H-PAD.top-PAD.bottom;
  var barW = cW/buckets.length - 8;

  counts.forEach(function(count, i) {
    var x = PAD.left + i*(cW/buckets.length) + 4;
    var bH = (count/maxCount)*cH;
    var color = i >= 4 ? '#d03030' : i === 3 ? '#f5a623' : '#22a050';
    ctx.fillStyle = color;
    ctx.fillRect(x, PAD.top+cH-bH, barW, bH);
    ctx.fillStyle = '#333'; ctx.font = 'bold 11px Segoe UI,sans-serif'; ctx.textAlign = 'center';
    if (count > 0) ctx.fillText(count, x+barW/2, PAD.top+cH-bH-4);
    ctx.fillStyle = '#666'; ctx.font = '10px Segoe UI,sans-serif';
    ctx.fillText(buckets[i].label, x+barW/2, H-PAD.bottom+14);
  });
}

// ── Tab : Par engin ───────────────────────────────────────────────────────────
function renderStatsEngins() {
  var all = getAllRows();
  var w = document.getElementById('statsPanel_engins');
  w.innerHTML = '';

  // Détecter les engins présents dans les données
  var enginsSet = {};
  all.forEach(function(x){ var e = (x.row.engin||'').trim(); if(e) enginsSet[e]=true; });
  var engins = Object.keys(enginsSet).sort();

  if (engins.length === 0) {
    // Pas d'engin renseigné : stats sans filtre
    var empty = document.createElement('div');
    empty.className = 'stats-empty';
    empty.textContent = 'Aucun champ Engin renseigné dans les lignes du Rassemblement.';
    w.appendChild(empty);
    return;
  }

  // KPI par engin
  var grid = document.createElement('div');
  grid.className = 'stats-engin-grid';

  engins.forEach(function(engin) {
    var rows = all.filter(function(x){ return (x.row.engin||'').trim() === engin; });
    var total = rows.length;
    var recus = rows.filter(function(x){ return x.row.recu; }).length;
    var actifs = total - recus;
    var taux = total > 0 ? Math.round((recus/total)*100) : 0;

    var today = todayStr();
    var retard = rows.filter(function(x){
      if (x.row.recu) return false;
      if (!x.sec.date) return false;
      var d = diffDays(x.sec.date, today);
      return d !== null && d > 3;
    }).length;

    var card = document.createElement('div');
    card.className = 'stats-engin-card';
    card.innerHTML = '<div class="engin-card-title">'+engin+'</div>'
      +'<div class="engin-card-kpis">'
      +'<span class="engin-kpi"><span class="engin-kpi-val" style="color:#1a4fa0">'+total+'</span><span class="engin-kpi-lbl">total</span></span>'
      +'<span class="engin-kpi"><span class="engin-kpi-val" style="color:#22a050">'+recus+'</span><span class="engin-kpi-lbl">reçus</span></span>'
      +'<span class="engin-kpi"><span class="engin-kpi-val" style="color:'+(actifs>0?'#d03030':'#22a050')+'">'+actifs+'</span><span class="engin-kpi-lbl">attente</span></span>'
      +'<span class="engin-kpi"><span class="engin-kpi-val" style="color:'+(retard>0?'#d03030':'#22a050')+'">'+retard+'</span><span class="engin-kpi-lbl">retard</span></span>'
      +'</div>'
      +'<div class="engin-card-bar"><div class="engin-card-fill" style="width:'+taux+'%;background:'+(taux>=80?'#22a050':taux>=50?'#f5a623':'#d03030')+'"></div></div>'
      +'<div class="engin-card-taux">'+taux+'% réceptionné</div>';
    grid.appendChild(card);
  });
  w.appendChild(grid);

  // Graphique comparatif engins (barres groupées)
  var title = document.createElement('div');
  title.className = 'stats-section-title';
  title.textContent = 'Comparaison par engin';
  w.appendChild(title);

  var canvasWrap = document.createElement('div'); canvasWrap.style.marginBottom = '20px';
  var canvas = document.createElement('canvas');
  canvas.style.width = '100%'; canvas.height = 200;
  canvasWrap.appendChild(canvas);
  w.appendChild(canvasWrap);

  requestAnimationFrame(function() {
    var data = engins.map(function(engin) {
      var rows = all.filter(function(x){ return (x.row.engin||'').trim() === engin; });
      var total = rows.length;
      var recus = rows.filter(function(x){ return x.row.recu; }).length;
      return { label: engin, recus: recus, actifs: total-recus };
    });
    drawEnginsBar(canvas, data);
  });
}

function drawEnginsBar(canvas, data) {
  var ctx = canvas.getContext('2d');
  var W = canvas.offsetWidth || 800;
  canvas.width = W;
  var H = canvas.height;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,W,H);

  var n = data.length;
  if (n === 0) return;

  var PAD = { top:20, right:20, bottom:40, left:45 };
  var cW = W-PAD.left-PAD.right, cH = H-PAD.top-PAD.bottom;
  var maxVal = Math.max.apply(null, data.map(function(d){ return d.recus+d.actifs; })) || 1;
  var groupW = cW/n;
  var barW = (groupW*0.7)/2;

  // Grille
  for (var g=0; g<=5; g++) {
    var val = Math.round((g/5)*maxVal);
    var y = PAD.top+cH-(g/5)*cH;
    ctx.strokeStyle='#e0ddd6'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(PAD.left,y); ctx.lineTo(PAD.left+cW,y); ctx.stroke();
    ctx.fillStyle='#888'; ctx.font='10px Segoe UI,sans-serif'; ctx.textAlign='right';
    ctx.fillText(val, PAD.left-4, y+3);
  }

  data.forEach(function(d, i) {
    var cx = PAD.left + i*groupW + groupW/2;

    // Reçus
    var hRecus = (d.recus/maxVal)*cH;
    ctx.fillStyle = '#22a050';
    ctx.fillRect(cx-barW-2, PAD.top+cH-hRecus, barW, hRecus);
    if (d.recus > 0) {
      ctx.fillStyle='#fff'; ctx.font='bold 10px Segoe UI,sans-serif'; ctx.textAlign='center';
      ctx.fillText(d.recus, cx-barW/2-2, PAD.top+cH-hRecus/2+4);
    }

    // En attente
    var hActifs = (d.actifs/maxVal)*cH;
    ctx.fillStyle = '#d03030';
    ctx.fillRect(cx+2, PAD.top+cH-hActifs, barW, hActifs);
    if (d.actifs > 0) {
      ctx.fillStyle='#fff'; ctx.font='bold 10px Segoe UI,sans-serif'; ctx.textAlign='center';
      ctx.fillText(d.actifs, cx+barW/2+2, PAD.top+cH-hActifs/2+4);
    }

    ctx.fillStyle='#333'; ctx.font='11px Segoe UI,sans-serif'; ctx.textAlign='center';
    ctx.fillText(d.label, cx, H-PAD.bottom+16);
  });

  // Légende
  ctx.fillStyle='#22a050'; ctx.fillRect(PAD.left, 4, 12, 10);
  ctx.fillStyle='#333'; ctx.font='10px Segoe UI'; ctx.textAlign='left'; ctx.fillText('Reçus', PAD.left+16, 13);
  ctx.fillStyle='#d03030'; ctx.fillRect(PAD.left+70, 4, 12, 10);
  ctx.fillStyle='#333'; ctx.fillText('En attente', PAD.left+86, 13);
}

// ── Tab : Cadence ─────────────────────────────────────────────────────────────
function renderStatsCadence() {
  var all = getAllRows();
  var w = document.getElementById('statsPanel_cadence');
  w.innerHTML = '';

  if (all.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'stats-empty';
    empty.textContent = 'Pas de données pour calculer la cadence.';
    w.appendChild(empty);
    return;
  }

  // Regrouper par semaine ISO
  function getWeek(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    var day = d.getDay() || 7;
    d.setDate(d.getDate() + 4 - day);
    var jan1 = new Date(d.getFullYear(), 0, 1);
    return d.getFullYear() + '-S' + Math.ceil((((d-jan1)/86400000)+1)/7).toString().padStart(2,'0');
  }

  var nouv = {}, recu = {};
  all.forEach(function(x) {
    var wk = getWeek(x.sec.date);
    if (wk) { nouv[wk] = (nouv[wk]||0) + 1; }
    if (x.row.recu && x.row.dateRecu) {
      var wr = getWeek(x.row.dateRecu);
      if (wr) { recu[wr] = (recu[wr]||0) + 1; }
    }
  });

  var weeks = Array.from(new Set(Object.keys(nouv).concat(Object.keys(recu)))).sort();

  if (weeks.length === 0) {
    var empty2 = document.createElement('div');
    empty2.className = 'stats-empty';
    empty2.textContent = 'Aucune date renseignée.';
    w.appendChild(empty2);
    return;
  }

  // KPI
  var totNouv = Object.values(nouv).reduce(function(s,v){ return s+v; },0);
  var totRecu = Object.values(recu).reduce(function(s,v){ return s+v; },0);
  var moyNouv = weeks.length > 0 ? Math.round(totNouv/weeks.length*10)/10 : 0;
  var moyRecu = weeks.length > 0 ? Math.round(totRecu/weeks.length*10)/10 : 0;

  var grid = document.createElement('div');
  grid.className = 'stats-kpi-grid stats-kpi-grid-small';
  [
    { label: 'Manquants / semaine', value: moyNouv, color: '#d03030', icon: '📉' },
    { label: 'Réceptions / semaine', value: moyRecu, color: '#22a050', icon: '📈' },
    { label: 'Semaines suivies', value: weeks.length, color: '#1a4fa0', icon: '📆' },
  ].forEach(function(k) {
    var card = document.createElement('div');
    card.className = 'stats-kpi-card';
    card.innerHTML = '<div class="kpi-icon">'+k.icon+'</div><div class="kpi-value" style="color:'+k.color+'">'+k.value+'</div><div class="kpi-label">'+k.label+'</div>';
    grid.appendChild(card);
  });
  w.appendChild(grid);

  var title = document.createElement('div');
  title.className = 'stats-section-title';
  title.textContent = 'Nouveaux manquants vs Réceptions par semaine';
  w.appendChild(title);

  var canvasWrap = document.createElement('div');
  var canvas = document.createElement('canvas');
  canvas.style.width = '100%'; canvas.height = 220;
  canvasWrap.appendChild(canvas);
  w.appendChild(canvasWrap);

  requestAnimationFrame(function() {
    var dataPoints = weeks.map(function(wk) {
      return { label: wk.replace(/^\d{4}-/, ''), nouv: nouv[wk]||0, recu: recu[wk]||0 };
    });
    drawCadenceChart(canvas, dataPoints);
  });
}

function drawCadenceChart(canvas, data) {
  var ctx = canvas.getContext('2d');
  var W = canvas.offsetWidth || 800;
  canvas.width = W;
  var H = canvas.height;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H);

  var n = data.length;
  if (n === 0) return;

  var PAD = { top:30, right:30, bottom:50, left:45 };
  var cW = W-PAD.left-PAD.right, cH = H-PAD.top-PAD.bottom;
  var maxVal = Math.max.apply(null, data.map(function(d){ return Math.max(d.nouv, d.recu); })) || 1;

  for (var g=0; g<=5; g++) {
    var val = Math.round((g/5)*maxVal);
    var y = PAD.top+cH-(g/5)*cH;
    ctx.strokeStyle='#e0ddd6'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(PAD.left,y); ctx.lineTo(PAD.left+cW,y); ctx.stroke();
    ctx.fillStyle='#888'; ctx.font='10px Segoe UI,sans-serif'; ctx.textAlign='right';
    ctx.fillText(val, PAD.left-4, y+3);
  }

  var step = n>1 ? cW/(n-1) : 0;

  function drawLine(key, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 2.5;
    ctx.lineJoin='round'; ctx.lineCap='round';
    ctx.beginPath();
    data.forEach(function(d,i) {
      var x = n===1 ? PAD.left+cW/2 : PAD.left+i*step;
      var y = PAD.top+cH-(d[key]/maxVal)*cH;
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.stroke();
    data.forEach(function(d,i) {
      var x = n===1 ? PAD.left+cW/2 : PAD.left+i*step;
      var y = PAD.top+cH-(d[key]/maxVal)*cH;
      ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2);
      ctx.fillStyle=color; ctx.fill();
      ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.stroke();
      if (d[key]>0) {
        ctx.fillStyle='#1a1917'; ctx.font='bold 9px Segoe UI,sans-serif'; ctx.textAlign='center';
        ctx.fillText(d[key], x, y-8);
      }
    });
  }

  drawLine('nouv', '#d03030');
  drawLine('recu', '#22a050');

  ctx.fillStyle='#555'; ctx.font='10px Segoe UI,sans-serif'; ctx.textAlign='center';
  data.forEach(function(d,i) {
    var x = n===1 ? PAD.left+cW/2 : PAD.left+i*step;
    ctx.save();
    if (n>8) { ctx.translate(x,H-PAD.bottom+10); ctx.rotate(-Math.PI/4); ctx.textAlign='right'; ctx.fillText(d.label,0,0); ctx.restore(); }
    else { ctx.fillText(d.label, x, H-PAD.bottom+18); ctx.restore(); }
  });

  // Légende
  ctx.fillStyle='#d03030'; ctx.fillRect(PAD.left,8,20,3);
  ctx.beginPath(); ctx.arc(PAD.left+10,9.5,3,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#333'; ctx.font='10px Segoe UI'; ctx.textAlign='left'; ctx.fillText('Nouveaux manquants', PAD.left+26, 13);
  ctx.fillStyle='#22a050'; ctx.fillRect(PAD.left+160,8,20,3);
  ctx.beginPath(); ctx.arc(PAD.left+170,9.5,3,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#333'; ctx.fillText('Réceptions', PAD.left+186, 13);
}

// ── Tab : Top articles ────────────────────────────────────────────────────────
function renderStatsTop() {
  var all = getAllRows();
  var w = document.getElementById('statsPanel_top');
  w.innerHTML = '';

  if (all.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'stats-empty';
    empty.textContent = 'Aucun article dans le Rassemblement.';
    w.appendChild(empty);
    return;
  }

  function buildTopList(keyFn, label) {
    var counts = {};
    all.forEach(function(x) {
      var k = (keyFn(x)||'').trim();
      if (!k) return;
      if (!counts[k]) counts[k] = { total:0, recu:0 };
      counts[k].total++;
      if (x.row.recu) counts[k].recu++;
    });
    var sorted = Object.keys(counts).map(function(k){
      return { key:k, total:counts[k].total, recu:counts[k].recu, actifs:counts[k].total-counts[k].recu };
    }).sort(function(a,b){ return b.total-a.total; }).slice(0,10);
    return { label:label, items:sorted };
  }

  var topKits    = buildTopList(function(x){ return x.row.kit; }, 'Kit');
  var topSymb    = buildTopList(function(x){ return x.row.symbole; }, 'Symbole');
  var topDesig   = buildTopList(function(x){ return x.row.designation; }, 'Désignation');

  [topKits, topSymb, topDesig].forEach(function(top) {
    if (top.items.length === 0) return;

    var title = document.createElement('div');
    title.className = 'stats-section-title';
    title.textContent = 'Top ' + top.label + 's récurrents';
    w.appendChild(title);

    var maxTotal = top.items[0].total;
    var list = document.createElement('div');
    list.className = 'stats-top-list';

    top.items.forEach(function(item, i) {
      var row = document.createElement('div');
      row.className = 'stats-top-row';
      var pct = Math.round((item.recu/item.total)*100);
      row.innerHTML = '<span class="top-rank">'+(i+1)+'</span>'
        +'<span class="top-key">'+item.key+'</span>'
        +'<div class="top-bar-wrap"><div class="top-bar-fill" style="width:'+Math.round((item.total/maxTotal)*100)+'%;background:#1a4fa0"></div></div>'
        +'<span class="top-count">'+item.total+'x</span>'
        +'<span class="top-recu" style="color:'+(pct===100?'#22a050':pct>0?'#f5a623':'#d03030')+'">'+pct+'% reçu</span>';
      list.appendChild(row);
    });
    w.appendChild(list);
  });
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────
function finishBoot() {
  build();
  buildRassemblement();
}

var now = new Date();
document.getElementById('dateJour').value = now.getFullYear()+'-'+('0'+(now.getMonth()+1)).slice(-2)+'-'+('0'+now.getDate()).slice(-2);
init();

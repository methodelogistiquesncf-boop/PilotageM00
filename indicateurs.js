// indicateurs.js — page Indicateurs : graphiques mensuels APPROS / PIÈCES DÉPOSÉES
import { state } from './state.js';
import { initAuth, doLogout, saveFirebase, getDb } from './firebase.js';

window.doLogout = doLogout;
window.saveFirebase = saveFirebase;

var MOIS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
var indicData = {};

function monthLabel(key) {
  var p = key.split('-');
  return MOIS_FR[parseInt(p[1], 10) - 1] + ' ' + p[0];
}
function currentMonthKey() {
  var v = document.getElementById('dateJour').value;
  return (v || new Date().toISOString().slice(0, 10)).slice(0, 7);
}

async function loadIndicateurs() {
  var db = getDb();
  if (!db) return;
  var snap = await db.collection('indicateurs').get();
  indicData = {};
  snap.forEach(function (d) { indicData[d.id] = d.data(); });
  buildMonthSelect();
  drawAll();
}

function buildMonthSelect() {
  var sel = document.getElementById('indicMonthSelect');
  if (!sel) return;
  var keys = Object.keys(indicData).sort().reverse();
  var cur = currentMonthKey();
  if (keys.indexOf(cur) === -1) keys.unshift(cur);
  sel.innerHTML = '';
  keys.forEach(function (k) {
    var o = document.createElement('option');
    o.value = k; o.textContent = monthLabel(k);
    sel.appendChild(o);
  });
  sel.value = cur;
  sel.onchange = drawAll;
}

function drawAll() {
  var sel = document.getElementById('indicMonthSelect');
  var key = sel ? sel.value : currentMonthKey();
  var jours = (indicData[key] && indicData[key].jours) || {};
  drawChart('chartAppros', jours, 'appro', key);
  drawChart('chartPieces', jours, 'pieces', key);
}

function drawChart(canvasId, jours, field, monthKey) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  var dpr = window.devicePixelRatio || 1;
  var cssW = canvas.clientWidth || 1000, cssH = 300;
  canvas.width = cssW * dpr; canvas.height = cssH * dpr;
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);

  var padL = 48, padR = 16, padT = 16, padB = 30;
  var W = cssW - padL - padR, H = cssH - padT - padB;
  var nDays = new Date(parseInt(monthKey.slice(0, 4), 10), parseInt(monthKey.slice(5, 7), 10), 0).getDate();

  ctx.font = '11px system-ui, sans-serif';
  ctx.strokeStyle = '#d7d4cc'; ctx.lineWidth = 1;
  ctx.fillStyle = '#6b7280';
  for (var v = 0; v <= 100; v += 20) {
    var y = padT + H - (v / 100) * H;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + W, y); ctx.stroke();
    ctx.textAlign = 'right'; ctx.fillText(v + ' %', padL - 8, y + 4);
  }
  ctx.textAlign = 'center';
  for (var dd = 1; dd <= nDays; dd++) {
    var x = padL + ((dd - 1) / Math.max(nDays - 1, 1)) * W;
    ctx.beginPath(); ctx.moveTo(x, padT + H); ctx.lineTo(x, padT + H + 4); ctx.stroke();
    if (dd === 1 || dd % 5 === 0) ctx.fillText(String(dd), x, padT + H + 18);
  }

  function line(lineKey, color) {
    var pts = [];
    for (var d2 = 1; d2 <= nDays; d2++) {
      var e = jours[String(d2)];
      var val = e && e[field] ? e[field][lineKey] : undefined;
      if (typeof val === 'number') {
        pts.push({ x: padL + ((d2 - 1) / Math.max(nDays - 1, 1)) * W, y: padT + H - (Math.min(val, 100) / 100) * H });
      }
    }
    if (!pts.length) return;
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
    pts.forEach(function (p, i) { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
    ctx.stroke();
    ctx.fillStyle = color;
    pts.forEach(function (p) { ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill(); });
  }
  line('j0', '#22a050');
  line('j3', '#f97316');

  ctx.fillStyle = '#22a050'; ctx.fillRect(padL + W - 150, padT - 4, 10, 10);
  ctx.fillStyle = '#374151'; ctx.textAlign = 'left'; ctx.fillText('J-0', padL + W - 136, padT + 5);
  ctx.fillStyle = '#f97316'; ctx.fillRect(padL + W - 90, padT - 4, 10, 10);
  ctx.fillStyle = '#374151'; ctx.fillText('J-3', padL + W - 76, padT + 5);
}

window.addEventListener('resize', drawAll);

// affichage rapide (dès que la session est reconnue)
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
  setTimeout(reveal, 900);
})();

initAuth(function () {
  document.getElementById('tabViewUsers').style.display = state.currentUserRole === 'Administrateur' ? '' : 'none';
  document.body.classList.add('ready');
  loadIndicateurs();
});

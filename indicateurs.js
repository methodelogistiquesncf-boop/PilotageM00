// indicateurs.js — page Indicateurs : graphiques mensuels + bulles au survol
import { state, showConfirm } from './state.js';
import { initAuth, doLogout, saveFirebase, getDb } from './firebase.js';

window.doLogout = doLogout;
window.saveFirebase = saveFirebase;

var MOIS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
var indicData = {};

function monthLabel(key) {
  var p = String(key).split('-');
  return (MOIS_FR[parseInt(p[1], 10) - 1] || p[1]) + ' ' + p[0];
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

// ─── Bulle d'info au survol des points ──────────────────────────────────────
function ensureTooltip() {
  var t = document.getElementById('indicTooltip');
  if (!t) {
    t = document.createElement('div');
    t.id = 'indicTooltip';
    t.style.cssText = 'position:fixed;z-index:9999;background:#111827;color:#fff;font-size:11px;font-weight:700;' +
      'padding:5px 10px;border-radius:6px;pointer-events:none;opacity:0;transition:opacity .12s;' +
      'transform:translate(-50%,-130%);white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,.25);';
    document.body.appendChild(t);
  }
  return t;
}

function bindCanvasHover(canvas) {
  if (canvas.__hoverBound) return;
  canvas.__hoverBound = true;
  canvas.addEventListener('mousemove', function (e) {
    var r = canvas.getBoundingClientRect();
    var mx = e.clientX - r.left, my = e.clientY - r.top;
    var pts = canvas._pts || [];
    var best = null, bd = 144; // rayon 12 px
    pts.forEach(function (p) {
      var dx = p.x - mx, dy = p.y - my, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = p; }
    });
    var t = ensureTooltip();
    if (best) {
      t.textContent = best.label + ' — ' + best.day + ' ' + monthLabel(canvas._monthKey) + ' : ' + String(best.v).replace('.', ',') + ' %' + ((state.currentUserRole || '') === 'Administrateur' ? ' · 🗑️ cliquer pour supprimer' : '');
      t.style.left = (r.left + best.x) + 'px';
      t.style.top = (r.top + best.y - 6) + 'px';
      t.style.opacity = '1';
      canvas.style.cursor = 'pointer';
    } else {
      t.style.opacity = '0';
      canvas.style.cursor = 'default';
    }
  });
  canvas.addEventListener('mouseleave', function () {
    var t = document.getElementById('indicTooltip');
    if (t) t.style.opacity = '0';
    canvas.style.cursor = 'default';
  });
}

// ─── Dessin du graphique ────────────────────────────────────────────────────
function drawChart(canvasId, jours, field, monthKey) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  var dpr = window.devicePixelRatio || 1;
  var cssW = canvas.clientWidth || 1000, cssH = 300;
  canvas.width = cssW * dpr; canvas.height = cssH * dpr;
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);
  canvas._monthKey = monthKey;

  var padL = 48, padR = 16, padT = 36, padB = 30;
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

  var hoverPts = [];
  function line(lineKey, color, label) {
    var pts = [];
    for (var d2 = 1; d2 <= nDays; d2++) {
      var e = jours[String(d2)];
      var val = e && e[field] ? e[field][lineKey] : undefined;
      if (typeof val === 'number') {
        pts.push({
          x: padL + ((d2 - 1) / Math.max(nDays - 1, 1)) * W,
          y: padT + H - (Math.min(val, 100) / 100) * H,
          v: val, day: d2, label: label, field: field
        });
      }
    }
    if (!pts.length) return;
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
    pts.forEach(function (p, i) { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
    ctx.stroke();
    ctx.fillStyle = color;
    pts.forEach(function (p) { ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill(); });
    hoverPts = hoverPts.concat(pts);
  }
  line('j0', '#22a050', 'J-0');
  line('j3', '#f97316', 'J-3');
  canvas._pts = hoverPts;
  bindCanvasHover(canvas);

  ctx.fillStyle = '#22a050'; ctx.fillRect(padL + W - 150, padT - 24, 10, 10);
  ctx.fillStyle = '#374151'; ctx.textAlign = 'left'; ctx.fillText('J-0', padL + W - 136, padT - 15);
  ctx.fillStyle = '#f97316'; ctx.fillRect(padL + W - 90, padT - 24, 10, 10);
  ctx.fillStyle = '#374151'; ctx.fillText('J-3', padL + W - 76, padT - 15);
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

// ─── Bouton info (i) DANS chaque carte graphique + modal d'aide ───
(function () {
  var style = document.createElement('style');
  style.textContent =
    '.indic-chart-card{position:relative;}' +
    '.indic-info-btn{position:absolute;top:8px;right:10px;width:22px;height:22px;border-radius:50%;' +
    'border:1px solid var(--border);background:var(--surface2);color:var(--accent);' +
    'font-family:Georgia,serif;font-style:italic;font-weight:700;font-size:13px;line-height:1;' +
    'cursor:pointer;z-index:5;}' +
    '.indic-info-btn:hover{background:var(--accent);color:#fff;}';
  document.head.appendChild(style);

  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'indicInfoOverlay';
  overlay.innerHTML =
    '<div class="modal-box">' +
    '<button class="close-btn" id="indicInfoClose">&#x2715;</button>' +
    '<h2>📊 Lecture des indicateurs</h2>' +
    '<p>Deux graphiques mensuels — <strong>APPROS</strong> et <strong>PIÈCES DÉPOSÉES</strong> — suivent le taux de réalisation jour par jour.</p>' +
    '<ul style="margin:10px 0 0;padding-left:20px;line-height:1.8">' +
    '<li><strong>Mois</strong> — sélecteur en haut de page pour consulter un autre mois.</li>' +
    '<li><strong>Courbe J-0 (verte)</strong> — taux consolidé avec un recul de 3 jours.</li>' +
    '<li><strong>Courbe J-3 (orange)</strong> — taux constaté le jour même ; l’écart entre les deux courbes montre ce qui a évolué entre-temps.</li>' +
    '</ul></div>';
  document.body.appendChild(overlay);
  overlay.querySelector('#indicInfoClose').addEventListener('click', function () { overlay.classList.remove('open'); });
  overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.classList.remove('open'); });

  function setup() {
    ['chartAppros', 'chartPieces'].forEach(function (id) {
      var cv = document.getElementById(id);
      if (!cv) return;
      var card = (cv.parentElement && cv.parentElement.classList.contains('indic-chart-card'))
        ? cv.parentElement : null;
      if (!card) {
        card = document.createElement('div');
        card.className = 'indic-chart-card';
        cv.parentNode.insertBefore(card, cv);
        card.appendChild(cv);
      }
      if (card.querySelector('.indic-info-btn')) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'indic-info-btn';
      b.textContent = 'i';
      b.title = 'Comment lire ce graphique ?';
      b.addEventListener('click', function () { overlay.classList.add('open'); });
      card.appendChild(b);
    });
  }
  setup();
})();

// ─── Exports CSV + PNG de la page Indicateurs ───
(function () {
  function selKey() {
    var sel = document.getElementById('indicMonthSelect');
    return sel && sel.value ? sel.value : currentMonthKey();
  }
  function daysIn(key) {
    return new Date(parseInt(key.slice(0, 4), 10), parseInt(key.slice(5, 7), 10), 0).getDate();
  }
  function num(v) { return typeof v === 'number' ? String(v).replace('.', ',') : ''; }
  function fileMonth(key) {
    return monthLabel(key).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
  }
  function download(hrefOrBlob, name, isUrl) {
    var a = document.createElement('a');
    if (isUrl) a.href = hrefOrBlob; else a.href = URL.createObjectURL(hrefOrBlob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    if (!isUrl) setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  // ── CSV : Date | Appro J-0 | Appro J-3 | Pièces J-0 | Pièces J-3 ──
  function exportIndicCSV() {
    var key = selKey();
    var p = key.split('-');
    var jours = (indicData[key] && indicData[key].jours) || {};
    var rows = [['Date', 'Appro J-0', 'Appro J-3', 'Pièces J-0', 'Pièces J-3']];
    for (var d = 1; d <= daysIn(key); d++) {
      var e = jours[String(d)];
      var a0 = e && e.appro ? e.appro.j0 : undefined;
      var a3 = e && e.appro ? e.appro.j3 : undefined;
      var q0 = e && e.pieces ? e.pieces.j0 : undefined;
      var q3 = e && e.pieces ? e.pieces.j3 : undefined;
      if (a0 === undefined && a3 === undefined && q0 === undefined && q3 === undefined) continue;
      rows.push([
        ('0' + d).slice(-2) + '/' + p[1] + '/' + p[0],
        num(a0), num(a3), num(q0), num(q3)
      ]);
    }
    var csv = '\ufeff' + rows.map(function (r) {
      return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(';');
    }).join('\n');
    download(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'indicateurs_' + fileMonth(key) + '.csv', false);
  }

  // ── PNG : en-tête + 2 graphiques empilés + pied de page ──
  function exportIndicPNG() {
    var key = selKey();
    var c1 = document.getElementById('chartAppros');
    var c2 = document.getElementById('chartPieces');
    if (!c1 || !c2) return;
    var dpr = window.devicePixelRatio || 1;
    var padX = 24, headerH = 58, titleH = 30, gap = 18, footerH = 40, chartH = 300;
    var w = Math.max(c1.clientWidth, c2.clientWidth) + padX * 2;
    var totalH = headerH + titleH + chartH + gap + titleH + chartH + footerH;

    var off = document.createElement('canvas');
    off.width = Math.round(w * dpr); off.height = Math.round(totalH * dpr);
    var ctx = off.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, totalH);

    var now = new Date();
    var when = 'le ' + now.toLocaleDateString('fr-FR') + ' à ' + now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    var lbl = monthLabel(key); lbl = lbl.charAt(0).toUpperCase() + lbl.slice(1);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#111827'; ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText('Indicateurs — ' + lbl, padX, 32);
    ctx.fillStyle = '#6b7280'; ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('Export ' + when, padX, 50);

    var y = headerH;
    ctx.fillStyle = '#1a4fa0'; ctx.font = '700 14px system-ui, sans-serif';
    ctx.fillText('APPROS — taux du mois', padX, y + 18);
    y += titleH;
    ctx.drawImage(c1, padX, y, c1.clientWidth, chartH);
    ctx.strokeStyle = '#d1d5db'; ctx.strokeRect(padX + .5, y + .5, c1.clientWidth - 1, chartH - 1);
    y += chartH + gap;

    ctx.fillStyle = '#1a4fa0';
    ctx.fillText('PIÈCES DÉPOSÉES — taux du mois', padX, y + 18);
    y += titleH;
    ctx.drawImage(c2, padX, y, c2.clientWidth, chartH);
    ctx.strokeStyle = '#d1d5db'; ctx.strokeRect(padX + .5, y + .5, c2.clientWidth - 1, chartH - 1);

    ctx.fillStyle = '#9ca3af'; ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('Pilotage M00 — exporté ' + when, padX, totalH - 14);

    var name = 'indicateurs_' + fileMonth(key) + '.png';
    if (off.toBlob) off.toBlob(function (b) { download(b, name, false); }, 'image/png');
    else download(off.toDataURL('image/png'), name, true);
  }

  // ── Boutons à côté du sélecteur de mois ──
  var sel = document.getElementById('indicMonthSelect');
  if (sel && !document.getElementById('btnIndicCSV')) {
    var bar = sel.parentNode;
    var b1 = document.createElement('button');
    b1.id = 'btnIndicCSV'; b1.className = 'btn btn-ghost'; b1.textContent = '📥 Export CSV';
    b1.title = 'Télécharger les données du mois (Excel)';
    b1.onclick = exportIndicCSV;
    var b2 = document.createElement('button');
    b2.id = 'btnIndicPNG'; b2.className = 'btn btn-ghost'; b2.textContent = '🖼️ Export PNG';
    b2.title = 'Télécharger l’image des 2 graphiques';
    b2.onclick = exportIndicPNG;
    bar.appendChild(b1); bar.appendChild(b2);
  }
})();

// ─── Bouton Administrateur : effacer le mois affiché ───
(function () {
  function addDeleteBtn() {
    var sel = document.getElementById('indicMonthSelect');
    if (!sel || document.getElementById('btnIndicDelete')) return;
    if ((state.currentUserRole || '') !== 'Administrateur') return;
    var b = document.createElement('button');
    b.id = 'btnIndicDelete';
    b.className = 'btn btn-ghost';
    b.textContent = '🗑️ Effacer le mois';
    b.title = 'Réservé aux Administrateurs : efface les indicateurs du mois affiché';
    b.style.color = '#c62828';
    b.onclick = async function () {
      var key = sel.value;
      var ok = await showConfirm(
        'Effacer définitivement les indicateurs de « ' + monthLabel(key) + ' » ?\nLes graphiques de ce mois seront vidés pour tous les utilisateurs.',
        { title: 'Effacer ce mois ?', okLabel: 'Effacer le mois' }
      );
      if (!ok) return;
      var db = getDb();
      if (!db) return;
      try {
        await db.collection('indicateurs').doc(key).delete();
        delete indicData[key];
        buildMonthSelect();
        drawAll();
      } catch (e) {
        console.error(e);
        alert('Erreur : ' + (e.message || e));
      }
    };
    sel.parentNode.appendChild(b);
  }
  var t = setInterval(function () {
    if (state.currentUserRole) { clearInterval(t); addDeleteBtn(); }
  }, 300);
})();

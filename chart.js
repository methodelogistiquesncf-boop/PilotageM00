// chart.js — modal graphique "Taux de réalisation" (onglet Supermarché)

import { state, ENGINS_CONFIG, D_FIXED, isoToDisplay } from './state.js';

let currentChartTab = 'courant';
let currentChartSection = 'APPROS';
const SERIES_COLORS = ['#1a4fa0', '#f5a623', '#22a050', '#d03030', '#9b59b6'];

function parseScore(str) {
  if (!str || !str.trim()) return null;
  var m = str.trim().match(/^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)$/);
  if (!m) return null;
  var num = parseFloat(m[1].replace(',', '.')), den = parseFloat(m[2].replace(',', '.'));
  if (den === 0) return null;
  return { num: num, den: den };
}

function computeChartSeries(cols, section) {
  var series = {};
  series["total"] = { label: "Total " + section, values: [] };
  var labels = cols.map(function (col) { return col.label; });
  cols.forEach(function (col) {
    var totalNum = 0, totalDen = 0, totalHas = false;
    ENGINS_CONFIG.forEach(function (e) {
      var p = parseScore(col.getScore(e.id, section));
      if (p) { totalNum += p.num; totalDen += p.den; totalHas = true; }
    });
    series["total"].values.push(totalHas && totalDen > 0 ? Math.round((totalNum / totalDen) * 1000) / 10 : null);
  });
  return { labels: labels, series: series };
}

function buildChartData_courant() {
  var cols = [];
  for (var d = 0; d < D_FIXED; d++) {
    (function (di) {
      var p = state.colOrder[di];
      cols.push({ label: isoToDisplay(state.headersData.dates[di]) || state.headersData.jours[di] || ('J-' + di), getScore: function (eid, sec) { return state.S[eid][sec][p].score; } });
    })(d);
  }
  state.synthCols.forEach(function (col) {
    cols.push({ label: isoToDisplay(col.date) || col.jour || 'Synthèse', getScore: function (eid, sec) { return col.enginData[eid][sec].score; } });
  });
  return computeChartSeries(cols, currentChartSection);
}

function buildChartData_historique() {
  var entries = Object.values(state.historique).sort(function (a, b) { return a.date.localeCompare(b.date); });
  var cols = entries.map(function (entry) {
    return {
      label: entry.date ? entry.date.slice(5).split('-').reverse().join('/') : '?',
      getScore: function (eid, sec) {
        var eg = entry.engins && entry.engins[eid];
        return eg && eg[sec] ? eg[sec].score : '';
      }
    };
  });
  return computeChartSeries(cols, currentChartSection);
}

export function switchSection(section) {
  currentChartSection = section;
  var sectionTabs = document.getElementById('sectionTabs');
  Array.prototype.forEach.call(sectionTabs.children, function (btn) {
    btn.classList.toggle('active', btn.id === 'sec' + section.replace(/\s+/g, '_'));
  });
  document.getElementById('chartTitle').textContent = 'Taux de réalisation ' + section;
  drawChart();
}

export function switchTab(tab) {
  currentChartTab = tab;
  document.getElementById('tabCourant').classList.toggle('active', tab === 'courant');
  document.getElementById('tabHistorique').classList.toggle('active', tab === 'historique');
  drawChart();
}

export function openChart() { document.getElementById('chartOverlay').classList.add('open'); drawChart(); }
export function closeChart() { document.getElementById('chartOverlay').classList.remove('open'); }

export function drawChart() {
  var data = currentChartTab === 'historique' ? buildChartData_historique() : buildChartData_courant();
  var labels = data.labels;
  var seriesKeys = Object.keys(data.series);

  var canvas = document.getElementById('approsChart');
  var ctx = canvas.getContext('2d');
  var W = canvas.offsetWidth || 860, H = 340;
  canvas.width = W; canvas.height = H;

  var PAD = { top: 40, right: 30, bottom: 55, left: 55 };
  var cW = W - PAD.left - PAD.right, cH = H - PAD.top - PAD.bottom;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);

  var n = labels.length;
  if (n === 0) {
    ctx.fillStyle = '#888'; ctx.font = '13px Segoe UI,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Aucune donnée disponible', W / 2, H / 2); return;
  }

  for (var pct = 0; pct <= 100; pct += 10) {
    var y = PAD.top + cH - (pct / 100) * cH;
    ctx.strokeStyle = '#e0ddd6'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + cW, y); ctx.stroke();
    ctx.fillStyle = '#888'; ctx.font = '11px Segoe UI,sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(pct + '%', PAD.left - 6, y + 4);
  }

  ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(PAD.left, PAD.top); ctx.lineTo(PAD.left, PAD.top + cH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(PAD.left, PAD.top + cH); ctx.lineTo(PAD.left + cW, PAD.top + cH); ctx.stroke();

  var step = n > 1 ? cW / (n - 1) : 0;
  ctx.fillStyle = '#555'; ctx.font = '10px Segoe UI,sans-serif'; ctx.textAlign = 'center';
  labels.forEach(function (lbl, i) {
    var x = n === 1 ? PAD.left + cW / 2 : PAD.left + i * step;
    ctx.save();
    if (n > 15) { ctx.translate(x, H - PAD.bottom + 10); ctx.rotate(-Math.PI / 4); ctx.textAlign = 'right'; ctx.fillText(lbl, 0, 0); ctx.restore(); }
    else { ctx.fillText(lbl, x, H - PAD.bottom + 18); ctx.restore(); }
  });

  seriesKeys.forEach(function (key, ki) {
    var serie = data.series[key];
    var color = SERIES_COLORS[ki % SERIES_COLORS.length];
    var pts = serie.values.map(function (v, i) {
      if (v === null) return null;
      return { x: n === 1 ? PAD.left + cW / 2 : PAD.left + i * step, y: PAD.top + cH - (v / 100) * cH, v: v };
    });

    ctx.strokeStyle = color; ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); var started = false;
    pts.forEach(function (pt) { if (!pt) { started = false; return; } if (!started) { ctx.moveTo(pt.x, pt.y); started = true; } else ctx.lineTo(pt.x, pt.y); });
    ctx.stroke();

    pts.forEach(function (pt) {
      if (!pt) return;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#1a1917'; ctx.font = 'bold 10px Segoe UI,sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(pt.v + '%', pt.x, pt.y - 9);
    });
  });

  var legX = PAD.left, legY = PAD.top - 20;
  seriesKeys.forEach(function (key, ki) {
    var serie = data.series[key];
    var color = SERIES_COLORS[ki % SERIES_COLORS.length];
    ctx.fillStyle = color; ctx.fillRect(legX, legY - 8, 14, 3);
    ctx.beginPath(); ctx.arc(legX + 7, legY - 6.5, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#333'; ctx.font = '10px Segoe UI,sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(serie.label, legX + 18, legY - 3);
    legX += ctx.measureText(serie.label).width + 40;
  });
}

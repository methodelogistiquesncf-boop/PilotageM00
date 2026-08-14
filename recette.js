/* ==========================================================
   recette.js — Bandeau "RECETTE" + fond selon la page
   ========================================================== */
(function () {
  'use strict';

  function init() {
    if (document.querySelector('.recette-banner')) return;

    /* ----- styles injectés ----- */
    var style = document.createElement('style');
    style.textContent =
      '.recette-banner{' +
      'position:fixed;top:0;left:0;right:0;' +
      'background:#f97316;color:#ffffff;' +
      'text-align:center;padding:6px 12px;' +
      'font-size:13px;font-weight:700;' +
      'letter-spacing:2px;text-transform:uppercase;' +
      'z-index:9999;box-shadow:0 2px 4px rgba(0,0,0,.15);' +
      '}' +
      'body{padding-top:32px !important;}';
    document.head.appendChild(style);

    /* ----- bandeau ----- */
    var banner = document.createElement('div');
    banner.className = 'recette-banner';
    banner.textContent = '⚠ Environnement de Recette ⚠';
    document.body.insertBefore(banner, document.body.firstChild);

    /* ----- fond orange discret UNIQUEMENT sur login ----- */
    var isLogin = window.location.pathname.toLowerCase().indexOf('login') !== -1;
    if (isLogin) {
      document.body.style.background = '#fdf3ea'; /* orange très discret */
      /* encore plus discret : '#fef7f0' */
    }
    /* Page principale : gris d'origine (--bg:#f3f4f6) conservé */
  }

  if (document.body) { init(); }
  else { document.addEventListener('DOMContentLoaded', init); }
})();

// @ts-check
// ----------------------------------------------------------------------------------
// Filet de sécurité du chargement. Script classique placé avant le programme principal (le
// module) : il note les erreurs dès la première ligne exécutée, même quand le programme
// principal ne peut pas démarrer (navigateur trop ancien, erreur de syntaxe, WebGL absent).
// Dans ce cas il affiche un écran d'explication avec un diagnostic à copier. Une fois le
// programme démarré, c'est src/diag.js qui reprend la main (window.__carReport).
// Écrit en JavaScript simple, sans dépendance : il doit tourner sur les navigateurs anciens.
// ----------------------------------------------------------------------------------
(function () {
  var W = /** @type {any} */ (window);
  var errs = (W.__carErrs = W.__carErrs || []);
  var add = function (o) {
    o.t = Date.now();
    if (W.__carReport) { W.__carReport(o); return; }
    if (errs.length < 60) errs.push(o);
  };
  window.addEventListener('error', function (ev) {
    var tg = /** @type {any} */ (ev.target);
    // ressource qui ne se charge pas (police, image) : notée, sans être une panne
    if (tg && tg !== window && tg.tagName) { add({ kind: 'ressource', where: 'chargement', msg: String(tg.tagName).toLowerCase() + ' ' + (tg.src || tg.href || '') }); return; }
    add({ kind: 'erreur', where: '', msg: String(ev.message || (ev.error && ev.error.message) || 'erreur'), src: ev.filename || '', line: ev.lineno || 0, col: ev.colno || 0, stack: ev.error && ev.error.stack ? String(ev.error.stack) : '' });
  }, true);
  window.addEventListener('unhandledrejection', function (ev) {
    var r = ev.reason;
    add({ kind: 'promesse', where: '', msg: String(r && r.message ? r.message : r), stack: r && r.stack ? String(r.stack) : '' });
  });

  // modules JavaScript non pris en charge : le programme principal ne s'exécutera jamais
  var noModules = !('noModule' in document.createElement('script'));

  function diagText(reason) {
    var lines = ['TIEE Simulator · diagnostic du démarrage', 'Version : ' + (typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'), 'Date : ' + new Date().toISOString(),
      'Page : ' + location.protocol + (location.protocol === 'file:' ? ' (fichier ouvert sur l\'ordinateur)' : ' ' + location.host),
      'Navigateur : ' + navigator.userAgent, 'Langue : ' + navigator.language + ' · écran ' + screen.width + '×' + screen.height,
      'Cause probable : ' + reason, '', 'Erreurs notées (' + errs.length + ') :'];
    for (var i = 0; i < errs.length; i++) {
      var e = errs[i];
      lines.push((i + 1) + '. [' + e.kind + '] ' + e.msg + (e.src ? ' (' + String(e.src).split('/').pop() + ':' + e.line + ':' + e.col + ')' : ''));
      if (e.stack) lines.push('   ' + String(e.stack).split('\n').slice(0, 5).join('\n   '));
    }
    return lines.join('\n');
  }
  function copy(text, btn) {
    var done = function (ok) { btn.textContent = ok ? 'Copié ✓' : 'Sélectionne le texte puis copie (Cmd/Ctrl + C)'; };
    var area = /** @type {HTMLTextAreaElement | null} */ (document.querySelector('#err .boot-diag textarea'));
    var legacy = function () { try { if (area) { area.focus(); area.select(); } done(document.execCommand('copy')); } catch (e) { done(false); } };
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, legacy); else legacy(); } catch (e) { legacy(); }
  }
  // écran de secours : dans #err (s'il affiche déjà une explication, le diagnostic s'y ajoute)
  function showFail(reason) {
    var box = document.getElementById('err');
    if (!box || box.querySelector('.boot-diag')) return;
    var text = diagText(reason);
    var explained = !box.hidden && box.textContent;
    box.hidden = false;
    var sheet = document.createElement('div'); sheet.className = 'sheet boot-sheet';
    if (!explained) {
      sheet.innerHTML = '<header><h2>Le simulateur n\'a pas pu démarrer</h2></header><div class="body prose"><p></p><p class="note">Essaie avec Chrome, Edge ou Firefox à jour. Sur Mac, mets Safari à jour (Safari 15 au minimum, menu Pomme → Réglages du système → Mise à jour de logiciels).</p></div>';
      /** @type {HTMLElement} */ (sheet.querySelector('p')).textContent = reason;
      box.innerHTML = ''; box.appendChild(sheet);
    }
    var d = document.createElement('div'); d.className = 'boot-diag';
    d.innerHTML = '<p class="note">Pour obtenir de l\'aide, copie ce diagnostic et envoie-le à ton formateur.</p><textarea readonly rows="8" aria-label="Texte du diagnostic"></textarea><button class="btn primary" type="button">Copier le diagnostic</button>';
    var area = /** @type {HTMLTextAreaElement} */ (d.querySelector('textarea')); area.value = text;
    var btn = /** @type {HTMLButtonElement} */ (d.querySelector('button')); btn.onclick = function () { copy(text, btn); };
    (explained ? /** @type {HTMLElement} */ (box.querySelector('.sheet .body') || box) : /** @type {HTMLElement} */ (sheet.querySelector('.body'))).appendChild(d);
  }
  // après le chargement : si le programme principal ne s'est pas déclaré prêt et qu'une erreur a
  // été notée, il ne démarrera plus ; sans erreur, il est peut-être seulement lent (ordinateur chargé)
  var tries = 0;
  function check() {
    if (W.__carReady) return;
    if (noModules) { showFail('Ce navigateur est trop ancien : il ne sait pas exécuter le programme du simulateur (modules JavaScript).'); return; }
    // le journal est partagé avec src/diag.js (même tableau) : on y lit aussi ce qu'il a noté
    var serious = errs.filter(function (e) { return e.kind !== 'ressource' && e.kind !== 'bruit'; });
    if (serious.length) { showFail('Une erreur s\'est produite au démarrage dans ce navigateur : ' + serious[0].msg); return; }
    if (++tries < 120) setTimeout(check, 3000);
  }
  W.__carBootCheck = check;
  if (document.readyState === 'complete') setTimeout(check, 3000);
  else window.addEventListener('load', function () { setTimeout(check, 3000); });
})();

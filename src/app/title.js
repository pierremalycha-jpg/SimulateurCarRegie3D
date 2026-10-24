// @ts-check
import { $, modal } from '../ui/common.js';
import { APP_VERSION } from '../diag.js';
import { emit } from '../state.js';
import { livePlayerCard } from '../game/quest.js';

// ----------------------------------------------------------------------------------
// Écran titre de TIEE Simulator (réalisé par le BTS Audiovisuel de Saint-Quentin) : écrit dans la
// page (index.template.html), il s'affiche dès l'ouverture, avant même le programme. Pendant que le
// stade et le car se construisent (main.js, par étapes), il montre la progression et les conseils
// d'Olivier ; quand tout est prêt, le menu s'allume. Trois entrées : Jouer (l'écran de lancement),
// Cours (leçons, exercices pratiques, glossaire), Réglages. Cours et Réglages ne dépendent pas du
// stade : ils s'ouvrent pendant le chargement.
// ----------------------------------------------------------------------------------
export const TITLE = { ready: false, pct: 0 };
const TIPS = [
  'Dans le Cours, chaque leçon se termine par un exercice pratique : Olivier vous emmène au poste et vérifie vos gestes.',
  'Jouer, Car vide : tout est à faire. Olivier vous propose d\'abord le tour du car, puis les tâches se cochent toutes seules sur le côté.',
  'Jouer, Mission spécifique : une tâche précise (le réseau, le line-up, un poste), le car préparé pour elle ; ensuite, vous enchaînez ou vous arrêtez.',
  'Jouer, Car pré-installé : tout est en place, jeu libre, sans missions ni chef de car.',
  'Tab ou T ouvre le pupitre : tous les postes du car et les outils, à une touche.',
  'Dans le car, Échap ouvre le menu : le Cours, les réglages, le retour à l\'accueil.',
  'Avant l\'antenne, on fait le line-up : chaque caméra est exposée et équilibrée pour se raccorder aux autres.',
  'Tally rouge : la caméra est à l\'antenne. Tally vert : elle est prête à passer, en PVW.',
  'Le N-1, c\'est le retour son de tout le programme, sauf ta propre voix : sans lui, un commentateur s\'entendrait en écho.',
  'Sur une grille, une source peut aller vers plusieurs destinations, mais une destination ne reçoit qu\'une source.',
  'Le genlock cale toutes les sources sur la même référence : sans lui, le mélangeur ne commute pas proprement.',
  'Si le waveform dépasse 100 %, les blancs sont écrêtés, même quand l\'image paraît belle sur l\'écran.',
  'En SDI, un câble trop long ferme le diagramme de l\'œil : au-delà d\'une limite, l\'image tombe d\'un coup.',
  'Même en SDI, le car a un réseau : RCP, grille, EVS et intercom se parlent en Ethernet.',
]
let tipI = 0, tipTimer = 0;
const keys = () => /** @type {HTMLButtonElement[]} */ ([...document.querySelectorAll('#ti-menu .ti-key')]);

/** l'écran titre est affiché */
export const titleOpen = () => { const t = $('#title'); return !!t && !t.hidden; };

function setTip(i) {
  tipI = (i + TIPS.length) % TIPS.length;
  const p = $('#ti-tip'); if (p) p.textContent = TIPS[tipI];
}
function rotate() { clearInterval(tipTimer); tipTimer = window.setInterval(() => { if (titleOpen()) setTip(tipI + 1); }, 8000); }

/** branche l'écran titre (au tout début du programme, avant la construction du monde) */
export function initTitle() {
  const t = $('#title'); if (!t) return;
  const ver = $('#ti-ver'); if (ver) ver.textContent = 'v' + APP_VERSION;
  const pc = $('#ti-player'); if (pc) pc.replaceChildren(livePlayerCard(true));
  const next = /** @type {HTMLButtonElement | null} */ ($('#ti-next'));
  if (next) { next.hidden = false; next.onclick = () => { setTip(tipI + 1); rotate(); }; }
  rotate();
  $('#ti-play').onclick = () => enterFrom('start');
  $('#ti-cours').onclick = () => emit('cours');
  $('#ti-settings').onclick = () => emit('settings');
  // le Cours et les réglages ne dépendent pas du stade : disponibles pendant le chargement
  for (const id of ['#ti-cours', '#ti-settings']) /** @type {HTMLButtonElement} */ ($(id)).disabled = false;
  // une fenêtre ouverte depuis l'écran titre passe par-dessus lui (styles/menu.css, body.ti-on)
  const sync = () => document.body.classList.toggle('ti-on', !t.hidden);
  new MutationObserver(sync).observe(t, { attributes: true, attributeFilter: ['hidden'] }); sync();
}

/** étape du chargement : libellé et avancement (0 à 100) */
export function loadStep(label, pct) {
  TITLE.pct = pct;
  const bar = $('#ti-bar'); if (!bar) return;
  bar.classList.remove('wait');
  bar.style.setProperty('--p', pct + '%');
  bar.setAttribute('aria-valuenow', String(Math.round(pct)));
  $('#ti-step').textContent = label;
  $('#ti-pct').textContent = Math.round(pct) + ' %';
}
/** laisse le navigateur afficher l'étape avant la suivante (une image, ou 60 ms si l'onglet est caché) */
export const tick = () => new Promise((r) => {
  let done = false; const go = () => { if (!done) { done = true; r(undefined); } };
  requestAnimationFrame(() => setTimeout(go, 0)); setTimeout(go, 60);
});

/** tout est construit : le menu s'allume */
export function titleReady() {
  TITLE.ready = true;
  loadStep('Le car est prêt', 100);
  const t = $('#title'); if (!t) return;
  t.classList.remove('loading'); t.classList.add('ready');
  $('#ti-sig').textContent = 'Prêt';
  for (const k of keys()) k.disabled = false;
  if (titleOpen() && !t.contains(document.activeElement)) $('#ti-play').focus({ preventScroll: true });
}

/** quitter l'écran titre vers l'écran Jouer */
export function enterFrom(target = 'start') {
  if (!TITLE.ready) return;
  const t = $('#title'); if (t) t.hidden = true;
  if (modal.isOpen) modal.close();
  if (target === 'start') { const a = /** @type {HTMLElement | null} */ ($('#st-antenne')); if (a) a.focus({ preventScroll: true }); }
}
/** revenir à l'écran titre (bouton « Menu principal » de la feuille de service) */
export function showTitle() {
  const t = $('#title'); if (!t) return;
  t.hidden = false;
  $('#ti-play').focus({ preventScroll: true });
}

/** clavier sur l'écran titre : flèches pour parcourir le menu */
export function titleKey(e) {
  if (e.code !== 'ArrowDown' && e.code !== 'ArrowUp') return;
  const list = keys().filter((b) => !b.disabled && !b.closest('[hidden]')); if (!list.length) return;
  const i = list.indexOf(/** @type {any} */ (document.activeElement));
  list[(i + (e.code === 'ArrowDown' ? 1 : -1) + list.length) % list.length].focus();
  e.preventDefault();
}


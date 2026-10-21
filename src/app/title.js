// @ts-check
import { el } from '../util.js';
import { $ } from '../ui/common.js';
import { APP_VERSION } from '../diag.js';
import { openTrainer } from '../ui/config.js';
import { emit } from '../state.js';
import { PROFILE, setRole } from './profile.js';

// ----------------------------------------------------------------------------------
// Écran titre : écrit dans la page (index.template.html), il s'affiche dès l'ouverture, avant
// même le programme. Pendant que le stade et le car se construisent (main.js, par étapes), il
// montre la progression et les conseils d'Olivier ; quand tout est prêt, le menu s'allume, en cinq
// entrées : Jouer (feuille de service), Cours, Chef de car, Formateur (profil Formateur), Réglages.
// ----------------------------------------------------------------------------------
export const TITLE = { ready: false, pct: 0 };
const TIPS = [
  'Tab ou T ouvre le pupitre : tous les postes du car et les outils, à une touche.',
  'Le Cours explique chaque notion avec un schéma et une manipulation : touche G dans le car, ou ici, pendant que le car se prépare.',
  'Dans le car, Échap ouvre le menu : le Cours, le chef de car, les réglages, et le profil Formateur.',
  'Touche J : je suis là pendant toute la vacation. Au poste où tu es, je te propose les parcours qui s\'y font.',
  'Avant l\'antenne, on fait le line-up : chaque caméra est exposée et équilibrée pour se raccorder aux autres.',
  'Tally rouge : la caméra est à l\'antenne. Tally vert : elle est prête à passer, en PVW.',
  'Le N-1, c\'est le retour son de tout le programme, sauf ta propre voix : sans lui, un commentateur s\'entendrait en écho.',
  'Sur une grille, une source peut aller vers plusieurs destinations, mais une destination ne reçoit qu\'une source.',
  'Une sortie de grille importante, comme le départ vers la transmission, se verrouille : un clic de trop ne coupera pas l\'antenne.',
  'Le genlock cale toutes les sources sur la même référence : sans lui, le mélangeur ne commute pas proprement.',
  'Si le waveform dépasse 100 %, les blancs sont écrêtés, même quand l\'image paraît belle sur l\'écran.',
  'En SDI, un câble trop long ferme le diagramme de l\'œil : au-delà d\'une limite, l\'image tombe d\'un coup.',
  'Même en SDI, le car a un réseau : RCP, grille, EVS et intercom se parlent en Ethernet.',
  'Au mélangeur, les touches 1 à 9 envoient directement une caméra à l\'antenne.',
];
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
  const next = /** @type {HTMLButtonElement | null} */ ($('#ti-next'));
  if (next) { next.hidden = false; next.onclick = () => { setTip(tipI + 1); rotate(); }; }
  rotate();
  $('#ti-play').onclick = () => enterFrom('start');
  $('#ti-cours').onclick = () => emit('cours');
  $('#ti-chef').onclick = () => emit('entrainement');
  $('#ti-trainer').onclick = () => enterFrom('trainer');
  $('#ti-settings').onclick = () => openPanel('settings');
  // les cours, l'espace du chef et les réglages ne dépendent pas du stade : disponibles pendant le chargement
  for (const id of ['#ti-cours', '#ti-chef', '#ti-settings']) /** @type {HTMLButtonElement} */ ($(id)).disabled = false;
  // le profil : Étudiant ou Formateur, mémorisé ; il change aussi depuis les réglages
  const role = $('#ti-role');
  if (role) for (const b of role.querySelectorAll('button')) {
    b.setAttribute('aria-pressed', String(b.dataset.v === PROFILE.role));
    b.addEventListener('click', () => { setRole(b.dataset.v); for (const x of role.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b)); });
  }
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
  const panel = $('#ti-panel');
  if (titleOpen() && (!panel || panel.hidden) && !t.contains(document.activeElement)) $('#ti-play').focus({ preventScroll: true });
}

/** quitter l'écran titre vers la feuille de service, les lieux, le chef de car ou l'espace formateur */
export function enterFrom(target = 'start') {
  if (!TITLE.ready) return;
  const t = $('#title'); if (t) t.hidden = true;
  closePanel();
  if (target === 'trainer') { openTrainer('car'); return; }
  if (target === 'lieux') {
    const wall = $('#start .dk-lieux'); const first = /** @type {HTMLElement | null} */ ($('#start .lx'));
    if (wall) wall.scrollIntoView({ block: 'start' });
    if (first) first.focus({ preventScroll: true });
    return;
  }
  const a = /** @type {HTMLElement | null} */ ($('#st-antenne')); if (a) a.focus({ preventScroll: true });
}
/** revenir à l'écran titre (bouton « Menu principal » de la feuille de service) */
export function showTitle() {
  const t = $('#title'); if (!t) return;
  t.hidden = false; closePanel();
  $('#ti-play').focus({ preventScroll: true });
}

// ---------------- réglages et crédits : un panneau à la place du menu ----------------
function openPanel(kind) {
  const p = $('#ti-panel'), menu = $('#ti-menu'), role = $('#ti-role'); if (!p || !menu) return;
  p.replaceChildren(...(kind === 'settings' ? settings() : credits()), el('button', { type: 'button', class: 'btn', id: 'ti-back', onclick: () => closePanel(true) }, 'Retour au menu'));
  menu.hidden = true; p.hidden = false; if (role) role.hidden = true;
  const first = /** @type {HTMLElement | null} */ (p.querySelector('button')); if (first) first.focus({ preventScroll: true });
}
function closePanel(focusMenu = false) {
  const p = $('#ti-panel'), menu = $('#ti-menu'); if (!p || !menu) return;
  if (p.hidden) return;
  p.hidden = true; p.replaceChildren(); menu.hidden = false; const role = $('#ti-role'); if (role) role.hidden = false;
  if (focusMenu) { const k = keys().find((b) => !b.disabled); if (k) k.focus({ preventScroll: true }); }
}
// une rangée de touches à bascule ; la valeur va aussi au sélecteur de la feuille de service
function seg(label, id, options, value, onChange) {
  const box = el('div', { class: 'seg', role: 'group', 'aria-label': label });
  const set = (v) => { for (const b of box.children) b.setAttribute('aria-pressed', String(b.dataset.v === v)); onChange(v); };
  for (const [v, text] of options) box.append(el('button', { type: 'button', 'data-v': v, 'aria-pressed': String(v === value), onclick: () => set(v) }, text));
  return [el('span', { id }, label), box];
}
function startValue(id, fallback) { const s = /** @type {any} */ ($('#' + id)); return s && s.value != null ? String(s.value) : fallback; }
function setStart(id, v) { const s = /** @type {any} */ ($('#' + id)); if (s) s.value = v; }
function settings() {
  let q = startValue('stqual', 'basse'); try { q = localStorage.getItem('carregie.quality') || q; } catch (e) { /* stockage indisponible */ }
  return [el('h2', {}, 'Réglages'),
    el('p', {}, 'Ils s\'appliquent en entrant dans le car, et se retrouvent sur la feuille de service.'),
    el('div', { class: 'ti-row' },
      ...seg('Qualité graphique', 'ti-q', [['basse', 'Basse'], ['moyenne', 'Moyenne'], ['haute', 'Haute']], q, (v) => { setStart('stqual', v); try { localStorage.setItem('carregie.quality', v); } catch (e) { /* stockage indisponible */ } }),
      ...seg('Son', 'ti-s', [['1', 'Ambiance et commentaires'], ['0', 'Coupé']], startValue('stsnd', '1'), (v) => setStart('stsnd', v))),
    el('p', {}, 'Basse convient aux ordinateurs portables ; Haute demande une carte graphique dédiée. D\'autres réglages (lumière, étiquettes, voix du réalisateur) sont dans Réglages, une fois dans le car.'),
    el('p', {}, 'Le profil se choisit sous le menu : Étudiant voit Jouer, Cours, Chef de car et Réglages ; Formateur a en plus l\'espace formateur, le suivi, la relecture technique et les pannes.'),
    ...credits()];
}
function credits() {
  return [el('h2', {}, 'Crédits'),
    el('p', {}, `Car régie 3D, version ${APP_VERSION}. Simulateur de formation aux métiers du car régie, pensé pour l'option TIEE du BTS Métiers de l'audiovisuel.`),
    el('ul', {},
      el('li', {}, 'Moteur 3D : three.js (licence MIT).'),
      el('li', {}, 'Polices : Archivo, Archivo Narrow, B612 Mono, Barlow Condensed, JetBrains Mono (licence SIL OFL).'),
      el('li', {}, 'Icônes : Phosphor (licence MIT).')),
    el('p', {}, 'Simulation non officielle, sans lien avec le club ni avec les constructeurs cités. Les caractéristiques techniques sont des ordres de grandeur réalistes, donnés à titre pédagogique.')];
}

/** clavier sur l'écran titre : flèches pour parcourir le menu, Échap pour revenir au menu */
export function titleKey(e) {
  const p = $('#ti-panel');
  if (e.code === 'Escape' && p && !p.hidden) { closePanel(true); e.preventDefault(); return; }
  if (e.code !== 'ArrowDown' && e.code !== 'ArrowUp') return;
  const list = keys().filter((b) => !b.disabled && !b.closest('[hidden]')); if (!list.length) return;
  const i = list.indexOf(/** @type {any} */ (document.activeElement));
  list[(i + (e.code === 'ArrowDown' ? 1 : -1) + list.length) % list.length].focus();
  e.preventDefault();
}

// @ts-check
import { S, emit, on } from '../state.js';
import { el, tc } from '../util.js';
import { icon } from '../ui/icons.js';
import { sfx } from '../game/sfx.js';
import { createPhone3D, SCREEN_PX } from './modele.js';
import { APPS, homeView, appView, levelWidget } from './apps.js';

// ----------------------------------------------------------------------------------
// Le téléphone (touche Tab, ou T ; bouton Téléphone du HUD et des postes) : comme dans un jeu,
// on lève un smartphone et ses applications mènent à tout ce qui n'est pas dans le décor : aller
// à un poste ou un endroit, les missions, Olivier, le plan caméras, les synoptiques, le matériel,
// le Cours et sa progression, les réglages. Il remplace le pupitre et les boutons du HUD : à
// l'écran, il ne reste que le téléphone et le menu (Échap). Les anciennes touches (P, Y, K, G, L,
// J, H, M, V) restent des raccourcis.
// Une application « dans le téléphone » s'affiche sur son écran (aller à, progression) ; les
// autres rangent le téléphone et ouvrent leur fenêtre habituelle.
// ----------------------------------------------------------------------------------
/** @type {{ open: boolean, app: string, p3d: any, t: number, dir: number, raf: number, clock: any, last: number, safety: any, press: boolean, stale: boolean }} */
export const TEL = { open: false, app: '', p3d: null, t: 0, dir: 0, raf: 0, clock: 0, last: 0, safety: 0, press: false, stale: false };
let root = null, screen = null, view = null, timeEl = null;

const DUR_IN = 0.3, DUR_OUT = 0.22;
const ease = (t) => 1 - Math.pow(1 - t, 3);

function build() {
  timeEl = el('b', { class: 'tel-time' });
  view = el('div', { class: 'tel-view' });
  screen = el('div', { class: 'tel-screen', style: { width: SCREEN_PX.w + 'px', height: SCREEN_PX.h + 'px' } },
    el('div', { class: 'tel-status', 'aria-hidden': 'true' }, timeEl, el('i', { class: 'tel-island' }),
      el('span', { class: 'tel-icons' }, icon('signal'), icon('wifi'), icon('batterie'))),
    view,
    el('button', { type: 'button', class: 'tel-homebar', 'aria-label': 'Écran d\'accueil du téléphone', title: 'Accueil (Retour arrière : Échap)', onclick: () => (TEL.app ? show('') : closeTelephone()) }, el('i')));
  root = el('div', { id: 'telephone', class: 'tel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Téléphone', hidden: true });
  // un clic à côté du téléphone le range
  root.addEventListener('pointerdown', (e) => { if (!screen.contains(/** @type {Node} */ (e.target))) { e.preventDefault(); closeTelephone(); } });
  // un appui en cours sur l'écran : l'accueil ne se reconstruit pas sous le doigt (le clic serait perdu)
  screen.addEventListener('pointerdown', () => { TEL.press = true; });
  window.addEventListener('pointerup', () => { if (!TEL.press) return; TEL.press = false; if (TEL.stale) setTimeout(refreshHome, 0); }, true);
  document.body.append(root);
  TEL.p3d = createPhone3D(root, screen);
  window.addEventListener('resize', () => { if (TEL.p3d && !root.hidden) { TEL.p3d.resize(); TEL.p3d.pose(ease(TEL.t)); TEL.p3d.render(); } });
}

/** affiche l'accueil ('') ou une application du téléphone */
function show(app) {
  TEL.app = app;
  const a = app ? APPS.find((x) => x.id === app) : null;
  view.replaceChildren(a && a.view ? appView(a, () => show('')) : homeView(launch));
  view.scrollTop = 0;
  screen.dataset.app = app || 'accueil';
  focusFirst();
}
function focusFirst() {
  if (matchMedia('(pointer: coarse)').matches) return;
  // la première application (accueil), sinon le premier choix de l'application ouverte
  const f = /** @type {HTMLElement | null} */ (view.querySelector('.tel-app') || view.querySelector('.tel-row') || view.querySelector('button'));
  if (f) f.focus({ preventScroll: true });
}
/** lancer une application : sur l'écran, ou ranger le téléphone et ouvrir sa fenêtre */
function launch(id) {
  const a = APPS.find((x) => x.id === id); if (!a) return;
  if (a.view) { show(id); return; }
  closeTelephone(true);
  if (a.open) a.open();
}

function tick(now) {
  TEL.raf = 0;
  const dt = Math.min(0.05, (now - (TEL.last || now)) / 1000); TEL.last = now;
  TEL.t = Math.max(0, Math.min(1, TEL.t + TEL.dir * dt / (TEL.dir > 0 ? DUR_IN : DUR_OUT)));
  TEL.p3d.pose(ease(TEL.t)); TEL.p3d.render();
  if (TEL.dir < 0 && TEL.t <= 0) { root.hidden = true; TEL.dir = 0; return; }
  if (TEL.dir > 0 && TEL.t >= 1) { TEL.dir = 0; return; }
  TEL.raf = requestAnimationFrame(tick);
}
function animate(dir) {
  TEL.dir = dir; TEL.last = 0;
  if (!TEL.raf) TEL.raf = requestAnimationFrame(tick);
  // filet : si les images ne tournent pas (onglet en arrière-plan), l'état final est posé quand même
  clearTimeout(TEL.safety);
  TEL.safety = setTimeout(() => { if (TEL.dir === dir) { TEL.t = dir > 0 ? 1 : 0; TEL.p3d.pose(TEL.t); TEL.p3d.render(); if (dir < 0) root.hidden = true; TEL.dir = 0; } }, 900);
}
function updClock() { if (timeEl) timeEl.textContent = tc(S.tcOffset + S.simTime).slice(0, 5); }

export const telOpen = () => TEL.open;
/** lever le téléphone, sur l'accueil ou sur une application */
export function openTelephone(app = '') {
  if (S.mode === 'start') return;
  if (!root) build();
  if (document.pointerLockElement) document.exitPointerLock();
  const was = TEL.open;
  TEL.open = true; S.telephone = true;
  root.hidden = false; root.classList.remove('tel-off');
  if (!was) { TEL.p3d.resize(); TEL.p3d.pose(ease(TEL.t)); sfx('open'); }
  show(app);
  updClock(); clearInterval(TEL.clock); TEL.clock = setInterval(updClock, 1000);
  animate(1);
  emit('telephone:open', app);
}
/** ranger le téléphone ; vite = sans bruit (une application prend la main) */
export function closeTelephone(vite = false) {
  if (!TEL.open) return;
  TEL.open = false; S.telephone = false;
  clearInterval(TEL.clock);
  if (!vite) sfx('close');
  // pendant qu'il descend, le téléphone ne prend plus les clics (la fenêtre ouverte par l'application les reçoit)
  root.classList.add('tel-off');
  if (screen && screen.contains(document.activeElement)) /** @type {HTMLElement} */ (document.activeElement).blur();
  animate(-1);
  emit('telephone:close');
}
export function toggleTelephone(app = '') { if (TEL.open) closeTelephone(); else openTelephone(app); }
on('telephone', (o) => openTelephone((o && o.app) || ''));
// le contenu suit le jeu (niveau, équipiers, objectif) tant que l'accueil est affiché
// niveau et badges : seul le bandeau du niveau change ; équipiers et lieu : l'accueil est refait, jamais sous le doigt
for (const ev of ['xp', 'badge']) on(ev, () => { const w = TEL.open && !TEL.app && view.querySelector('.tel-lvl'); if (!w) return; if (TEL.press) TEL.stale = true; else w.replaceWith(levelWidget(launch)); });
for (const ev of ['session', 'teleport']) on(ev, () => { if (TEL.open && !TEL.app) { TEL.stale = true; if (!TEL.press) refreshHome(); } });
function refreshHome() { TEL.stale = false; if (TEL.open && !TEL.app) show(''); }

/** déplacer le focus vers l'élément le plus proche dans une direction (flèches) */
function moveFocus(dx, dy) {
  const items = /** @type {HTMLElement[]} */ ([...view.querySelectorAll('button, [tabindex="0"]')].filter((b) => /** @type {HTMLElement} */ (b).offsetParent !== null));
  const cur = /** @type {HTMLElement} */ (document.activeElement);
  if (!items.includes(cur)) { if (items[0]) items[0].focus(); return; }
  const r0 = cur.getBoundingClientRect(), x0 = r0.left + r0.width / 2, y0 = r0.top + r0.height / 2;
  let best = null, bd = Infinity;
  for (const b of items) {
    if (b === cur) continue;
    const r = b.getBoundingClientRect(), x = r.left + r.width / 2 - x0, y = r.top + r.height / 2 - y0;
    const along = x * dx + y * dy; if (along <= 2) continue;
    const d = along + Math.abs(x * dy + y * dx) * 2.5;
    if (d < bd) { bd = d; best = b; }
  }
  if (best) { best.focus(); best.scrollIntoView({ block: 'nearest' }); }
}
// raccourcis qui rangent le téléphone et font ce qu'ils font d'habitude
const PASS = new Set(['KeyP', 'KeyY', 'KeyK', 'KeyG', 'KeyL', 'KeyJ', 'KeyH', 'KeyM', 'KeyV']);
/**
 * Touches quand le téléphone est levé. Renvoie true si la touche est prise par le téléphone ;
 * false : le téléphone est rangé et la touche suit son chemin habituel.
 * @param {KeyboardEvent} e
 */
export function telKey(e) {
  if (e.code === 'Escape') { e.preventDefault(); if (TEL.app) show(''); else closeTelephone(); return true; }
  if (e.code === 'Tab' || e.code === 'KeyT') { e.preventDefault(); closeTelephone(); return true; }
  const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (arrows[e.code]) { e.preventDefault(); moveFocus(arrows[e.code][0], arrows[e.code][1]); return true; }
  if (e.code === 'Backspace' && TEL.app) { e.preventDefault(); show(''); return true; }
  if (PASS.has(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) { closeTelephone(true); return false; }
  // Entrée, Espace : le bouton qui a le focus ; le reste (déplacement…) attend que le téléphone soit rangé
  if (e.code !== 'Enter' && e.code !== 'Space' && e.code !== 'NumpadEnter') e.preventDefault();
  return true;
}
/** pour les tests : l'état du téléphone */
export const telDebug = () => ({ open: TEL.open, app: TEL.app, t: TEL.t, webgl: !!(TEL.p3d && TEL.p3d.webgl), scale: TEL.p3d ? TEL.p3d.scale : 0, apps: root ? [...root.querySelectorAll('.tel-app')].map((b) => /** @type {HTMLElement} */ (b).dataset.app) : [] });

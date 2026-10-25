// @ts-check
import * as THREE from 'three';
import { S } from '../state.js';
import { el, clamp, lerp, wrapAngle } from '../util.js';
import { T } from '../truck.js';
import { renderEye, RENDER } from '../render.js';
import { rich } from '../ui/rich.js';
import { POSTE_MELANGEUR } from './melangeur.js';
import { POSTE_VISION } from './vision.js';
import { POSTE_SON } from './son.js';

// ----------------------------------------------------------------------------------
// Les postes en 3D : au lieu d'une interface plate en plein écran, on s'assoit devant le vrai
// matériel du car. L'écran est partagé : à gauche, le pupitre en 3D (le car est rendu comme en marchant), qu'on
// observe en tournant autour (orbite, comme la caméra du Cours : glisser pour tourner, clic droit ou Maj pour
// déplacer, molette pour s'approcher) ; à droite, un panneau 2D : les écrans du poste en direct (multiview,
// moniteur de référence, PRISM, vumètres… : on voit l'effet de chaque geste), puis la fiche et le fil
// « Ce qui se passe ». Sur le pupitre, une couche d'interface 2D légère :
//  · une zone cliquable transparente sur chaque commande (élément du DOM recalé à chaque image sur la
//    projection de la commande 3D) : clic, clavier (Tab, flèches), lecteurs d'écran, et les parcours du chef
//    de car qui visent les mêmes sélecteurs qu'en 2D (#station .xpt.pst[aria-label=…], .rcp-btn…) ;
//    une commande est une touche (clic), une touche maintenue (talkback), une glissière le long d'une
//    course 3D (barre T, fader, joystick) ou une molette (glisser vers le haut ou le bas, molette, flèches) ;
//  · une bulle au survol (nom et rôle de la commande), des étiquettes sur les zones du pupitre ;
//  · des vues prédéfinies (le poste, puis chaque zone en gros plan), double-clic pour revenir à la vue ;
//  · « Tous les réglages » : un tiroir qui contient l'interface 2D complète du poste (ce que le matériel 3D ne
//    porte pas : pages, matrices, instruments). Le chef de car y renvoie quand l'élément à montrer y est.
// La vue 2D reste disponible (bouton « Vue 2D » de l'en-tête, choix mémorisé) : mode allégé, petit écran,
// ou simple préférence. Un poste s'ajoute ici par sa définition (voir POSTE_MELANGEUR) :
//  ready, root, deck, views, zones, intro, controls, controlsSig?, hover, monitors?, panels?, drawer?, key?, legend?,
//  update ; et, pour l'orbite : rMin / rMax (distance à la cible), eyeBox (où l'œil peut aller, repère du pupitre).
// ----------------------------------------------------------------------------------
const DEFS = { melangeur: POSTE_MELANGEUR, vision: POSTE_VISION, son: POSTE_SON };
const PREF = 'carregie.poste3d';

/** @type {any} */
export const P3D = { active: false, def: null, arg: null, view: 'poste', orb: null, fly: null, hits: [], tags: [], ui: null, hot: null, sel: null, panel: null, drawer: null, mons: null, sig: '' };

/** ce poste existe-t-il en 3D (et son matériel est-il construit) ? */
export const poste3dDispo = (id) => !!(DEFS[id] && DEFS[id].ready());
/** vue choisie : 3D par défaut, 2D en mode allégé et en qualité Basse (PC faibles) ; le choix de l'utilisateur est mémorisé */
export function poste3dVoulu() {
  try { const v = localStorage.getItem(PREF); if (v === '3d' || v === '2d') return v === '3d'; } catch (e) { /* stockage indisponible */ }
  return !S.lite && S.quality !== 'basse';
}
export function setPoste3dVoulu(on) { try { localStorage.setItem(PREF, on ? '3d' : '2d'); } catch (e) { /* stockage indisponible */ } }

const V = new THREE.Vector3(), W3 = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), SPH = new THREE.Spherical();
/** @type {any} */
let CAM = null; // caméra de la vue (pour projeter la course des glissières)
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const val = (v) => (typeof v === 'function' ? v() : v);
const toWorld = (obj, p, out = new THREE.Vector3()) => out.set(p[0], p[1], p[2]).applyMatrix4(obj.matrixWorld);
// repère d'une commande, d'une vue ou d'une zone : le sien, sinon le plateau (commandes) ou le pupitre (vues, zones)
const frameOf = (o, dflt) => (o && o.frame ? val(o.frame) : dflt) || dflt;
function viewOf(id) {
  const v = P3D.def.views.find((x) => x.id === id) || P3D.def.views[0];
  const f = frameOf(v, P3D.def.root()); f.updateMatrixWorld(true);
  return { id: v.id, eye: toWorld(f, val(v.eye)), look: toWorld(f, val(v.look)), fov: v.fov };
}

/** monte le poste en 3D dans le corps du poste ; renvoie l'instance attendue par ui/stations.js */
export function mountPoste3D(id, body, ctx, arg) {
  const def = DEFS[id]; P3D.def = def; P3D.active = true; P3D.arg = arg;
  if (def.enter) def.enter(arg);
  P3D.view = 'poste'; P3D.orb = orbOf(viewOf('poste')); P3D.fly = null; P3D.hot = null; P3D.sel = null; P3D.panel = null;
  body.classList.add('p3d-body');
  // la scène : orbite autour du pupitre (glisser), déplacement (clic droit, Maj + glisser), molette (s'approcher),
  // pincement au doigt, double-clic pour revenir à la vue
  // data-ro-ok : regarder, changer de vue et lire les fiches restent permis quand le poste est en lecture seule (session)
  const stage = el('div', { class: 'p3d-stage', 'aria-hidden': 'true', 'data-ro-ok': '' });
  orbitInput(stage);
  // zones cliquables des commandes (reconstruites quand la définition le demande : autre caméra, autre couche…)
  const hitsBox = el('div', { class: 'p3d-hits' });
  // étiquettes des zones (vue d'ensemble)
  const tagsBox = el('div', { class: 'p3d-tags', 'data-ro-ok': '' });
  P3D.tags = def.zones.map((z) => {
    const lab = el('span', {}, val(z.title));
    const b = el('button', { class: 'p3d-tag', type: 'button', onclick: () => { goView(z.view); showFiche(z); } }, el('i'), lab);
    tagsBox.append(b);
    return { z, b, lab };
  });
  // vues prédéfinies, puis le tiroir « Tous les réglages »
  const views = el('div', { class: 'p3d-views', role: 'toolbar', 'aria-label': 'Vues du poste', 'data-ro-ok': '' }, ...def.views.map((v) => el('button', { class: 'btn small', type: 'button', 'data-view': v.id, onclick: () => { goView(v.id); const z = def.zones.find((x) => x.view === v.id); showFiche(z || null); } }, v.label)));
  // panneau de droite : les écrans du poste (en direct), puis deux onglets, la fiche (zone, réglages en 2D) et le fil
  // « Ce qui se passe » (un point signale une nouvelle explication quand on lit la fiche)
  const mons = el('div', { class: 'p3d-mons', role: 'region', 'aria-label': 'Écrans du poste' });
  const fiche = el('div', { class: 'p3d-fiche', role: 'tabpanel' });
  const tabF = el('button', { class: 'p3d-tab on', type: 'button', role: 'tab', 'aria-selected': 'true', 'data-ro-ok': '', onclick: () => setTab('fiche') }, 'Fiche');
  const tabE = el('button', { class: 'p3d-tab', type: 'button', role: 'tab', 'aria-selected': 'false', 'data-ro-ok': '', onclick: () => setTab('fil') }, 'Ce qui se passe');
  // replier la fiche et le fil : toute la hauteur pour les écrans (un clic sur un onglet les rouvre)
  const fold = el('button', { class: 'p3d-fold', type: 'button', 'data-ro-ok': '', 'aria-expanded': 'true', title: 'Replier la fiche : toute la hauteur pour les écrans', onclick: () => setFold(!P3D.ui.folded) }, '▾');
  const legend = el('p', { class: 'p3d-legend note' });
  const side = el('div', { class: 'p3d-side' }, mons, el('div', { class: 'p3d-tabs', role: 'tablist' }, tabF, tabE, el('span', { class: 'p3d-sp' }), fold), el('div', { class: 'p3d-tabbody' }, fiche, ctx.explainBox), legend);
  const tip = el('div', { class: 'p3d-tip', role: 'status', hidden: true });
  const drawer = def.drawer ? makeDrawer(def.drawer, views, ctx, arg) : null;
  body.append(stage, hitsBox, tagsBox, views, ...(drawer ? [drawer.box] : []), side, tip);
  P3D.ui = { body, stage, hitsBox, tagsBox, views, side, mons, fiche, legend, tip, tabF, tabE, fold, feed: ctx.explainBox, tab: 'fiche', folded: false };
  P3D.drawer = drawer;
  P3D.mons = def.monitors ? def.monitors(mons, ctx) || {} : null;
  mons.hidden = !def.monitors;
  // une explication arrive pendant qu'on lit la fiche : le point sur l'onglet du fil
  const list = ctx.explainBox.querySelector('.ex-list');
  if (list && typeof MutationObserver !== 'undefined') new MutationObserver(() => { if (P3D.ui && P3D.ui.tab !== 'fil') tabE.classList.add('new'); }).observe(list, { childList: true, characterData: true, subtree: true });
  buildHits();
  showFiche(null);
  setTab('fiche');
  return {
    update(dt) {
      if (def.controlsSig && def.controlsSig() !== P3D.sig) { buildHits(); if (def.onControls) def.onControls(); }
      legend.textContent = def.legend ? def.legend() : '';
      if (P3D.panel && P3D.panel.update) P3D.panel.update();
      for (const b of views.querySelectorAll('[data-view]')) b.classList.toggle('on', /** @type {HTMLElement} */ (b).dataset.view === P3D.view);
      for (const H of P3D.hits) {
        const off = !!(H.c.off && H.c.off()); if (off !== H.off) { H.off = off; H.h.classList.toggle('dead', off); }
        if (H.c.slider || H.c.knob) H.h.setAttribute('aria-valuenow', String(Math.round(H.c.value() * 100)));
        if (H.c.on) { const on = !!H.c.on(); if (on !== H.on) { H.on = on; H.h.classList.toggle('on', on); } }
      }
      if (P3D.hot) refreshTip();
      for (const t of P3D.tags) { const s = val(t.z.title); if (t.lab.textContent !== s) t.lab.textContent = s; }
      if (drawer && drawer.open && drawer.inst.update) drawer.inst.update(dt);
      if (P3D.mons && P3D.mons.update) P3D.mons.update(dt);
    },
    frame(dt) { if (drawer && drawer.open && drawer.inst.frame) drawer.inst.frame(dt); if (P3D.mons && P3D.mons.frame) P3D.mons.frame(dt); },
    key(e) {
      const H = P3D.hot;
      if (H && (H.c.slider || H.c.knob) && document.activeElement === H.h) {
        const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
        // la barre T et les glissières tirées vers soi : flèche bas = vers l'opérateur
        if (d) { H.c.set(clamp(H.c.value() + d * (H.c.step || 0.02) * (H.c.slider && !H.c.up ? -1 : 1), 0, 1)); refreshTip(); return true; }
      }
      if (drawer && drawer.open && drawer.inst.key && drawer.inst.key(e)) return true;
      return def.key ? def.key(e) : false;
    },
    close() { if (drawer && drawer.inst.close) drawer.inst.close(); if (P3D.mons && P3D.mons.close) P3D.mons.close(); unmount(); },
  };
}
function unmount() {
  if (!P3D.active) return;
  // la caméra sert aussi à la vue en marchant : elle retrouve son cadrage normal
  if (CAM) { CAM.clearViewOffset(); CAM.near = 0.1; CAM.updateProjectionMatrix(); }
  if (P3D.def && P3D.def.hover) P3D.def.hover(null);
  if (P3D.def && P3D.def.leave) P3D.def.leave();
  P3D.active = false; P3D.ui = null; P3D.hits = []; P3D.tags = []; P3D.panel = null; P3D.drawer = null; P3D.mons = null;
}
const later = (fn) => setTimeout(fn, 30);

// ---------------- les zones cliquables ----------------
function buildHits() {
  const ui = P3D.ui, def = P3D.def; if (!ui) return;
  P3D.sig = def.controlsSig ? def.controlsSig() : '';
  if (P3D.hot) { def.hover(null); P3D.hot = null; ui.tip.hidden = true; }
  ui.hitsBox.replaceChildren();
  P3D.hits = def.controls().map((c) => {
    const range = c.slider || c.knob;
    const tag = range ? 'div' : 'button';
    const h = el(tag, { class: 'p3d-hit ' + (c.cls || '') + (c.knob ? ' p3d-knob' : '') + (c.slider ? ' p3d-slide' : ''), id: c.id || null, 'aria-label': c.aria || null, ...(range ? { role: 'slider', tabindex: 0, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-orientation': 'vertical' } : { type: 'button' }) },
      c.inner ? el('span', { class: 'p3d-inner ' + c.inner }) : null, el('span', { class: 'p3d-sr' }, c.text || val(c.name)));
    const H = { c, h, rect: null, off: false, on: false };
    h.addEventListener('pointerenter', () => hover(H, true)); h.addEventListener('pointerleave', () => hover(H, false));
    h.addEventListener('focus', () => hover(H, true)); h.addEventListener('blur', () => hover(H, false));
    if (range) dragOf(H);
    else if (c.hold) holdOf(H);
    else h.addEventListener('click', () => { if (c.panel) { openPanel(c.panel); return; } c.act(); later(() => refreshTip()); });
    ui.hitsBox.append(h);
    return H;
  });
}

// ---------------- vues et caméra : orbite autour d'une cible (comme la caméra du Cours) ----------------
// orb : cible t (monde), distance r, angles theta (autour de la verticale) et phi (depuis la verticale), ouverture ;
// theta0 : l'angle de la vue d'origine (on ne tourne pas derrière le pupitre, dans le mur d'écrans)
function orbOf(v) {
  SPH.setFromVector3(V.copy(v.eye).sub(v.look));
  return { id: v.id, t: v.look.clone(), r: SPH.radius, theta: SPH.theta, phi: SPH.phi, fov: v.fov, theta0: SPH.theta };
}
export function goView(id) {
  if (!P3D.active) return;
  const to = orbOf(viewOf(id));
  P3D.fly = { from: { ...P3D.orb, t: P3D.orb.t.clone() }, to, t0: null };
  P3D.view = to.id;
}
const PHI = [0.1, 1.45];
function orbitInput(stage) {
  const ptrs = new Map(); let pinch = null;
  const pan = (dx, dy) => {
    // déplacement de la cible dans le plan de l'écran, proportionnel à la distance
    if (!CAM) return; const O = P3D.orb; const k = O.r * 0.0016;
    const right = new THREE.Vector3().setFromMatrixColumn(CAM.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(CAM.matrixWorld, 1);
    O.t.addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
    clampTarget();
  };
  stage.addEventListener('contextmenu', (e) => e.preventDefault());
  stage.addEventListener('pointerdown', (e) => {
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey });
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* sans capture */ }
    P3D.fly = null;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), r: P3D.orb.r }; }
  });
  stage.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 2 && pinch) { const [a, b] = [...ptrs.values()]; P3D.orb.r = clampR(pinch.r * pinch.d / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y))); return; }
    if (p.pan) { pan(dx, dy); return; }
    const O = P3D.orb, span = P3D.def.thetaSpan ?? 1.25;
    O.theta = O.theta0 + clamp(wrapAngle(O.theta - dx * 0.006 - O.theta0), -span, span);
    O.phi = clamp(O.phi - dy * 0.006, PHI[0], P3D.def.phiMax ?? PHI[1]);
  });
  const end = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
  stage.addEventListener('wheel', (e) => { e.preventDefault(); P3D.fly = null; P3D.orb.r = clampR(P3D.orb.r * Math.exp(e.deltaY * 0.0012)); }, { passive: false });
  stage.addEventListener('dblclick', () => goView(P3D.view));
}
const clampR = (r) => clamp(r, P3D.def.rMin ?? 0.2, P3D.def.rMax ?? 1.8);
// la cible reste près du pupitre (repère du pupitre : ±1,6 m de côté, du bureau au haut des écrans)
function clampTarget() {
  const R = P3D.def.root(); R.updateMatrixWorld(true);
  const loc = R.worldToLocal(P3D.orb.t.clone());
  loc.set(clamp(loc.x, -1.6, 1.6), clamp(loc.y, -0.1, 1.4), clamp(loc.z, -1.0, 0.8));
  P3D.orb.t.copy(R.localToWorld(loc));
}
// l'œil reste dans le car : s'il sort de la boîte permise (repère du pupitre), il se rapproche de la cible
// les vues sont réglées pour une zone 3D au format 16/10 ; plus étroite (le panneau de droite), l'œil recule d'autant
// (jusqu'à 1,5 fois) pour garder le même cadrage en largeur
let NARROW = 1;
function eyeOf(O, out) {
  const R = P3D.def.root(), B = P3D.def.eyeBox || { x: [-2.5, 2.5], y: [0.12, 1.6], z: [-0.9, 1.3] };
  let r = O.r * NARROW;
  for (let k = 0; k < 12; k++) {
    out.setFromSpherical(SPH.set(r, O.phi, O.theta)).add(O.t);
    const l = R.worldToLocal(V.copy(out));
    if (l.x >= B.x[0] && l.x <= B.x[1] && l.y >= B.y[0] && l.y <= B.y[1] && l.z >= B.z[0] && l.z <= B.z[1]) break;
    r *= 0.85;
  }
  return out;
}
function camStep(cam, W, H, sideW) {
  if (P3D.fly) {
    // temps réel (le pas de la simulation est borné : sur une machine lente, le vol traînerait)
    const F = P3D.fly; const now = performance.now(); F.t0 ??= now; const k = Math.min(1, (now - F.t0) / 750); const e = ease(k);
    const a = F.from, b = F.to;
    P3D.orb = { id: b.id, t: a.t.clone().lerp(b.t, e), r: Math.exp(lerp(Math.log(a.r), Math.log(b.r), e)), theta: a.theta + wrapAngle(b.theta - a.theta) * e, phi: lerp(a.phi, b.phi, e), fov: lerp(a.fov, b.fov, e), theta0: b.theta0 };
    if (k >= 1) { P3D.orb = { ...b, t: b.t.clone() }; P3D.fly = null; }
  }
  const O = P3D.orb;
  NARROW = clamp(1.6 / Math.max(0.3, (W - sideW) / Math.max(1, H)), 1, 1.5);
  eyeOf(O, cam.position);
  cam.up.copy(UP); cam.lookAt(O.t);
  // la scène se centre dans la partie libre de l'écran, à gauche du panneau : décalage du centre optique
  const fov = O.fov, s = Math.round(sideW / 2), v = cam.view;
  if (Math.abs(cam.fov - fov) > 0.01 || cam.near !== 0.02 || !v || !v.enabled || v.offsetX !== s || v.fullWidth !== W || v.fullHeight !== H) {
    cam.fov = fov; cam.near = 0.02;
    cam.setViewOffset(W, H, s, 0, W, H);
  }
  cam.updateMatrixWorld();
}

/** rendu de la vue du poste (boucle principale, à la place de l'écran vide des postes 2D) */
export function renderPoste3D(renderer, cam, dt) {
  if (!P3D.active || !P3D.def) return;
  CAM = cam;
  const cv = renderer.domElement, side = P3D.ui ? P3D.ui.side.getBoundingClientRect() : null;
  // colonne à droite (grand écran) : on décale ; en bas (petit écran) : rien
  camStep(cam, cv.clientWidth, cv.clientHeight, side && side.top < 120 && side.width < cv.clientWidth * 0.6 ? side.width + 12 : 0);
  P3D.def.update(dt);
  // les étiquettes flottantes des postes du car n'ont rien à faire dans la vue de l'opérateur
  for (const s of T.stations) if (s.sprite.visible) s.sprite.visible = false;
  renderer.setClearColor(0x000000, 1);
  renderEye(renderer, T.scene, cam, RENDER.pbr ? 1.2 : 1.0, true);
  place(cam, renderer.domElement);
}

// ---------------- zones cliquables et étiquettes : projetées sur l'écran à chaque image ----------------
function place(cam, canvas) {
  const ui = P3D.ui; if (!ui) return;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  const deck = P3D.def.deck();
  deck.updateMatrixWorld(true);
  const side = ui.side.getBoundingClientRect();
  const dr = P3D.drawer && P3D.drawer.open ? P3D.drawer.box.getBoundingClientRect() : null;
  for (const Hh of P3D.hits) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, behind = false;
    const f = frameOf(Hh.c, deck);
    const pts = Hh.pts || (Hh.pts = []);
    Hh.c.corners().forEach((p, k) => {
      toWorld(f, p, W3).project(cam);
      if (W3.z > 1) behind = true;
      const x = (W3.x + 1) / 2 * W, y = (1 - W3.y) / 2 * H;
      pts[k] = [x, y];
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    });
    // masquée derrière la colonne de droite ou le tiroir ouvert, hors de l'écran ou derrière l'œil
    const under = (b) => b && b.width > 0 && x0 >= b.left - 2 && x1 <= b.right + 2 && y0 >= b.top - 2 && y1 <= b.bottom + 2;
    const hide = behind || x1 < 0 || y1 < 0 || x0 > W || y0 > H || (x0 > side.left - 2 && side.width > 0 && y0 < side.bottom) || under(dr);
    const r = hide ? null : [x0, y0, x1 - x0, y1 - y0];
    const st = Hh.h.style;
    if (!r) { if (!Hh.hidden) { st.display = 'none'; Hh.hidden = true; } Hh.rect = null; continue; }
    if (Hh.hidden) { st.display = ''; Hh.hidden = false; }
    const k = r.map((v) => Math.round(v * 2) / 2).join(',');
    if (k !== Hh.k) {
      Hh.k = k; st.left = r[0] + 'px'; st.top = r[1] + 'px'; st.width = Math.max(6, r[2]) + 'px'; st.height = Math.max(6, r[3]) + 'px';
      // vue en biais : la zone prend la forme exacte de la commande projetée (le découpage vaut aussi pour le pointeur),
      // pour que deux commandes voisines ne se recouvrent pas ; une zone minuscule reste rectangulaire
      st.clipPath = r[2] > 10 && r[3] > 10 ? `polygon(${pts.map(([x, y]) => `${Math.round(x - r[0])}px ${Math.round(y - r[1])}px`).join(', ')})` : '';
    }
    Hh.rect = r;
  }
  const showTags = P3D.view === 'poste' && !P3D.fly;
  ui.tagsBox.hidden = !showTags;
  if (showTags) {
    for (const t of P3D.tags) {
      const f = frameOf(t.z, P3D.def.root()); f.updateMatrixWorld(true);
      toWorld(f, val(t.z.at), W3).project(cam);
      const x = (W3.x + 1) / 2 * W, y = (1 - W3.y) / 2 * H;
      const out = W3.z > 1 || x < 0 || x > W || y < 0 || y > H || (x > side.left - 8 && y < side.bottom) || (dr && x > dr.left && x < dr.right && y > dr.top);
      t.b.hidden = !!out;
      if (!out) { t.b.style.left = Math.round(x) + 'px'; t.b.style.top = Math.round(y) + 'px'; }
    }
  }
  if (P3D.hot) placeTip();
}

// ---------------- survol : la commande s'éclaire, la bulle explique ----------------
function hover(H, on) {
  if (on) { P3D.hot = H; P3D.def.hover(H.c); refreshTip(); }
  else if (P3D.hot === H) { P3D.hot = null; P3D.def.hover(null); if (P3D.ui) P3D.ui.tip.hidden = true; }
}
function refreshTip() {
  const ui = P3D.ui, H = P3D.hot; if (!ui || !H) return;
  const info = val(H.c.info);
  const name = val(H.c.name);
  const sig = name + '|' + info;
  if (ui.tip.dataset.sig !== sig) { ui.tip.dataset.sig = sig; ui.tip.replaceChildren(el('b', {}, name), el('span', {}, info)); }
  ui.tip.hidden = false; placeTip();
}
function placeTip() {
  const ui = P3D.ui, H = P3D.hot; if (!ui || !H || !H.rect) { if (ui) ui.tip.hidden = true; return; }
  const [x, y, w, h] = H.rect; const tw = ui.tip.offsetWidth || 280, th = ui.tip.offsetHeight || 80;
  const side = ui.side.getBoundingClientRect();
  const maxX = (side.width ? side.left : window.innerWidth) - tw - 8;
  const left = clamp(x + w / 2 - tw / 2, 8, Math.max(8, maxX));
  const top = y - th - 12 > 60 ? y - th - 12 : y + h + 12;
  ui.tip.style.left = left + 'px'; ui.tip.style.top = top + 'px';
}

// ---------------- glissières et molettes : souris, doigt, molette de la souris, flèches ----------------
// glissière : on tire le long de la course projetée à l'écran (barre T, fader, joystick) ;
// molette : on glisse vers le haut (monte) ou vers le bas (descend), 160 px pour toute la course
function dragOf(H) {
  const h = H.h, c = H.c; let d = null;
  h.addEventListener('pointerdown', (e) => {
    e.preventDefault(); try { h.setPointerCapture(e.pointerId); } catch (err) { /* sans capture */ }
    if (c.slider) {
      const f = frameOf(c, P3D.def.deck()); const [a, b] = c.along;
      const pa = toWorld(f, a).project(CAM), pb = toWorld(f, b).project(CAM);
      const H2 = window.innerHeight / 2, W2 = window.innerWidth / 2;
      const dx = (pb.x - pa.x) * W2, dy = -(pb.y - pa.y) * H2; const len = Math.hypot(dx, dy) || 1;
      d = { x: e.clientX, y: e.clientY, v: c.value(), ux: dx / len, uy: dy / len, len };
      // course courte à l'écran (joystick) : un minimum de pixels pour garder de la finesse
      d.len = Math.max(d.len, c.minDrag || 0);
    } else d = { x: e.clientX, y: e.clientY, v: c.value(), ux: 0, uy: -1, len: e.shiftKey ? 600 : 160 };
  });
  h.addEventListener('pointermove', (e) => { if (!d) return; const s = ((e.clientX - d.x) * d.ux + (e.clientY - d.y) * d.uy) / d.len; c.set(clamp(d.v + s, 0, 1)); refreshTip(); });
  const end = () => { d = null; };
  h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
  h.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); c.set(clamp(c.value() - Math.sign(e.deltaY) * (c.step || 0.02) * (e.shiftKey ? 0.25 : 1), 0, 1)); refreshTip(); }, { passive: false });
  if (c.reset) h.addEventListener('dblclick', () => { c.reset(); refreshTip(); });
}
// touche maintenue (talkback) : active tant qu'on appuie
function holdOf(H) {
  const h = H.h, c = H.c; let on = false;
  const up = () => { if (on) { on = false; c.hold(false); } };
  h.addEventListener('pointerdown', (e) => { e.preventDefault(); on = true; c.hold(true); });
  h.addEventListener('pointerup', up); h.addEventListener('pointerleave', up); h.addEventListener('pointercancel', up);
  h.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !on) { e.preventDefault(); on = true; c.hold(true); } });
  h.addEventListener('keyup', up);
}

// ---------------- « Tous les réglages » : l'interface 2D complète du poste, dans un tiroir ----------------
function makeDrawer(spec, views, ctx, arg) {
  const dock = el('div', { class: 'p3d-dock' });
  const inner = el('div', { class: 'p3d-drawer-body' });
  const box = el('div', { class: 'p3d-drawer', hidden: true, role: 'region', 'aria-label': spec.label }, el('div', { class: 'p3d-drawer-head' }, el('b', {}, spec.label), el('span', { class: 'note' }, spec.note || ''),
    el('button', { class: 'btn small', type: 'button', 'data-ro-ok': '', onclick: () => D.toggle(false) }, 'Refermer')), dock, inner);
  const btn = el('button', { class: 'btn small p3d-drawer-btn', type: 'button', 'data-ro-ok': '', 'aria-expanded': 'false', title: 'L\'interface 2D complète du poste : ce que le matériel 3D ne porte pas', onclick: () => D.toggle() }, spec.label + ' ▴');
  views.append(btn);
  // le fil « Ce qui se passe » reste dans la colonne : l'interface 2D en reçoit un factice
  const dctx = { dock, explainBox: el('div', { hidden: true }), explain: ctx.explain };
  const D = {
    box, btn, open: false,
    inst: spec.build(inner, arg, dctx) || {},
    toggle(on = !D.open) { D.open = on; box.hidden = !on; btn.setAttribute('aria-expanded', String(on)); btn.classList.toggle('on', on); btn.textContent = spec.label + (on ? ' ▾' : ' ▴'); if (on && D.inst.update) D.inst.update(0); },
  };
  if (!dock.childElementCount) dock.remove();
  return D;
}
/**
 * écrans du panneau et du tiroir : en vue 3D, l'interface passe au-dessus du canevas WebGL, qui dessine pourtant les
 * écrans des postes (drawSlots) ; juste après, on recopie chaque écran dans un canevas posé dans son cadre.
 */
export function mirrorSlots(renderer) {
  if (!P3D.active || !P3D.ui) return;
  const src = renderer.domElement, pr = renderer.getPixelRatio();
  for (const m of /** @type {NodeListOf<HTMLElement>} */ (P3D.ui.body.querySelectorAll('[data-gl]'))) {
    if (m.offsetParent === null) continue;
    const r = m.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue;
    let cv = /** @type {HTMLCanvasElement | null} */ (m.querySelector(':scope > canvas.p3d-mirror'));
    if (!cv) { cv = el('canvas', { class: 'p3d-mirror' }); m.append(cv); }
    const w = Math.round(r.width * pr), h = Math.round(r.height * pr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const g = cv.getContext('2d'); if (g) g.drawImage(src, r.left * pr, r.top * pr, r.width * pr, r.height * pr, 0, 0, w, h);
  }
}
/**
 * le chef de car (ui/tutor_ui.js) : la commande à montrer existe en 3D mais n'est pas à l'écran (hors du cadre de la
 * vue, sous la colonne) → on approche la vue qui la montre (celle de la commande, sinon la vue de détail du poste)
 */
export function revealFor(sel, text) {
  if (!P3D.active || P3D.fly) return false;
  const H = P3D.hits.find((x) => x.h.matches(sel) && (!text || (x.h.textContent || '').includes(text)));
  if (!H || !H.hidden) return false;
  const v = H.c.view || P3D.def.detailView;
  if (!v || v === P3D.view) return false;
  goView(v); return true;
}
/** le chef de car (ui/tutor_ui.js) : l'élément à montrer est-il dans le tiroir refermé ? → le bouton qui l'ouvre */
export function drawerButtonFor(sel, text) {
  const D = P3D.drawer; if (!P3D.active || !D || D.open) return null;
  for (const n of D.box.querySelectorAll(sel)) if (!text || (n.textContent || '').includes(text)) return D.btn;
  return null;
}
export function openDrawer(on = true) { if (P3D.drawer) P3D.drawer.toggle(on); }

// ---------------- la fiche (colonne de droite) ----------------
function setFold(on) {
  const ui = P3D.ui; if (!ui) return;
  ui.folded = on; ui.side.classList.toggle('p3d-folded', on); ui.fold.textContent = on ? '▴' : '▾';
  ui.fold.setAttribute('aria-expanded', String(!on)); ui.fold.title = on ? 'Rouvrir la fiche et le fil' : 'Replier la fiche : toute la hauteur pour les écrans';
}
function setTab(t) {
  const ui = P3D.ui; if (!ui) return;
  if (ui.folded) setFold(false);
  ui.tab = t; ui.fiche.hidden = t !== 'fiche'; ui.feed.hidden = t !== 'fil';
  ui.tabF.classList.toggle('on', t === 'fiche'); ui.tabF.setAttribute('aria-selected', String(t === 'fiche'));
  ui.tabE.classList.toggle('on', t === 'fil'); ui.tabE.setAttribute('aria-selected', String(t === 'fil'));
  if (t === 'fil') ui.tabE.classList.remove('new');
}
function showFiche(z) {
  const ui = P3D.ui; if (!ui) return;
  P3D.sel = z; P3D.panel = null;
  if (z) setTab('fiche');
  const d = z || P3D.def.intro;
  const kids = [el('h3', {}, val(d.title)), rich(val(d.text).join('\n\n'), 'p3d-txt')];
  if (z) kids.push(el('button', { class: 'btn small', type: 'button', 'data-ro-ok': '', onclick: () => { goView('poste'); showFiche(null); } }, 'Revenir au poste'));
  ui.fiche.replaceChildren(...kids);
}
/** ouvre la fiche d'une zone avec ses réglages en 2D (écran tactile, menu…) */
export function openPanel(id) {
  const ui = P3D.ui; if (!ui) return;
  const z = P3D.def.zones.find((x) => x.id === id);
  showFiche(z || null);
  const p = P3D.def.panels && P3D.def.panels[id] ? P3D.def.panels[id]() : null;
  if (p) { ui.fiche.insertBefore(p.box, ui.fiche.lastChild); P3D.panel = p; }
  if (z && P3D.view !== z.view) goView(z.view);
}

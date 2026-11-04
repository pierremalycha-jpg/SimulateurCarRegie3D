// @ts-check
import * as THREE from 'three';
import { el, clamp } from '../../util.js';
import { S } from '../../state.js';
import { icon } from '../../ui/icons.js';
import { jetons } from '../kit.js';
import { AZIMUTS, directionIso, baseIso, cadrer, expositionPlateau } from './calc.js';
import { ImageCamera } from './dof.js';
import { anneau, COUCHE_REPERES, CIEL } from './pieces.js';

// ----------------------------------------------------------------------------------
// Le moteur du plateau 3D du Labo (v19.30) : un seul rendu WebGL, partagé par les ateliers qui ont un
// plateau (Optique, Photométrie), monté dans l'atelier affiché. Une vue isométrique (caméra orthographique,
// élévation fixe, azimut par quarts de tour animés) qu'on fait glisser, zoomer à la molette ou au pincement,
// recentrer (bouton, double clic) ; des objets qu'on prend et qu'on pose au sol (le pointeur est projeté sur
// le plan du sol : l'objet suit sans sauter, et l'atelier écrit la position dans son état, d'où tout se
// recalcule) ; un anneau sous l'objet survolé ; des étiquettes HTML accrochées aux objets ; l'image de la
// caméra (dof.js) composée dans un cadre du coin, agrandissable. Le rendu ne se fait qu'à la demande (un
// réglage, un geste, une animation) : rien ne tourne quand rien ne bouge. Un atelier donne un adaptateur
// (sa scène, ses objets à prendre, ses étiquettes, ce qu'il faut cadrer, son image de caméra, son exposition).
// ----------------------------------------------------------------------------------
/**
 * @typedef {object} Glisser ce que porte un objet qu'on peut prendre (userData.glisser)
 * @property {string} nom
 * @property {string[]} cles les chemins de l'état qu'il déplace (verrouillés par un défi : il ne bouge pas)
 * @property {() => void} [debut] pris (l'atelier note ce qu'il faut garder en place)
 * @property {(x: number, z: number) => void} bouger pose l'objet au sol en (x, z)
 * @property {() => void} [fin] lâché
 */
/**
 * @typedef {object} Etiquette
 * @property {HTMLElement} el
 * @property {THREE.Object3D | number[]} cible
 * @property {number[]} dec décalage (m)
 * @property {boolean} on
 */
/**
 * @typedef {object} Adaptateur ce qu'un atelier donne au plateau
 * @property {THREE.Scene} scene
 * @property {THREE.Object3D[]} glissables les objets qu'on peut prendre (eux ou un parent portent userData.glisser)
 * @property {Etiquette[]} etiquettes
 * @property {() => number[][]} cadre les points à tenir dans la vue
 * @property {() => (import('./dof.js').ImageSpec | null)} image l'image de la caméra, ou null
 * @property {(cles: string[]) => boolean} verrou l'un de ces chemins est imposé par le défi en cours
 * @property {() => number} [exposition] l'exposition du plateau vu de haut
 * @property {(t: string) => void} [dire] une annonce (lecteurs d'écran)
 * @property {HTMLElement[]} [outils] des touches de plus dans la barre d'outils du plateau
 * @property {HTMLElement} [panneau] un panneau posé sur le plateau (la visite des notions)
 * @property {{ az: number, azCible: number, cible: THREE.Vector3, demi: number, cadre: boolean, vol: any }} [vue] la vue gardée (posée par le moteur)
 */
const CLE_TAGS = 'carregie.lbtags';
const CLE_AIDE = 'carregie.lbaide';
const PLAN = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const num = (hex) => parseInt(String(hex).replace('#', ''), 16) || 0x3b9cff;

/** une étiquette à accrocher à un objet (ou à un point) de la scène */
export function etiquette(cible, texte = '', cls = '', dec = [0, 0, 0]) {
  const e = el('span', { class: 'lb-tag' + (cls ? ' ' + cls : '') }, texte);
  const L = /** @type {Etiquette & { set: (t: string, cls?: string) => void }} */ ({ el: e, cible, dec, on: true, set(t, c) { e.textContent = t; if (c != null) e.className = 'lb-tag' + (c ? ' ' + c : ''); } });
  return L;
}
/** un texte d'étiquette en deux parties : le nom, puis la valeur en plus discret */
export function etiquetteNom(cible, nom, cls = '', dec = [0, 0, 0]) {
  const L = etiquette(cible, '', cls, dec);
  const b = el('b', {}, nom), s = el('small', {});
  L.el.replaceChildren(b, s);
  L.set = (t, c) => { s.textContent = t; if (c != null) L.el.className = 'lb-tag' + (c ? ' ' + c : ''); };
  return L;
}

/** @type {any} */ let P = null;
/** le moteur, construit à la première demande */
export function plateau() { return P || (P = creer()); }
function creer() {
  const T = jetons();
  const canvas = /** @type {HTMLCanvasElement} */ (el('canvas', { class: 'lb-gl', tabindex: '-1', role: 'img', 'aria-label': 'Le plateau en 3D : glisser un objet pour le déplacer, le fond pour déplacer la vue, molette pour zoomer' }));
  /** @type {THREE.WebGLRenderer | null} */ let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !S.lite, alpha: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, S.quality === 'haute' ? 2 : S.lite || S.quality === 'basse' ? 1 : 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = S.quality !== 'basse' && !S.lite; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  } catch (e) { renderer = null; }
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400); cam.name = 'vue isométrique'; cam.layers.enable(COUCHE_REPERES);
  const image = renderer ? new ImageCamera(renderer) : null;
  const ring = anneau(num(T.accent));
  const tags = el('div', { class: 'lb-tags', 'aria-hidden': 'true' });
  const btn = (label, title, onclick, cls = '') => el('button', { type: 'button', class: 'btn small ' + cls, title, onclick }, label);
  const bFit = btn('Recentrer', 'Cadrer la caméra et les objets (double clic dans la vue)', () => cadrerVue());
  const bG = btn(icon('retourapp'), 'Tourner la vue d\'un quart de tour vers la gauche', () => tourner(-1), 'lb-ico'); bG.setAttribute('aria-label', 'Tourner à gauche');
  const bD = btn(icon('suivant'), 'Tourner la vue d\'un quart de tour vers la droite', () => tourner(1), 'lb-ico'); bD.setAttribute('aria-label', 'Tourner à droite');
  const bTags = btn('Étiquettes', 'Afficher ou masquer les étiquettes des objets', () => poserTags(!E.tagsOn));
  const outils = el('div', { class: 'lb-outils', role: 'toolbar', 'aria-label': 'La vue' }, bFit, bG, bD, bTags);
  const aide = el('p', { class: 'lb-aide3d' }, 'Glissez un objet pour le déplacer · le fond pour déplacer la vue · molette pour zoomer');
  const cap = el('span', { class: 'lb-pip-cap' });
  const bGrand = btn('Agrandir', 'Agrandir l\'image de la caméra', () => agrandir(!E.grand), 'lb-pip-btn');
  /** agrandit (ou réduit) l'image de la caméra dans son coin */
  function agrandir(on) { E.grand = !!on; pip.classList.toggle('grand', E.grand); if (E.host) E.host.classList.toggle('lb-grand', E.grand); bGrand.textContent = E.grand ? 'Réduire' : 'Agrandir'; demander(); }
  const pip = el('div', { class: 'lb-pip', role: 'img', 'aria-label': 'L\'image de la caméra' }, el('span', { class: 'lb-pip-t' }, 'Image de la caméra'), cap, bGrand);
  const nogl = el('p', { class: 'lb-nogl' }, 'La 3D n\'est pas disponible ici (pas de WebGL) : les réglages et les mesures restent utilisables.');

  const E = {
    ok: !!renderer, renderer, canvas, cam, image, ring, tags, pip, cap, outils, aide, nogl,
    /** @type {HTMLElement | null} */ host: null, /** @type {Adaptateur | null} */ A: null,
    tagsOn: true, grand: false, raf: 0, last: 0, t: 0, drag: null, pan: null, pinch: null, ptrs: new Map(), hoverT: 0, hot: null, bouge: 0, lastTap: 0,
    /** @type {Map<string, (dt: number, t: number) => void>} */ anims: new Map(), extras: /** @type {HTMLElement[]} */ ([]),
    images: 0, sauts: 0, garde: 0,
    ray: new THREE.Raycaster(), v2: new THREE.Vector2(), pt: new THREE.Vector3(), v3: new THREE.Vector3(), v3b: new THREE.Vector3(),
  };
  try { if (localStorage.getItem(CLE_TAGS) === '0') E.tagsOn = false; if (localStorage.getItem(CLE_AIDE) === '1') aide.classList.add('vu'); } catch (e) { /* stockage indisponible */ }
  E.ray.layers.set(0);
  poserTags(E.tagsOn);

  // ---------------- monter dans un atelier ----------------
  /** monte le plateau dans l'élément host, avec l'adaptateur de l'atelier */
  function monter(host, /** @type {Adaptateur} */ A) {
    if (E.host !== host) {
      E.host = host;
      host.replaceChildren(...(E.ok ? [canvas, tags, outils, aide, pip] : [nogl])); host.classList.toggle('lb-grand', E.grand);
      host.style.background = CIEL;
      if (ro) { ro.disconnect(); ro.observe(host); }
    }
    if (!E.ok || !A) return;
    if (E.A !== A) {
      if (E.A) { E.A.scene.remove(ring); for (const L of E.A.etiquettes) L.el.remove(); }
      for (const x of E.extras) x.remove(); E.extras = [];
      E.A = A; E.hot = null; E.drag = null; E.pan = null; ring.visible = false; E.anims.clear();
      A.scene.add(ring);
      for (const L of A.etiquettes) tags.append(L.el);
      for (const b of A.outils || []) { outils.append(b); E.extras.push(b); }
      if (A.panneau) { host.append(A.panneau); E.extras.push(A.panneau); }
      if (!A.vue) A.vue = { az: AZIMUTS[0], azCible: AZIMUTS[0], cible: new THREE.Vector3(), demi: 6, cadre: false, vol: null };
    }
    // des étiquettes ajoutées après coup
    for (const L of A.etiquettes) if (!L.el.isConnected) tags.append(L.el);
    if (!A.vue.cadre) { A.vue.cadre = true; cadrerVue(true); }
    demander();
  }
  // au redimensionnement, les étiquettes se cachent jusqu'à l'image suivante (leurs places ne valent plus)
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (E.A) for (const L of E.A.etiquettes) L.el.hidden = true; demander(); }) : null;
  /**
   * demande une image ; si le navigateur ne la donne pas dans le tiers de seconde (une page qu'il croit au repos, un rendu
   * logiciel sans écran), on la dessine quand même : une animation avance toujours
   */
  function demander() {
    if (E.raf || !E.ok) return;
    E.raf = requestAnimationFrame(rendu);
    clearTimeout(E.garde); E.garde = setTimeout(() => { if (E.raf) { cancelAnimationFrame(E.raf); rendu(performance.now()); } }, 350);
  }
  function poserTags(on) {
    E.tagsOn = on; tags.hidden = !on; bTags.setAttribute('aria-pressed', String(on)); bTags.classList.toggle('on', on);
    try { localStorage.setItem(CLE_TAGS, on ? '1' : '0'); } catch (e) { /* stockage indisponible */ }
    demander();
  }
  function tourner(sens) { const V = E.A && E.A.vue; if (!V) return; V.azCible += 90 * sens; demander(); }
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  /** vole en douceur vers une vue : cible [x, y, z] (m), demi-hauteur du cadre (m), azimut (degrés) ; chaque champ est facultatif */
  function voler(v, dur = 1.1) {
    const V = E.A && E.A.vue; if (!V) return;
    V.vol = { de: { c: V.cible.clone(), d: V.demi }, a: { c: v.cible ? new THREE.Vector3(v.cible[0], v.cible[1], v.cible[2]) : V.cible.clone(), d: clamp(v.demi ?? V.demi, 1.2, 40) }, k: 0, dur };
    if (v.az != null) { let az = v.az; while (az - V.azCible > 180) az -= 360; while (az - V.azCible < -180) az += 360; V.azCible = az; }
    demander();
  }
  /** fait tourner une animation (appelée à chaque image tant qu'elle est là) */
  function animer(id, fn) { E.anims.set(id, fn); demander(); }
  function arreter(id) { E.anims.delete(id); }
  /** cadre la caméra et les objets de l'atelier */
  function cadrerVue(tout = false) {
    const A = E.A; if (!A || !A.vue) return;
    const w = canvas.clientWidth || 800, h = canvas.clientHeight || 500;
    const { cible, demi } = cadrer(A.cadre(), A.vue.azCible, w / h, 1.22, 3);
    // le cadre laisse le coin de l'image de la caméra libre : la scène glisse un peu vers le haut et la gauche
    const B = baseIso(A.vue.azCible), d2 = demi * 1.06, dx = d2 * (w / h) * 0.1, dy = d2 * 0.1;
    A.vue.cible.set(cible[0] + B.droite[0] * dx - B.haut[0] * dy, cible[1] + B.droite[1] * dx - B.haut[1] * dy, cible[2] + B.droite[2] * dx - B.haut[2] * dy);
    A.vue.demi = d2; A.vue.vol = null; if (tout) A.vue.az = A.vue.azCible;
    demander();
  }

  // ---------------- la caméra orthographique ----------------
  function poserCam() {
    const V = E.A.vue, w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    const d = directionIso(V.az);
    cam.position.set(V.cible.x + d[0] * 150, V.cible.y + d[1] * 150, V.cible.z + d[2] * 150); cam.up.set(0, 1, 0); cam.lookAt(V.cible);
    const asp = w / h; cam.left = -V.demi * asp; cam.right = V.demi * asp; cam.top = V.demi; cam.bottom = -V.demi; cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }
  /** le point du sol sous un pointeur (coordonnées client), ou null */
  function auSol(cx, cy) {
    const r = canvas.getBoundingClientRect();
    E.v2.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    E.ray.setFromCamera(E.v2, cam);
    return E.ray.ray.intersectPlane(PLAN, E.pt) ? E.pt : null;
  }
  /** l'objet à prendre sous un pointeur : { obj, g } ou null */
  function sousPointeur(cx, cy) {
    const A = E.A; if (!A) return null;
    const r = canvas.getBoundingClientRect();
    E.v2.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    E.ray.setFromCamera(E.v2, cam);
    const hits = E.ray.intersectObjects(A.glissables, true);
    for (const h of hits) {
      let vis = true; for (let o = h.object; o; o = o.parent) if (!o.visible) { vis = false; break; }
      if (!vis) continue;
      for (let o = h.object; o; o = o.parent) if (o.userData.glisser) return { obj: o, g: /** @type {Glisser} */ (o.userData.glisser) };
    }
    return null;
  }

  // ---------------- les gestes ----------------
  canvas.addEventListener('pointerdown', (e) => {
    if (!E.A) return;
    canvas.setPointerCapture(e.pointerId); E.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    E.bouge = 0;
    if (E.ptrs.size === 2) { const [a, b] = [...E.ptrs.values()]; E.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), demi: E.A.vue.demi, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; E.drag = null; E.pan = null; return; }
    E.A.vue.vol = null;
    poserCam();
    const hit = e.button === 0 ? sousPointeur(e.clientX, e.clientY) : null;
    if (hit) {
      if (E.A.verrou(hit.g.cles)) { if (E.A.dire) E.A.dire(`${hit.g.nom} : imposé par le défi.`); E.drag = null; E.pan = null; return; }
      const p = auSol(e.clientX, e.clientY); if (!p) return;
      E.drag = { g: hit.g, obj: hit.obj, ox: p.x - hit.obj.position.x, oz: p.z - hit.obj.position.z };
      if (hit.g.debut) hit.g.debut();
      E.hot = hit.obj; canvas.style.cursor = 'grabbing'; demander();
      return;
    }
    E.pan = { x: e.clientX, y: e.clientY };
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (e) => {
    const A = E.A; if (!A) return;
    const p = E.ptrs.get(e.pointerId);
    if (!p) { survol(e); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; E.bouge += Math.abs(dx) + Math.abs(dy);
    if (E.ptrs.size === 2 && E.pinch) {
      const [a, b] = [...E.ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      A.vue.demi = clamp(E.pinch.demi * E.pinch.d / Math.max(20, d), 1.2, 40);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; deplacerVue(mx - E.pinch.mx, my - E.pinch.my); E.pinch.mx = mx; E.pinch.my = my;
      demander(); return;
    }
    if (E.drag) {
      poserCam(); const s = auSol(e.clientX, e.clientY); if (!s) return;
      E.drag.g.bouger(s.x - E.drag.ox, s.z - E.drag.oz);
      demander(); return;
    }
    if (E.pan) { deplacerVue(dx, dy); demander(); }
  });
  const fin = (e) => {
    const p = E.ptrs.get(e.pointerId); E.ptrs.delete(e.pointerId); if (E.ptrs.size < 2) E.pinch = null;
    if (E.drag) {
      if (E.drag.g.fin) E.drag.g.fin(); E.drag = null;
      // l'aide a servi : elle se range
      if (E.bouge >= 6 && !aide.classList.contains('vu')) { aide.classList.add('vu'); try { localStorage.setItem(CLE_AIDE, '1'); } catch (e2) { /* stockage indisponible */ } }
    }
    E.pan = null; canvas.style.cursor = '';
    if (p && E.bouge < 6 && e.type === 'pointerup') { const now = performance.now(); if (now - E.lastTap < 320) { E.lastTap = 0; cadrerVue(); } else E.lastTap = now; }
    survol(e);
  };
  canvas.addEventListener('pointerup', fin); canvas.addEventListener('pointercancel', fin);
  canvas.addEventListener('pointerleave', () => { if (!E.drag && E.hot) { E.hot = null; ring.visible = false; demander(); } });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => {
    const A = E.A; if (!A) return; e.preventDefault(); A.vue.vol = null;
    poserCam(); const p0 = auSol(e.clientX, e.clientY); const a = p0 ? [p0.x, p0.z] : null;
    A.vue.demi = clamp(A.vue.demi * Math.exp(e.deltaY * 0.0012), 1.2, 40);
    poserCam(); const p1 = auSol(e.clientX, e.clientY);
    if (a && p1) { A.vue.cible.x += a[0] - p1.x; A.vue.cible.z += a[1] - p1.z; }
    demander();
  }, { passive: false });
  /** déplace la vue de (dx, dy) pixels d'écran */
  function deplacerVue(dx, dy) {
    const V = E.A.vue, h = canvas.clientHeight || 1, k = 2 * V.demi / h;
    const B = baseIso(V.az);
    V.cible.x += -dx * k * B.droite[0] + dy * k * B.haut[0]; V.cible.y += dy * k * B.haut[1]; V.cible.z += -dx * k * B.droite[2] + dy * k * B.haut[2];
  }
  function survol(e) {
    const now = performance.now(); if (now - E.hoverT < 40 || E.drag || E.pan) return; E.hoverT = now;
    poserCam();
    const hit = sousPointeur(e.clientX, e.clientY);
    const obj = hit ? hit.obj : null;
    canvas.style.cursor = hit ? (E.A.verrou(hit.g.cles) ? 'not-allowed' : 'grab') : '';
    if (obj !== E.hot) { E.hot = obj; demander(); }
  }

  // ---------------- le rendu ----------------
  function rendu(now) {
    E.raf = 0; clearTimeout(E.garde); E.garde = 0; E.images++;
    const A = E.A, R = renderer, host = E.host;
    if (!R || !A || !host || !host.isConnected || host.offsetParent === null) { E.sauts++; return; }
    const dt = Math.min(0.1, Math.max(0.001, (now - (E.last || now)) / 1000)); E.last = now;
    const w = canvas.clientWidth || host.clientWidth || 640, h = canvas.clientHeight || host.clientHeight || 400;
    if (canvas.width !== Math.round(w * R.getPixelRatio()) || canvas.height !== Math.round(h * R.getPixelRatio())) R.setSize(w, h, false);
    const V = A.vue; E.t += dt;
    if (V.az !== V.azCible) { V.az += (V.azCible - V.az) * (1 - Math.exp(-dt * 9)); if (Math.abs(V.azCible - V.az) < 0.03) V.az = V.azCible; else demander(); }
    if (V.vol) { const F = V.vol; F.k = Math.min(1, F.k + dt / F.dur); const e = ease(F.k); V.cible.lerpVectors(F.de.c, F.a.c, e); V.demi = Math.exp(Math.log(F.de.d) + (Math.log(F.a.d) - Math.log(F.de.d)) * e); if (F.k >= 1) V.vol = null; else demander(); }
    for (const fn of E.anims.values()) { try { fn(dt, E.t); } catch (err) { console.error(err); E.anims.clear(); } }
    if (E.anims.size) demander();
    poserCam();
    // l'anneau sous l'objet pris ou survolé
    if (E.hot) { ring.visible = true; E.hot.getWorldPosition(E.v3); ring.position.set(E.v3.x, 0.018, E.v3.z); } else ring.visible = false;
    // l'image de la caméra, d'abord (elle lit la scène sans les repères)
    const im = A.image ? A.image() : null;
    let cadre = null;
    pip.hidden = !im;
    if (im && image) {
      const r = pip.getBoundingClientRect(), c = canvas.getBoundingClientRect(), pr = R.getPixelRatio();
      const maxW = S.lite ? 420 : S.quality === 'haute' ? 1100 : 820;
      const rw = Math.min(maxW, r.width * pr), rh = rw * (r.height / Math.max(1, r.width));
      image.rendre(A.scene, im, rw, rh);
      cadre = { x: r.left - c.left, y: c.bottom - r.bottom, w: r.width, h: r.height, r: 14 * (rw / Math.max(1, r.width)) };
      cap.textContent = im.legende || '';
    }
    // le plateau, vu de haut
    R.setRenderTarget(null); R.setViewport(0, 0, w, h); R.setScissorTest(false);
    R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = A.exposition ? A.exposition() : expositionPlateau(0);
    R.autoClear = true; R.render(A.scene, cam);
    if (cadre && image) { image.composer(cadre.x, cadre.y, cadre.w, cadre.h, cadre.r); R.setViewport(0, 0, w, h); }
    // les étiquettes (pas sous l'image de la caméra) ; une étiquette ajoutée depuis la dernière image entre dans la page
    if (E.tagsOn) for (const L of A.etiquettes) {
      if (!L.el.isConnected) tags.append(L.el);
      let vis = L.on;
      if (vis) {
        const t = /** @type {any} */ (L.cible);
        if (t.isObject3D) { for (let o = t; o; o = o.parent) if (!o.visible) { vis = false; break; } t.getWorldPosition(E.v3); } else E.v3.set(t[0], t[1], t[2]);
        E.v3.x += L.dec[0]; E.v3.y += L.dec[1]; E.v3.z += L.dec[2];
        E.v3b.copy(E.v3).project(cam);
        vis = vis && Math.abs(E.v3b.x) < 1.05 && Math.abs(E.v3b.y) < 1.05;
        let sx = (E.v3b.x + 1) / 2 * w; const sy = (1 - E.v3b.y) / 2 * h;
        if (vis && cadre && sx > cadre.x && sx < cadre.x + cadre.w && sy > h - cadre.y - cadre.h - 18 && sy < h - cadre.y) vis = false;
        // une étiquette reste dans le cadre du plateau (elle glisse le long du bord)
        if (vis) { const demi = L.el.offsetWidth / 2 + 6; sx = clamp(sx, demi, w - demi); if (sy < 12 || sy > h + 6) vis = false; }
        if (vis) L.el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
      }
      L.el.hidden = !vis;
    }
  }

  /** la place à l'écran (coordonnées client) d'un objet de la scène, à dy mètres au-dessus de son origine (tests) */
  function ecran(obj, dy = 1.2) {
    poserCam(); obj.getWorldPosition(E.v3); E.v3.y += dy; E.v3b.copy(E.v3).project(cam);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (E.v3b.x + 1) / 2 * r.width, y: r.top + (1 - E.v3b.y) / 2 * r.height };
  }
  return { ok: E.ok, monter, demander, cadrer: cadrerVue, tourner, voler, animer, arreter, agrandir, ecran, canvas, etat: E };
}

// @ts-check
import * as THREE from 'three';
import { el, clamp, lerp } from '../util.js';
import { on } from '../state.js';
import { NOTIONS, CHAPITRES, notionsDu } from '../content/cours/camera/index.js';
import { buildRig, AXIS_H, FOCAL_PLANE } from './model.js';
import { buildStudio } from './scene.js';
import { PASTILLES, notionsAt } from './points.js';
import { renderFiche } from './fiche.js';
import { MIRE_D, ND, defocus, focusDist, zoomFocal, vfov, blurPx, exposureOf } from './optics.js';

// ----------------------------------------------------------------------------------
// Module « La caméra » : un espace à part du stade, ouvert depuis l'écran titre. Une caméra de
// plateau en 3D sur son pied, des pastilles sur ce qu'il faut connaître ; un clic, la vue
// s'approche et la fiche s'ouvre à droite. Vue d'ensemble, vue éclatée, vue en coupe (le trajet
// de la lumière jusqu'aux trois capteurs). Son propre rendu (un second contexte WebGL), construit
// à la première ouverture ; la boucle du simulateur est en pause tant qu'il est ouvert.
// ----------------------------------------------------------------------------------

export const CL = { open: false, built: false };
/** @type {any} */
let R = null;
let titleWasOpen = false, raf = 0;

/** le module est ouvert (les touches et la boucle du simulateur l'ignorent) */
export const camlabOpen = () => CL.open;

/** l'événement « camera » ouvre le module (touche #ti-camera de l'écran titre, data-emit) */
export function initCamLab() {
  on('camera', (o) => openCameraLab(o || {}));
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const quality = () => { try { return localStorage.getItem('carregie.quality') || 'moyenne'; } catch (e) { return 'moyenne'; } };

// ---------------- la vue : orbite autour d'une cible, et vol d'un point à un autre ----------------
function makeOrbit(camera, dom) {
  const O = { target: new THREE.Vector3(), sph: new THREE.Spherical(1.5, 1.2, 0.9), vel: { th: 0, ph: 0 }, fly: null, moved: 0, onTap: null, onHover: null };
  const apply = () => { const p = new THREE.Vector3().setFromSpherical(O.sph).add(O.target); camera.position.copy(p); camera.lookAt(O.target); };
  O.apply = apply;
  /** va regarder la cible depuis la direction dir (vers l'œil), à la distance dist */
  O.flyTo = (target, dir, dist, dur = 0.9) => {
    const from = { t: O.target.clone(), d: new THREE.Vector3().setFromSpherical(O.sph).normalize(), r: O.sph.radius };
    O.fly = { from, to: { t: target.clone(), d: dir.clone().normalize(), r: dist }, k: 0, dur };
  };
  O.update = (dt) => {
    if (O.fly) {
      const F = O.fly; F.k = Math.min(1, F.k + dt / F.dur); const e = ease(F.k);
      O.target.lerpVectors(F.from.t, F.to.t, e);
      const ang = F.from.d.angleTo(F.to.d); let d;
      if (ang < 1e-4) d = F.to.d.clone(); else { const s = Math.sin(ang); d = F.from.d.clone().multiplyScalar(Math.sin((1 - e) * ang) / s).addScaledVector(F.to.d, Math.sin(e * ang) / s); }
      const r = Math.exp(lerp(Math.log(F.from.r), Math.log(F.to.r), e));
      O.sph.setFromVector3(d.multiplyScalar(r));
      if (F.k >= 1) O.fly = null;
    } else if (Math.abs(O.vel.th) + Math.abs(O.vel.ph) > 1e-5) {
      O.sph.theta += O.vel.th; O.sph.phi = clamp(O.sph.phi + O.vel.ph, 0.08, Math.PI - 0.08);
      const k = Math.pow(0.0015, dt); O.vel.th *= k; O.vel.ph *= k;
    }
    O.sph.phi = clamp(O.sph.phi, 0.08, Math.PI - 0.08);
    apply();
  };
  const ptrs = new Map(); let pinch = null;
  dom.addEventListener('pointerdown', (e) => {
    dom.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button, sx: e.clientX, sy: e.clientY });
    O.moved = 0; O.fly = null; O.vel.th = O.vel.ph = 0;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), r: O.sph.radius, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; }
  });
  dom.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) { if (O.onHover) O.onHover(e); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    O.moved += Math.abs(dx) + Math.abs(dy);
    if (ptrs.size === 2 && pinch) {
      const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      O.sph.radius = clamp(pinch.r * pinch.d / Math.max(20, d), 0.16, 7);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; pan(mx - pinch.mx, my - pinch.my); pinch.mx = mx; pinch.my = my;
      return;
    }
    if (p.b === 2 || e.shiftKey) { pan(dx, dy); return; }
    O.vel.th = -dx * 0.0055; O.vel.ph = -dy * 0.0055;
    O.sph.theta += O.vel.th; O.sph.phi = clamp(O.sph.phi + O.vel.ph, 0.08, Math.PI - 0.08);
  });
  const end = (e) => {
    const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
    if (p && O.moved < 6 && e.type === 'pointerup' && O.onTap) O.onTap(e);
  };
  dom.addEventListener('pointerup', end); dom.addEventListener('pointercancel', end);
  dom.addEventListener('contextmenu', (e) => e.preventDefault());
  dom.addEventListener('wheel', (e) => { e.preventDefault(); O.fly = null; O.sph.radius = clamp(O.sph.radius * Math.exp(e.deltaY * 0.0012), 0.16, 7); }, { passive: false });
  function pan(dx, dy) {
    const k = O.sph.radius * 0.0016; const right = new THREE.Vector3(), up = new THREE.Vector3();
    camera.matrixWorld.extractBasis(right, up, new THREE.Vector3());
    O.target.addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
  }
  return O;
}

// ---------------- construction (à la première ouverture) ----------------
async function build() {
  // les sérigraphies sont dessinées avec les polices de l'interface : on les attend (2 s au plus)
  try { await Promise.race([Promise.all(['600 40px "Archivo Narrow"', '700 40px "Archivo Narrow"', '600 16px "B612 Mono"'].map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 2000))]); } catch (e) { /* polices de secours */ }
  const q = quality();
  const root = el('div', { id: 'camlab', class: 'camlab', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'La caméra', hidden: true });
  const canvas = el('canvas', { class: 'cl-gl', 'aria-label': 'Caméra de plateau en 3D : glisser pour tourner autour, molette pour zoomer, clic sur une pastille pour ouvrir sa fiche' });
  const pins = el('div', { class: 'cl-pins' });
  const side = el('aside', { class: 'cl-side', hidden: true, 'aria-label': 'Fiche' });
  const list = el('nav', { class: 'cl-list', hidden: true, 'aria-label': 'Les notions' });
  const btn = (label, title, onclick, cls = '') => el('button', { type: 'button', class: 'btn small ' + cls, title, onclick }, label);
  const bOverview = btn('Vue d\'ensemble', 'Revenir à la caméra entière', () => overview());
  const bExplode = btn('Vue éclatée', 'Écarter les pièces de la caméra', () => setExplode(!R.explodeOn));
  const bCut = btn('Vue en coupe', 'Couper la caméra en deux et suivre la lumière', () => setCut(!R.rig.state.cut));
  const bList = btn('Les notions', 'Toutes les notions, chapitre par chapitre', () => toggleList());
  const bQuit = btn('Quitter', 'Revenir au menu (Échap)', () => closeCameraLab(), 'cl-quit');
  bQuit.append(' ', el('kbd', {}, 'Échap'));
  const bar = el('header', { class: 'cl-bar' },
    el('div', { class: 'cl-id' }, el('span', { class: 'tape y' }, 'La caméra'), el('small', {}, 'Type Sony HXC-FB80 · Fujinon ZA12x4.5BERD')),
    el('div', { class: 'cl-views', role: 'toolbar', 'aria-label': 'Vues' }, bOverview, bExplode, bCut, bList),
    bQuit);
  const hint = el('p', { class: 'cl-hint-bar' }, 'Glisser pour tourner · molette ou pincer pour approcher · clic droit ou Maj pour déplacer · une pastille ouvre sa fiche');
  const loading = el('p', { class: 'cl-loading' }, 'Montage de la caméra…');
  root.append(canvas, pins, bar, list, side, hint, loading);
  document.body.append(root);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'haute' ? 2 : q === 'basse' ? 1 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  // rien ne bouge sur le plateau : les ombres ne sont recalculées que si une pièce bouge
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  renderer.localClippingEnabled = true;
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.02, 60);
  const rig = buildRig();
  const studio = buildStudio(renderer, rig, q);
  const orbit = makeOrbit(camera, canvas);
  R = { root, canvas, pins, side, list, bar, renderer, camera, rig, studio, orbit, explodeOn: false, explodeT: 0, pinEls: new Map(), anchors: new Map(), point: null, fiche: null, notion: null, rr: 0, ray: new THREE.Raycaster(), lens: null, bExplode, bCut };
  rig.set({ zoom: 0.45, focus: 0.1, iris: 5.6, nd: 0 });
  buildPins();
  buildList();
  orbit.onTap = (e) => { const id = pick(e); if (id) openPoint(id); };
  let hoverT = 0;
  orbit.onHover = (e) => { const now = performance.now(); if (now - hoverT < 60) return; hoverT = now; const id = pick(e); canvas.style.cursor = id ? 'pointer' : ''; for (const [pid, b] of R.pinEls) b.classList.toggle('hover', pid === id); };
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', resize);
  resize();
  overview(true);
  loading.remove();
  CL.built = true;
}

// ---------------- pastilles ----------------
function buildPins() {
  const { rig, studio, pins } = R;
  const parentOf = {
    frontale: rig.lens.lens, point: rig.lens.lens, zoom: rig.lens.lens, iris: rig.lens.lens, tirage: rig.lens.lens, macro: rig.lens.lens, doubleur: rig.lens.lens, poignee: rig.lens.servo,
    monture: rig.body.body, filtres: rig.body.panel, commandes: rig.body.panel, menu: rig.body.panel, bloc: rig.internals.P.prism, viseur: rig.vf.vf,
    intercom: rig.body.rear, connectique: rig.body.rear, fibre: rig.body.rear, manches: rig.support.group,
  };
  studio.scene.updateMatrixWorld(true);
  PASTILLES.forEach((p, i) => {
    const a = new THREE.Object3D(); a.name = 'pastille ' + p.id;
    if (p.obj) {
      /** @type {any} */ let obj = null; studio.scene.traverse((o) => { if (!obj && o.userData.point === p.obj && o.type === 'Group') obj = o; });
      if (!obj) return;
      const bb = new THREE.Box3().setFromObject(obj); const top = new THREE.Vector3((bb.min.x + bb.max.x) / 2, bb.max.y + 0.04, (bb.min.z + bb.max.z) / 2);
      obj.add(a); a.position.copy(obj.worldToLocal(top));
      a.userData.center = obj.worldToLocal(bb.getCenter(new THREE.Vector3()));
      a.userData.world = true;
    } else {
      const parent = parentOf[p.id] || rig.cam; parent.add(a);
      // le point d'accroche est donné dans le repère de la caméra : on le ramène dans celui du parent
      rig.cam.updateMatrixWorld(true);
      const w = new THREE.Vector3(p.at[0], p.at[1], p.at[2]).applyMatrix4(rig.cam.matrixWorld);
      a.position.copy(parent.worldToLocal(w));
    }
    R.anchors.set(p.id, a);
    const n = notionsAt(p.id).length;
    const b = el('button', { type: 'button', class: 'cl-pin', 'data-id': p.id, 'aria-label': `${p.nom} (${n} notion${n > 1 ? 's' : ''})`, onclick: () => openPoint(p.id) },
      el('i', { 'aria-hidden': 'true' }, String(i + 1)), el('span', {}, p.nom));
    b.dataset.occ = '0';
    pins.append(b); R.pinEls.set(p.id, b);
  });
}
const V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3();
function updatePins() {
  const { camera, canvas } = R; const w = canvas.clientWidth, h = canvas.clientHeight;
  const ids = [...R.anchors.keys()];
  // une pastille cachée par une pièce s'estompe : quatre rayons par image, chacune son tour
  const rids = new Set([0, 1, 2, 3].map(() => ids[R.rr++ % ids.length]));
  // deux pastilles qui se chevauchent à l'écran : seule la première de la liste reste (les autres
  // reparaissent en s'approchant) ; la pastille ouverte reste toujours
  const placed = [];
  for (const id of ids) {
    const a = R.anchors.get(id), b = R.pinEls.get(id), p = PASTILLES.find((x) => x.id === id);
    a.getWorldPosition(V1);
    V2.set(p.n[0], p.n[1], p.n[2]); if (!a.userData.world) V2.transformDirection(a.parent.matrixWorld); // normales du plateau : déjà dans le repère du monde
    const toEye = V3.copy(camera.position).sub(V1); const dist = toEye.length();
    const facing = V2.dot(toEye) / dist;
    const ndc = V1.clone().project(camera);
    const onScreen = ndc.z < 1 && Math.abs(ndc.x) < 1.05 && Math.abs(ndc.y) < 1.05;
    if (rids.has(id) && onScreen) {
      R.ray.set(camera.position, V1.clone().sub(camera.position).normalize()); R.ray.far = dist;
      const hit = R.ray.intersectObjects([R.rig.root, R.studio.mire, R.studio.desk], true).find(solid);
      b.dataset.occ = hit && hit.distance < dist - 0.025 ? '1' : '0';
    }
    const far = R.point && R.point !== id;
    let show = onScreen && facing > 0.05 && !(R.rig.state.cut && id !== 'bloc' && p.at && p.at[2] < -0.01);
    const sx = (ndc.x + 1) / 2 * w, sy = (1 - ndc.y) / 2 * h;
    if (show && R.point !== id && placed.some(([x, y]) => Math.hypot(x - sx, y - sy) < 26)) show = false;
    b.hidden = !show;
    if (!show) continue;
    if (b.dataset.occ !== '1') placed.push([sx, sy]);
    b.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
    b.classList.toggle('occ', b.dataset.occ === '1');
    b.classList.toggle('dim', !!far);
    b.classList.toggle('cur', R.point === id);
  }
}
/** une pièce touchée par un rayon et qu'on voit vraiment : visible (elle et ses parents), pas en verre, pas coupée */
function solid(h) {
  for (let o = h.object; o; o = o.parent) if (!o.visible) return false;
  const m = h.object.material; if (!m || m.visible === false || (m.transparent && m.opacity < 0.5)) return false;
  return !(m.clippingPlanes && m.clippingPlanes.length && R.rig.cutPlane.distanceToPoint(h.point) < 0);
}
/** la pastille de la pièce sous le pointeur */
function pick(e) {
  const r = R.canvas.getBoundingClientRect();
  const v = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  R.ray.setFromCamera(v, R.camera); R.ray.far = 60;
  const hits = R.ray.intersectObjects([R.rig.root, R.studio.mire, R.studio.desk], true);
  for (const h of hits) {
    if (!solid(h)) continue;
    for (let o = h.object; o; o = o.parent) if (o.userData.point) return PASTILLES.some((p) => p.id === o.userData.point) ? o.userData.point : null;
    return null;
  }
  return null;
}

// ---------------- vues ----------------
function overview(now = false) {
  closeSide(); R.point = null;
  setCut(false); setExplode(false);
  const t = new THREE.Vector3(-0.09, AXIS_H - 0.02, 0);
  if (now) { R.orbit.target.copy(t); R.orbit.sph.set(1.55, 1.25, Math.atan2(0.75, -0.62)); R.orbit.apply(); }
  else R.orbit.flyTo(t, new THREE.Vector3(0.75, 0.33, -0.62), 1.55);
}
function setExplode(on) { R.explodeOn = on; R.bExplode.classList.toggle('on', on); R.bExplode.setAttribute('aria-pressed', String(on)); }
function setCut(on) { R.rig.setCut(on); R.bCut.classList.toggle('on', on); R.bCut.setAttribute('aria-pressed', String(on)); }

/** ouvre une pastille : la vue s'approche, le panneau propose ses notions */
function openPoint(id, notion) {
  const p = PASTILLES.find((x) => x.id === id); if (!p) return;
  R.point = id;
  if (p.mode === 'cut') setCut(true);
  const a = R.anchors.get(id); const t = new THREE.Vector3();
  if (a.userData.world) a.parent.localToWorld(t.copy(a.userData.center));
  else if (p.look) t.set(p.look[0], p.look[1], p.look[2]).applyMatrix4(R.rig.cam.matrixWorld);
  else a.getWorldPosition(t);
  R.orbit.flyTo(t, new THREE.Vector3(p.dir[0], p.dir[1], p.dir[2]), p.dist);
  const ids = notionsAt(id);
  openNotion(notion || ids[0], id, false);
}
/** ouvre la fiche d'une notion (depuis une pastille, la liste ou « Voir aussi ») */
function openNotion(nid, pointId = null, fly = true) {
  const f = NOTIONS[nid]; if (!f) return;
  if (fly && f.point && f.point !== R.point) { openPoint(f.point, nid); return; }
  R.notion = nid;
  if (R.fiche) R.fiche.dispose();
  R.fiche = renderFiche(nid, { open: (s) => openNotion(s), lens: (st) => lensFromLab(st) });
  const pid = pointId || R.point;
  const p = PASTILLES.find((x) => x.id === pid);
  const ids = pid ? notionsAt(pid) : [];
  const tabs = ids.length > 1 ? el('div', { class: 'cl-tabs', role: 'tablist', 'aria-label': 'Notions de ce point' }, ...ids.map((s) => el('button', {
    type: 'button', role: 'tab', class: 'cl-tab' + (NOTIONS[s].prevu ? ' prevu' : ''), 'aria-selected': String(s === nid), onclick: () => openNotion(s, pid, false),
  }, NOTIONS[s].t))) : null;
  R.side.replaceChildren(
    el('div', { class: 'cl-sh' }, el('span', { class: 'cl-sp' }, p ? p.nom : 'Notion'), el('button', { type: 'button', class: 'linkbtn cl-close', 'aria-label': 'Fermer la fiche', onclick: () => { closeSide(); } }, 'Fermer')),
    ...(tabs ? [tabs] : []),
    el('div', { class: 'cl-scroll' }, R.fiche.node));
  R.side.hidden = false; R.root.classList.add('side-open');
  for (const b of R.list.querySelectorAll('[data-n]')) b.classList.toggle('cur', /** @type {HTMLElement} */ (b).dataset.n === nid);
  const sc = R.side.querySelector('.cl-scroll'); if (sc) sc.scrollTop = 0;
}
function closeSide() {
  if (R.fiche) { R.fiche.dispose(); R.fiche = null; }
  R.side.hidden = true; R.side.replaceChildren(); R.root.classList.remove('side-open'); R.notion = null; R.point = null; resetImage();
}
function toggleList(force) {
  const show = force != null ? force : R.list.hidden;
  R.list.hidden = !show; R.root.classList.toggle('list-open', show);
}
function buildList() {
  const L = R.list;
  const ecrites = Object.values(NOTIONS).filter((n) => !n.prevu).length;
  L.append(el('div', { class: 'cl-lh' }, el('b', {}, 'Les notions'), el('small', {}, `${ecrites} fiche${ecrites > 1 ? 's' : ''} écrite${ecrites > 1 ? 's' : ''} sur ${Object.keys(NOTIONS).length}`), el('button', { type: 'button', class: 'linkbtn', onclick: () => toggleList(false) }, 'Fermer')));
  for (const c of CHAPITRES) {
    const ul = el('ul', {});
    for (const id of notionsDu(c.n)) {
      const f = NOTIONS[id];
      ul.append(el('li', {}, el('button', { type: 'button', 'data-n': id, class: 'cl-ni' + (f.prevu ? ' prevu' : ''), onclick: () => { if (window.innerWidth < 900) toggleList(false); openNotion(id); } },
        el('i', { 'aria-hidden': 'true' }), f.t, f.prevu ? el('small', {}, `lot ${f.lot}`) : null)));
    }
    L.append(el('details', { class: 'cl-ch', open: c.n <= 2 }, el('summary', {}, el('b', {}, String(c.n)), c.nom), ul));
  }
}

// ---------------- la caméra pilotée par une manipulation ----------------
// st : bagues et filtre (zoom, focus, iris, ff, nd, ext, macro), et l'image : light (lumière du
// plateau, 1 par défaut), gain (dB), wb (dominante R, V, B), bars, chan (VF OUT), zebra ([bas,
// haut] en %), mireD (distance de la mire, m). Une manipulation n'envoie que ce qu'elle règle.
const RIG_KEYS = ['zoom', 'focus', 'iris', 'ff', 'nd', 'ext', 'macro'];
const CHANS = ['COLOR', 'Y', 'R', 'G', 'B'];
function lensFromLab(st) {
  R.lens = st;
  const o = {}; for (const k of RIG_KEYS) if (st[k] != null && st[k] >= 0) o[k] = st[k];
  if (Object.keys(o).length) R.rig.set(o);
  setMire(st.mireD || MIRE_D);
  const vfm = R.studio.vfMat.uniforms, mon = R.studio.monMat.uniforms;
  const wb = st.wb || [1, 1, 1];
  for (const u of [vfm, mon]) { u.wb.value.set(wb[0], wb[1], wb[2]); u.bars.value = st.bars ? 1 : 0; }
  vfm.chan.value = Math.max(0, CHANS.indexOf(st.chan || 'COLOR'));
  if (st.zebra) vfm.zebra.value.set(st.zebra[0] / 100, st.zebra[1] / 100); else vfm.zebra.value.set(9, 9);
  R.renderer.shadowMap.needsUpdate = true;
}
/** la mire du plateau, avancée ou reculée par une manipulation */
function setMire(D) {
  const x = FOCAL_PLANE + D;
  if (Math.abs(R.studio.mire.position.x - x) < 1e-6) return;
  R.studio.mire.position.x = x; R.studio.dirty = true; R.renderer.shadowMap.needsUpdate = true;
}
/** fiche refermée : l'image redevient celle de la caméra seule */
function resetImage() { lensFromLab({}); R.lens = null; }
/** l'image de la caméra : focale, flou de mise au point, lumière reçue */
function cameraImage(dt) {
  const s = R.rig.state, L = R.lens || {};
  const f = zoomFocal(s.zoom), dF = focusDist(s.focus), N = Math.min(s.iris, 64);
  const H = R.studio.rt.height;
  const blurR = blurPx(Math.abs(defocus(f, L.mireD || MIRE_D, dF, s.ff)) / N, H) / 2;
  const E = s.iris >= 99 ? 0 : exposureOf(N, ND[s.nd || 0][1], L.gain || 0) * (L.light != null ? L.light : 1);
  for (const m of [R.studio.vfMat, R.studio.monMat]) { m.uniforms.blur.value = blurR; m.uniforms.exposure.value = E * EXPO_K; }
  R.studio.renderView(dt, THREE.MathUtils.radToDeg(vfov(f)));
}
/** lumière du plateau ramenée à l'image : à f/8 sans filtre, le blanc de la mire vers 90 % */
const EXPO_K = 0.9;

// ---------------- boucle ----------------
let last = 0;
function loop(now) {
  raf = requestAnimationFrame(loop);
  // temps réel (borné à 0,2 s) : sur un ordinateur lent, la vue arrive quand même à l'heure
  const dt = Math.min(0.2, Math.max(0.001, (now - (last || now)) / 1000)); last = now;
  const { rig, orbit, renderer, camera, studio } = R;
  R.explodeT = clamp(R.explodeT + (R.explodeOn ? dt : -dt) * 1.4, 0, 1);
  if (R.explodeT !== rig.state.explode) { rig.setExplode(R.explodeT); renderer.shadowMap.needsUpdate = true; }
  orbit.update(dt);
  rig.update(dt);
  // la vue d'abord (elle recalcule les ombres s'il le faut, caméra comprise), puis l'image de la caméra
  renderer.render(studio.scene, camera);
  cameraImage(dt);
  updatePins();
}
function resize() {
  if (!R) return;
  const w = R.canvas.clientWidth || window.innerWidth, h = R.canvas.clientHeight || window.innerHeight;
  R.renderer.setSize(w, h, false); R.camera.aspect = w / h; R.camera.updateProjectionMatrix();
}
function onKey(e) {
  if (!CL.open) return;
  if (e.code === 'Escape') {
    e.preventDefault(); e.stopPropagation();
    if (!R.list.hidden && window.innerWidth < 900) { toggleList(false); return; }
    if (!R.side.hidden) { closeSide(); return; }
    closeCameraLab();
  }
}

// ---------------- ouvrir, fermer ----------------
/** ouvre le module ; o.notion ou o.point : ouvrir directement une fiche */
export async function openCameraLab(o = {}) {
  if (CL.open) return;
  CL.open = true;
  const title = document.getElementById('title');
  titleWasOpen = !!title && !title.hidden; if (title) title.hidden = true;
  if (!CL.built) {
    try { await build(); } catch (e) { CL.open = false; if (title && titleWasOpen) title.hidden = false; throw e; }
  }
  R.root.hidden = false; document.body.classList.add('camlab-on');
  resize(); last = 0; raf = requestAnimationFrame(loop);
  if (o.notion) openNotion(o.notion); else if (o.point) openPoint(o.point);
  const first = /** @type {HTMLElement | null} */ (R.bar.querySelector('button')); if (first) first.focus({ preventScroll: true });
}
export function closeCameraLab() {
  if (!CL.open) return;
  CL.open = false; cancelAnimationFrame(raf);
  if (R) { closeSide(); R.root.hidden = true; }
  document.body.classList.remove('camlab-on');
  const title = document.getElementById('title');
  if (title && titleWasOpen) { title.hidden = false; const b = document.getElementById('ti-camera'); if (b) b.focus({ preventScroll: true }); }
}
/** accès de débogage et de test */
export const camlabDebug = () => R;

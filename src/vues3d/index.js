// @ts-check
import * as THREE from 'three';
import { el, clamp } from '../util.js';
import { on, emit, S } from '../state.js';
import { rich } from '../ui/rich.js';
import { lessonById } from '../cours/index.js';
import { makeOrbit } from './orbite.js';
import { Flux, libere, mat } from './kit.js';
import { VUES, vueById, vuesDuChapitre, CHAP3D, etapeDeLecon } from './catalogue.js';

// ----------------------------------------------------------------------------------
// Les vues 3D du Cours : pour une notion technique qui se comprend mieux dans l'espace (un coaxial
// coupé en deux et les mots SDI qui y passent, des machines regroupées en VLAN, une passerelle entre
// deux réseaux, des paquets ST 2110 doublés sur les réseaux rouge et bleu…), une scène 3D animée
// qu'on observe en tournant autour, comme la caméra en 3D (src/camlab). L'écran est partagé comme aux
// postes en 3D : à gauche la scène, à droite un panneau 2D qui garde les écrits :
//  · « En 3D » : les étapes de la visite (chacune approche la vue et règle la scène), les commandes de
//    la vue (couper un câble, changer de format, abonner un récepteur…), ce qui se passe, l'objet cliqué ;
//  · « La leçon » : l'essentiel, le schéma et l'explication de la leçon du Cours dont la vue est tirée.
// Une vue est un fichier de vues/ (catalogue.js les liste) : ses étapes, ses commandes et build(ctx),
// qui construit la scène avec les outils de kit.js et materiel.js. Un second contexte WebGL, construit
// à la première ouverture ; la boucle du simulateur est en pause tant qu'il est ouvert. On l'ouvre par
// le bouton « Voir en 3D » d'une leçon, ou par l'entrée « … en 3D » du chapitre (ui/cours_ui.js).
// ----------------------------------------------------------------------------------

export const V3 = { open: false, built: false };
/** @type {any} */
let R = null;
let titleWasOpen = false, raf = 0, openedFrom = '', backLesson = '', backChapter = '';

/** le module est ouvert (les touches et la boucle du simulateur l'ignorent) */
export const vues3dOpen = () => V3.open;
/** l'événement « vue3d » ouvre une vue : { vue, etape?, lecon?, chapitre?, from? } */
export function initVues3d() { on('vue3d', (o) => { openVue3d(o || {}).catch((e) => console.error(e)); }); }

const quality = () => S.quality || 'moyenne';
const LABEL_KEY = 'carregie.v3labels';

// ---------------- construction (à la première ouverture) ----------------
async function build() {
  // les textes posés dans la scène sont dessinés avec les polices de l'interface : on les attend (2 s au plus)
  try { await Promise.race([Promise.all(['600 40px "Archivo Narrow"', '700 40px "Archivo Narrow"', '600 16px "B612 Mono"'].map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 2000))]); } catch (e) { /* polices de secours */ }
  const q = quality();
  const root = el('div', { id: 'vues3d', class: 'v3', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Vue 3D', hidden: true });
  const stage = el('div', { class: 'v3-stage' });
  const canvas = el('canvas', { class: 'v3-gl', tabindex: '-1', 'aria-label': 'Scène 3D : glisser pour tourner autour, molette pour approcher, clic sur un objet pour le décrire' });
  const tags = el('div', { class: 'v3-tags', 'aria-hidden': 'true' });
  const tip = el('div', { class: 'v3-tip', hidden: true, 'aria-hidden': 'true' });
  const side = el('aside', { class: 'v3-side', 'aria-label': 'Explications' });
  const list = el('nav', { class: 'v3-list', hidden: true, 'aria-label': 'Les vues 3D' });
  const btn = (label, title, onclick, cls = '') => el('button', { type: 'button', class: 'btn small ' + cls, title, onclick }, label);
  const bList = btn('Les vues 3D', 'Toutes les vues 3D du Cours, chapitre par chapitre', () => toggleList());
  const bTags = btn('Étiquettes', 'Afficher ou masquer les noms posés dans la scène', () => setTags(!R.tagsOn));
  const bPause = btn('Pause', 'Arrêter ou relancer l\'animation (barre d\'espace)', () => setPause(!R.paused));
  const bHome = btn('Recentrer', 'Revenir au point de vue de l\'étape (double-clic dans la scène)', () => recenter());
  const bQuit = btn('Quitter', 'Revenir au Cours (Échap)', () => closeVue3d(), 'v3-quit');
  bQuit.append(' ', el('kbd', {}, 'Échap'));
  const title = el('span', { class: 'tape y v3-chap' }, 'En 3D');
  const sub = el('b', { class: 'v3-title' });
  const bar = el('header', { class: 'v3-bar' },
    el('div', { class: 'v3-id' }, title, sub),
    el('div', { class: 'v3-tools', role: 'toolbar', 'aria-label': 'Vue' }, bList, bTags, bPause, bHome),
    bQuit);
  const hint = el('p', { class: 'v3-hint' }, 'Glisser pour tourner · molette ou pincer pour approcher · clic droit ou Maj pour déplacer · clic sur un objet pour le décrire');
  const loading = el('p', { class: 'v3-loading' }, 'Préparation de la scène…');
  stage.append(canvas, tags, tip, hint);
  root.append(stage, bar, list, side, loading);
  document.body.append(root);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'haute' ? 2 : q === 'basse' ? 1 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = q !== 'basse' && !S.lite; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene(); scene.name = 'vues 3D';
  scene.background = new THREE.Color(0x0b0f13);
  scene.fog = new THREE.Fog(0x0b0f13, 18, 46);
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.02, 200);
  // lumières : un ciel doux, une lumière principale qui porte les ombres, un contre-jour froid
  scene.add(new THREE.HemisphereLight(0xc8d2dc, 0x1a1d22, 0.9));
  const key = new THREE.DirectionalLight(0xfff2e0, 2.2); key.position.set(-5, 9, 6);
  key.castShadow = renderer.shadowMap.enabled; key.shadow.mapSize.set(q === 'haute' ? 2048 : 1024, q === 'haute' ? 2048 : 1024);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x9fb8ff, 0.9); rim.position.set(6, 4, -7); scene.add(rim);
  // environnement de reflets : une pièce sombre et quelques boîtes à lumière
  const pm = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(30, 12, 30), new THREE.MeshBasicMaterial({ color: 0x10141b, side: THREE.BackSide })));
  for (const [p, s, c] of [[[-5, 5, 4], [5, 0.1, 3], 0xfff0dc], [[5, 4, -4], [3, 0.1, 3], 0xd8e4ff], [[0, 3, -14.9], [8, 3, 0.1], 0x2a3a6a]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(s[0], s[1], s[2]), new THREE.MeshBasicMaterial({ color: c })); m.position.set(p[0], p[1], p[2]); env.add(m);
  }
  scene.environment = pm.fromScene(env, 0.03).texture; scene.environmentIntensity = 0.45;
  // le sol : un plateau sombre, une grille discrète
  const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 64), mat('beton', 0x1b2026, { roughness: 0.92 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.name = 'sol';
  const grid = new THREE.GridHelper(32, 64, 0x2b333b, 0x20272e); grid.position.y = 0.002;
  /** @type {any} */ (grid.material).transparent = true; /** @type {any} */ (grid.material).opacity = 0.5;
  const decor = new THREE.Group(); decor.add(floor, grid); scene.add(decor);
  const orbit = makeOrbit(camera, canvas);
  const box = new THREE.Box3Helper(new THREE.Box3(), 0xffb020); box.visible = false; box.name = 'sélection'; scene.add(box);

  R = { root, stage, canvas, tags, tip, side, list, bar, sub, title, bList, bTags, bPause, renderer, scene, camera, key, orbit, decor, floor, grid, selBox: box, pm,
    vue: null, inst: null, group: null, etape: 0, labels: [], tagsOn: true, paused: false, sel: null, fluxes: [], tab: 'vue', t: 0,
    ray: new THREE.Raycaster(), hoverT: 0, panel: null, /** @type {Record<string, string>} */ lus: {} };
  try { const v = localStorage.getItem(LABEL_KEY); if (v === '0') R.tagsOn = false; } catch (e) { /* stockage indisponible */ }
  setTags(R.tagsOn);
  orbit.onTap = (e) => select(pick(e));
  orbit.onHover = (e) => hover(e);
  orbit.onDouble = () => recenter();
  canvas.addEventListener('pointerleave', () => { tip.hidden = true; });
  buildList();
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', resize);
  loading.remove();
  V3.built = true;
}

// ---------------- la liste des vues (gauche) ----------------
function buildList() {
  const L = R.list;
  L.append(el('div', { class: 'v3-lh' }, el('b', {}, 'Les vues 3D'), el('small', {}, `${VUES.length} vues`), el('button', { type: 'button', class: 'linkbtn', onclick: () => toggleList(false) }, 'Fermer')));
  for (const [chap, label] of Object.entries(CHAP3D)) {
    const vs = vuesDuChapitre(chap); if (!vs.length) continue;
    L.append(el('details', { class: 'v3-ch', open: true, 'data-chap': chap }, el('summary', {}, label),
      el('ul', {}, ...vs.map((v) => el('li', {}, el('button', { type: 'button', class: 'v3-li', 'data-vue': v.id, onclick: () => { if (window.innerWidth < 900) toggleList(false); showVue(v.id); } }, el('b', {}, v.titre), el('small', {}, v.resume)))))));
  }
}
function toggleList(force) {
  const show = force != null ? force : R.list.hidden;
  R.list.hidden = !show; R.root.classList.toggle('list-open', show);
  R.bList.setAttribute('aria-pressed', String(show));
}
function setTags(on) {
  R.tagsOn = on; R.tags.hidden = !on;
  R.bTags.setAttribute('aria-pressed', String(on)); R.bTags.classList.toggle('on', on);
  try { localStorage.setItem(LABEL_KEY, on ? '1' : '0'); } catch (e) { /* stockage indisponible */ }
}
function setPause(p) {
  R.paused = p; R.bPause.textContent = p ? 'Lecture' : 'Pause';
  R.bPause.setAttribute('aria-pressed', String(p)); R.bPause.classList.toggle('on', p);
}

// ---------------- une vue : construire, libérer ----------------
const V = new THREE.Vector3(), V2 = new THREE.Vector3();
const vec = (a) => new THREE.Vector3(a[0], a[1], a[2]);
/** le contexte donné à la construction d'une vue */
function makeCtx(group) {
  return {
    THREE, root: group, qualite: quality(), lite: !!S.lite,
    /** une étiquette HTML accrochée à un objet (ou un point) de la scène */
    label(target, text, o = {}) {
      const e = el('span', { class: 'v3-tag' + (o.cls ? ' ' + o.cls : '') }, text);
      R.tags.append(e);
      const L = { el: e, target, off: o.off ? vec(o.off) : new THREE.Vector3(), on: true, set(t) { e.textContent = t; }, show(v) { L.on = !!v; } };
      R.labels.push(L);
      return L;
    },
    /** un flux d'objets qui avancent le long de courbes (mis à jour par le moteur) */
    flux(max, geo, material) { const f = new Flux(max, geo, material); group.add(f.mesh); R.fluxes.push(f); return f; },
    /** un message dans le panneau (« Ce qui se passe ») */
    say(text) { if (R.panel && R.panel.say) R.panel.say(text); },
    /** une lecture chiffrée du panneau (clé déclarée dans vue.lectures) */
    read(k, v) { R.lus[k] = v; if (R.panel && R.panel.read) R.panel.read(k, v); },
    /** l'étape en cours, et y aller */
    etape: () => R.etape, goEtape: (i) => goEtape(i),
    /** décrit un objet dans le panneau, comme un clic */
    select: (obj) => select(obj),
  };
}
function disposeVue() {
  if (!R.inst) return;
  try { if (R.inst.dispose) R.inst.dispose(); } catch (e) { console.error(e); }
  R.scene.remove(R.group); libere(R.group);
  for (const L of R.labels) L.el.remove();
  R.labels = []; R.fluxes = []; R.inst = null; R.group = null; R.vue = null; R.sel = null; R.selBox.visible = false; R.panel = null; R.lus = {};
}
/** ouvre une vue (à l'étape donnée) */
function showVue(id, etape = 0) {
  const vue = vueById(id); if (!vue) return;
  if (R.vue && R.vue.id === id) { goEtape(etape); return; }
  disposeVue();
  const group = new THREE.Group(); group.name = 'vue ' + id;
  R.scene.add(group); R.group = group; R.vue = vue; R.t = 0;
  R.sub.textContent = vue.titre; R.title.textContent = CHAP3D[vue.chapitre] || 'En 3D';
  const d = vue.decor || {};
  R.decor.visible = d.sol !== false;
  R.scene.background.set(d.fond ?? 0x0b0f13); R.scene.fog.color.set(d.fond ?? 0x0b0f13);
  R.scene.fog.near = d.brume ? d.brume[0] : 18; R.scene.fog.far = d.brume ? d.brume[1] : 46;
  const o = vue.orbite || {};
  Object.assign(R.orbit, { rMin: o.rMin ?? 0.4, rMax: o.rMax ?? 24, phiMin: o.phiMin ?? 0.12, phiMax: o.phiMax ?? 1.52 });
  R.inst = vue.build(makeCtx(group)) || {};
  // les objets translucides (verre, zones, faisceaux) et les rayons ne portent pas d'ombre
  group.traverse((x) => { const m = /** @type {any} */ (x); if (m.isMesh && !x.name.startsWith('texte') && x.name !== 'flux') { x.castShadow = !m.material.transparent && !x.userData.passe; x.receiveShadow = true; } });
  for (const b of R.list.querySelectorAll('.v3-li')) b.classList.toggle('cur', /** @type {HTMLElement} */ (b).dataset.vue === id);
  R.etape = -1;
  renderSide();
  goEtape(clamp(etape, 0, vue.etapes.length - 1), true);
}
/** va à l'étape i : la vue s'approche, la scène se règle, le panneau suit */
function goEtape(i, now = false) {
  const vue = R.vue; if (!vue) return;
  i = clamp(i, 0, vue.etapes.length - 1);
  const E = vue.etapes[i]; R.etape = i;
  const cam = E.vue || vue.vue;
  if (cam) { if (now) R.orbit.jumpTo(vec(cam.cible), vec(cam.dir), cam.dist); else R.orbit.flyTo(vec(cam.cible), vec(cam.dir), cam.dist); }
  try { if (R.inst.etape) R.inst.etape(i, E); } catch (e) { console.error(e); }
  if (R.panel) R.panel.step(i);
}
function recenter() { if (R.vue) { const E = R.vue.etapes[R.etape] || {}; const cam = E.vue || R.vue.vue; if (cam) R.orbit.flyTo(vec(cam.cible), vec(cam.dir), cam.dist); } }

// ---------------- le panneau de droite ----------------
function renderSide() {
  const vue = R.vue;
  const tabs = el('div', { class: 'v3-tabs', role: 'tablist', 'aria-label': 'Panneau' });
  const body = el('div', { class: 'v3-scroll' });
  const mkTab = (k, label) => el('button', { type: 'button', role: 'tab', class: 'v3-tab', 'data-tab': k, 'aria-selected': String(R.tab === k), onclick: () => { R.tab = k; for (const b of tabs.children) b.setAttribute('aria-selected', String(/** @type {HTMLElement} */ (b).dataset.tab === k)); fill(); } }, label);
  tabs.append(mkTab('vue', 'En 3D'), mkTab('lecon', 'La leçon'));
  // l'onglet « En 3D » : étapes, commandes, ce qui se passe, objet cliqué (construits une fois, gardés)
  const stepNo = el('span', { class: 'v3-sn' });
  const prev = el('button', { type: 'button', class: 'btn small', 'aria-label': 'Étape précédente', onclick: () => goEtape(R.etape - 1) }, '◀');
  const next = el('button', { type: 'button', class: 'btn small primary', 'aria-label': 'Étape suivante', onclick: () => goEtape(R.etape + 1) }, 'Suivante ▶');
  const dots = el('ol', { class: 'v3-dots', 'aria-label': 'Étapes' }, ...vue.etapes.map((E, k) => el('li', {}, el('button', { type: 'button', class: 'v3-dot', 'data-k': String(k), title: E.t, onclick: () => goEtape(k) }, el('span', { class: 'sr' }, `Étape ${k + 1} : ${E.t}`)))));
  const stepT = el('h3', { class: 'v3-st' }); const stepTxt = el('div', { class: 'v3-stx' });
  const live = el('p', { class: 'v3-live', role: 'status', 'aria-live': 'polite' });
  const reads = vue.lectures && vue.lectures.length ? el('dl', { class: 'v3-read' }) : null;
  const readVals = {};
  // les lectures déjà écrites (pendant la construction de la scène, ou avant un changement d'onglet) sont reprises
  if (reads) for (const k of vue.lectures) { readVals[k] = el('dd', {}, R.lus[k] ?? '—'); reads.append(el('div', {}, el('dt', {}, k), readVals[k])); }
  const selBox = el('section', { class: 'v3-sel', hidden: true, 'aria-label': 'Objet choisi' });
  let cmds = null;
  try { cmds = R.inst.commandes ? R.inst.commandes() : null; } catch (e) { console.error(e); }
  const vueTab = el('div', { class: 'v3-vue' },
    el('p', { class: 'v3-resume' }, vue.resume),
    el('section', { class: 'v3-steps', 'aria-label': 'Étapes' }, el('div', { class: 'v3-nav' }, prev, stepNo, next), dots, stepT, stepTxt),
    cmds ? el('section', { class: 'v3-cmd', 'aria-label': 'Commandes de la vue' }, el('h4', {}, 'À vous'), cmds) : null,
    reads ? el('section', { class: 'v3-reads', 'aria-label': 'Lectures' }, el('h4', {}, 'Ce que mesure la scène'), reads) : null,
    el('section', { class: 'v3-what', 'aria-label': 'Ce qui se passe' }, el('h4', {}, 'Ce qui se passe'), live),
    selBox);
  const fill = () => {
    body.replaceChildren(R.tab === 'vue' ? vueTab : lessonTab());
    body.scrollTop = 0;
  };
  R.panel = {
    step(i) {
      const E = vue.etapes[i];
      stepNo.textContent = `Étape ${i + 1} / ${vue.etapes.length}`;
      prev.disabled = i === 0; next.disabled = i === vue.etapes.length - 1;
      stepT.textContent = E.t; stepTxt.replaceChildren(rich(E.texte, 'v3-rich'));
      for (const b of dots.querySelectorAll('.v3-dot')) { const k = Number(/** @type {HTMLElement} */ (b).dataset.k); b.classList.toggle('on', k === i); b.classList.toggle('vu', k < i); b.setAttribute('aria-current', k === i ? 'step' : 'false'); }
      if (R.tab !== 'vue') return;
      const sc = R.side.querySelector('.v3-scroll'); if (sc) sc.scrollTop = 0;
    },
    say(t) { live.textContent = t; live.classList.remove('flash'); void live.offsetWidth; live.classList.add('flash'); },
    read(k, v) { if (readVals[k]) readVals[k].textContent = v; },
    sel(info) {
      selBox.hidden = !info; if (!info) return;
      selBox.replaceChildren(el('h4', {}, 'Vous avez choisi'), el('b', { class: 'v3-seln' }, info.nom), info.texte ? rich(info.texte, 'v3-rich') : null);
    },
  };
  live.textContent = vue.depart || 'Choisissez une étape, tournez autour de la scène, cliquez un objet pour le décrire.';
  const L = backLesson && vue.lecons.includes(backLesson) ? backLesson : vue.lecons[0];
  const found = lessonById(L);
  R.side.replaceChildren(
    el('div', { class: 'v3-sh' }, el('span', { class: 'v3-sp' }, found ? found.chapter.title : 'Cours'),
      found ? el('button', { type: 'button', class: 'linkbtn', title: 'Fermer la vue et ouvrir la leçon dans le Cours (manipulation, quiz)', onclick: () => closeVue3d({ lesson: L }) }, 'Leçon complète et quiz') : null),
    tabs, body);
  fill();
}
/** l'onglet « La leçon » : l'essentiel, le schéma, l'explication, de chaque leçon de la vue */
function lessonTab() {
  const vue = R.vue;
  const ids = vue.lecons.filter((id) => lessonById(id));
  const box = el('div', { class: 'v3-lecon' });
  const cur = R.lessonPick && ids.includes(R.lessonPick) ? R.lessonPick : (backLesson && ids.includes(backLesson) ? backLesson : ids[0]);
  if (ids.length > 1) box.append(el('div', { class: 'v3-lpick', role: 'group', 'aria-label': 'Leçons de cette vue' }, ...ids.map((id) => el('button', { type: 'button', class: 'v3-chip' + (id === cur ? ' on' : ''), 'aria-pressed': String(id === cur), onclick: () => { R.lessonPick = id; const sc = R.side.querySelector('.v3-scroll'); if (sc) sc.replaceChildren(lessonTab()); } }, lessonById(id).lesson.title))));
  const f = lessonById(cur); if (!f) return box;
  const Ls = f.lesson;
  box.append(el('h2', { class: 'v3-lt' }, Ls.title, Ls.minutes ? el('small', {}, Ls.minutes) : null),
    el('section', { class: 'co-ess', 'aria-label': 'L\'essentiel' }, el('h4', {}, 'L\'essentiel'), el('ul', {}, ...Ls.essentials.map((t) => el('li', {}, rich(t, 'co-rich'))))));
  if (Ls.figure) { try { box.append(el('div', { class: 'co-figbox' }, Ls.figure())); } catch (e) { console.error(e); } }
  box.append(el('section', { class: 'co-text' }, rich(Ls.body, 'co-rich')));
  if (Ls.plus) box.append(el('details', { class: 'co-plus' }, el('summary', {}, 'Pour aller plus loin'), rich(Ls.plus, 'co-rich')));
  box.append(el('div', { class: 'hwrow' }, el('button', { type: 'button', class: 'btn small primary', onclick: () => closeVue3d({ lesson: cur }) }, 'Ouvrir la leçon dans le Cours (manipulation, quiz)')));
  for (const s of box.querySelectorAll('svg[role="img"]')) if (s.querySelector('[tabindex], a, button')) s.setAttribute('role', 'group');
  return box;
}

// ---------------- survol, clic, sélection ----------------
/** ce qu'il y a sous le pointeur : { obj, info } */
function pick(e) {
  if (!R.group) return null;
  const r = R.canvas.getBoundingClientRect();
  const v = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  R.ray.setFromCamera(v, R.camera); R.ray.far = 200;
  const hits = R.ray.intersectObjects([R.group], true);
  for (const h of hits) {
    let vis = true; for (let o = h.object; o; o = o.parent) if (!o.visible) { vis = false; break; }
    if (!vis) continue;
    const any = /** @type {any} */ (h.object);
    if (any.userData.flux && h.instanceId != null) { const it = any.userData.flux.at(h.instanceId); if (it && it.info) return { obj: null, item: it, info: it.info }; continue; }
    if (any.userData.instInfo && h.instanceId != null) { const info = any.userData.instInfo(h.instanceId); if (info) return { obj: null, info }; continue; }
    for (let o = h.object; o; o = o.parent) if (o.userData.info) return { obj: o, info: typeof o.userData.info === 'function' ? o.userData.info() : o.userData.info };
    if (any.userData.passe) continue; // décor qu'on traverse (zones translucides, rayons)
    return null;
  }
  return null;
}
function hover(e) {
  const now = performance.now(); if (now - R.hoverT < 50) return; R.hoverT = now;
  const p = pick(e);
  R.canvas.style.cursor = p ? 'pointer' : '';
  if (!p) { R.tip.hidden = true; return; }
  const r = R.stage.getBoundingClientRect();
  R.tip.textContent = p.info.nom; R.tip.hidden = false;
  R.tip.style.transform = `translate(${(e.clientX - r.left + 14).toFixed(0)}px, ${(e.clientY - r.top + 12).toFixed(0)}px)`;
}
function select(p) {
  if (p && !p.info && p.isObject3D) p = { obj: p, info: typeof p.userData.info === 'function' ? p.userData.info() : p.userData.info };
  R.sel = p && p.obj ? p.obj : null;
  R.selBox.visible = !!R.sel;
  if (R.panel) R.panel.sel(p ? p.info : null);
  if (p && R.inst && R.inst.onSelect) { try { R.inst.onSelect(p); } catch (e) { console.error(e); } }
  if (p && R.tab !== 'vue') { R.tab = 'vue'; renderTabsOnly(); }
  if (p) { const s = R.side.querySelector('.v3-sel'); if (s) s.scrollIntoView({ block: 'nearest' }); }
}
function renderTabsOnly() { const t = /** @type {HTMLElement | null} */ (R.side.querySelector('.v3-tab[data-tab="vue"]')); if (t) t.click(); }

// ---------------- boucle ----------------
let last = 0;
function loop(now) {
  raf = requestAnimationFrame(loop);
  const dt = Math.min(0.1, Math.max(0.001, (now - (last || now)) / 1000)); last = now;
  const { orbit, renderer, camera, scene } = R;
  if (R.inst && !R.paused) {
    R.t += dt;
    try { if (R.inst.update) R.inst.update(dt, R.t); } catch (e) { console.error(e); setPause(true); }
    for (const f of R.fluxes) f.update(dt);
  }
  orbit.update(dt);
  if (R.sel) { R.selBox.box.setFromObject(R.sel); R.selBox.box.expandByScalar(0.02); }
  renderer.render(scene, camera);
  updateLabels();
}
function updateLabels() {
  if (!R.tagsOn) return;
  const w = R.canvas.clientWidth, h = R.canvas.clientHeight;
  for (const L of R.labels) {
    let vis = L.on;
    if (vis) {
      if (L.target.isObject3D) { for (let o = L.target; o; o = o.parent) if (!o.visible) { vis = false; break; } L.target.getWorldPosition(V); } else V.copy(L.target);
      V.add(L.off);
      V2.copy(V).project(R.camera);
      vis = vis && V2.z < 1 && Math.abs(V2.x) < 1.1 && Math.abs(V2.y) < 1.1;
      if (vis) L.el.style.transform = `translate(${((V2.x + 1) / 2 * w).toFixed(1)}px, ${((1 - V2.y) / 2 * h).toFixed(1)}px)`;
    }
    L.el.hidden = !vis;
  }
}
function resize() {
  if (!R) return;
  const w = R.canvas.clientWidth || window.innerWidth, h = R.canvas.clientHeight || window.innerHeight;
  R.renderer.setSize(w, h, false); R.camera.aspect = w / h; R.camera.updateProjectionMatrix();
}
function onKey(e) {
  if (!V3.open) return;
  const t = /** @type {HTMLElement} */ (e.target);
  const typing = t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
  if (e.code === 'Escape') {
    e.preventDefault(); e.stopPropagation();
    if (!R.list.hidden && window.innerWidth < 900) { toggleList(false); return; }
    closeVue3d(); return;
  }
  if (typing) return;
  if (e.code === 'Space' && !(t && t.tagName === 'BUTTON')) { e.preventDefault(); setPause(!R.paused); }
  else if (e.code === 'ArrowRight' && t === R.canvas) { e.preventDefault(); goEtape(R.etape + 1); }
  else if (e.code === 'ArrowLeft' && t === R.canvas) { e.preventDefault(); goEtape(R.etape - 1); }
}

// ---------------- ouvrir, fermer ----------------
/**
 * Ouvre le module. o.vue : la vue (sinon la première du chapitre o.chapitre, ou celle de la leçon o.lecon) ;
 * o.etape : l'étape (sinon celle de la leçon) ; o.from : 'cours' pour y revenir en sortant.
 * @param {{ vue?: string, etape?: number, lecon?: string, chapitre?: string, from?: string, liste?: boolean }} o
 */
export async function openVue3d(o = {}) {
  let id = o.vue;
  if (!id && o.lecon) { const v = VUES.find((x) => x.lecons.includes(o.lecon)); if (v) id = v.id; }
  if (!id && o.chapitre) { const v = vuesDuChapitre(o.chapitre)[0]; if (v) id = v.id; }
  if (!id) id = VUES[0].id;
  const vue = vueById(id); if (!vue) return;
  const etape = o.etape != null ? o.etape : o.lecon ? etapeDeLecon(vue, o.lecon) : 0;
  if (V3.open) { if (o.lecon) backLesson = o.lecon; showVue(id, etape); return; }
  V3.open = true; openedFrom = o.from || ''; backLesson = o.lecon || ''; backChapter = o.chapitre || vue.chapitre;
  const title = document.getElementById('title');
  titleWasOpen = !!title && !title.hidden; if (title) title.hidden = true;
  if (!V3.built) {
    try { await build(); } catch (e) { V3.open = false; if (title && titleWasOpen) title.hidden = false; throw e; }
  }
  R.root.hidden = false; document.body.classList.add('vues3d-on');
  R.tab = 'vue'; R.lessonPick = null;
  resize();
  showVue(id, etape);
  toggleList(!!o.liste && window.innerWidth >= 900);
  last = 0; raf = requestAnimationFrame(loop);
  const first = /** @type {HTMLElement | null} */ (R.side.querySelector('.v3-nav .primary')); if (first) first.focus({ preventScroll: true });
}
/**
 * Ferme le module ; next.lesson : ouvrir cette leçon du Cours ; sinon, venu du Cours, on y revient.
 * @param {{ lesson?: string } | null} [next]
 */
export function closeVue3d(next = null) {
  if (!V3.open) return;
  V3.open = false; cancelAnimationFrame(raf);
  if (R) { disposeVue(); R.root.hidden = true; R.tip.hidden = true; }
  document.body.classList.remove('vues3d-on');
  const title = document.getElementById('title');
  if (title && titleWasOpen) { title.hidden = false; const b = document.getElementById('ti-cours'); if (b) b.focus({ preventScroll: true }); }
  const from = openedFrom, back = backLesson, chap = backChapter;
  openedFrom = ''; backLesson = ''; backChapter = '';
  if (next && next.lesson) emit('cours', { lesson: next.lesson });
  else if (from === 'cours') emit('cours', back ? { lesson: back } : { chapter: chap });
}
/** accès de débogage et de test */
export const vues3dDebug = () => R;

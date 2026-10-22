// @ts-check
import * as THREE from 'three';
import { drawFace } from '../../equipment/viewer.js';
import { U, RACK19, canvas, canvasTex, FONT } from './kit.js';

// ----------------------------------------------------------------------------------
// Les appareils en 3D. Pour chaque modèle du catalogue, un prototype est construit une fois
// (géométrie, faces dessinées, plans des faces) puis cloné pour chaque exemplaire sorti du stock :
// les clones partagent géométries et matériaux. Les faces avant et arrière sont les dessins de la
// visionneuse (drawFace, equipment/viewer.js) passés en texture : le SVG est sérialisé, chargé
// comme image, copié dans un canvas. Le même placement sert à retrouver chaque connecteur : un
// port de la face (x, y dans w × h) devient un point du plan de la face, d'où partent les câbles.
//
// Repère local d'un appareil, selon sa pose :
//   - baie : origine au bas du plan avant (z = 0), le corps vers -z ;
//   - table : origine au centre de l'empreinte, sur le plateau de la table (y = 0) ; face avant vers +z ;
//   - plateau : origine au sol, au pied de la colonne ; l'objectif regarde +z ;
//   - mur : origine au mur, au centre du coffret ; les prises regardent +z.
// ----------------------------------------------------------------------------------
/** @typedef {import('../types.js').Modele} Modele */
/** @typedef {import('../types.js').Appareil} Appareil */
/** @typedef {import('../types.js').Eval} Eval */
/** @typedef {import('../types.js').Face} Face */
/**
 * Un plan de face, en coordonnées locales : centre, droite (x croissant du dessin), bas (y croissant
 * du dessin), normale sortante, taille ; et le placement du dessin (échelle s, marges) dans ce plan.
 * @typedef {{ c: THREE.Vector3, r: THREE.Vector3, d: THREE.Vector3, n: THREE.Vector3, w: number, h: number, fw: number, fh: number, s: number }} Plan
 */
/**
 * @typedef {object} Proto
 * @property {THREE.Group} group le gabarit (jamais dans la scène : on le clone)
 * @property {Record<string, Plan>} plans par nom de face (avant, arriere)
 * @property {Record<string, { face: string, x: number, y: number }>} ports où est dessiné chaque port
 * @property {THREE.Vector3} pin point de la pastille (repère local)
 * @property {THREE.Box3} box encombrement (repère local)
 */

const BG = '#2b3036';
const isConsole = (/** @type {Face | undefined} */ f) => !!f && /dessus|pupitre/i.test(f.label || '');
/** l'appareil a-t-il besoin d'énergie (secteur, 12 V ou PoE+) ? (il a alors un voyant POWER) */
const needsPower = (/** @type {Modele} */ m) => m.ports.some((p) => (p.sig === 'secteur' || p.sig === 'dc12' || (p.sig === 'ip' && p.poe)) && (p.dir === 'in' || p.dir === 'io'));

/** un plan : centre, droite, bas (la normale sortante en découle) */
function plan(c, r, d, w, h, /** @type {Face} */ f) {
  const C = new THREE.Vector3(...c), R = new THREE.Vector3(...r).normalize(), D = new THREE.Vector3(...d).normalize();
  const N = new THREE.Vector3().crossVectors(R, D.clone().negate()).normalize();
  const s = Math.min(w / f.w, h / f.h);
  return /** @type {Plan} */ ({ c: C, r: R, d: D, n: N, w, h, fw: f.w, fh: f.h, s });
}
/** un point (x, y) du dessin de la face, en coordonnées locales de l'appareil */
export function pointDe(/** @type {Plan} */ P, x, y, lift = 0) {
  return P.c.clone().addScaledVector(P.r, (x - P.fw / 2) * P.s).addScaledVector(P.d, (y - P.fh / 2) * P.s).addScaledVector(P.n, lift);
}
/** oriente un maillage plan (PlaneGeometry, +x à droite, +y en haut) sur un plan de face */
function orient(/** @type {THREE.Object3D} */ o, /** @type {Plan} */ P, lift = 0.0006) {
  o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(P.r, P.d.clone().negate(), P.n));
  o.position.copy(P.c).addScaledVector(P.n, lift);
}

// ---------------- les faces dessinées, en texture ----------------
/**
 * Dessin de secours d'une face sur un canvas 2D (avant que le SVG soit prêt, ou si le navigateur
 * refuse de copier l'image) : le corps, les groupes, les textes, les connecteurs, les voyants.
 */
function quickFace(/** @type {CanvasRenderingContext2D} */ g, /** @type {Face} */ f, k) {
  g.save(); g.scale(k, k);
  for (const it of f.items) {
    switch (it.t) {
      case 'body': g.fillStyle = '#30363d'; g.strokeStyle = '#4a525b'; g.lineWidth = 1.5; g.fillRect(it.x, it.y, it.w, it.h); g.strokeRect(it.x, it.y, it.w, it.h); break;
      case 'group': g.strokeStyle = '#48515a'; g.setLineDash([3, 3]); g.strokeRect(it.x, it.y, it.w, it.h); g.setLineDash([]); break;
      case 'text': g.fillStyle = '#e8edf1'; g.font = `600 ${it.size || 12}px ${FONT}`; g.fillText(String(it.s || ''), it.x, it.y); break;
      case 'port': g.fillStyle = '#c9ced3'; g.beginPath(); g.arc(it.x, it.y, 10, 0, Math.PI * 2); g.fill(); g.fillStyle = '#23272c'; g.beginPath(); g.arc(it.x, it.y, 6, 0, Math.PI * 2); g.fill(); break;
      case 'led': g.fillStyle = '#2a2d31'; g.beginPath(); g.arc(it.x, it.y, 6, 0, Math.PI * 2); g.fill(); break;
      case 'lcd': g.fillStyle = '#0a1208'; g.fillRect(it.x, it.y, it.w, it.h); break;
      case 'btn': g.fillStyle = '#2f363e'; g.fillRect(it.x, it.y, it.w, it.h); break;
      case 'keys': g.fillStyle = '#2f363e'; for (let r = 0; r < it.rows; r++) for (let c = 0; c < it.cols; c++) g.fillRect(it.x + c * (it.w + it.gap), it.y + r * (it.h + it.gap), it.w, it.h); break;
      case 'knob': case 'joy': case 'jog': g.fillStyle = '#3a424b'; g.beginPath(); g.arc(it.x, it.y, it.r || 14, 0, Math.PI * 2); g.fill(); break;
      default: break;
    }
  }
  g.restore();
}
/** le SVG de drawFace, prêt à charger comme image (taille fixée : w × h unités) */
function faceSvg(/** @type {Face} */ f) {
  const host = document.createElement('div');
  const svg = drawFace(host, f, {}, {}, () => {}, f.label);
  svg.setAttribute('width', String(f.w)); svg.setAttribute('height', String(f.h)); svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return new XMLSerializer().serializeToString(svg);
}

/**
 * La texture d'une face : le dessin de secours tout de suite, puis le vrai dessin quand l'image SVG
 * est chargée. Un canvas intermédiaire vérifie que la copie est permise (sinon WebGL refuserait la
 * texture) : en cas de refus, le dessin de secours reste.
 * @param {Face} f @param {string} bg couleur de fond (celle du boîtier) @param {number} max largeur maximale (px)
 * @param {{ alive: boolean }} life
 */
function faceTexture(f, bg, max, life) {
  const ar = f.w / f.h;
  const cw = ar >= 1 ? max : Math.max(16, Math.round(max * ar)), ch = ar >= 1 ? Math.max(16, Math.round(max / ar)) : max;
  const c = canvas(cw, ch); const g = c.getContext('2d');
  const k = cw / f.w;
  if (g) { g.fillStyle = bg; g.fillRect(0, 0, cw, ch); quickFace(g, f, k); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  try {
    const img = new Image();
    img.onload = () => {
      if (!life.alive || !g) return;
      const tmp = canvas(cw, ch); const tg = tmp.getContext('2d'); if (!tg) return;
      tg.fillStyle = bg; tg.fillRect(0, 0, cw, ch); tg.drawImage(img, 0, 0, cw, ch);
      try { tg.getImageData(0, 0, 1, 1); } catch (e) { return; } // copie refusée : le dessin de secours reste
      g.drawImage(tmp, 0, 0); tex.needsUpdate = true;
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(faceSvg(f));
  } catch (e) { /* pas de SVG (environnement de test) : le dessin de secours reste */ }
  return tex;
}

/**
 * La fabrique des appareils : prototypes par modèle, exemplaires, état en direct.
 * @param {ReturnType<import('./kit.js').makeBin>} bin @param {string} quality
 */
export function makeDevices(bin, quality) {
  const low = quality === 'basse';
  const TEX = low ? 256 : 512;
  const life = { alive: true };
  /** @type {Map<string, Proto>} */
  const protos = new Map();
  const std = (color, roughness = 0.6, metalness = 0.2, o = {}) => bin.add(new THREE.MeshStandardMaterial({ color, roughness, metalness, ...o }));
  const G = (g) => bin.add(g);
  // matériaux partagés : voyants, tally, écrans éteints, métal
  const MAT = {
    ledOn: bin.add(new THREE.MeshBasicMaterial({ color: '#46ff7a' })), ledOff: std('#1a231d', 0.5, 0.1),
    tallyPgm: bin.add(new THREE.MeshBasicMaterial({ color: '#ff2a1f' })), tallyPvw: bin.add(new THREE.MeshBasicMaterial({ color: '#2fe060' })), tallyOff: std('#3a1c1c', 0.4, 0.1),
    lcdOn: bin.add(new THREE.MeshBasicMaterial({ map: bin.add(canvasTex(128, 64, (g, w, h) => { g.fillStyle = '#0f2a44'; g.fillRect(0, 0, w, h); g.fillStyle = '#8fd3ff'; for (let i = 0; i < 4; i++) g.fillRect(8, 8 + i * 13, 40 + ((i * 37) % 60), 5); g.fillStyle = '#ffb020'; g.fillRect(w - 30, 8, 22, 5); })) })),
    lcdOff: std('#07090b', 0.3, 0.2),
    metal: std('#3b4148', 0.45, 0.6), dark: std('#16191c', 0.6, 0.3), chrome: std('#a7aeb5', 0.3, 0.85), glass: std('#0b0f14', 0.08, 0.6),
    screenOff: std('#050608', 0.2, 0.4),
  };
  const ledG = G(new THREE.SphereGeometry(1, 10, 6));
  const box = (w, h, d) => G(new THREE.BoxGeometry(w, h, d));
  const add = (/** @type {THREE.Object3D} */ parent, /** @type {THREE.Object3D} */ o, x = 0, y = 0, z = 0) => { o.position.set(x, y, z); parent.add(o); return o; };
  const M = (g, m) => { const x = new THREE.Mesh(g, m); x.castShadow = !low; x.receiveShadow = true; return x; };

  /** pose la texture d'une face sur son plan, et les voyants / écrans LCD qu'elle dessine */
  function habille(/** @type {Proto} */ P, /** @type {string} */ face, /** @type {Face} */ f, /** @type {string} */ bg, o = {}) {
    const pl = P.plans[face]; if (!pl) return;
    for (const it of f.items) if (it.t === 'port') P.ports[it.id] = { face, x: it.x, y: it.y };
    const w = pl.fw * pl.s, h = pl.fh * pl.s;
    if (Math.min(w, h) >= 0.008) {
      const tex = bin.add(faceTexture(f, bg, TEX, life));
      const mat = std('#ffffff', 0.55, 0.15, { map: tex });
      const m = new THREE.Mesh(G(new THREE.PlaneGeometry(w, h)), mat); m.receiveShadow = true; orient(m, pl); P.group.add(m);
    }
    // les écrans LCD dessinés : un cache qui s'allume avec l'appareil (sauf l'écran du moniteur, qui a le sien)
    if (!o.noLcd) for (const it of f.items) {
      if (it.t !== 'lcd') continue;
      const lcd = new THREE.Mesh(G(new THREE.PlaneGeometry(it.w * pl.s * 0.96, it.h * pl.s * 0.9)), MAT.lcdOff); lcd.name = 'lcd';
      orient(lcd, pl, 0.0012); lcd.position.copy(pointDe(pl, it.x + it.w / 2, it.y + it.h / 2, 0.0012)); P.group.add(lcd);
    }
  }
  /** le voyant POWER : celui que dessine la face, sinon un voyant en haut à droite de la face avant */
  function voyant(/** @type {Proto} */ P, /** @type {Modele} */ m) {
    if (!needsPower(m)) return;
    let pos = null;
    for (const [face, f] of Object.entries(m.faces || {})) {
      const pl = P.plans[face]; if (!pl) continue;
      const it = f.items.find((x) => x.t === 'led' && /pow|pwr|^led$/i.test(String(x.id)));
      if (it) { pos = pointDe(pl, it.x, it.y, 0.0015); break; }
    }
    if (!pos) { const pl = P.plans.avant || P.plans.arriere; if (!pl) return; pos = pl.c.clone().addScaledVector(pl.r, pl.w / 2 - 0.012).addScaledVector(pl.d, -pl.h / 2 + 0.008).addScaledVector(pl.n, 0.0015); }
    const led = new THREE.Mesh(ledG, MAT.ledOff); led.name = 'led'; led.scale.setScalar(0.004); led.position.copy(pos); P.group.add(led);
  }

  // ---------------- les formes, par pose et par famille ----------------
  /** un appareil de baie : face 19" (pleine largeur) ou appareil posé sur une tablette 1 U */
  function rackShape(/** @type {Proto} */ P, /** @type {Modele} */ m) {
    const b = m.boite || { w: 0.44, h: 0.044, d: 0.25 }; const col = b.couleur || BG;
    const h = (m.u || 1) * U - 0.0015; const d = Math.max(0.08, b.d);
    const full = !(m.largeur && m.largeur < 1);
    const body = std(col, 0.55, 0.35);
    if (full) {
      add(P.group, M(box(RACK19, h, 0.003), body), 0, h / 2, -0.0015);
      const bw = Math.min(0.44, b.w || 0.44);
      add(P.group, M(box(bw, h - 0.002, d), body), 0, h / 2, -0.003 - d / 2);
      for (const sx of [-1, 1]) add(P.group, M(G(new THREE.CylinderGeometry(0.0035, 0.0035, 0.002, 8)), MAT.chrome), sx * (RACK19 / 2 - 0.008), h / 2, 0.001).rotation.x = Math.PI / 2;
      const fa = m.faces && m.faces.avant, fr = m.faces && m.faces.arriere;
      if (fa) { P.plans.avant = plan([0, h / 2, 0], [1, 0, 0], [0, -1, 0], RACK19 - 0.03, h, fa); habille(P, 'avant', fa, col); }
      if (fr) { P.plans.arriere = plan([0, h / 2, -0.003 - d], [-1, 0, 0], [0, -1, 0], bw, h - 0.002, fr); habille(P, 'arriere', fr, col); }
      P.pin.set(RACK19 / 2 - 0.02, h / 2, 0.01);
    } else {
      // la tablette : oreilles et fond ; l'appareil posé dessus, au centre, la face au ras des oreilles
      const shelf = MAT.metal;
      add(P.group, M(box(0.44, 0.003, 0.3), shelf), 0, 0.0015, -0.153);
      for (const sx of [-1, 1]) add(P.group, M(box(0.021, U - 0.0015, 0.003), shelf), sx * (RACK19 / 2 - 0.0105), (U - 0.0015) / 2, -0.0015);
      add(P.group, M(box(0.44, 0.008, 0.002), shelf), 0, 0.004, -0.001);
      const hh = h - 0.004;
      add(P.group, M(box(b.w, hh, d), body), 0, 0.003 + hh / 2, -d / 2);
      const fa = m.faces && m.faces.avant, fr = m.faces && m.faces.arriere;
      if (fa) { P.plans.avant = plan([0, 0.003 + hh / 2, 0], [1, 0, 0], [0, -1, 0], b.w, hh, fa); habille(P, 'avant', fa, col); }
      if (fr) { P.plans.arriere = plan([0, 0.003 + hh / 2, -d], [-1, 0, 0], [0, -1, 0], b.w, hh, fr); habille(P, 'arriere', fr, col); }
      P.pin.set(b.w / 2 + 0.01, h / 2, 0.01);
    }
  }
  /** un pupitre (mélangeur, télécommande) : un coin, le dessus incliné porte les commandes */
  function consoleShape(/** @type {Proto} */ P, /** @type {Modele} */ m) {
    const b = m.boite || { w: 0.4, h: 0.12, d: 0.3 }; const col = b.couleur || BG;
    const hb = b.h, hf = Math.max(0.03, b.h * 0.32), d = b.d, w = b.w;
    const sh = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(d / 2, hf), new THREE.Vector2(-d / 2, hb)]);
    const g = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false }); g.translate(0, 0, -w / 2); g.rotateY(-Math.PI / 2);
    add(P.group, M(G(g), std(col, 0.55, 0.3)), 0, 0, 0);
    const L = Math.hypot(d, hb - hf);
    const fa = m.faces && m.faces.avant, fr = m.faces && m.faces.arriere;
    if (fa) { P.plans.avant = plan([0, (hb + hf) / 2, 0], [1, 0, 0], [0, hf - hb, d], w - 0.02, L - 0.02, fa); habille(P, 'avant', fa, col); }
    if (fr) { P.plans.arriere = plan([0, hb / 2, -d / 2], [-1, 0, 0], [0, -1, 0], w, hb, fr); habille(P, 'arriere', fr, col); }
    P.pin.set(0, hb + 0.04, -d / 4);
  }
  /** un boîtier posé sur la table : face avant vers l'opérateur, connecteurs derrière */
  function boxShape(/** @type {Proto} */ P, /** @type {Modele} */ m) {
    const b = m.boite || { w: 0.2, h: 0.05, d: 0.15 }; const col = b.couleur || BG;
    const h = Math.max(0.003, b.h);
    add(P.group, M(box(b.w, h, b.d), std(col, 0.55, 0.25)), 0, h / 2, 0);
    const fa = m.faces && m.faces.avant, fr = m.faces && m.faces.arriere;
    if (fa) { P.plans.avant = plan([0, h / 2, b.d / 2], [1, 0, 0], [0, -1, 0], b.w, h, fa); habille(P, 'avant', fa, col); }
    if (fr) { P.plans.arriere = plan([0, h / 2, -b.d / 2], [-1, 0, 0], [0, -1, 0], b.w, h, fr); habille(P, 'arriere', fr, col); }
    P.pin.set(0, h + 0.03, 0);
  }
  /** le moniteur : pied, dalle, écran (allumé par l'état), connecteurs au dos */
  function monitorShape(/** @type {Proto} */ P, /** @type {Modele} */ m) {
    const b = m.boite || { w: 0.5, h: 0.32, d: 0.05 }; const col = b.couleur || '#101214';
    const y0 = 0.1, cy = y0 + b.h / 2;
    add(P.group, M(box(0.24, 0.012, 0.17), MAT.dark), 0, 0.006, -0.01);
    add(P.group, M(box(0.05, y0 + 0.06, 0.025), MAT.dark), 0, (y0 + 0.06) / 2, -0.04);
    add(P.group, M(box(b.w, b.h, b.d), std(col, 0.5, 0.3)), 0, cy, 0);
    const fa = m.faces && m.faces.avant, fr = m.faces && m.faces.arriere;
    if (fa) {
      P.plans.avant = plan([0, cy, b.d / 2], [1, 0, 0], [0, -1, 0], b.w, b.h, fa); habille(P, 'avant', fa, col, { noLcd: true });
      const lcd = fa.items.find((it) => it.t === 'lcd');
      const pl = P.plans.avant; const sw = lcd ? lcd.w * pl.s : b.w * 0.92, sh = lcd ? lcd.h * pl.s : b.h * 0.8;
      const scr = new THREE.Mesh(G(new THREE.PlaneGeometry(sw, sh)), MAT.screenOff); scr.name = 'screen';
      orient(scr, pl, 0.0015); if (lcd) scr.position.copy(pointDe(pl, lcd.x + lcd.w / 2, lcd.y + lcd.h / 2, 0.0015)); P.group.add(scr);
    }
    if (fr) { P.plans.arriere = plan([0, cy, -b.d / 2], [-1, 0, 0], [0, -1, 0], b.w * 0.9, b.h * 0.6, fr); habille(P, 'arriere', fr, col); }
    P.pin.set(0, y0 + b.h + 0.04, 0);
  }
  /** le micro sur son pied de table : la prise XLR est à la queue du micro */
  function microShape(/** @type {Proto} */ P, /** @type {Modele} */ m) {
    add(P.group, M(G(new THREE.CylinderGeometry(0.055, 0.06, 0.012, 16)), MAT.dark), 0, 0.006, 0);
    add(P.group, M(G(new THREE.CylinderGeometry(0.006, 0.006, 0.15, 8)), MAT.chrome), 0, 0.085, 0);
    const mic = new THREE.Group(); mic.position.set(0, 0.16, 0); mic.rotation.x = -0.35; P.group.add(mic);
    const body = M(G(new THREE.CylinderGeometry(0.022, 0.016, 0.15, 14)), std('#2a2d31', 0.5, 0.4)); body.rotation.x = Math.PI / 2; mic.add(body);
    add(mic, M(G(new THREE.SphereGeometry(0.03, 14, 10)), std('#9aa1a8', 0.4, 0.7, { wireframe: false })), 0, 0, 0.09);
    mic.updateMatrix();
    const f = m.faces && m.faces.avant;
    if (f) {
      // la queue du micro, vue de derrière : un petit plan sur lequel tombe la prise XLR du dessin
      const tail = new THREE.Vector3(0, 0, -0.077).applyMatrix4(mic.matrix);
      const r = new THREE.Vector3(-1, 0, 0), d = new THREE.Vector3(0, -1, 0).applyQuaternion(mic.quaternion);
      P.plans.avant = plan([tail.x, tail.y, tail.z], [r.x, r.y, r.z], [d.x, d.y, d.z], 0.03, 0.03, f);
      for (const it of f.items) if (it.t === 'port') P.ports[it.id] = { face: 'avant', x: f.w / 2, y: f.h / 2 };
    }
    P.pin.set(0, 0.24, 0);
  }
  /** colonne et trépied (le pied de caméra, et la colonne sous chaque caméra du plateau) */
  function tripod(/** @type {THREE.Object3D} */ g, top = 1.42) {
    const legG = G(new THREE.CylinderGeometry(0.009, 0.007, 0.82, 6));
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3 + 0.3; const l = M(legG, MAT.chrome); l.receiveShadow = false; l.position.set(Math.sin(a) * 0.2, 0.36, Math.cos(a) * 0.2); l.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5); g.add(l); }
    add(g, M(G(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 10)), MAT.metal), 0, 0.74, 0);
    add(g, M(G(new THREE.CylinderGeometry(0.018, 0.018, top - 0.74, 10)), MAT.chrome), 0, (top + 0.74) / 2, 0);
    add(g, M(box(0.14, 0.014, 0.14), MAT.metal), 0, top + 0.007, 0);
  }
  /** une caméra PTZ sur sa colonne : embase (connecteurs derrière), fourche, tête et objectif, tally */
  function cameraShape(/** @type {Proto} */ P, /** @type {Modele} */ m) {
    const b = m.boite || { w: 0.18, h: 0.2, d: 0.18 }; const col = b.couleur || '#2a2d31';
    const y0 = 1.44; tripod(P.group, y0 - 0.016);
    const body = std(col, 0.45, 0.35), bh = 0.058;
    add(P.group, M(box(b.w, bh, b.d), body), 0, y0 + bh / 2, 0);
    add(P.group, M(G(new THREE.CylinderGeometry(b.w * 0.36, b.w * 0.4, 0.02, 18)), body), 0, y0 + bh + 0.01, 0);
    const hw = b.w * 0.6, hh = b.h - bh - 0.04, hd = b.d * 0.9, hy = y0 + bh + 0.02 + hh / 2 + 0.01;
    for (const sx of [-1, 1]) add(P.group, M(box(0.016, hh + 0.02, b.d * 0.42), body), sx * (hw / 2 + 0.011), hy - 0.005, 0);
    add(P.group, M(box(hw, hh, hd), body), 0, hy, 0);
    const lens = M(G(new THREE.CylinderGeometry(hh * 0.36, hh * 0.4, 0.04, 20)), MAT.dark); lens.rotation.x = Math.PI / 2; add(P.group, lens, 0, hy - hh * 0.05, hd / 2 + 0.02);
    const glass = M(G(new THREE.CircleGeometry(hh * 0.3, 20)), MAT.glass); add(P.group, glass, 0, hy - hh * 0.05, hd / 2 + 0.0405);
    // le tally : un voyant en façade au-dessus de l'objectif, et un sur le dessus de la tête (visible de loin)
    const t1 = new THREE.Mesh(box(0.022, 0.008, 0.004), MAT.tallyOff); t1.name = 'tally'; add(P.group, t1, 0, hy + hh * 0.38, hd / 2 + 0.002);
    const t2 = new THREE.Mesh(box(0.03, 0.006, 0.02), MAT.tallyOff); t2.name = 'tally'; add(P.group, t2, 0, hy + hh / 2 + 0.003, hd / 2 - 0.02);
    const fr = m.faces && m.faces.arriere;
    if (fr) { P.plans.arriere = plan([0, y0 + bh / 2, -b.d / 2], [-1, 0, 0], [0, -1, 0], b.w, bh, fr); habille(P, 'arriere', fr, col); }
    P.pin.set(0, y0 + b.h + 0.05, 0);
  }
  /** le tableau électrique : le coffret des prises, au mur */
  function murShape(/** @type {Proto} */ P, /** @type {Modele} */ m) {
    const b = m.boite || { w: 0.4, h: 0.3, d: 0.05 }; const col = b.couleur || '#dfe3e6';
    add(P.group, M(box(b.w, b.h, b.d), std(col, 0.5, 0.1)), 0, 0, b.d / 2);
    const fa = m.faces && m.faces.avant;
    if (fa) { P.plans.avant = plan([0, 0, b.d], [1, 0, 0], [0, -1, 0], b.w, b.h, fa); habille(P, 'avant', fa, col); }
    P.pin.set(b.w / 2 + 0.03, b.h / 2, b.d);
  }

  /** le prototype d'un modèle (construit une fois) */
  function proto(/** @type {Modele} */ m) {
    let P = protos.get(m.id); if (P) return P;
    P = /** @type {Proto} */ ({ group: new THREE.Group(), plans: {}, ports: {}, pin: new THREE.Vector3(), box: new THREE.Box3() });
    if (m.pose === 'rack') rackShape(P, m);
    else if (m.pose === 'mur') murShape(P, m);
    else if (m.pose === 'plateau') { if (m.famille === 'camera') cameraShape(P, m); else { tripod(P.group); P.pin.set(0, 1.5, 0); } }
    else if (m.famille === 'moniteur') monitorShape(P, m);
    else if (m.famille === 'son') microShape(P, m);
    else if (isConsole(m.faces && m.faces.avant)) consoleShape(P, m);
    else boxShape(P, m);
    voyant(P, m);
    P.group.updateMatrixWorld(true);
    P.box.setFromObject(P.group);
    protos.set(m.id, P);
    return P;
  }

  /**
   * Un exemplaire : le clone du prototype, avec ses voyants, son tally, son écran.
   * @param {Appareil} a @param {Modele} m
   */
  function instance(a, m) {
    const P = proto(m);
    const group = P.group.clone(true); group.userData.uid = a.uid;
    /** @type {THREE.Mesh[]} */ const leds = [], lcds = [], tallies = [];
    /** @type {THREE.Mesh | null} */ let screen = null;
    group.traverse((o) => { const x = /** @type {THREE.Mesh} */ (o); if (!x.isMesh) return; if (x.name === 'led') leds.push(x); else if (x.name === 'lcd') lcds.push(x); else if (x.name === 'tally') tallies.push(x); else if (x.name === 'screen') screen = x; });
    /** @type {{ canvas: HTMLCanvasElement, tex: THREE.CanvasTexture, mat: THREE.MeshBasicMaterial, label: string } | null} */
    let scr = null;
    if (screen) {
      const c = canvas(low ? 160 : 320, low ? 90 : 180);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshBasicMaterial({ map: tex });
      scr = { canvas: c, tex, mat, label: '\u0000' };
    }
    return { uid: a.uid, group, proto: P, leds, lcds, tallies, screen: /** @type {THREE.Mesh | null} */ (screen), scr, on: null };
  }
  /** libère ce qui appartient à un exemplaire (la texture et le matériau de son écran) */
  function release(/** @type {ReturnType<typeof instance>} */ I) { if (I.scr) { I.scr.tex.dispose(); I.scr.mat.dispose(); } }

  /** ce qu'affiche l'écran d'un moniteur : une image de synthèse, son étiquette, le format */
  function paintScreen(/** @type {HTMLCanvasElement} */ c, /** @type {import('../types.js').Flux | null} */ f, /** @type {string} */ entree) {
    const g = c.getContext('2d'); if (!g) return; const w = c.width, h = c.height; const k = w / 320;
    const tag = (txt, x, y, bg) => { g.font = `700 ${14 * k}px ${FONT}`; const tw = g.measureText(txt).width + 10 * k; g.fillStyle = bg; g.fillRect(x, y, tw, 18 * k); g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(txt, x + 5 * k, y + 9.5 * k); return tw; };
    const picture = (x, y, pw, ph) => {
      const gr = g.createLinearGradient(0, y, 0, y + ph); gr.addColorStop(0, '#1d3c6e'); gr.addColorStop(0.62, '#0f2147'); gr.addColorStop(0.63, '#3a2b20'); gr.addColorStop(1, '#22180f'); g.fillStyle = gr; g.fillRect(x, y, pw, ph);
      g.fillStyle = '#6b4b2e'; g.fillRect(x + pw * 0.55, y + ph * 0.42, pw * 0.12, ph * 0.3);
      g.fillStyle = '#e9d2b5'; g.beginPath(); g.arc(x + pw * 0.61, y + ph * 0.3, ph * 0.07, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1a1d22'; g.fillRect(x + pw * 0.56, y + ph * 0.36, pw * 0.1, ph * 0.08);
    };
    g.fillStyle = '#04060a'; g.fillRect(0, 0, w, h);
    if (!f) {
      g.fillStyle = '#5d6872'; g.font = `600 ${18 * k}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('PAS DE SIGNAL', w / 2, h / 2 - 8 * k); g.font = `500 ${13 * k}px ${FONT}`; g.fillText(entree.toUpperCase(), w / 2, h / 2 + 14 * k); g.textAlign = 'left';
      return;
    }
    const lab = String(f.label || '');
    if (/multiview/i.test(lab)) {
      g.fillStyle = '#0b0d10'; g.fillRect(0, 0, w, h);
      const big = (x, label, col) => { picture(x + 3 * k, 3 * k, w / 2 - 6 * k, h / 2 - 6 * k); g.strokeStyle = col; g.lineWidth = 3 * k; g.strokeRect(x + 3 * k, 3 * k, w / 2 - 6 * k, h / 2 - 6 * k); tag(label, x + 6 * k, h / 2 - 24 * k, 'rgba(0,0,0,0.65)'); };
      big(0, 'PVW', '#2fe060'); big(w / 2, 'PGM', '#ff2a1f');
      for (let i = 0; i < 8; i++) { const cx = (i % 4) * (w / 4), cy = h / 2 + Math.floor(i / 4) * (h / 4); picture(cx + 2 * k, cy + 2 * k, w / 4 - 4 * k, h / 4 - 4 * k); g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(cx + 2 * k, cy + h / 4 - 15 * k, w / 4 - 4 * k, 13 * k); g.fillStyle = '#dfe5ea'; g.font = `600 ${10 * k}px ${FONT}`; g.textBaseline = 'middle'; g.fillText(String(i + 1), cx + 6 * k, cy + h / 4 - 8.5 * k); }
    } else if (/noir/i.test(lab)) {
      tag(lab, 8 * k, 8 * k, 'rgba(255,42,31,0.75)');
    } else if (/vmix/i.test(lab)) {
      g.fillStyle = '#1f2328'; g.fillRect(0, 0, w, h); picture(w * 0.52, 8 * k, w * 0.45, h * 0.45); picture(w * 0.03, 8 * k, w * 0.45, h * 0.45);
      g.strokeStyle = '#ff2a1f'; g.lineWidth = 2 * k; g.strokeRect(w * 0.52, 8 * k, w * 0.45, h * 0.45);
      for (let i = 0; i < 4; i++) picture(w * 0.03 + i * w * 0.24, h * 0.58, w * 0.22, h * 0.3);
    } else {
      picture(0, 0, w, h);
      const col = /^PGM/.test(lab) ? 'rgba(220,30,20,0.85)' : /^PVW/.test(lab) ? 'rgba(30,160,70,0.85)' : 'rgba(0,0,0,0.7)';
      tag(lab, 8 * k, h - 26 * k, col);
    }
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.font = `500 ${11 * k}px ${FONT}`; const ft = String(f.format || ''); const fw = g.measureText(ft).width; g.fillRect(w - fw - 14 * k, 6 * k, fw + 8 * k, 16 * k); g.fillStyle = '#cfd6dc'; g.textBaseline = 'middle'; g.fillText(ft, w - fw - 10 * k, 14.5 * k);
  }

  /**
   * L'état en direct d'un exemplaire : voyant POWER, écrans LCD, tally, écran du moniteur.
   * @param {ReturnType<typeof instance>} I @param {Appareil} a @param {Eval} E
   */
  function state(I, a, E) {
    const on = !!(E.power[a.uid] && E.power[a.uid].on);
    for (const l of I.leds) l.material = on ? MAT.ledOn : MAT.ledOff;
    for (const l of I.lcds) l.material = on ? MAT.lcdOn : MAT.lcdOff;
    const t = E.tally[a.uid];
    for (const x of I.tallies) x.material = t && t.pgm ? MAT.tallyPgm : t && t.pvw ? MAT.tallyPvw : MAT.tallyOff;
    if (I.screen && I.scr) {
      // l'entrée regardée : celle choisie (cfg.entree : hdmi / sdi), sinon la première qui reçoit
      const pref = a.cfg && typeof a.cfg.entree === 'string' ? a.cfg.entree : '';
      const ins = Object.keys(E.video).filter((k) => k.startsWith(a.uid + ':'));
      const k = (pref && ins.find((x) => x.endsWith(':' + pref + '-in'))) || ins.find((x) => E.video[x]) || ins[0] || '';
      const f = k ? E.video[k] : null;
      const label = !on ? '' : JSON.stringify([f && f.label, f && f.format, k]);
      if (!on) I.screen.material = MAT.screenOff;
      else {
        if (label !== I.scr.label) { paintScreen(I.scr.canvas, f || null, k ? k.split(':').pop() || '' : ''); I.scr.tex.needsUpdate = true; }
        I.screen.material = I.scr.mat;
      }
      I.scr.label = label;
    }
  }

  /**
   * Où est un connecteur, en coordonnées locales de l'appareil : le point de la face, la normale
   * sortante ; repli : le centre de la face arrière (ou avant).
   * @returns {{ p: THREE.Vector3, n: THREE.Vector3 }}
   */
  function portLocal(/** @type {Proto} */ P, /** @type {string} */ port) {
    const at = P.ports[port]; const pl = at ? P.plans[at.face] : null;
    if (at && pl) return { p: pointDe(pl, at.x, at.y, 0.004), n: pl.n.clone() };
    const fb = P.plans.arriere || P.plans.avant;
    if (fb) return { p: fb.c.clone().addScaledVector(fb.n, 0.004), n: fb.n.clone() };
    const c = P.box.getCenter(new THREE.Vector3()); return { p: c, n: new THREE.Vector3(0, 0, -1) };
  }

  return {
    proto, instance, state, release, portLocal, MAT,
    dispose() { life.alive = false; protos.clear(); },
  };
}

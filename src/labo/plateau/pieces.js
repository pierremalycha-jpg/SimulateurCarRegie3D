// @ts-check
import * as THREE from 'three';
import { Builder } from '../../geo.js';
import { matiere, MATIERE } from '../../matiere.js';
import { S } from '../../state.js';
import { RADIANCE_TRAVAIL } from './calc.js';

// ----------------------------------------------------------------------------------
// Les pièces du plateau 3D du Labo (v19.30), en low-poly polygonal : des formes à facettes (prismes à
// six ou huit faces, cônes, icosaèdres pour les têtes, les mains et les feuillages), les arêtes franches,
// les surfaces organiques légèrement froissées (chaque sommet décalé d'un bruit déterministe, les facettes
// cessent d'être régulières), le tout fusionné par un Builder en mode ao (occlusion cuite dans les couleurs
// par sommet) et lu à plat (flatShading : chaque facette a sa teinte, dans le style « dessin » du
// simulateur). Pas de relief procédural : une matière de matiere() dont le relief est coupé (il lisserait
// les facettes). Le sol et le cyclo (sa courbe du pied en quatre pans), les sujets (tronc en prisme, tête en
// icosaèdre, pancarte lettrée dessinée dans un canevas), la caméra sur son pied, les projecteurs sur leur pied
// (tête octogonale orientable, lentille qui s'allume, vrai projecteur du rendu et cône de lumière), une plante
// et des caisses pour l'échelle, les lampes du fond (qui deviennent des disques dans le flou), les lumières
// de travail, et les repères posés au sol (champ, zone nette, traits, ligne d'axe, anneau). Tout ce qui n'est
// qu'un repère vit sur la couche 1 : la caméra du plateau le voit, l'image de la caméra non.
// ----------------------------------------------------------------------------------
/** la couche des repères (vus de haut seulement) */
export const COUCHE_REPERES = 1;
export const COUL = {
  sol: 0x9aa1ab, bord: 0x4f5864, cyclo: 0xe2e5ea, pied: 0x3b424c, corps: 0x262b33, metal: 0x8a919b, peau: 0xe7b394, cheveux: 0x3a2a22,
  pantalon: 0x2f3640, chaussure: 0x1e2229, fresnel: 0x30363f, hmi: 0x4b5563, led: 0x2c3138, lentille: 0x1b1f26, caisse: 0x8a6a46, cellule: 0xf2f3ee,
  pot: 0xb8714a, terre: 0x3b2f27, feuille: 0x3f9a5a, feuille2: 0x2f7d47, tige: 0x4a3b2a,
};

/** une matière plate : celle de matiere(), sans son relief (le low-poly se lit à plat), lue en flatShading */
export function matPlate(o = {}) {
  const m = matiere('plastique', { color: 0xffffff, vertexColors: true, roughness: 0.88, ...o });
  // sortie de la liste des reliefs : un changement de qualité ne lui en remet pas
  m.userData.detailOn = false; MATIERE.all.delete(m);
  m.flatShading = true; m.needsUpdate = true;
  return m;
}
let MAT = null;
/** la matière commune des pièces (couleurs par sommet) */
export const matPieces = () => MAT || (MAT = matPlate());
/**
 * une pièce : un Builder en mode ao, une seule matière
 * @param {string} nom @param {(b: Builder) => void} remplir @param {{ ao?: number, mat?: THREE.Material, ombre?: boolean }} [o]
 */
export function piece(nom, remplir, o = {}) {
  const b = new Builder({ ao: o.ao ?? 0.05, small: 0.12 });
  remplir(b);
  const m = new THREE.Mesh(b.build(), o.mat || matPieces());
  m.name = nom; m.castShadow = o.ombre !== false; m.receiveShadow = true;
  return m;
}
const ombres = () => S.quality !== 'basse' && !S.lite;

// ---------------- les formes à facettes ----------------
const mat4 = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
/**
 * pose une forme dans un Builder : position, rotation (rad), échelle ; occ : la boîte occultante (w, h, d) pour l'occlusion cuite
 * @param {Builder} b @param {THREE.BufferGeometry} geo
 */
function forme(b, geo, x, y, z, color, o = {}) {
  const r = o.rot || [0, 0, 0], e = o.ech || [1, 1, 1];
  const m = mat4(x, y, z, r[0], r[1], r[2], e[0], e[1], e[2]);
  const bi = o.occ ? b.occlude(o.occ[0], o.occ[1], o.occ[2], m) : -1;
  b.add(geo, m, color, bi, !!o.menu);
  return b;
}
/** une boîte franche (arêtes vives) */
const boite = (b, w, h, d, x, y, z, color, o = {}) => forme(b, new THREE.BoxGeometry(w, h, d), x, y, z, color, { occ: [w, h, d], ...o });
/** un prisme (cylindre à peu de faces) debout : rt en haut, rb en bas, h de haut ; seg faces */
const prisme = (b, rt, rb, h, x, y, z, color, seg = 6, o = {}) => forme(b, new THREE.CylinderGeometry(rt, rb, h, seg), x, y, z, color, { occ: [Math.max(rt, rb) * 2, h, Math.max(rt, rb) * 2], ...o });
/** un cône (pointe en haut) */
const cone = (b, r, h, x, y, z, color, seg = 5, o = {}) => forme(b, new THREE.ConeGeometry(r, h, seg), x, y, z, color, o);
/** un icosaèdre (une boule à facettes), froissé ou non */
const boule = (b, r, x, y, z, color, o = {}) => forme(b, froisse(new THREE.IcosahedronGeometry(r, o.detail ?? 1), o.froisse ?? 0, o.graine ?? 1), x, y, z, color, o);
/** le bruit déterministe d'un sommet, par sa position (deux sommets au même endroit bougent ensemble : les facettes restent jointes) */
function bruit(x, y, z, k, graine) {
  const s = Math.sin(Math.round(x * 1e4) * 12.9898 + Math.round(y * 1e4) * 78.233 + Math.round(z * 1e4) * 37.719 + k * 9.17 + graine * 101.3) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}
/** froisse une géométrie : chaque sommet décalé d'un bruit (amplitude amp, en unités de la géométrie) ; les facettes deviennent irrégulières */
export function froisse(geo, amp, graine = 1) {
  if (!amp) return geo;
  const p = /** @type {THREE.BufferAttribute} */ (geo.attributes.position);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    p.setXYZ(i, x + bruit(x, y, z, 0, graine) * amp, y + bruit(x, y, z, 1, graine) * amp, z + bruit(x, y, z, 2, graine) * amp);
  }
  p.needsUpdate = true; geo.computeVertexNormals();
  return geo;
}

// ---------------- le décor ----------------
/** le sol du plateau : une dalle claire, son bord sombre ; w × d mètres, centrée en (cx, cz), le dessus à y = 0 */
export const sol = (w, d, cx, cz) => piece('sol', (b) => { boite(b, w, 0.12, d, cx, -0.06, cz, COUL.sol); boite(b, w + 0.5, 0.08, d + 0.5, cx, -0.1, cz, COUL.bord); }, { ao: 0.5, ombre: false });
/** le cyclo : un mur clair au fond (en z), son pied courbe en quatre pans, deux retours */
export const cyclo = (w, h, z, cx = 0) => piece('cyclo', (b) => {
  const R = 1.4, n = 4;
  boite(b, w, h, 0.3, cx, h / 2 + R, z + 0.15, COUL.cyclo); boite(b, w, R, 0.3, cx, R / 2, z + 0.15, COUL.cyclo);
  // le pied courbe : des pans de la dalle au mur, tournés vers le plateau
  const pts = []; for (let i = 0; i <= n; i++) { const a = i / n * Math.PI / 2; pts.push([R - R * Math.cos(a), z - R + R * Math.sin(a)]); }
  const pos = []; const x0 = cx - w / 2, x1 = cx + w / 2;
  for (let i = 0; i < n; i++) { const [ya, za] = pts[i], [yb, zb] = pts[i + 1]; pos.push(x0, ya, za, x0, yb, zb, x1, yb, zb, x0, ya, za, x1, yb, zb, x1, ya, za); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); g.computeVertexNormals();
  forme(b, g, 0, 0, 0, COUL.cyclo);
  for (const s of [-1, 1]) boite(b, 0.3, h + R, 3, cx + s * (w / 2 - 0.15), (h + R) / 2, z - 1.35, COUL.cyclo);
}, { ao: 0.4 });
/** des lampes sur le fond : des boules à facettes qui éclairent par elles-mêmes (dans le flou, des disques) */
export function lampes(n, w, y, z, cx = 0) {
  const mat = matPlate({ vertexColors: false, color: 0x7a6a4a, emissive: 0xffe2a4, emissiveIntensity: RADIANCE_TRAVAIL * 1.6, roughness: 0.5 });
  return piece('lampes', (b) => { for (let i = 0; i < n; i++) { const x = cx + (i - (n - 1) / 2) * (w / n), yy = y + (i % 2) * 0.5; boule(b, 0.09, x, yy, z - 0.24, 0xffffff, { detail: 1 }); prisme(b, 0.015, 0.015, 0.24, x, yy, z - 0.12, 0x333333, 5, { rot: [Math.PI / 2, 0, 0] }); } }, { mat, ombre: false });
}
/** une caisse de plateau (une malle à coins), posée au sol */
export const caisse = (x, z, rot = 0) => piece('caisse', (b) => { boite(b, 0.56, 0.36, 0.4, x, 0.18, z, COUL.caisse, { rot: [0, rot, 0] }); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) boite(b, 0.08, 0.38, 0.08, x + Math.cos(rot) * sx * 0.25 - Math.sin(rot) * sz * 0.17, 0.19, z + Math.sin(rot) * sx * 0.25 + Math.cos(rot) * sz * 0.17, COUL.metal, { rot: [0, rot, 0], menu: true }); });
/** une plante en pot : le motif du low-poly (pot en prisme, feuillage en icosaèdres froissés) */
export const plante = (x, z, graine = 1) => piece('plante', (b) => {
  prisme(b, 0.19, 0.14, 0.34, x, 0.17, z, COUL.pot, 7); prisme(b, 0.17, 0.17, 0.02, x, 0.35, z, COUL.terre, 7);
  prisme(b, 0.015, 0.025, 0.5, x, 0.58, z, COUL.tige, 5);
  boule(b, 0.3, x, 0.98, z, COUL.feuille, { froisse: 0.05, graine, detail: 1 });
  boule(b, 0.22, x + 0.2, 0.78, z - 0.12, COUL.feuille2, { froisse: 0.04, graine: graine + 1, detail: 1 });
  boule(b, 0.2, x - 0.18, 0.82, z + 0.14, COUL.feuille2, { froisse: 0.04, graine: graine + 2, detail: 1 });
});
/**
 * les lumières de travail du plateau, en unités physiques (lx) : un ciel doux et une clé qui porte les ombres,
 * posées sur une couche (0 : vues par toutes les caméras ; 1 : par la vue de haut seulement)
 */
export function lumieresTravail(couche, ciel = 170, cle = 250) {
  const g = new THREE.Group(); g.name = 'lumières de travail';
  const h = new THREE.HemisphereLight(0xd4dbe6, 0x4a5058, ciel); h.layers.set(couche);
  const k = new THREE.DirectionalLight(0xfff3e2, cle); k.position.set(-9, 16, -7); k.layers.set(couche);
  k.castShadow = ombres(); const r = S.quality === 'haute' ? 2048 : 1024; k.shadow.mapSize.set(r, r);
  Object.assign(k.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 60 }); k.shadow.bias = -0.0005; k.shadow.normalBias = 0.03;
  g.add(h, k, k.target);
  return g;
}

// ---------------- les gens ----------------
/** un sujet debout, l'avant en +z (le nez le dit) ; couleur : son haut. Tronc et jambes en prismes, tête et mains en icosaèdres froissés */
export function personnage(couleur, graine = 1) {
  const g = new THREE.Group(); g.name = 'personnage';
  const corps = piece('corps', (b) => {
    for (const s of [-1, 1]) {
      cone(b, 0.085, 0.3, s * 0.1, 0.045, 0.06, COUL.chaussure, 5, { rot: [Math.PI / 2, 0, 0] });
      prisme(b, 0.085, 0.06, 0.82, s * 0.1, 0.46, 0, COUL.pantalon, 6);
      boule(b, 0.085, s * 0.25, 1.45, 0, couleur, { froisse: 0.006, graine: graine + 3 });
      prisme(b, 0.055, 0.045, 0.52, s * 0.3, 1.17, 0, couleur, 5);
      boule(b, 0.055, s * 0.3, 0.88, 0, COUL.peau, { froisse: 0.005, graine: graine + 4 });
    }
    prisme(b, 0.2, 0.17, 0.2, 0, 0.95, 0, COUL.pantalon, 6);
    prisme(b, 0.23, 0.17, 0.5, 0, 1.28, 0, couleur, 6, { occ: [0.46, 0.5, 0.4] });
    prisme(b, 0.06, 0.07, 0.12, 0, 1.56, 0, COUL.peau, 6);
    forme(b, froisse(new THREE.IcosahedronGeometry(0.13, 1), 0.006, graine), 0, 1.72, 0, COUL.peau, { ech: [1, 1.12, 1], occ: [0.26, 0.3, 0.26] });
    forme(b, froisse(new THREE.SphereGeometry(0.135, 7, 4, 0, Math.PI * 2, 0, Math.PI * 0.55), 0.006, graine + 1), 0, 1.75, -0.015, COUL.cheveux, { ech: [1, 1.1, 1] });
    cone(b, 0.022, 0.05, 0, 1.7, 0.145, COUL.peau, 4, { rot: [Math.PI / 2, 0, 0], menu: true });
  });
  g.add(corps); g.userData.corps = corps;
  return g;
}
/**
 * une pancarte tenue devant soi : la lettre du sujet sur sa couleur, et une mire de traits fins (la netteté se juge là)
 * @param {string} lettre @param {string} couleur (#rrggbb) @param {string} police
 */
export function pancarte(lettre, couleur, police) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 184;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  g.fillStyle = couleur; g.beginPath(); if (typeof g.roundRect === 'function') g.roundRect(0, 0, 256, 184, 22); else g.rect(0, 0, 256, 184); g.fill();
  g.fillStyle = '#0c0e13'; g.font = `700 150px ${police}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(lettre, 96, 98);
  g.fillStyle = '#0c0e13';
  for (let i = 0; i < 9; i++) g.fillRect(182, 36 + i * 8, 50, 2);
  for (let i = 0; i < 7; i++) g.fillRect(182 + i * 8, 116, 2, 36);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.36), matPlate({ vertexColors: false, map: t, roughness: 0.95 }));
  m.name = 'pancarte ' + lettre; m.position.set(0, 1.1, 0.215); m.castShadow = true;
  return m;
}
/** la cellule d'un luxmètre, posée sur la poitrine, tournée vers l'avant */
export const luxmetre = () => piece('luxmètre', (b) => { boite(b, 0.1, 0.14, 0.03, 0, 1.38, 0.2, COUL.corps); boule(b, 0.03, 0, 1.42, 0.215, COUL.cellule, { detail: 1 }); }, { ao: 0.03 });

// ---------------- la caméra ----------------
/** une caméra d'épaule sur pied, l'objectif vers +z ; corps (ce qu'on prend pour la déplacer) et œil (où l'image se forme) */
export function camera3d() {
  const g = new THREE.Group(); g.name = 'caméra';
  const pied = piece('pied de caméra', (b) => {
    for (let i = 0; i < 3; i++) { const a = Math.PI / 2 + i * 2 * Math.PI / 3; const x = Math.cos(a) * 0.46, z = Math.sin(a) * 0.46; b.rod([0, 1.33, 0], [x, 0, z], 0.018, COUL.pied, 5); b.rod([0, 0.62, 0], [x * 0.5, 0.46, z * 0.5], 0.01, COUL.metal, 4); cone(b, 0.035, 0.05, x, 0.025, z, COUL.chaussure, 5, { menu: true }); }
    prisme(b, 0.045, 0.055, 0.1, 0, 1.33, 0, COUL.metal, 6); boite(b, 0.16, 0.05, 0.22, 0, 1.41, 0, COUL.metal);
  });
  const corps = piece('corps de caméra', (b) => {
    boite(b, 0.24, 0.2, 0.44, 0, 1.55, 0, COUL.corps);
    prisme(b, 0.07, 0.06, 0.22, 0, 1.55, 0.32, COUL.corps, 8, { rot: [Math.PI / 2, 0, 0] }); prisme(b, 0.1, 0.075, 0.08, 0, 1.55, 0.46, COUL.chaussure, 8, { rot: [Math.PI / 2, 0, 0] });
    boite(b, 0.12, 0.09, 0.15, -0.15, 1.69, -0.1, COUL.corps); prisme(b, 0.045, 0.035, 0.06, -0.15, 1.69, -0.2, COUL.chaussure, 8, { rot: [Math.PI / 2, 0, 0], menu: true });
    boite(b, 0.06, 0.05, 0.3, 0, 1.7, 0.02, COUL.metal); boite(b, 0.05, 0.1, 0.18, 0.15, 1.5, -0.08, COUL.pied);
  });
  g.add(pied, corps);
  g.userData.corps = corps; g.userData.oeil = new THREE.Vector3(0, 1.55, 0.5);
  return g;
}

// ---------------- les projecteurs ----------------
/**
 * un projecteur sur pied : fresnel (halogène), hmi, led (panneau). La tête (y = 1,85 m) s'oriente ; regler() allume la
 * lentille, le vrai projecteur du rendu (SpotLight, candelas) et le cône de lumière (repère, couche 1).
 * @param {'fresnel' | 'hmi' | 'led'} type
 */
export function projecteur(type) {
  const g = new THREE.Group(); g.name = 'projecteur ' + type;
  const pied = piece('pied de projecteur', (b) => {
    prisme(b, 0.02, 0.028, 1.75, 0, 0.875, 0, COUL.pied, 6);
    for (let i = 0; i < 3; i++) { const a = Math.PI / 2 + i * 2 * Math.PI / 3; const x = Math.cos(a) * 0.48, z = Math.sin(a) * 0.48; b.rod([0, 0.5, 0], [x, 0, z], 0.014, COUL.pied, 5); b.rod([0, 0.08, 0], [x * 0.62, 0.3, z * 0.62], 0.009, COUL.metal, 4); cone(b, 0.035, 0.05, x, 0.025, z, COUL.chaussure, 5, { menu: true }); }
    prisme(b, 0.04, 0.04, 0.06, 0, 1.78, 0, COUL.metal, 6);
    if (type === 'hmi') boite(b, 0.22, 0.14, 0.32, 0.16, 0.75, 0.02, COUL.hmi);
  });
  const tete = new THREE.Object3D(); tete.name = 'tête'; tete.position.set(0, 1.85, 0); tete.rotation.order = 'YXZ';
  const coque = type === 'led' ? COUL.led : type === 'hmi' ? COUL.hmi : COUL.fresnel;
  const corps = piece('tête de projecteur', (b) => {
    for (const s of [-1, 1]) boite(b, 0.03, 0.44, 0.04, s * (type === 'led' ? 0.34 : 0.2), -0.02, 0, COUL.metal);
    boite(b, type === 'led' ? 0.72 : 0.44, 0.03, 0.04, 0, -0.22, 0, COUL.metal);
    if (type === 'led') { boite(b, 0.62, 0.42, 0.08, 0, 0, 0, coque); boite(b, 0.3, 0.2, 0.05, 0, 0, -0.06, COUL.metal); return; }
    // la tête : un prisme octogonal le long de l'axe, un peu plus large à l'avant
    prisme(b, 0.17, 0.15, 0.42, 0, 0, 0, coque, 8, { rot: [Math.PI / 2, 0, 0], occ: [0.34, 0.34, 0.42] }); boite(b, 0.2, 0.03, 0.3, 0, 0.17, -0.02, COUL.metal);
    prisme(b, 0.15, 0.15, 0.04, 0, 0, 0.2, COUL.metal, 8, { rot: [Math.PI / 2, 0, 0] });
    // les volets, ouverts
    boite(b, 0.34, 0.012, 0.2, 0, 0.23, 0.3, coque, { rot: [-0.55, 0, 0] }); boite(b, 0.34, 0.012, 0.2, 0, -0.23, 0.3, coque, { rot: [0.55, 0, 0] });
    boite(b, 0.012, 0.34, 0.2, 0.23, 0, 0.3, coque, { rot: [0, 0.55, 0] }); boite(b, 0.012, 0.34, 0.2, -0.23, 0, 0.3, coque, { rot: [0, -0.55, 0] });
  });
  const matL = matPlate({ vertexColors: false, color: COUL.lentille, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.4 });
  const lentille = type === 'led' ? new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.34, 0.012), matL) : new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 8), matL);
  lentille.name = 'lentille';
  if (type === 'led') lentille.position.set(0, 0, 0.046); else { lentille.rotation.x = Math.PI / 2; lentille.position.set(0, 0, 0.225); }
  const spot = new THREE.SpotLight(0xffffff, 0, 0, 0.5, 0.6, 2); spot.name = 'projecteur du rendu'; spot.position.set(0, 0, 0.26);
  const cible = new THREE.Object3D(); cible.position.set(0, 0, 3); spot.target = cible;
  spot.castShadow = ombres(); spot.shadow.mapSize.set(512, 512); spot.shadow.camera.near = 0.4; spot.shadow.camera.far = 30; spot.shadow.bias = -0.0005; spot.shadow.normalBias = 0.04;
  const geoCone = new THREE.CylinderGeometry(1, 0.03, 1, 12, 1, true); geoCone.rotateX(Math.PI / 2); geoCone.translate(0, 0, 0.5);
  const cone3 = new THREE.Mesh(geoCone, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }));
  cone3.name = 'cône'; cone3.layers.set(COUCHE_REPERES); cone3.renderOrder = 3; cone3.position.set(0, 0, 0.26); cone3.userData.passe = true;
  tete.add(corps, lentille, spot, cible, cone3);
  g.add(pied, tete);
  g.userData.tete = tete; g.userData.corps = corps; g.userData.pied = pied; g.userData.spot = spot; g.userData.cone = cone3; g.userData.lentille = lentille;
  /**
   * règle le projecteur : allumé, couleur [r, g, b] (0..1), intensité (cd), demi-angle du cône (rad), pénombre, longueur du cône (m),
   * part de puissance (pour l'éclat de la lentille, 0..1)
   */
  g.userData.regler = (o) => {
    const on = !!o.on && o.intensite > 0;
    spot.intensity = on ? o.intensite : 0; spot.angle = o.angle; spot.penumbra = o.penombre; spot.color.setRGB(o.couleur[0], o.couleur[1], o.couleur[2]);
    matL.emissive.setRGB(o.couleur[0], o.couleur[1], o.couleur[2]); matL.emissiveIntensity = on ? RADIANCE_TRAVAIL * (0.5 + 2.5 * (o.niveau ?? 1)) : 0;
    cone3.visible = on; const r = Math.tan(o.angle / 0.91 * 0.5) * o.longueur; cone3.scale.set(Math.max(0.05, r), Math.max(0.05, r), Math.max(0.1, o.longueur));
    /** @type {any} */ (cone3.material).color.setRGB(o.couleur[0], o.couleur[1], o.couleur[2]); /** @type {any} */ (cone3.material).opacity = 0.05 + 0.1 * (o.niveau ?? 1);
  };
  return g;
}

// ---------------- les repères au sol (couche 1) ----------------
const matRepere = (couleur, opacite) => new THREE.MeshBasicMaterial({ color: couleur, transparent: true, opacity: opacite, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
const plat = (m, nom, y) => { m.layers.set(COUCHE_REPERES); m.renderOrder = 2; m.name = nom; m.position.y = y; m.userData.passe = true; m.frustumCulled = false; return m; };
/** un coin de champ posé au sol depuis l'origine vers +z : maj(demiLargeur, longueur) */
export function coin(couleur, opacite = 0.1) {
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  const m = plat(new THREE.Mesh(geo, matRepere(couleur, opacite)), 'champ', 0.012);
  const bord = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: couleur, transparent: true, opacity: 0.5, toneMapped: false }));
  bord.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3)); plat(bord, 'bord du champ', 0.013); m.add(bord);
  m.userData.maj = (w, L) => {
    const p = /** @type {THREE.BufferAttribute} */ (geo.attributes.position); p.set([0, 0, 0, -w, 0, L, w, 0, L]); p.needsUpdate = true;
    const q = /** @type {THREE.BufferAttribute} */ (bord.geometry.attributes.position); q.set([0, 0, 0, -w, 0, L, 0, 0, 0, w, 0, L]); q.needsUpdate = true;
  };
  return m;
}
/** une dalle trapézoïdale au sol entre z0 (demi-largeur w0) et z1 (w1) : maj(z0, w0, z1, w1) */
export function dalle(couleur, opacite = 0.18) {
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3)); geo.setIndex([0, 1, 2, 0, 2, 3]);
  const m = plat(new THREE.Mesh(geo, matRepere(couleur, opacite)), 'dalle', 0.014);
  m.userData.maj = (z0, w0, z1, w1) => { const p = /** @type {THREE.BufferAttribute} */ (geo.attributes.position); p.set([-w0, 0, z0, w0, 0, z0, w1, 0, z1, -w1, 0, z1]); p.needsUpdate = true; };
  return m;
}
/** un trait en travers (à z, de demi-largeur w) : maj(z, w) */
export function trait(couleur, epaisseur = 0.05) {
  const m = plat(new THREE.Mesh(new THREE.BoxGeometry(1, 0.01, epaisseur), matRepere(couleur, 0.9)), 'trait', 0.016);
  m.userData.maj = (z, w) => { m.position.z = z; m.scale.x = Math.max(0.2, 2 * w); };
  return m;
}
/** une ligne pointillée au sol de l'origine vers +z : maj(L) */
export function ligne(couleur, opacite = 0.45) {
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, 0, 1]), 3));
  const m = plat(new THREE.Line(geo, new THREE.LineDashedMaterial({ color: couleur, transparent: true, opacity: opacite, dashSize: 0.25, gapSize: 0.25, toneMapped: false })), 'ligne', 0.015);
  m.userData.maj = (L) => { m.scale.z = Math.max(0.01, L); const p = /** @type {THREE.BufferAttribute} */ (geo.attributes.position); p.setZ(1, 1); p.needsUpdate = true; /** @type {any} */ (m).computeLineDistances(); /** @type {any} */ (m.geometry.attributes.lineDistance).array[1] = L; /** @type {any} */ (m.geometry.attributes.lineDistance).needsUpdate = true; };
  return m;
}
/** l'anneau posé sous l'objet qu'on survole ou qu'on déplace */
export function anneau(couleur) {
  const g = new THREE.RingGeometry(0.5, 0.58, 32); g.rotateX(-Math.PI / 2);
  const m = plat(new THREE.Mesh(g, matRepere(couleur, 0.85)), 'anneau', 0.018); m.visible = false;
  return m;
}

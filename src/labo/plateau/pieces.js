// @ts-check
import * as THREE from 'three';
import { Builder } from '../../geo.js';
import { matiere, MATIERE } from '../../matiere.js';
import { S } from '../../state.js';
import { RADIANCE_TRAVAIL } from './calc.js';

// ----------------------------------------------------------------------------------
// Les pièces du plateau 3D du Labo (v19.30), en low-poly : des boîtes aux arêtes à peine arrondies et
// des cylindres à peu de faces, fusionnés par un Builder en mode ao (occlusion cuite dans les couleurs par
// sommet), lus à plat (flatShading : chaque face a sa teinte franche, dans le style « dessin » du
// simulateur). Pas de relief procédural ici : une matière de matiere() dont le relief est coupé (il lisserait
// les faces). Le sol et le cyclo, les sujets (avec leur pancarte lettrée, dessinée dans un canevas), la
// caméra sur son pied, les projecteurs sur leur pied (tête orientable, lentille qui s'allume, vrai
// projecteur du rendu et cône de lumière), les lampes du fond (qui deviennent des disques dans le flou),
// les lumières de travail, et les repères posés au sol (champ, zone nette, traits, ligne d'axe, anneau).
// Tout ce qui n'est qu'un repère vit sur la couche 1 : la caméra du plateau le voit, l'image de la caméra non.
// ----------------------------------------------------------------------------------
/** la couche des repères (vus de haut seulement) */
export const COUCHE_REPERES = 1;
export const COUL = {
  sol: 0x9aa1ab, bord: 0x4f5864, cyclo: 0xe2e5ea, pied: 0x3b424c, corps: 0x262b33, metal: 0x8a919b, peau: 0xe7b394, cheveux: 0x3a2a22,
  pantalon: 0x2f3640, chaussure: 0x1e2229, fresnel: 0x30363f, hmi: 0x4b5563, led: 0x2c3138, lentille: 0x1b1f26, caisse: 0x8a6a46, cellule: 0xf2f3ee,
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

// ---------------- le décor ----------------
/** le sol du plateau : une dalle claire, son bord sombre ; w × d mètres, centrée en (cx, cz), le dessus à y = 0 */
export const sol = (w, d, cx, cz) => piece('sol', (b) => { b.cbox(w, 0.12, d, cx, -0.06, cz, COUL.sol, 0.02); b.cbox(w + 0.5, 0.08, d + 0.5, cx, -0.1, cz, COUL.bord, 0.02); }, { ao: 0.5, ombre: false });
/** le cyclo : un mur clair au fond (en z), deux retours */
export const cyclo = (w, h, z, cx = 0) => piece('cyclo', (b) => {
  b.cbox(w, h, 0.3, cx, h / 2, z + 0.15, COUL.cyclo, 0.03);
  for (const s of [-1, 1]) b.cbox(0.3, h, 3, cx + s * (w / 2 - 0.15), h / 2, z - 1.35, COUL.cyclo, 0.03);
}, { ao: 0.4 });
/** des lampes sur le fond : des boules qui éclairent par elles-mêmes (dans le flou, des disques) */
export function lampes(n, w, y, z, cx = 0) {
  const mat = matPlate({ vertexColors: false, color: 0x7a6a4a, emissive: 0xffe2a4, emissiveIntensity: RADIANCE_TRAVAIL * 1.6, roughness: 0.5 });
  return piece('lampes', (b) => { for (let i = 0; i < n; i++) { const x = cx + (i - (n - 1) / 2) * (w / n); b.sphere(0.08, x, y + (i % 2) * 0.5, z - 0.22, 0xffffff, 8); b.cyl(0.015, 0.015, 0.22, x, y + (i % 2) * 0.5, z - 0.11, 0x333333, 6, Math.PI / 2); } }, { mat, ombre: false });
}
/** une caisse (cube de plateau) posée au sol */
export const caisse = (x, z, rot = 0) => piece('caisse', (b) => b.cbox(0.5, 0.2, 0.3, x, 0.1, z, COUL.caisse, 0.015, rot));
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
/** un sujet debout, l'avant en +z (le nez le dit) ; couleur : son haut */
export function personnage(couleur) {
  const g = new THREE.Group(); g.name = 'personnage';
  const corps = piece('corps', (b) => {
    for (const s of [-1, 1]) {
      b.cbox(0.14, 0.08, 0.27, s * 0.1, 0.04, 0.03, COUL.chaussure, 0.02);
      b.cbox(0.15, 0.78, 0.17, s * 0.1, 0.47, 0, COUL.pantalon, 0.03);
      b.cbox(0.11, 0.52, 0.12, s * 0.29, 1.15, 0, couleur, 0.04);
      b.cbox(0.09, 0.1, 0.1, s * 0.29, 0.85, 0, COUL.peau, 0.02);
    }
    b.cbox(0.44, 0.58, 0.24, 0, 1.16, 0, couleur, 0.05);
    b.cbox(0.12, 0.08, 0.12, 0, 1.49, 0, COUL.peau, 0.02);
    b.cbox(0.22, 0.26, 0.23, 0, 1.65, 0, COUL.peau, 0.05);
    b.cbox(0.05, 0.05, 0.05, 0, 1.63, 0.13, COUL.peau, 0.01);
    b.cbox(0.24, 0.1, 0.25, 0, 1.76, -0.01, COUL.cheveux, 0.04);
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
  m.name = 'pancarte ' + lettre; m.position.set(0, 1.05, 0.165); m.castShadow = true;
  return m;
}
/** la cellule d'un luxmètre, posée sur la poitrine, tournée vers l'avant */
export const luxmetre = () => piece('luxmètre', (b) => { b.cbox(0.1, 0.14, 0.03, 0, 1.36, 0.14, COUL.corps, 0.01); b.sphere(0.028, 0, 1.4, 0.155, COUL.cellule, 8); }, { ao: 0.03 });

// ---------------- la caméra ----------------
/** une caméra d'épaule sur pied, l'objectif vers +z ; corps (ce qu'on prend pour la déplacer) et œil (où l'image se forme) */
export function camera3d() {
  const g = new THREE.Group(); g.name = 'caméra';
  const pied = piece('pied de caméra', (b) => {
    for (let i = 0; i < 3; i++) { const a = Math.PI / 2 + i * 2 * Math.PI / 3; const x = Math.cos(a) * 0.46, z = Math.sin(a) * 0.46; b.rod([0, 1.33, 0], [x, 0, z], 0.018, COUL.pied, 6); b.rod([0, 0.62, 0], [x * 0.5, 0.46, z * 0.5], 0.01, COUL.metal, 5); b.cbox(0.06, 0.03, 0.06, x, 0.015, z, COUL.chaussure, 0.01); }
    b.cyl(0.035, 0.045, 0.1, 0, 1.33, 0, COUL.metal, 8); b.cbox(0.16, 0.06, 0.22, 0, 1.41, 0, COUL.metal, 0.01);
  });
  const corps = piece('corps de caméra', (b) => {
    b.cbox(0.24, 0.22, 0.44, 0, 1.55, 0, COUL.corps, 0.03);
    b.cyl(0.065, 0.078, 0.22, 0, 1.55, 0.32, COUL.corps, 10, Math.PI / 2); b.cyl(0.082, 0.082, 0.03, 0, 1.55, 0.43, COUL.metal, 12, Math.PI / 2);
    b.cbox(0.12, 0.09, 0.15, -0.15, 1.69, -0.1, COUL.corps, 0.02); b.cyl(0.04, 0.04, 0.05, -0.15, 1.69, -0.2, COUL.chaussure, 10, Math.PI / 2);
    b.cbox(0.06, 0.05, 0.3, 0, 1.71, 0.02, COUL.metal, 0.012); b.cbox(0.05, 0.1, 0.18, 0.15, 1.5, -0.08, COUL.pied, 0.012);
  });
  g.add(pied, corps);
  g.userData.corps = corps; g.userData.oeil = new THREE.Vector3(0, 1.55, 0.45);
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
    b.cyl(0.022, 0.028, 1.75, 0, 0.875, 0, COUL.pied, 8);
    for (let i = 0; i < 3; i++) { const a = Math.PI / 2 + i * 2 * Math.PI / 3; const x = Math.cos(a) * 0.48, z = Math.sin(a) * 0.48; b.rod([0, 0.5, 0], [x, 0, z], 0.014, COUL.pied, 6); b.rod([0, 0.08, 0], [x * 0.62, 0.3, z * 0.62], 0.009, COUL.metal, 5); b.cbox(0.06, 0.03, 0.06, x, 0.015, z, COUL.chaussure, 0.01); }
    b.cyl(0.04, 0.04, 0.06, 0, 1.78, 0, COUL.metal, 8);
    if (type === 'hmi') b.cbox(0.22, 0.14, 0.32, 0.16, 0.75, 0.02, COUL.hmi, 0.02);
  });
  const tete = new THREE.Object3D(); tete.name = 'tête'; tete.position.set(0, 1.85, 0); tete.rotation.order = 'YXZ';
  const coque = type === 'led' ? COUL.led : type === 'hmi' ? COUL.hmi : COUL.fresnel;
  const corps = piece('tête de projecteur', (b) => {
    for (const s of [-1, 1]) b.cbox(0.03, 0.44, 0.04, s * (type === 'led' ? 0.34 : 0.2), -0.02, 0, COUL.metal, 0.008);
    b.cbox(type === 'led' ? 0.72 : 0.44, 0.03, 0.04, 0, -0.22, 0, COUL.metal, 0.008);
    if (type === 'led') { b.cbox(0.62, 0.42, 0.08, 0, 0, 0, coque, 0.02); b.cbox(0.3, 0.2, 0.05, 0, 0, -0.06, COUL.metal, 0.01); return; }
    b.cbox(0.32, 0.34, 0.42, 0, 0, 0, coque, 0.04); b.cbox(0.2, 0.03, 0.3, 0, 0.185, -0.02, COUL.metal, 0.008);
    b.cyl(0.145, 0.145, 0.04, 0, 0, 0.2, COUL.metal, 16, Math.PI / 2);
    // les volets, ouverts
    b.cbox(0.34, 0.012, 0.2, 0, 0.23, 0.3, coque, 0.004, 0, -0.55); b.cbox(0.34, 0.012, 0.2, 0, -0.23, 0.3, coque, 0.004, 0, 0.55);
    b.cbox(0.012, 0.34, 0.2, 0.23, 0, 0.3, coque, 0.004, 0.55); b.cbox(0.012, 0.34, 0.2, -0.23, 0, 0.3, coque, 0.004, -0.55);
  });
  const matL = matPlate({ vertexColors: false, color: COUL.lentille, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.4 });
  const lentille = type === 'led' ? new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.34, 0.012), matL) : new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.03, 16), matL);
  lentille.name = 'lentille';
  if (type === 'led') lentille.position.set(0, 0, 0.046); else { lentille.rotation.x = Math.PI / 2; lentille.position.set(0, 0, 0.225); }
  const spot = new THREE.SpotLight(0xffffff, 0, 0, 0.5, 0.6, 2); spot.name = 'projecteur du rendu'; spot.position.set(0, 0, 0.26);
  const cible = new THREE.Object3D(); cible.position.set(0, 0, 3); spot.target = cible;
  spot.castShadow = ombres(); spot.shadow.mapSize.set(512, 512); spot.shadow.camera.near = 0.4; spot.shadow.camera.far = 30; spot.shadow.bias = -0.0005; spot.shadow.normalBias = 0.04;
  const geoCone = new THREE.CylinderGeometry(1, 0.03, 1, 20, 1, true); geoCone.rotateX(Math.PI / 2); geoCone.translate(0, 0, 0.5);
  const cone = new THREE.Mesh(geoCone, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }));
  cone.name = 'cône'; cone.layers.set(COUCHE_REPERES); cone.renderOrder = 3; cone.position.set(0, 0, 0.26); cone.userData.passe = true;
  tete.add(corps, lentille, spot, cible, cone);
  g.add(pied, tete);
  g.userData.tete = tete; g.userData.corps = corps; g.userData.pied = pied; g.userData.spot = spot; g.userData.cone = cone; g.userData.lentille = lentille;
  /**
   * règle le projecteur : allumé, couleur [r, g, b] (0..1), intensité (cd), demi-angle du cône (rad), pénombre, longueur du cône (m),
   * part de puissance (pour l'éclat de la lentille, 0..1)
   */
  g.userData.regler = (o) => {
    const on = !!o.on && o.intensite > 0;
    spot.intensity = on ? o.intensite : 0; spot.angle = o.angle; spot.penumbra = o.penombre; spot.color.setRGB(o.couleur[0], o.couleur[1], o.couleur[2]);
    matL.emissive.setRGB(o.couleur[0], o.couleur[1], o.couleur[2]); matL.emissiveIntensity = on ? RADIANCE_TRAVAIL * (0.5 + 2.5 * (o.niveau ?? 1)) : 0;
    cone.visible = on; const r = Math.tan(o.angle / 0.91 * 0.5) * o.longueur; cone.scale.set(Math.max(0.05, r), Math.max(0.05, r), Math.max(0.1, o.longueur));
    /** @type {any} */ (cone.material).color.setRGB(o.couleur[0], o.couleur[1], o.couleur[2]); /** @type {any} */ (cone.material).opacity = 0.05 + 0.1 * (o.niveau ?? 1);
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

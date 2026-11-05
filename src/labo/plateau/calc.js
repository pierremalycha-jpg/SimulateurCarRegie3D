// @ts-check
import { tache } from '../calc/optique.js';

// ----------------------------------------------------------------------------------
// Le plateau 3D du Labo (v19.31) : les calculs purs qui le posent, sans three.js ni DOM (testés en
// Node, tests/unit/plateau.test.mjs) :
//   - l'isométrie : l'œil regarde la cible depuis une direction fixe (élévation arctan(1/√2) ≈ 35,26°,
//     azimut par quarts de tour) à travers une caméra orthographique ; cadrer() choisit la cible et la
//     demi-hauteur du cadre pour que des points tiennent dans la vue ;
//   - la lecture des positions : à l'atelier Optique, un sujet se repère par sa distance le long de l'axe
//     de la caméra (ce que l'optique utilise) et son écart latéral ; à l'atelier Photométrie, un
//     projecteur par sa distance au sujet et son angle autour de lui, compté depuis la direction de la
//     caméra, positif à la droite de la caméra (comme le modèle, labo/calc/photometrie.js) ;
//   - l'exposition de l'image de la caméra : un gris 18 % reçu sous l'éclairement Eref (celui qu'il faut
//     pour le diaphragme, la sensibilité et le temps de pose réglés) doit sortir à 18 % ; la luminance
//     d'une surface mate vaut ρE/π, le rendu multiplie donc par π/Eref. Le plateau vu de haut s'expose de
//     lui-même sur la lumière la plus forte, comme un œil ;
//   - la tache de flou à l'écran : celle du capteur (mm, labo/calc/optique.js) rapportée à la hauteur de
//     l'image en pixels ;
//   - un projecteur du rendu (SpotLight) depuis les mesures du modèle : intensité dans l'axe en candelas,
//     cône ouvert à l'angle de champ (10 % de l'axe : 1,82 fois l'angle de faisceau), pénombre.
// ----------------------------------------------------------------------------------
const rad = (d) => d * Math.PI / 180;
const deg = (r) => r * 180 / Math.PI;

/** élévation de l'œil isométrique (rad) : arctan(1/√2) */
export const ELEV = Math.atan(1 / Math.SQRT2);
/** les quatre azimuts (degrés), dans l'ordre des quarts de tour ; le premier met la caméra devant, le cyclo au fond */
export const AZIMUTS = [225, 315, 45, 135];
/** direction de la cible vers l'œil (vecteur unitaire) pour un azimut (degrés) */
export function directionIso(az, el = ELEV) {
  const a = rad(az);
  return [Math.sin(a) * Math.cos(el), Math.sin(el), Math.cos(a) * Math.cos(el)];
}
/** la base de l'écran pour cet azimut : la direction de vue, la droite et le haut de l'écran (vecteurs du monde) */
export function baseIso(az, el = ELEV) {
  const d = directionIso(az, el);
  // droite = haut du monde ∧ direction ; haut de l'écran = direction ∧ droite (même choix que lookAt de three.js)
  const r = [d[2], 0, -d[0]]; const n = Math.hypot(r[0], r[2]) || 1; r[0] /= n; r[2] /= n;
  const u = [d[1] * r[2] - d[2] * r[1], d[2] * r[0] - d[0] * r[2], d[0] * r[1] - d[1] * r[0]];
  return { dir: d, droite: r, haut: u };
}
/**
 * Cadre des points dans la vue isométrique : la cible (au sol) et la demi-hauteur du cadre (m).
 * @param {number[][]} points [x, y, z]
 * @param {number} az azimut (degrés)
 * @param {number} aspect largeur ÷ hauteur du cadre
 * @param {number} [marge] facteur d'air autour des points
 * @param {number} [min] demi-hauteur minimale (m)
 */
export function cadrer(points, az, aspect, marge = 1.2, min = 2.5) {
  const B = baseIso(az);
  const dot = (p, v) => p[0] * v[0] + p[1] * v[1] + p[2] * v[2];
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const p of points) { const u = dot(p, B.droite), v = dot(p, B.haut); u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  if (!points.length) return { cible: [0, 0, 0], demi: min };
  const demi = Math.max(min, (v1 - v0) / 2 * marge, (u1 - u0) / 2 / Math.max(0.2, aspect) * marge);
  // le point du monde qui se projette au centre du cadre, ramené au sol le long de la direction de vue
  const uc = (u0 + u1) / 2, vc = (v0 + v1) / 2;
  const c = [B.droite[0] * uc + B.haut[0] * vc, B.droite[1] * uc + B.haut[1] * vc, B.droite[2] * uc + B.haut[2] * vc];
  const t = -c[1] / B.dir[1];
  return { cible: [c[0] + B.dir[0] * t, 0, c[2] + B.dir[2] * t], demi };
}

/** l'azimut de la vue (parmi les quatre) qui regarde une ligne de direction beta (rad, atan2(x, z)) le plus de côté */
export const azimutDeCote = (beta) => AZIMUTS.reduce((b, az) => (Math.abs(Math.cos(az * Math.PI / 180 - beta)) < Math.abs(Math.cos(b * Math.PI / 180 - beta)) ? az : b), AZIMUTS[0]);
/** l'azimut de la vue (parmi les quatre) dont l'œil est le plus du côté de la direction beta (rad, atan2(x, z)) */
export const azimutDuCote = (beta) => AZIMUTS.reduce((b, az) => (Math.cos(az * Math.PI / 180 - beta) > Math.cos(b * Math.PI / 180 - beta) ? az : b), AZIMUTS[0]);
/** borne une valeur dans [a, b] @param {number} v @param {[number, number]} ab */
export const borne = (v, [a, b]) => Math.min(Math.max(v, a), b);
/** @typedef {[number, number]} Bornes */
/** les bornes du plateau : distance d'un sujet (m), écart latéral (m), distance d'un projecteur (m), son angle (°), la caméra en x (m) */
export const LIM = /** @type {Record<'sujet' | 'lat' | 'proj' | 'phi' | 'camX', Bornes>} */ ({ sujet: [0.5, 29], lat: [-7, 7], proj: [1, 15], phi: [-80, 80], camX: [-7, 7] });
/** les gains de la balance des blancs d'une caméra : l'inverse des composantes de sa température, le vert à 1 @param {number[]} c @returns {[number, number, number]} */
export const balanceBlancs = ([r, g, b]) => [g / Math.max(r, 1e-6), 1, g / Math.max(b, 1e-6)];

// ---------------- Optique : la caméra regarde vers +z ----------------
/** la place d'un sujet dans le monde : distance d le long de l'axe, écart latéral lat (positif à la droite de l'image) */
export const mondeOptique = (cam, d, lat) => ({ x: cam.x - lat, z: cam.z + d });
/** la lecture inverse : un point du sol en distance et écart latéral */
export const lectureOptique = (cam, x, z) => ({ d: z - cam.z, lat: cam.x - x });

// ---------------- Photométrie : le sujet au centre, la caméra autour ----------------
/** le repère de la caméra autour du sujet : u (du sujet vers la caméra), r (la droite de la caméra, qui regarde le sujet) */
export function repereCam(cam, sujet = { x: 0, z: 0 }) {
  let ux = cam.x - sujet.x, uz = cam.z - sujet.z; const n = Math.hypot(ux, uz) || 1; ux /= n; uz /= n;
  // l'avant de la caméra est −u ; sa droite (avant ∧ haut, y vers le haut) vaut (u.z, 0, −u.x)
  return { ux, uz, rx: uz, rz: -ux };
}
/** la place d'un projecteur : à d mètres du sujet, à phi degrés de la direction de la caméra (positif à sa droite) */
export function mondePhoto(cam, d, phi, sujet = { x: 0, z: 0 }) {
  const R = repereCam(cam, sujet), a = rad(phi);
  return { x: sujet.x + d * (Math.cos(a) * R.ux + Math.sin(a) * R.rx), z: sujet.z + d * (Math.cos(a) * R.uz + Math.sin(a) * R.rz) };
}
/** la lecture inverse : un point du sol en distance au sujet et angle autour de lui */
export function lecturePhoto(cam, x, z, sujet = { x: 0, z: 0 }) {
  const R = repereCam(cam, sujet), vx = x - sujet.x, vz = z - sujet.z;
  return { d: Math.hypot(vx, vz), phi: deg(Math.atan2(vx * R.rx + vz * R.rz, vx * R.ux + vz * R.uz)) };
}
/** le cap (rotation autour de y, rad) qui tourne l'avant (+z) d'un objet posé en « de » vers « vers » */
export const capVers = (de, vers) => Math.atan2(vers.x - de.x, vers.z - de.z);

// ---------------- la lumière du rendu ----------------
/** la lumière de travail du plateau (lx), ordre de grandeur d'un plateau allumé pour s'installer */
export const LUX_TRAVAIL = 650;
/** l'exposition du rendu pour qu'un gris 18 % sous Eref lux sorte à 18 % : π ÷ Eref */
export const expositionImage = (Eref) => Math.PI / Math.max(1e-3, Eref);
/** l'exposition du plateau vu de haut : sur la lumière de travail, ou sur la lumière la plus forte si elle domine */
export const expositionPlateau = (Emax = 0, base = LUX_TRAVAIL) => Math.PI / Math.max(base, 0.35 * Emax);
/** la radiance d'une source qui paraît blanche sous la lumière de travail (pour les matières lumineuses du décor) */
export const RADIANCE_TRAVAIL = LUX_TRAVAIL / Math.PI;
/** angle de champ vertical (degrés) d'une focale f (mm) sur un capteur de hauteur h (mm) */
export const fovVertical = (h, f) => deg(2 * Math.atan(h / (2 * f)));
/** diamètre de la tache de flou à l'écran (px) d'un point à d (m) : f, N, point à s, hauteur du capteur hCap (mm), image de hPx pixels */
export const tachePx = (f, N, s, d, hCap, hPx) => tache(f, N, s, d) / hCap * hPx;
/**
 * un projecteur du rendu depuis une mesure du modèle (eclairage()) : intensité dans l'axe (cd), demi-angle du cône
 * (rad, à l'angle de champ : 10 % de l'axe), pénombre (part du cône où la lumière décroît)
 */
export const spotDepuis = (r) => ({ intensite: Math.max(0, r.I0 || 0), angle: Math.max(0.02, rad(0.91 * (r.theta || 10))), penombre: 0.6 });
/** la couleur d'une lumière (composantes 0..1, le canal le plus fort à 1) depuis des composantes relatives @param {number[]} c @returns {[number, number, number]} */
export function couleurLumiere([r, g, b]) { const mx = Math.max(r, g, b, 1e-6); return [r / mx, g / mx, b / mx]; }

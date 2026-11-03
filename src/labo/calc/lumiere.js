// @ts-check
// ----------------------------------------------------------------------------------
// La lumière pour le chapitre « La lumière » du Cours et le Labo (calcul pur ; la photométrie des
// projecteurs est dans photometrie.js) :
//   - les familles de sources (ordres de grandeur des fiches : efficacité lumineuse en lm/W, indice de
//     rendu des couleurs, température de couleur, gradation) ; flux = puissance × efficacité ;
//     courant absorbé sur le secteur I = P ÷ (U × cos φ) ;
//   - l'angle solide d'un cône de demi-angle θ/2 : Ω = 2π (1 − cos θ/2) stéradians ; l'intensité
//     moyenne d'un faisceau de flux Φ : I = Φ ÷ Ω ; avec le profil de photometrie.js (I tombe à 50 % à
//     l'angle de faisceau θ), l'angle de champ (10 %) vaut √(log₂ 10) × θ ≈ 1,82 θ ;
//   - le diamètre éclairé à la distance d : 2 d tan(θ/2) ;
//   - le scintillement : une source alimentée en 50 Hz sans électronique qui lisse (HMI à ballast
//     magnétique, LED ou fluo bas de gamme) varie à 100 Hz. Une image exposée t secondes intègre la
//     lumière : l'ondulation résiduelle d'une image à l'autre vaut |sin(π f t) ÷ (π f t)| (nulle quand
//     t est un multiple de 1/f), et la fréquence apparente sur les images est l'écart de f au multiple
//     de la cadence le plus proche (repliement). Ce sont des ordres de grandeur ;
//   - l'uniformité d'un éclairage : U1 = Emin ÷ Emax, U2 = Emin ÷ Emoy. Repères d'un stade de haut
//     niveau éclairé pour la télévision (ordre de grandeur des guides UEFA et FIFA : éclairement
//     vertical vers les caméras 1 400 à 2 000 lx, U1 ≥ 0,5 à 0,7, U2 ≥ 0,7 à 0,8).
// ----------------------------------------------------------------------------------
/**
 * @typedef {object} Famille
 * @property {string} id
 * @property {string} nom
 * @property {[number, number]} efficacite lm/W (ordre de grandeur)
 * @property {[number, number]} irc indice de rendu des couleurs (Ra)
 * @property {number | [number, number]} T température de couleur (K), ou sa plage réglable
 * @property {string} gradation comment elle se gradue
 * @property {string} chaleur ce qui part en chaleur
 */
/** @type {Famille[]} */
export const FAMILLES = [
  { id: 'halogene', nom: 'Halogène (tungstène)', efficacite: [18, 25], irc: [99, 100], T: 3200, gradation: 'au gradateur : elle rougit en baissant', chaleur: 'plus de 90 % de la puissance part en chaleur (infrarouge)' },
  { id: 'hmi', nom: 'HMI (iodures métalliques)', efficacite: [75, 100], irc: [90, 95], T: 5600, gradation: 'peu : entre 50 et 100 %, par le ballast ; sinon volets, diffuseurs, filtres', chaleur: 'chauffe beaucoup moins à lumière égale ; s\'allume en une ou deux minutes' },
  { id: 'led', nom: 'LED (diodes)', efficacite: [60, 130], irc: [90, 98], T: [2700, 6500], gradation: 'de 0 à 100 % sans changer de couleur', chaleur: 'peu de chaleur vers le sujet, mais une électronique à refroidir (ventilateur)' },
  { id: 'fluo', nom: 'Tubes fluorescents', efficacite: [60, 80], irc: [85, 95], T: [3200, 5600], gradation: 'avec un ballast électronique gradable', chaleur: 'peu de chaleur, lumière douce' },
];
export const familleById = (/** @type {string} */ id) => FAMILLES.find((f) => f.id === id) || FAMILLES[0];
/** milieu d'une plage */
const mil = (x) => (Array.isArray(x) ? (x[0] + x[1]) / 2 : x);
/** flux lumineux (lm) d'une source de P watts, à l'efficacité moyenne de sa famille (ou donnée) */
export const flux = (P, /** @type {string} */ famille, eff = mil(familleById(famille).efficacite)) => P * eff;
/** courant absorbé (A) sur le secteur : I = P ÷ (U × cos φ) */
export const courant = (P, U = 230, cosPhi = 1) => P / (U * cosPhi);
/** puissance (W) qu'il faut pour un flux donné (lm) */
export const puissancePour = (lm, /** @type {string} */ famille) => lm / mil(familleById(famille).efficacite);

/** angle solide (sr) d'un cône d'angle au sommet θ (degrés) */
export const angleSolide = (theta) => 2 * Math.PI * (1 - Math.cos(theta * Math.PI / 360));
/** intensité moyenne (cd) d'un faisceau de flux Φ (lm) et d'angle θ (degrés) */
export const intensiteMoyenne = (phi, theta) => phi / angleSolide(theta);
/** angle de champ (10 % de l'axe) pour un angle de faisceau θ (50 %), avec le profil de photometrie.js */
export const angleChampDe = (theta) => theta * Math.sqrt(Math.log2(10));
/** diamètre éclairé (m) à la distance d (m) pour un angle θ (degrés) */
export const diametre = (d, theta) => 2 * d * Math.tan(theta * Math.PI / 360);

/**
 * Le scintillement vu par la caméra : lumière qui varie à f (Hz), image exposée t (s), cadence c (images/s).
 * @returns {{ residu: number, apparente: number, visible: boolean }} residu : ondulation d'une image à l'autre (0 à 1) ;
 *   apparente : fréquence du battement sur les images (Hz) ; visible : l'ondulation dépasse 5 %
 */
export function scintillement(f, t, c) {
  const x = Math.PI * f * t;
  const residu = x < 1e-9 ? 1 : Math.abs(Math.sin(x) / x);
  const k = Math.round(f / c), apparente = Math.abs(f - k * c);
  return { residu, apparente, visible: residu > 0.05 && apparente > 0.01 };
}
/** les temps de pose (s) qui ne scintillent pas sous une lumière à f Hz : les multiples de 1/f jusqu'à tMax */
export const posesSures = (f, tMax) => Array.from({ length: Math.floor(tMax * f + 1e-9) }, (_, k) => (k + 1) / f);

/** l'uniformité d'une série d'éclairements : U1 = Emin ÷ Emax, U2 = Emin ÷ Emoy */
export function uniformite(/** @type {number[]} */ E) {
  const min = Math.min(...E), max = Math.max(...E), moy = E.reduce((s, x) => s + x, 0) / E.length;
  return { min, max, moy, u1: max > 0 ? min / max : 0, u2: moy > 0 ? min / moy : 0 };
}
/** repères d'un stade de haut niveau éclairé pour la télévision (ordre de grandeur des guides UEFA et FIFA) */
export const STADE_TV = { evMin: 1400, evMax: 2000, u1: 0.5, u2: 0.7, ra: 80, tMin: 4000, tMax: 6500 };

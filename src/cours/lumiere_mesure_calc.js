// @ts-check
import { courant } from '../labo/calc/lumiere.js';
import { mired, GELS } from '../labo/calc/photometrie.js';

// ----------------------------------------------------------------------------------
// Les calculs de la partie « La lumière et sa mesure » du chapitre La lumière (v19.29) qui ne sont pas
// déjà dans les ateliers du Labo (labo/calc/photometrie.js, lumiere.js, sensito.js). Calcul pur.
//   - Le secteur : combien de projecteurs sur une ligne (16 A, 230 V) ; facteur de puissance cos φ
//     (ordre de grandeur : 1 pour une lampe à incandescence, qui est une résistance ; vers 0,95 pour
//     une alimentation électronique avec correction du facteur de puissance, LED ou ballast HMI).
//   - L'éclairement d'une source ponctuelle : E = I cos i ÷ d² (lux).
//   - La limite de l'inverse du carré : un disque lambertien uniforme de diamètre D, vu dans son axe à
//     la distance d, donne E = π L a² ÷ (a² + d²) avec a = D ÷ 2 (photométrie classique) ; la loi
//     « ponctuelle » π L a² ÷ d² surestime donc de a² ÷ (a² + d²) : 20 % à d = D, 1 % vers d = 5 D.
//   - La couleur : la correction à faire (en mireds) et la gélatine la plus proche (GELS du Labo).
//   - La mesure : cellule incidente N² ÷ t = E × S ÷ C (C = 250 pour une cellule plate, vers 330 pour un
//     dôme : ISO 2720, ordres de grandeur des fabricants) ; spotmètre (luminance) N² ÷ t = L × S ÷ K
//     (K = 12,5 chez la plupart des fabricants). Le spotmètre place tout sujet au même niveau : il se
//     trompe de log₂(π K ÷ (ρ C)) diaphs sur une surface mate de facteur de réflexion ρ (calibrage
//     ρ = π K ÷ C, environ 16 % pour K = 12,5 et C = 250).
//   - La caméra de car : sensibilité donnée par le diaphragme qui met une charte blanche (89,9 %) à
//     100 % sous 2 000 lx ; la Sony HXC-FB80 du Labo de la caméra annonce f/13 en 50 Hz (fiche
//     technique), d'où N = 13 × √(E ÷ 2 000).
//   - Le gain : 20 log₁₀ 2 ≈ 6,02 dB par diaph.
// ----------------------------------------------------------------------------------

/** facteur de puissance des familles (ordre de grandeur) */
export const COS_PHI = { halogene: 1, hmi: 0.95, led: 0.95, fluo: 0.95 };
/** une ligne monophasée ordinaire du plateau : 16 A sous 230 V */
export const LIGNE = { A: 16, U: 230 };
/**
 * Le courant d'un projecteur et combien on en met sur une ligne.
 * @param {number} P puissance (W)
 * @param {string} famille id de FAMILLES (labo/calc/lumiere.js)
 * @returns {{ I: number, n: number, total: number }} I : courant d'un projecteur (A) ; n : combien sur la ligne ; total : courant de ces n projecteurs
 */
export function surLigne(P, famille, Imax = LIGNE.A, U = LIGNE.U) {
  const I = P > 0 ? courant(P, U, COS_PHI[famille] || 1) : 0;
  const n = I > 0 ? Math.floor(Imax / I + 1e-9) : 0;
  return { I, n, total: n * I };
}

/** éclairement (lx) à d mètres d'une source ponctuelle d'intensité I (cd), incidence i (degrés) */
export const eclairementPonctuel = (I, d, i = 0) => (d > 0 ? I * Math.max(0, Math.cos(i * Math.PI / 180)) / (d * d) : 0);
/** de combien (part de 0 à 1) la loi de l'inverse du carré surestime l'éclairement d'un disque lambertien de diamètre D vu à d */
export function ecartDisque(d, D) {
  const a = D / 2;
  return d > 0 ? (a * a) / (a * a + d * d) : 1;
}
/** la distance au-delà de laquelle l'écart de la loi reste sous tol (part de 0 à 1) pour une source de diamètre D */
export const distanceSure = (D, tol = 0.01) => (D / 2) * Math.sqrt((1 - tol) / tol);

/** tolérance d'usage entre la lumière et la balance de la caméra (mireds, ordre de grandeur) */
export const TOL_MIRED = 20;
/** la correction à faire sur la lumière (mireds) pour qu'elle tombe à la balance Tcam : positive, il faut la réchauffer (CTO) */
export const correction = (Tlum, Tcam) => mired(Tcam) - mired(Tlum);
/** les gélatines de couleur (sans les neutres), de la plus froide à la plus chaude */
export const GELS_COULEUR = GELS.filter((g) => g.mired !== 0 || g.id === 'aucune').sort((a, b) => a.mired - b.mired);
/** la gélatine dont le décalage est le plus proche de la correction à faire */
export function gelPour(Tlum, Tcam) {
  const c = correction(Tlum, Tcam);
  return GELS_COULEUR.reduce((best, g) => (Math.abs(g.mired - c) < Math.abs(best.mired - c) ? g : best), GELS_COULEUR[0]);
}

/** constantes des posemètres : cellule plate, dôme (ordre de grandeur), spotmètre */
export const C_PLATE = 250, C_DOME = 330, K_SPOT = 12.5;
/** le nombre f d'après un éclairement mesuré (cellule incidente de constante C) */
export const ouvertureIncidente = (E, S, t, C = C_PLATE) => (E > 0 && S > 0 && t > 0 ? Math.sqrt(E * t * S / C) : 0);
/** le nombre f d'après une luminance mesurée (spotmètre de constante K) */
export const ouvertureSpot = (L, S, t, K = K_SPOT) => (L > 0 && S > 0 && t > 0 ? Math.sqrt(L * t * S / K) : 0);
/** la luminance (cd/m²) qu'il faut pour exposer à N, S, t d'après un spotmètre */
export const luminancePour = (N, S, t, K = K_SPOT) => N * N * K / (t * S);
/** le facteur de réflexion que le spotmètre prend pour un gris moyen : π K ÷ C */
export const grisVise = (K = K_SPOT, C = C_PLATE) => Math.PI * K / C;
/**
 * L'erreur d'exposition (diaphs) si l'on suit le spotmètre sur une surface mate de facteur de réflexion rho, comparé à la
 * cellule incidente : négative, l'image est sous-exposée (un sujet clair) ; positive, surexposée (un sujet sombre).
 */
export const erreurSpot = (rho, K = K_SPOT, C = C_PLATE) => Math.log2(grisVise(K, C) / rho);

/** la sensibilité d'une caméra de car : f/13 à 2 000 lx (Sony HXC-FB80, 50 Hz, fiche technique) */
export const CAMERA = { N: 13, E: 2000 };
/** le diaphragme d'une caméra de car pour un éclairement E (lx) */
export const ouvertureCamera = (E, Nref = CAMERA.N, Eref = CAMERA.E) => (E > 0 ? Nref * Math.sqrt(E / Eref) : 0);
/** diaphs entre deux nombres f (positif : N2 laisse passer moins de lumière que N1) */
export const diaphsEntre = (N1, N2) => 2 * Math.log2(N2 / N1);
/** le gain (dB) qui rattrape n diaphs : 20 log₁₀ 2 ≈ 6,02 dB par diaph */
export const dbPourDiaphs = (n) => n * 20 * Math.log10(2);

/** la suite des diaphragmes au tiers (valeurs gravées sur les objectifs) */
export const DIAPHS_TIERS = [1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22];
/** le diaphragme gravé le plus proche d'un nombre f (en diaphs, donc en logarithme) */
export function diaphProche(N) {
  if (!(N > 0)) return DIAPHS_TIERS[0];
  return DIAPHS_TIERS.reduce((b, x) => (Math.abs(Math.log2(x / N)) < Math.abs(Math.log2(b / N)) ? x : b), DIAPHS_TIERS[0]);
}

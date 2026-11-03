// @ts-check
// ----------------------------------------------------------------------------------
// La sensitométrie de l'atelier « Sensitométrie » (Labo). Calcul pur. Une charte de gris est filmée :
// chaque plage a sa luminance relative x (le gris moyen, 18 %, vaut 0,18 ; le blanc de la charte,
// 90 %, vaut 0,9), exprimée aussi en diaphs par rapport au gris (un diaph = deux fois plus de lumière).
//   - Exposition : x × 2^e (e en diaphs, l'iris ou le temps de pose) ; gain : × 10^(g/20)
//     (6 dB ≈ un diaph de plus au signal, et autant de bruit en plus).
//   - Le capteur (ordre de grandeur d'une caméra actuelle) : 14 diaphs, du plancher de bruit
//     (0,18 × 2^−8) à la saturation des photosites (0,18 × 2^6). Le gain n'ajoute pas de plage : il
//     monte tout, bruit compris, et fait écrêter plus tôt.
//   - Les courbes de transfert (OETF) :
//       BT.709 : V = 4,5 L sous 0,018, sinon 1,099 L^0,45 − 0,099 ; écrêtage à 109 % ;
//       BT.709 avec knee : au-dessus de 85 %, la courbe est comprimée (pente en log) pour que 600 %
//       arrive à 109 % ;
//       S-Log3 (Sony) : V = (420 + 261,5 log10((x + 0,01) ÷ 0,19)) ÷ 1023 au-dessus de 0,01125,
//       linéaire dessous ; le gris à 41 % ;
//       HLG (BT.2100) : E = 0,2674 x (le gris à 38 %, le blanc 90 % vers 73 %, BT.2408),
//       V = √(3E) sous 1/12, sinon a ln(12E − b) + c.
// Les niveaux sont des niveaux de signal (0 = noir, 1 = 100 %), lus sur la forme d'onde.
// ----------------------------------------------------------------------------------
export const GRIS = 0.18;
/** le capteur : plancher de bruit et saturation, en luminance relative de la scène à exposition 0 */
export const CAPTEUR = { bruit: GRIS * Math.pow(2, -8), sature: GRIS * Math.pow(2, 6) };
/** les plages de la charte : de −6 à +6 diaphs autour du gris */
export const CHARTE = Array.from({ length: 13 }, (_, k) => k - 6);

const HLG = { a: 0.17883277, b: 0.28466892, c: 0.55991073, k: 0.2674 };
const KNEE = { point: 0.85, max: 6 };
const v709 = (L) => (L < 0.018 ? 4.5 * L : 1.099 * Math.pow(L, 0.45) - 0.099);
const L709 = (V) => (V < 0.081 ? V / 4.5 : Math.pow((V + 0.099) / 1.099, 1 / 0.45));
const LKNEE = L709(KNEE.point);

/** @typedef {{ id: string, nom: string, oetf: (x: number) => number, clip: number, grisCible: number }} Courbe */
/** @type {Record<string, Courbe>} */
export const COURBES = {
  bt709: { id: 'bt709', nom: 'BT.709', clip: 1.09, grisCible: 0.41, oetf: (x) => v709(Math.max(0, x)) },
  knee: {
    id: 'knee', nom: 'BT.709 avec knee', clip: 1.09, grisCible: 0.41,
    oetf: (x) => { const L = Math.max(0, x); if (L <= LKNEE) return v709(L); return KNEE.point + (1.09 - KNEE.point) * Math.log(L / LKNEE) / Math.log(KNEE.max / LKNEE); },
  },
  slog3: {
    id: 'slog3', nom: 'S-Log3', clip: 1.0, grisCible: 420 / 1023,
    oetf: (x) => (x >= 0.01125 ? (420 + Math.log10((x + 0.01) / 0.19) * 261.5) / 1023 : (x * (171.2102946929 - 95) / 0.01125 + 95) / 1023),
  },
  hlg: {
    id: 'hlg', nom: 'HLG (BT.2100)', clip: 1.0, grisCible: 0.38,
    oetf: (x) => { const E = Math.max(0, x) * HLG.k; return E <= 1 / 12 ? Math.sqrt(3 * E) : HLG.a * Math.log(12 * E - HLG.b) + HLG.c; },
  },
};
/** le gain (dB) en facteur de signal */
export const gainLin = (dB) => Math.pow(10, dB / 20);
/** gain en diaphs (6,02 dB par diaph) */
export const gainDiaphs = (dB) => dB / (20 * Math.log10(2));
/**
 * Le signal d'une plage de luminance relative x, avec l'exposition e (diaphs), le gain g (dB) et la courbe.
 * @returns {{ V: number, sature: boolean, bruit: boolean, ecrete: boolean }} V borné à l'écrêtage de la courbe
 */
export function signal(/** @type {string} */ courbe, x, e = 0, g = 0) {
  const C = COURBES[courbe] || COURBES.bt709;
  const xs = x * Math.pow(2, e);                  // la lumière sur le capteur
  const sature = xs >= CAPTEUR.sature;
  const bruit = xs <= CAPTEUR.bruit;
  const L = Math.min(xs, CAPTEUR.sature) * gainLin(g); // le capteur écrête, puis le gain monte le signal
  const brut = C.oetf(L);
  const ecrete = brut >= C.clip;
  return { V: Math.max(0, Math.min(brut, C.clip)), sature, bruit, ecrete };
}
/** la luminance de la scène (x, à exposition 0) qui fait écrêter le signal, avec ce réglage */
export function xEcretage(/** @type {string} */ courbe, e = 0, g = 0) {
  const C = COURBES[courbe] || COURBES.bt709;
  // recherche par dichotomie sur le signal (croissant en x)
  let lo = 1e-6, hi = CAPTEUR.sature / Math.pow(2, e);
  if (C.oetf(CAPTEUR.sature * gainLin(g)) < C.clip) return hi; // c'est le capteur qui sature d'abord
  for (let k = 0; k < 80; k++) { const m = Math.sqrt(lo * hi); if (C.oetf(m * Math.pow(2, e) * gainLin(g)) >= C.clip) hi = m; else lo = m; }
  return hi;
}
/** la luminance de la scène au plancher de bruit, avec cette exposition (le gain ne le baisse pas) */
export const xBruit = (e = 0) => CAPTEUR.bruit / Math.pow(2, e);
/** la plage utile (diaphs) de la scène : du plancher de bruit à l'écrêtage, et sa part au-dessus du gris */
export function plage(/** @type {string} */ courbe, e = 0, g = 0) {
  const haut = xEcretage(courbe, e, g), bas = xBruit(e);
  return { diaphs: Math.log2(haut / bas), dessus: Math.log2(haut / GRIS), dessous: Math.log2(GRIS / bas) };
}
/** l'écart en diaphs entre deux luminances */
export const ecartDiaphs = (x1, x2) => Math.log2(x2 / x1);
/** l'exposition (diaphs) qui met le gris au niveau V avec cette courbe et ce gain */
export function expoPourGris(/** @type {string} */ courbe, V, g = 0) {
  let lo = -8, hi = 8;
  for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (signal(courbe, GRIS, m, g).V < V) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

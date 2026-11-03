// @ts-check
// ----------------------------------------------------------------------------------
// L'optique de l'atelier « Optique et profondeur de champ » (Labo). Calcul pur, en lentille mince :
// les longueurs en millimètres pour l'objectif, en mètres pour les distances de la scène.
//   - Tache de flou sur le capteur d'un point à la distance d quand le point est fait à s :
//     t = f² × |d − s| ÷ (N × d × (s − f)).
//   - Hyperfocale : H = f² ÷ (N × c) + f. Point fait à H : net de H ÷ 2 (à f près) jusqu'à l'infini.
//   - Limites de la zone nette : proche = s(H − f) ÷ (H + s − 2f), lointaine = s(H − f) ÷ (H − s),
//     l'infini si s ≥ H. Mêmes formules que le module caméra (camlab/optics.js) : à 54 mm, f/1,8,
//     c = 0,011 mm, point à 3 m, net de 2,94 à 3,06 m.
//   - Champ couvert à la distance d : d × (dimension du capteur) ÷ f ; angle : 2 atan(dim ÷ 2f).
// Cercle de confusion admis, par convention : environ deux photosites en HD sur 2/3" (0,011 mm),
// 0,025 mm en Super 35, 0,03 mm en plein format 24 × 36. Ce sont des conventions, pas des lois :
// on le dit dans l'atelier.
// ----------------------------------------------------------------------------------
/** @typedef {{ id: string, nom: string, w: number, h: number, c: number }} Capteur */
/** les capteurs de l'atelier (image 16:9 utile ; dimensions en mm) */
export const CAPTEURS = /** @type {Record<string, Capteur>} */ ({
  '2/3': { id: '2/3', nom: '2/3" (caméra de plateau)', w: 9.59, h: 5.39, c: 0.011 },
  s35: { id: 's35', nom: 'Super 35 (caméra cinéma)', w: 24.89, h: 14.0, c: 0.025 },
  ff: { id: 'ff', nom: 'Plein format 24 × 36', w: 36, h: 20.25, c: 0.03 },
});
/** crans d'iris (nombres f), du plus ouvert au plus fermé */
export const IRIS = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
/** focales proposées (mm), de 8 à 200 mm */
export const FOCALE = { min: 8, max: 200 };

/** hyperfocale (m) pour la focale f (mm), le nombre N et le cercle de confusion c (mm) */
export const hyperfocale = (f, N, c) => (f * f / (N * c) + f) / 1000;
/**
 * limites de la zone nette (m) pour le point fait à s (m) : [proche, lointaine] ; lointaine = Infinity
 * au-delà de l'hyperfocale
 */
export function limites(f, N, c, s) {
  const H = hyperfocale(f, N, c) * 1000, S = s * 1000;
  const near = S * (H - f) / (H + S - 2 * f);
  const far = S >= H ? Infinity : S * (H - f) / (H - S);
  return [near / 1000, far / 1000];
}
/** profondeur de champ totale (m), Infinity si la zone va jusqu'à l'infini */
export const profondeur = (f, N, c, s) => { const [a, b] = limites(f, N, c, s); return b - a; };
/** diamètre de la tache de flou sur le capteur (mm) d'un point à d (m), le point fait à s (m) */
export function tache(f, N, s, d) {
  const S = s * 1000, D = d * 1000;
  if (S <= f) return Infinity;
  return f * f * Math.abs(D - S) / (N * D * (S - f));
}
/** le point à d est net : sa tache reste sous le cercle de confusion */
export const net = (f, N, c, s, d) => tache(f, N, s, d) <= c * (1 + 1e-9);
/** largeur et hauteur (m) du champ couvert à la distance d (m) */
export const champ = (/** @type {Capteur} */ K, f, d) => ({ w: d * K.w / f, h: d * K.h / f });
/** angle de champ horizontal (degrés) */
export const angleH = (/** @type {Capteur} */ K, f) => 2 * Math.atan(K.w / (2 * f)) * 180 / Math.PI;
/** la focale (mm) qui couvre une largeur w (m) à la distance d (m) */
export const focalePour = (/** @type {Capteur} */ K, w, d) => d * K.w / w;
/** facteur de recadrage par rapport au plein format, à cadre 16:9 égal (rapport des largeurs) : 3,75 en 2/3", 1,45 en Super 35 */
export const recadrage = (/** @type {Capteur} */ K) => 36 / K.w;
/** le cran d'iris le plus proche d'un nombre f */
export const cranIris = (N) => IRIS.reduce((b, x) => (Math.abs(Math.log(x / N)) < Math.abs(Math.log(b / N)) ? x : b), IRIS[0]);
/** écriture d'une distance : 2,94 m, 66 m, ∞ */
export const distTxt = (d) => (!isFinite(d) ? '∞' : (d < 10 ? (Math.round(d * 100) / 100) : Math.round(d * 10) / 10).toString().replace('.', ',') + ' m');

// @ts-check
// ----------------------------------------------------------------------------------
// La photométrie de l'atelier « Photométrie » (Labo). Calcul pur.
//   - Intensité dans l'axe I (candelas) : celle du projecteur à son angle de faisceau θ. Entre le
//     serré (spot) et le large (flood), I suit une loi de puissance de θ passant par les deux points
//     de la fiche : I(θ) = Ispot × (θ ÷ θspot)^k.
//   - Hors de l'axe, à l'angle α : I(α) = I × 2^−(2α ÷ θ)² : l'angle de faisceau est, par définition,
//     celui où l'intensité tombe à la moitié de l'axe (l'angle de champ, à 10 %, en vaut 1,8 fois).
//   - Éclairement reçu (lux) : E = I(α) × cos i ÷ d² (inverse du carré et cosinus de l'incidence i).
//   - Luminance d'une surface mate de facteur de réflexion ρ : L = ρ × E ÷ π (cd/m²).
//   - Lampe halogène sur gradateur, en tension relative V : flux ∝ V^3,4, température ∝ V^0,42
//     (lois empiriques des lampes à incandescence : à mi-tension, 9 % du flux et environ 2 400 K).
//     Une LED garde sa couleur : flux ∝ niveau.
//   - Couleur : en mireds (10⁶ ÷ K) ; une gélatine décale les mireds et laisse passer une part de la
//     lumière ; deux sources se mélangent en moyenne des mireds pondérée par l'éclairement (ordre de
//     grandeur : la couleur perçue d'un mélange n'est pas exactement là).
//   - Exposition au luxmètre (cellule plate) : N² ÷ t = E × S ÷ C, C = 250 (constante d'étalonnage
//     des cellules plates en lux ; 1 000 lx, ISO 800, 1/50 s : f/8).
// Les projecteurs sont des ordres de grandeur de fiches constructeur (Fresnel 1 kW halogène,
// Fresnel HMI 575 W, panneau LED bicolore), pas les mesures d'un modèle précis.
// ----------------------------------------------------------------------------------
/**
 * @typedef {object} Source
 * @property {string} id
 * @property {string} nom
 * @property {'halogene' | 'hmi' | 'led'} type
 * @property {number} T température de couleur à pleine puissance (K) ; pour la LED, la valeur par défaut
 * @property {[number, number]} [plageT] LED bicolore : températures réglables
 * @property {[number, number]} angles angle de faisceau serré et large (degrés)
 * @property {[number, number]} I intensité dans l'axe au serré et au large (cd)
 * @property {number} watts puissance consommée (W)
 */
/** @type {Record<string, Source>} */
export const SOURCES = {
  fresnel: { id: 'fresnel', nom: 'Fresnel 1 kW halogène', type: 'halogene', T: 3200, angles: [12, 60], I: [80000, 5500], watts: 1000 },
  hmi: { id: 'hmi', nom: 'Fresnel HMI 575 W', type: 'hmi', T: 5600, angles: [12, 55], I: [190000, 14000], watts: 575 },
  led: { id: 'led', nom: 'Panneau LED bicolore', type: 'led', T: 5600, plageT: [2800, 6500], angles: [50, 50], I: [3600, 3600], watts: 100 },
};
/**
 * @typedef {{ id: string, nom: string, mired: number, trans: number }} Gel
 * les gélatines (ordres de grandeur des nuanciers : décalage en mireds, part de lumière transmise)
 */
/** @type {Gel[]} */
export const GELS = [
  { id: 'aucune', nom: 'Aucune', mired: 0, trans: 1 },
  { id: 'ctb', nom: 'CTB plein (bleu correcteur)', mired: -137, trans: 0.36 },
  { id: 'demi-ctb', nom: '½ CTB', mired: -78, trans: 0.55 },
  { id: 'cto', nom: 'CTO plein (orange correcteur)', mired: 159, trans: 0.55 },
  { id: 'demi-cto', nom: '½ CTO', mired: 81, trans: 0.7 },
  { id: 'nd3', nom: 'ND 0,3 (un diaph)', mired: 0, trans: 0.5 },
  { id: 'nd6', nom: 'ND 0,6 (deux diaphs)', mired: 0, trans: 0.25 },
];
export const gelById = (/** @type {string} */ id) => GELS.find((g) => g.id === id) || GELS[0];
/** constante d'étalonnage d'une cellule plate (lux) */
export const C_CELLULE = 250;

const rad = (a) => a * Math.PI / 180;
/** angle de faisceau réglable (degrés), borné à la plage du projecteur */
export const angleBorne = (/** @type {Source} */ S, a) => Math.min(Math.max(a, S.angles[0]), S.angles[1]);
/** intensité dans l'axe (cd) à l'angle de faisceau θ, à pleine puissance et sans gélatine */
export function intensiteAxe(/** @type {Source} */ S, theta) {
  const [a0, a1] = S.angles, [i0, i1] = S.I; const t = angleBorne(S, theta);
  if (a0 === a1) return i0;
  const k = Math.log(i1 / i0) / Math.log(a1 / a0);
  return i0 * Math.pow(t / a0, k);
}
/** part de l'intensité de l'axe à l'angle α hors de l'axe (faisceau de θ degrés) */
export const profil = (theta, alpha) => Math.pow(2, -((2 * alpha / theta) ** 2));
/** flux relatif et température d'une source selon le niveau du gradateur (0 à 1) */
export function gradateur(/** @type {Source} */ S, niveau, Tled = S.T) {
  const v = Math.min(Math.max(niveau, 0), 1);
  if (S.type === 'halogene') return { flux: Math.pow(v, 3.4), T: v > 0 ? S.T * Math.pow(v, 0.42) : 0 };
  // une HMI ne se gradue que peu (on la règle par la distance, les volets, les filtres) : ordre de grandeur, flux ∝ niveau au-dessus de 50 %
  if (S.type === 'hmi') return { flux: Math.max(0.5, v), T: S.T };
  const T = S.plageT ? Math.min(Math.max(Tled, S.plageT[0]), S.plageT[1]) : S.T;
  return { flux: v, T };
}
export const mired = (T) => 1e6 / T;
export const kelvin = (m) => 1e6 / m;
/**
 * L'éclairement reçu au sujet et la couleur d'une source réglée.
 * @param {{ source: string, angle: number, niveau: number, Tled?: number, gel?: string, d: number, alpha?: number, incidence?: number }} p
 *   d : distance (m) ; alpha : écart entre l'axe du projecteur et le sujet (degrés) ; incidence : angle entre la direction
 *   de la lumière et la normale de la cellule (degrés)
 */
export function eclairage(p) {
  const S = SOURCES[p.source] || SOURCES.fresnel; const G = gelById(p.gel || 'aucune');
  const theta = angleBorne(S, p.angle);
  const g = gradateur(S, p.niveau, p.Tled);
  const I0 = intensiteAxe(S, theta) * g.flux * G.trans;
  const I = I0 * profil(theta, Math.abs(p.alpha || 0));
  const cosi = Math.max(0, Math.cos(rad(p.incidence || 0)));
  const E = p.d > 0 ? I * cosi / (p.d * p.d) : 0;
  const T = g.T > 0 ? kelvin(mired(g.T) + G.mired) : 0;
  return { I0, I, E, T, theta, diametre: 2 * p.d * Math.tan(rad(theta / 2)) };
}
/** deux sources ou plus : éclairement total et température moyenne (en mireds pondérés par l'éclairement) */
export function melange(/** @type {{ E: number, T: number }[]} */ list) {
  const E = list.reduce((s, x) => s + x.E, 0);
  if (E <= 0) return { E: 0, T: 0 };
  const m = list.reduce((s, x) => s + (x.T > 0 ? x.E * mired(x.T) : 0), 0) / E;
  return { E, T: kelvin(m) };
}
/** dominante vue par une caméra balancée à Tcam (K) : écart en mireds (positif : la lumière est plus chaude) */
export const dominante = (Tlum, Tcam) => mired(Tlum) - mired(Tcam);
/** le nombre f juste pour un éclairement E (lx), une sensibilité S (ISO) et un temps de pose t (s) */
export const ouverture = (E, S, t) => Math.sqrt(E * t * S / C_CELLULE);
/** l'éclairement qu'il faut pour exposer à N, S, t */
export const eclairementPour = (N, S, t) => N * N * C_CELLULE / (t * S);
/** écart d'exposition en diaphs entre ce qu'on a (E) et ce qu'il faut (Eref) */
export const diaphs = (E, Eref) => Math.log2(E / Eref);
/** luminance (cd/m²) d'une surface mate de facteur de réflexion rho sous l'éclairement E */
export const luminance = (E, rho) => rho * E / Math.PI;
/** rapport de contraste lumière principale / débouchage : (Ep + Ed) ÷ Ed, et son écart en diaphs */
export function contraste(Ep, Ed) {
  if (Ed <= 0) return { rapport: Infinity, diaphs: Infinity };
  const r = (Ep + Ed) / Ed; return { rapport: r, diaphs: Math.log2(r) };
}

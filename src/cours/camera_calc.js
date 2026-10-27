// @ts-check
import { SENSOR, LENS, COC, maxAperture } from '../camlab/optics.js';

// ----------------------------------------------------------------------------------
// Les calculs des leçons de la caméra, de la lentille frontale au moniteur (cours/camera_*.js) et de
// leurs exercices (cours/exos/camera_notions.js). Pur, sans interface, testé à part. Les chiffres sont
// ceux des fiches du module « La caméra en 3D » (src/camlab/notions) : Sony HXC-FB80 (f/13 à 2 000 lux
// en 50 Hz, 60 dB de rapport signal sur bruit), Fujinon ZA12x4.5BERD (camlab/optics.js), capteur 2/3"
// (9,59 × 5,39 mm, 1 920 photosites de 5 µm), ITU-R BT.709 (OETF, Y'CbCr, 10 bits 64–940),
// ITU-R BT.1886 (gamma 2,4), ITU-R BT.2100 (HLG) et BT.2408 (blanc de référence à 75 %), EBU R 103.
// ----------------------------------------------------------------------------------

// ---------------- l'objectif ----------------
/** réflexion d'une surface air-verre en incidence normale (Fresnel) : ((n − 1) ÷ (n + 1))² */
export const fresnel = (n = 1.5) => ((n - 1) / (n + 1)) ** 2;
/** lumière transmise par un objectif de s surfaces air-verre qui réfléchissent chacune r */
export const transmission = (s, r) => (1 - r) ** s;
/** réflexion par surface selon le traitement (fiche « La lentille frontale ») */
export const TRAITEMENTS = { nu: fresnel(1.5), simple: 0.013, multi: 0.002 };
/** angle de champ (degrés) d'une dimension de capteur dim (mm) à la focale f (mm) */
export const angleDeg = (dim, f) => 2 * Math.atan(dim / 2 / f) * 180 / Math.PI;
/** focale (mm) qui cadre une largeur w (m) à la distance D (m), sur la largeur du capteur (9,59 mm en 2/3") */
export const focalePour = (w, D, capteur = SENSOR.w) => D * capteur / w;
/** focale (mm) qui cadre une hauteur h (m) à la distance D (m) : la valeur de plan d'une personne */
export const focalePourHauteur = (h, D) => D * SENSOR.h / h;
/** facteur entre une focale photo plein format (36 mm de large) et la focale 2/3" qui donne le même cadre */
export const EQUIV_24x36 = 36 / SENSOR.w;
/** rapport de zoom */
export const rapportZoom = (fmin = LENS.fmin, fmax = LENS.fmax) => fmax / fmin;

/** nombre f réellement obtenu à la focale f (ramping, doubleur) : l'iris N demandé, ou l'ouverture maximale */
export const nombreF = (N, f, ext = false) => Math.max(N, maxAperture(f, ext));
/** écart en diaphragmes entre deux nombres f (positif : N2 laisse passer moins de lumière) */
export const diaphIris = (N1, N2) => 2 * Math.log2(N2 / N1);
/** tache de diffraction (diamètre, µm) d'un point à l'ouverture N : 2,44 × λ × N, λ = 0,55 µm */
export const diffraction = (N, lambda = 0.55) => 2.44 * lambda * N;
/** taille d'un photosite (µm) : largeur du capteur ÷ nombre de colonnes */
export const photosite = (colonnes = 1920, w = SENSOR.w) => w / colonnes * 1000;
/** décalage d'image (mm) qu'il faut pour voir net à d au lieu de d0 (lentille mince, macro) : f² × (1/d − 1/d0), d et d0 en m */
export const decalageImage = (f, d, d0 = LENS.mod) => f * f * (1 / (d * 1000) - 1 / (d0 * 1000));

// ---------------- la lumière jusqu'aux capteurs ----------------
/** densité optique d'un filtre qui transmet t */
export const densite = (t) => -Math.log10(t);
/** diaphragmes retirés par un filtre qui transmet t (1/4 : 2, 1/16 : 4, 1/64 : 6) */
export const diaphND = (t) => -Math.log2(t);
/** diaphragmes apportés par un gain en dB (6,02 dB par diaphragme) */
export const diaphGain = (dB) => dB / (20 * Math.log10(2));
/** diaphragmes retirés par un temps de pose t (s), par rapport à 1/50 s */
export const diaphShutter = (t, tRef = 1 / 50) => Math.log2(tRef / t);
/** sensibilité de la HXC-FB80 : f/13 à 2 000 lux en 50 Hz, shutter OFF, sans filtre ni gain */
export const SENSIBILITE = { N: 13, lux: 2000 };
/**
 * Le nombre f qui expose une scène au niveau nominal : N = 13 × √(lux ÷ 2000 × transmission du ND × gain × temps de pose ÷ 1/50).
 * @param {number} lux @param {number} [nd] transmission du filtre @param {number} [gainDb] @param {number} [t] temps de pose (s)
 */
export function irisPour(lux, nd = 1, gainDb = 0, t = 1 / 50) {
  return SENSIBILITE.N * Math.sqrt(lux / SENSIBILITE.lux * nd * 10 ** (gainDb / 20) * (t * 50));
}
/**
 * Le bilan en diaphragmes d'une exposition : positif, l'image est trop claire de tant de diaphragmes ; 0 au nominal.
 * @param {{ lux: number, N: number, nd?: number, gainDb?: number, t?: number }} e
 */
export function bilanExposition(e) {
  return Math.log2(e.lux / SENSIBILITE.lux) + diaphIris(SENSIBILITE.N, e.N) * -1 - diaphND(e.nd ?? 1) + diaphGain(e.gainDb ?? 0) - diaphShutter(e.t ?? 1 / 50);
}
/** rapport signal sur bruit (dB) de la HXC-FB80 au gain donné : 60 dB à 0 dB, le gain amplifie le bruit autant que le signal */
export const snrGain = (gainDb) => 60 - Math.max(0, gainDb);
/** bruit de photons : un photosite qui reçoit n électrons en moyenne en reçoit n ± √n ; rapport signal sur bruit en dB */
export const snrPhotons = (n) => 20 * Math.log10(Math.sqrt(n));
/** distance (m) parcourue pendant le temps de pose par un objet à v (m/s) */
export const bouge = (v, t) => v * t;
/** battements d'une lampe à f Hz (100 Hz sur le secteur à 50 Hz) pendant un temps de pose t : entier, pas de scintillement */
export const battements = (t, f = 100) => t * f;
export const scintille = (t, f = 100) => Math.abs(battements(t, f) - Math.round(battements(t, f))) > 1e-6;
/** mired d'une température de couleur, et l'écart entre deux lumières */
export const mired = (T) => 1e6 / T;
export const ecartMired = (T1, T2) => mired(T1) - mired(T2);
/** limite de Nyquist (paires de lignes par mm) d'un photosite de p µm */
export const nyquist = (p = photosite()) => 1000 / (2 * p);
/** focale (mm) à laquelle un motif de période P (mm) vu à D (m) tombe sur deux photosites : au-delà, plus large, le moiré guette */
export const focaleMoire = (P, D, p = photosite()) => 2 * p / 1000 * D * 1000 / P;
/** loi de Wien : maximum d'émission (nm) d'un corps noir à T (K) */
export const wien = (T) => 2898e3 / T;

// ---------------- les capteurs et le signal ----------------
/** luminance BT.709 */
export const Y709 = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
/** Y', Cb, Cr (BT.709) de R', G', B' (0 à 1) */
export function ycbcr(r, g, b) { const y = Y709(r, g, b); return { y, cb: (b - y) / 1.8556, cr: (r - y) / 1.5748 }; }
/** au vectorscope : la teinte (angle depuis l'axe Cb, degrés, 0 à 360) et la saturation (distance au centre) */
export function vecteur(r, g, b) {
  const { cb, cr } = ycbcr(r, g, b);
  const a = Math.atan2(cr, cb) * 180 / Math.PI;
  return { angle: (a + 360) % 360, sat: Math.hypot(cb, cr) };
}
/** ligne des carnations au vectorscope (degrés) */
export const CARNATIONS = 123;
/** les barres 75 % (100/0/75/0), dans l'ordre de la mire : nom et R', G', B' */
export const BARRES = /** @type {const} */ ([['gris', 1, 1, 1], ['jaune', 1, 1, 0], ['cyan', 0, 1, 1], ['vert', 0, 1, 0], ['magenta', 1, 0, 1], ['rouge', 1, 0, 0], ['bleu', 0, 0, 1]]);
/** luminance (%) d'une barre à 75 % */
export const lumaBarre = (/** @type {readonly [string, number, number, number]} */ b) => 100 * Y709(0.75 * b[1], 0.75 * b[2], 0.75 * b[3]);
/** code 10 bits d'un niveau de luminance en % (64 = 0 %, 940 = 100 %), borné aux codes d'image (4 à 1019) */
export const code10 = (pct) => Math.max(4, Math.min(1019, Math.round(64 + 876 * pct / 100)));
/** code 8 bits (16 = 0 %, 235 = 100 %) */
export const code8 = (pct) => Math.max(1, Math.min(254, Math.round(16 + 219 * pct / 100)));
/** niveau (%) d'un code de luminance 10 bits */
export const pctDe = (code) => (code - 64) / 876 * 100;
/** code 10 bits d'une différence de couleur (−0,5 à +0,5) : 512 au centre, 64 et 960 aux extrêmes */
export const codeC = (c) => Math.max(4, Math.min(1019, Math.round(512 + 896 * c)));
/** millivolts d'un niveau en % (0 à 700 mV pour 0 à 100 %) */
export const mV = (pct) => pct * 7;
/**
 * Débit d'un SDI (Gb/s) : échantillons par ligne (suppression comprise) × lignes × images × 2 mots (Y' et C) × 10 bits.
 * Les formats en 50 Hz du car.
 */
export const RASTERS = {
  '720p50': { ech: 1980, lignes: 750, ips: 50, lien: 'HD-SDI' },
  '1080i50': { ech: 2640, lignes: 1125, ips: 25, lien: 'HD-SDI' },
  '1080p50': { ech: 2640, lignes: 1125, ips: 50, lien: '3G-SDI' },
  '2160p50': { ech: 5280, lignes: 2250, ips: 50, lien: '12G-SDI' },
};
export const debitSDI = (/** @type {keyof typeof RASTERS} */ fmt) => { const r = RASTERS[fmt]; return r.ech * r.lignes * r.ips * 2 * 10 / 1e9; };

// ---------------- le traitement de l'image ----------------
/** OETF BT.709 : lumière L (0 à 1, au-delà pour les hautes lumières) → signal V */
export const oetf709 = (L) => (L < 0.018 ? 4.5 * L : 1.099 * Math.pow(L, 0.45) - 0.099);
/** la même courbe avec un exposant réglé (MASTER GAMMA) ; 0,45 donne la BT.709. Près du noir, une droite qui se raccorde à la puissance en 1,8 % */
export function gammaCourbe(L, exp = 0.45) {
  const v0 = 1.099 * Math.pow(0.018, exp) - 0.099;
  return L < 0.018 ? L * v0 / 0.018 : 1.099 * Math.pow(L, exp) - 0.099;
}
/** EOTF de l'écran de référence (BT.1886, sans noir) : luminosité relative d'un signal V */
export const eotf1886 = (V, g = 2.4) => Math.pow(Math.max(0, V), g);
/** black gamma : relève (k > 0) ou abaisse (k < 0) le bas de la courbe, sur la plage [0, range], sans bouger le noir ni le haut */
export function blackGamma(V, k = 0, range = 0.3) {
  if (!k || V <= 0 || V >= range) return V;
  const x = V / range;
  return V + k * range * x * (1 - x) * (1 - x) * 1.5;
}
/** knee : au-dessus du point p (0 à 1), le signal ne monte plus qu'avec la pente s ; puis le white clip c */
export function kneeClip(V, p = 0.95, s = 0.1, c = 1.03) {
  const k = V > p ? p + (V - p) * s : V;
  return Math.min(k, c);
}
/**
 * La chaîne complète, de la lumière de scène L (1 = le blanc nominal) au signal en % : le master black (black, une part de
 * la lumière ajoutée ou retirée avant la courbe, le blanc ne bougeant pas), le noir écrêté à 0 (« bouché »), le gamma et
 * le black gamma, puis le knee et le white clip.
 */
export function signalDe(L, o = {}) {
  const { exp = 0.45, black = 0, bk = 0, knee = 0.95, slope = 0.1, kneeOn = true, clip = 1.03 } = /** @type {any} */ (o);
  const Lp = Math.max(0, black + (1 - black) * L);
  let V = blackGamma(gammaCourbe(Lp, exp), bk);
  V = kneeOn ? kneeClip(V, knee, slope, clip) : Math.min(V, clip);
  return V * 100;
}
/** le niveau de lumière (fraction du blanc nominal) d'un signal V (inverse de la BT.709) */
export const lumiereDe = (V) => (V < 0.081 ? V / 4.5 : Math.pow((V + 0.099) / 1.099, 1 / 0.45));
/** gains R et B de la balance des blancs pour une lumière Tl vue par une caméra balancée pour Tc (castOf de camlab/optics.js) */
export { castOf, kelvinRGB } from '../camlab/optics.js';
/** saturation : rapproche (k < 1) ou éloigne (k > 1) une couleur du gris de même luminance */
export function saturer(r, g, b, k) { const y = Y709(r, g, b); return [y + k * (r - y), y + k * (g - y), y + k * (b - y)]; }
/**
 * La matrice utilisateur (P14 USER MATRIX : R-G, R-B, G-R, G-B, B-R, B-G) : chaque voie reçoit une part de sa
 * différence avec une autre. Sur un gris (R = G = B), rien ne change.
 * @param {number[]} rgb @param {{ rg?: number, rb?: number, gr?: number, gb?: number, br?: number, bg?: number }} m
 */
export function matrice([r, g, b], m) {
  return [r + (m.rg || 0) * (r - g) + (m.rb || 0) * (r - b), g + (m.gr || 0) * (g - r) + (m.gb || 0) * (g - b), b + (m.br || 0) * (b - r) + (m.bg || 0) * (b - g)];
}
/** le détail sur un profil : le signal plus k fois son écart à la moyenne de ses voisins, borné par le limiteur ; sous le seuil crisp, rien */
export function detail(profil, k = 0.5, limiter = 0.1, crisp = 0) {
  return profil.map((v, i) => {
    const a = profil[Math.max(0, i - 2)], b = profil[Math.min(profil.length - 1, i + 2)];
    const e = v - (a + b) / 2;
    if (Math.abs(e) <= crisp) return v;
    return v + Math.max(-limiter, Math.min(limiter, k * e));
  });
}

// ---------------- le corps et la voie caméra ----------------
/** consommations de la tête (W) d'après la fiche HXC-FB80 ; l'objectif est un ordre de grandeur */
export const CONSO = { corps: 19, viseur: 13, objectif: 4 };
/** autonomie (h) d'une batterie de E Wh pour une puissance P (W) */
export const autonomie = (E, P) => E / P;
/** courant (A) demandé sur DC IN à la tension U (V) pour une puissance P (W) ; la prise accepte 5,4 A au plus */
export const courantDC = (P, U = 12) => P / U;
export const DC_IN = { min: 10.5, max: 17, A: 5.4 };
/** longueur maximale du câble hybride alimenté par la CCU (HXC-FB80, objectif portable) et de la fibre monomode seule (m) */
export const PORTEE = { hybride: 600, monomode: 10000 };
/** couple (N·m) d'une charge m (kg) dont le centre de gravité est à d (m) de l'axe */
export const couple = (m, d) => m * 9.81 * d;
/** amplitude d'une référence sur une entrée en boucle : bouchons de 75 Ω au bout de la ligne (0, 1 ou 2) → facteur sur l'amplitude nominale */
export function amplitudeBoucle(bouchons) {
  if (bouchons <= 0) return 2; // l'onde se réfléchit au bout du câble ouvert et s'ajoute à elle-même
  const R = 75 / bouchons;
  return 2 * R / (75 + R);
}
/** demi-impulsion du tri-level (µs) : 44 périodes de l'horloge (74,25 MHz en 1080i50) */
export const triLevelUs = (T = 44, MHz = 74.25) => T / MHz;
/** zone de sécurité du viseur : marge (pixels) de chaque côté pour une zone de pct % de l'image */
export const margeSecurite = (pct, px = 1920) => px * (1 - pct / 100) / 2;
/** zébra : une zone de niveau v (%) est hachurée par un zébra centré sur z de largeur w */
export const zebra = (v, z = 70, w = 10) => Math.abs(v - z) <= w / 2;
/** quel tally s'allume sur une caméra : rouge au programme, vert au preview (si le car l'utilise), éteint sinon */
export const tallyDe = (cam, pgm, pvw) => (cam === pgm ? 'rouge' : cam === pvw ? 'vert' : 'éteint');

// ---------------- jusqu'au moniteur ----------------
/** la PLUGE : barres à −2, +2 et +4 % sur le noir */
export const PLUGE = [-2, 2, 4];
/**
 * Un niveau de la PLUGE se voit-il ? Avec une luminosité (décalage du noir de l'écran, en % du signal) b, l'écran
 * montre max(0, v + b) : la barre se distingue du noir de fond (0 % + b) si les deux ne sont pas écrasés au même noir.
 */
export function plugeVisible(v, b) { const fond = Math.max(0, b), barre = Math.max(0, v + b); return Math.abs(barre - fond) > 1e-9; }
/** luminosité bien réglée : la −2 % se confond avec le noir, la +2 % reste visible (à 1,5 % au moins au-dessus du noir affiché) */
export const plugeJuste = (b) => !plugeVisible(-2, b) && 2 + b >= 1.5;
/** luminance (cd/m²) d'un signal V (0 à 1) sur un écran BT.1886 réglé à Lw cd/m² pour le blanc, avec un décalage du noir b (fraction) */
export const luminanceEcran = (V, Lw = 100, b = 0) => Lw * Math.pow(Math.max(0, V + b), 2.4);
/** en bleu seul : la voie bleue affichée d'une barre 75 % quand la chroma du moniteur vaut k (1 = juste) */
export function bleuSeul(/** @type {readonly [string, number, number, number]} */ barre, k = 1) {
  const r = 0.75 * barre[1], g = 0.75 * barre[2], b = 0.75 * barre[3], y = Y709(r, g, b);
  return Math.max(0, y + k * (b - y));
}

// ---------------- pour aller plus loin ----------------
/** facteur de format entre le Super 35 (≈ 25 mm de large, ordre de grandeur) et le 2/3" */
export const CROP_S35 = 2.6;
/** profondeur de champ totale (m), sans l'infini, pour un cercle de confusion c (mm) */
export function pdcTotale(f, N, s, c = COC) {
  const H = (f * f / (N * c) + f) / 1000, fm = f / 1000;
  const near = s * (H - fm) / (H + s - 2 * fm), far = s >= H ? Infinity : s * (H - fm) / (H - s);
  return far - near;
}
/** OETF HLG (BT.2100) : lumière de scène E (0 à 1, 1 = le maximum) → signal (0 à 1) */
export function hlg(E) {
  const a = 0.17883277, b = 1 - 4 * a, c = 0.5 - a * Math.log(4 * a);
  return E <= 1 / 12 ? Math.sqrt(3 * E) : a * Math.log(12 * E - b) + c;
}
/** lumière de scène d'un signal HLG (inverse) */
export function hlgInverse(V) {
  const a = 0.17883277, b = 1 - 4 * a, c = 0.5 - a * Math.log(4 * a);
  return V <= 0.5 ? V * V / 3 : (Math.exp((V - c) / a) + b) / 12;
}
/** le blanc de référence HLG (BT.2408) : 75 % du signal ; sa lumière de scène */
export const HLG_BLANC = 0.75;
/** super ralenti à n fois 50 images/s : diaphragmes perdus, temps de pose au plus, vitesse de relecture la plus lente sans répétition */
export const hfr = (n) => ({ diaph: Math.log2(n), pose: 1 / (50 * n), fluideJusqua: 1 / n, phases: n, battements: 100 / (50 * n) });

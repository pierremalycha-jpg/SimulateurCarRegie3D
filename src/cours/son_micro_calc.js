// @ts-check
// ----------------------------------------------------------------------------------
// Le modèle pur de la partie « Capter : le son et le micro » du chapitre Le son : la pression acoustique
// et ses décibels, la distance et l'addition des sources, la longueur d'onde ; ce qu'un micro donne en
// tension (sensibilité en dBV/Pa), en dBV et en dBu, et le gain que la console doit ajouter ; la
// directivité des micros du premier ordre (A + B cos θ), le facteur de directivité et l'effet de
// proximité ; l'alimentation fantôme P48 (deux résistances de 6,81 kΩ) ; la liaison symétrique et le
// parasite qu'elle annule. Sans interface : les leçons (cours/son_micros.js), leurs exercices
// (cours/exos/son_micros.js) et les vues 3D son-micro et son-capsules lisent les mêmes fonctions.
// Chiffres :
//   · 20 µPa, seuil d'audition de référence (0 dB SPL) ; 94 dB SPL = 1 Pa ; c ≈ 343 m/s dans l'air à 20 °C ;
//   · 0 dBV = 1 V ; 0 dBu = 0,7746 V (√0,6 : 1 mW dans 600 Ω), donc dBu = dBV + 2,2 ;
//   · micros dynamiques, fiches Shure : SM58 −54,5 dBV/Pa (1,85 mV/Pa), 50–15 000 Hz, 150 Ω nominaux
//     (300 Ω réels) ; SM48 −57,5 dBV/Pa (1,3 mV/Pa), 55–14 000 Hz, 150 Ω (270 Ω réels) ;
//   · micro statique et canon : ordres de grandeur (≈ 20 et ≈ 40 mV/Pa), à lire sur la fiche du micro ;
//   · P48 (IEC 61938) : 48 V par deux résistances de 6,81 kΩ (3,405 kΩ vus du micro), 10 mA au plus ;
//   · directivités du premier ordre : omni (1, 0), cardioïde large (0,7, 0,3), cardioïde (0,5, 0,5),
//     supercardioïde (0,37, 0,63), hypercardioïde (0,25, 0,75), figure en 8 (0, 1) ;
//   · l'effet de proximité est celui d'un gradient de pression idéal : un vrai micro le compense en
//     partie (ordre de grandeur).
// ----------------------------------------------------------------------------------
const log10 = Math.log10;

/** pression de référence (Pa) : 0 dB SPL */
export const P0 = 20e-6;
/** vitesse du son dans l'air à 20 °C (m/s) */
export const C_SON = 343;
/** 0 dBu en volts (√0,6) */
export const V_DBU = Math.sqrt(0.6);
/** écart entre dBu et dBV : dBu = dBV + DBU_DBV */
export const DBU_DBV = 20 * log10(1 / V_DBU);

// ---------------- la pression et ses décibels ----------------
/** niveau de pression acoustique (dB SPL) d'une pression efficace en pascals */
export const splDePa = (pa) => 20 * log10(Math.max(1e-12, pa) / P0);
/** pression efficace (Pa) d'un niveau en dB SPL */
export const paDeSpl = (db) => P0 * 10 ** (db / 20);
/** impédance acoustique de l'air à 20 °C (ρ·c, en Pa·s/m) */
export const RHO_C = 413;
/** l'amplitude du mouvement de l'air (m) pour une pression efficace pa à la fréquence f : ξ = p / (ρ c 2π f) ; la membrane d'un micro bouge d'autant à peu près */
export const deplacementAir = (pa, f) => pa / (RHO_C * 2 * Math.PI * f);
/** longueur d'onde (m) d'un son de fréquence f (Hz) */
export const longueurOnde = (f, c = C_SON) => c / f;
/** le niveau à la distance r2 quand on connaît celui à r1 : la loi en 1/r du champ libre (−6 dB par doublement) */
export const aDistance = (spl1, r1, r2) => spl1 - 20 * log10(r2 / r1);
/** deux sources ensemble : incohérentes, les puissances s'ajoutent (+3 dB à niveau égal) ; cohérentes et en phase, les pressions (+6 dB) */
export function somme(a, b, coherentes = false) {
  return coherentes ? 20 * log10(10 ** (a / 20) + 10 ** (b / 20)) : 10 * log10(10 ** (a / 10) + 10 ** (b / 10));
}
/** combien de fois plus de pression pour un écart de d dB ; et de puissance */
export const rapportPression = (d) => 10 ** (d / 20);
export const rapportPuissance = (d) => 10 ** (d / 10);

// ---------------- les tensions et leurs décibels ----------------
export const dbvDeV = (v) => 20 * log10(Math.max(1e-12, v));
export const vDeDbv = (d) => 10 ** (d / 20);
export const dbuDeV = (v) => 20 * log10(Math.max(1e-12, v) / V_DBU);
export const vDeDbu = (d) => V_DBU * 10 ** (d / 20);
export const dbuDeDbv = (d) => d + DBU_DBV;
export const dbvDeDbu = (d) => d - DBU_DBV;
/** les niveaux de ligne : professionnel +4 dBu, grand public −10 dBV */
export const LIGNE_PRO = 4, LIGNE_GP = -10;

// ---------------- les micros ----------------
/**
 * @typedef {object} Micro
 * @property {string} nom
 * @property {'dynamique' | 'statique' | 'ruban'} techno
 * @property {number} sens sensibilité en dBV/Pa (à 1 kHz, tension à vide)
 * @property {[number, number]} bande bande passante annoncée (Hz)
 * @property {number} z impédance nominale (Ω)
 * @property {number} [zReel] impédance réelle annoncée (Ω)
 * @property {number} [i48] courant demandé sur le 48 V (mA), pour un statique
 * @property {boolean} [ordre] la sensibilité est un ordre de grandeur (pas un modèle précis)
 * @property {string} [dir] directivité (DIRECTIVITES)
 * @property {number} [bruit] bruit propre d'un statique, en dB SPL pondéré A (ordre de grandeur) ; un dynamique n'a que le souffle du préampli
 * @property {number} [spMax] pression maximale avant saturation de son électronique, en dB SPL (ordre de grandeur) ; un dynamique n'en a pratiquement pas
 */
/** @type {Record<string, Micro>} */
export const MICROS = {
  sm58: { nom: 'Micro dynamique type SM58', techno: 'dynamique', sens: -54.5, bande: [50, 15000], z: 150, zReel: 300, dir: 'cardio' },
  sm48: { nom: 'Micro dynamique type SM48', techno: 'dynamique', sens: -57.5, bande: [55, 14000], z: 150, zReel: 270, dir: 'cardio' },
  statique: { nom: 'Micro statique de studio (ordre de grandeur)', techno: 'statique', sens: -34, bande: [20, 20000], z: 200, i48: 3, ordre: true, dir: 'cardio', bruit: 12, spMax: 135 },
  canon: { nom: 'Micro canon de bord terrain (ordre de grandeur)', techno: 'statique', sens: -28, bande: [40, 20000], z: 25, i48: 2, ordre: true, dir: 'hyper', bruit: 13, spMax: 130 },
  ruban: { nom: 'Micro à ruban passif (ordre de grandeur)', techno: 'ruban', sens: -55, bande: [30, 15000], z: 300, ordre: true, dir: 'huit' },
  electret: { nom: 'Micro-cravate électret (ordre de grandeur)', techno: 'statique', sens: -44, bande: [50, 18000], z: 1000, i48: 1, ordre: true, dir: 'omni', bruit: 25, spMax: 125 },
};
/** sensibilité en mV/Pa */
export const mvParPa = (sens) => 1000 * 10 ** (sens / 20);
/** tension de sortie (dBV) d'un micro de sensibilité sens (dBV/Pa) sous un niveau spl (dB SPL) : 94 dB SPL = 1 Pa */
export const sortieDbv = (sens, spl) => sens + (spl - 94);
/** la même en dBu */
export const sortieDbu = (sens, spl) => dbuDeDbv(sortieDbv(sens, spl));
/** tension de sortie en mV */
export const sortieMv = (sens, spl) => 1000 * vDeDbv(sortieDbv(sens, spl));
/** le gain (dB) à donner au préampli pour amener le micro au niveau visé (dBu) : 0 dBu = −18 dBFS (EBU R68) */
export const gainPour = (sens, spl, cibleDbu = 0) => cibleDbu - sortieDbu(sens, spl);
/** l'écart de sensibilité entre deux micros, en dB */
export const ecartSens = (a, b) => MICROS[a].sens - MICROS[b].sens;
/** souffle ramené à l'entrée d'un bon préampli micro (dBu), source de 150 Ω : ordre de grandeur */
export const EIN = -128;
/**
 * Le bruit d'un micro et de son préampli, ramené au micro en dB SPL équivalent : ce qu'il faudrait de son pour
 * qu'il égale le bruit. Le bruit propre du statique et le souffle du préampli s'ajoutent en puissance ; un
 * dynamique n'apporte que le souffle du préampli (sa bobine est comptée dans l'EIN).
 */
export function bruitEquivalent(m, ein = EIN) {
  const pre = ein - dbuDeDbv(m.sens) + 94;
  return m.bruit == null ? pre : 10 * Math.log10(10 ** (m.bruit / 10) + 10 ** (pre / 10));
}
/** la marge du son sur le bruit (dB) pour un son de spl dB SPL au micro */
export const margeBruit = (m, spl, ein = EIN) => spl - bruitEquivalent(m, ein);

// ---------------- la directivité ----------------
/** @typedef {{ nom: string, A: number, B: number }} Directivite */
/** @type {Record<string, Directivite>} */
export const DIRECTIVITES = {
  omni: { nom: 'omnidirectionnel', A: 1, B: 0 },
  large: { nom: 'cardioïde large (infracardioïde)', A: 0.7, B: 0.3 },
  cardio: { nom: 'cardioïde', A: 0.5, B: 0.5 },
  super: { nom: 'supercardioïde', A: 0.37, B: 0.63 },
  hyper: { nom: 'hypercardioïde', A: 0.25, B: 0.75 },
  huit: { nom: 'figure en 8 (bidirectionnel)', A: 0, B: 1 },
};
/** la sensibilité relative à l'angle θ (degrés, 0 = dans l'axe) : A + B cos θ, entre −1 et 1 (le signe : la polarité) */
export const polaire = (d, deg) => d.A + d.B * Math.cos(deg * Math.PI / 180);
/** l'atténuation à l'angle θ, en dB (négative ; −∞ dans un trou) */
export const attenuation = (d, deg) => 20 * log10(Math.max(1e-6, Math.abs(polaire(d, deg))));
/** l'angle de rejet (degrés) où la réponse s'annule ; null pour un omni ou un cardioïde large (pas de trou) */
export function angleRejet(d) {
  if (d.B <= d.A) return d.B === d.A ? 180 : null;
  return Math.acos(-d.A / d.B) * 180 / Math.PI;
}
/** facteur de directivité Q (efficacité au champ diffus : A² + B²/3) et indice DI en dB */
export const facteurQ = (d) => 1 / (d.A * d.A + d.B * d.B / 3);
export const indiceDI = (d) => 10 * log10(facteurQ(d));
/** facteur de distance : à quelle distance relative le micro garde le même rapport direct / réverbéré qu'un omni à 1 */
export const facteurDistance = (d) => Math.sqrt(facteurQ(d));
/**
 * L'effet de proximité d'un micro directif, dans l'axe : la part « gradient de pression » (B) monte aux basses
 * fréquences quand la source est proche (|1 + 1/(jkr)|). Gain des graves par rapport au même micro loin de la
 * source, en dB (modèle idéal : un vrai micro le compense en partie).
 */
export function proximite(d, f, r, c = C_SON) {
  const k = 2 * Math.PI * f / c, g = Math.sqrt(1 + 1 / (k * r) ** 2);
  return 20 * log10((d.A + d.B * g) / (d.A + d.B));
}

/**
 * La réponse d'un micro, en dB par rapport à une source lointaine dans l'axe : directivité et effet de
 * proximité ensemble, |A + B · cos θ · √(1 + 1/(kr)²)| (amplitudes seules, modèle idéal).
 */
export function reponse(d, deg, f, r, c = C_SON) {
  const k = 2 * Math.PI * f / c, g = Math.sqrt(1 + 1 / (k * r) ** 2);
  return 20 * log10(Math.max(1e-6, Math.abs(d.A + d.B * Math.cos(deg * Math.PI / 180) * g)));
}

// ---------------- l'alimentation fantôme ----------------
/** P48 : 48 V, deux résistances de 6,81 kΩ (broches 2 et 3), 10 mA au plus */
export const P48 = { u: 48, r: 6810, imax: 10 };
/** la résistance vue par le micro : les deux résistances en parallèle (Ω) */
export const rFantome = (p = P48) => p.r / 2;
/** la tension qui reste au micro (V) quand il demande i mA */
export const uMicro = (i, p = P48) => p.u - i / 1000 * rFantome(p);
/** le courant maximal (mA), micro en court-circuit */
export const iCourtCircuit = (p = P48) => p.u / rFantome(p) * 1000;
/** la puissance disponible au micro (mW) pour i mA */
export const puissanceMicro = (i, p = P48) => uMicro(i, p) * i;
/**
 * Ce qui traverse une bobine ou un ruban branché sur le 48 V : en symétrique, les broches 2 et 3 sont au même
 * potentiel, rien ne passe ; si une des deux broches touche la masse (câble défectueux, adaptateur asymétrique),
 * un courant passe par la bobine (mA). rb : résistance de la bobine ou du transformateur du ruban (Ω).
 */
export function fuite(rb, defaut = false, p = P48) {
  if (!defaut) return 0;
  return p.u / (p.r + rb) * 1000;
}

// ---------------- la liaison symétrique ----------------
/**
 * Un signal et un parasite capté sur le câble. En symétrique, le parasite arrive pareil sur les deux conducteurs
 * et la différence l'annule, sauf la part due au déséquilibre (fraction, 0,001 = 0,1 %) ; en asymétrique, il
 * s'ajoute tout entier. Renvoie le parasite restant (mV), la réjection (dB) et le rapport signal / parasite (dB).
 * @param {number} signalMv
 * @param {number} parasiteMv
 * @param {boolean} sym
 * @param {number} [deseq]
 */
export function liaison(signalMv, parasiteMv, sym, deseq = 0.001) {
  const reste = sym ? parasiteMv * deseq : parasiteMv;
  const rejection = sym ? 20 * log10(1 / Math.max(1e-9, deseq)) : 0;
  return { reste, rejection, rapport: 20 * log10(signalMv / Math.max(1e-9, reste)) };
}

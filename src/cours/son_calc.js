// @ts-check
// ----------------------------------------------------------------------------------
// Les calculs du chapitre « Le son » (v19.26), purs et testés (tests/unit/son.test.mjs) : les décibels
// (rapports, dBu, dBV, dBFS, sommes, distance), la directivité des micros (diagrammes polaires du premier
// ordre, canon à tube d'interférence, facteur de distance), les couples stéréo (écart de niveau et de temps
// d'un couple pour une source, position de l'image, angle d'enregistrement, MS et son équivalent XY,
// compatibilité mono), les liaisons (réjection de mode commun, adaptation d'impédance), la dynamique
// (compresseur, limiteur, gate), le loudness (EBU R128 : intégré avec portes, plage, crête vraie) et
// l'audio numérique (débit PCM, dynamique, AES3, MADI, Dante, latence d'un tampon, dérive d'horloges).
// Les manipulations des leçons (cours/son_bases.js, cours/son_traitement.js) ne font que les afficher.
// ----------------------------------------------------------------------------------
export const SON = 343; // célérité du son dans l'air à 20 °C, m/s
const log10 = Math.log10;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------- décibels ----------------
/** rapport → dB : 20 log pour une amplitude (tension, pression), 10 log pour une puissance */
export const ratioDb = (r, puissance = false) => (r <= 0 ? -Infinity : (puissance ? 10 : 20) * log10(r));
/** dB → rapport */
export const dbRatio = (dB, puissance = false) => Math.pow(10, dB / (puissance ? 10 : 20));
/** 0 dBu = 0,775 V (la tension qui donne 1 mW dans 600 Ω) ; 0 dBV = 1 V */
export const dbuVolt = (dbu) => 0.775 * dbRatio(dbu);
export const voltDbu = (v) => ratioDb(v / 0.775);
export const dbvVolt = (dbv) => dbRatio(dbv);
export const voltDbv = (v) => ratioDb(v);
export const dbuDbv = (dbu) => dbu + ratioDb(0.775);
export const dbvDbu = (dbv) => dbv - ratioDb(0.775);
/** l'écart entre le niveau ligne professionnel (+4 dBu) et grand public (−10 dBV) : 11,8 dB */
export const ECART_PRO_CONSO = 4 - dbvDbu(-10);
/**
 * Somme de sources en dB. Non corrélées (deux micros, deux bruits) : les puissances s'ajoutent (deux
 * sources égales : +3 dB). Corrélées (le même signal deux fois) : les amplitudes s'ajoutent (+6 dB).
 */
export function sommeDb(niveaux, correlees = false) {
  const l = niveaux.filter((v) => Number.isFinite(v));
  if (!l.length) return -Infinity;
  return correlees ? ratioDb(l.reduce((s, v) => s + dbRatio(v), 0)) : ratioDb(l.reduce((s, v) => s + dbRatio(v, true), 0), true);
}
/** niveau de pression acoustique à d2 connaissant celui à d1 (champ libre : −6 dB par doublement de distance) */
export const splA = (spl1, d1, d2) => spl1 - 20 * log10(d2 / d1);
/** niveau de pression acoustique → pression en pascals (0 dB SPL = 20 µPa) */
export const splPa = (spl) => 20e-6 * dbRatio(spl);
/** tension d'un micro (mV) pour une pression (Pa) et une sensibilité (mV/Pa) */
export const tensionMicro = (pa, sensibiliteMvPa) => pa * sensibiliteMvPa;

// ---------------- les micros : directivité ----------------
/** les diagrammes du premier ordre : ρ(θ) = a + (1 − a) cos θ */
export const DIRECTIVITES = /** @type {const} */ ([
  { id: 'omni', nom: 'Omnidirectionnel', a: 1 },
  { id: 'large', nom: 'Cardioïde large', a: 0.7 },
  { id: 'cardio', nom: 'Cardioïde', a: 0.5 },
  { id: 'super', nom: 'Supercardioïde', a: 0.366 },
  { id: 'hyper', nom: 'Hypercardioïde', a: 0.25 },
  { id: 'bidir', nom: 'Bidirectionnel (en 8)', a: 0 },
]);
export const directivite = (id) => DIRECTIVITES.find((d) => d.id === id) || DIRECTIVITES[2];
/** sensibilité relative à l'angle θ (degrés), signée (négative à l'arrière d'un micro en 8) */
export const rho = (a, thetaDeg) => a + (1 - a) * Math.cos(thetaDeg * Math.PI / 180);
/** atténuation à l'angle θ, en dB (0 dB dans l'axe ; −60 dB au plus pour l'affichage) */
export const attenuationDb = (a, thetaDeg) => Math.max(-60, ratioDb(Math.abs(rho(a, thetaDeg))));
/**
 * Le canon (micro à tube d'interférence) : une capsule hypercardioïde derrière un tube à fentes de longueur L.
 * Hors axe, les ondes entrées par les fentes arrivent déphasées et s'annulent : le facteur de ligne est
 * |sin x / x| avec x = π L (1 − cos θ) / λ. Le tube ne resserre la directivité qu'aux fréquences dont la
 * longueur d'onde est courte devant L : dans le grave, un canon n'est qu'un hypercardioïde.
 */
export function canon(thetaDeg, fHz, L = 0.25) {
  const lambda = SON / fHz;
  const x = Math.PI * L * (1 - Math.cos(thetaDeg * Math.PI / 180)) / lambda;
  const tube = x < 1e-9 ? 1 : Math.abs(Math.sin(x) / x);
  return Math.abs(rho(0.25, thetaDeg)) * tube;
}
export const canonDb = (thetaDeg, fHz, L = 0.25) => Math.max(-60, ratioDb(canon(thetaDeg, fHz, L)));
/** efficacité en champ diffus (REE) et facteur de distance : un cardioïde capte 1/3 du champ diffus d'un omni (−4,8 dB) et se place 1,7 fois plus loin */
export function facteurDistance(a) {
  const ree = a * a + (1 - a) * (1 - a) / 3;
  return { ree, reeDb: ratioDb(ree, true), facteur: 1 / Math.sqrt(ree) };
}

// ---------------- les couples stéréo ----------------
/**
 * @typedef {object} Couple
 * @property {'coincident' | 'espace' | 'ms'} genre coïncident (XY, Blumlein), espacé (AB, ORTF, NOS, DIN), MS
 * @property {string} a directivité des capsules (id de DIRECTIVITES) ; pour MS : celle du M
 * @property {number} angle angle entre les axes des deux capsules, en degrés (0 pour AB)
 * @property {number} d écartement des capsules, en mètres (0 si coïncident)
 * @property {number} [gS] MS : niveau du S par rapport au M, en rapport d'amplitude (1 = même niveau)
 */
/** les couples classiques */
export const COUPLES = /** @type {const} */ ([
  { id: 'xy', nom: 'XY 90°', sous: 'deux cardioïdes coïncidents à 90°', genre: 'coincident', a: 'cardio', angle: 90, d: 0 },
  { id: 'xy120', nom: 'XY 120°', sous: 'deux cardioïdes coïncidents à 120°', genre: 'coincident', a: 'cardio', angle: 120, d: 0 },
  { id: 'blumlein', nom: 'Blumlein', sous: 'deux micros en 8 coïncidents à 90°', genre: 'coincident', a: 'bidir', angle: 90, d: 0 },
  { id: 'ortf', nom: 'ORTF', sous: 'deux cardioïdes à 110°, écartés de 17 cm', genre: 'espace', a: 'cardio', angle: 110, d: 0.17 },
  { id: 'nos', nom: 'NOS', sous: 'deux cardioïdes à 90°, écartés de 30 cm', genre: 'espace', a: 'cardio', angle: 90, d: 0.30 },
  { id: 'din', nom: 'DIN', sous: 'deux cardioïdes à 90°, écartés de 20 cm', genre: 'espace', a: 'cardio', angle: 90, d: 0.20 },
  { id: 'ab40', nom: 'AB 40 cm', sous: 'deux omnis parallèles, écartés de 40 cm', genre: 'espace', a: 'omni', angle: 0, d: 0.40 },
  { id: 'ab60', nom: 'AB 60 cm', sous: 'deux omnis parallèles, écartés de 60 cm', genre: 'espace', a: 'omni', angle: 0, d: 0.60 },
  { id: 'ms', nom: 'MS', sous: 'un cardioïde M vers l\'avant, un 8 S vers les côtés, décodés en L = M + S, R = M − S', genre: 'ms', a: 'cardio', angle: 0, d: 0, gS: 1 },
]);
/** pleine latéralisation (l'image sur un seul haut-parleur) : vers 15 dB d'écart de niveau, ou 1,1 ms d'écart de temps (Williams, 1987 ; ordres de grandeur) */
export const PLEIN_DL = 15, PLEIN_DT = 1.1;
/**
 * Ce que capte un couple pour une source à l'azimut φ (degrés, positif à gauche) : les niveaux des deux voies,
 * l'écart de niveau ΔL (dB, positif quand la gauche est plus forte), l'écart de temps Δt (ms, positif quand la
 * gauche reçoit d'abord) et la position de l'image entre les haut-parleurs (−100 droite … +100 gauche), par le
 * modèle linéaire : les deux écarts s'ajoutent, chacun rapporté à sa valeur de pleine latéralisation.
 * @param {Couple | { genre: string, a: string, angle: number, d: number, gS?: number }} c
 */
export function couple(c, phiDeg) {
  const a = directivite(c.a).a;
  let L, R, dt = 0;
  if (c.genre === 'ms') {
    const g = c.gS ?? 1;
    const M = rho(a, phiDeg), S = Math.sin(phiDeg * Math.PI / 180); // le 8 regarde à gauche
    L = M + g * S; R = M - g * S;
  } else {
    L = rho(a, phiDeg - c.angle / 2); R = rho(a, phiDeg + c.angle / 2);
    dt = c.d * Math.sin(phiDeg * Math.PI / 180) / SON * 1000;
  }
  const dL = ratioDb(Math.abs(L)) - ratioDb(Math.abs(R));
  const pos = clamp(100 * (clamp(dL, -40, 40) / PLEIN_DL + dt / PLEIN_DT), -100, 100);
  return { L, R, dL: Number.isFinite(dL) ? dL : (L ? 60 : -60), dt, pos };
}
/**
 * L'angle d'enregistrement du couple : l'ouverture (en degrés, centrée sur l'axe) dans laquelle les sources
 * se répartissent entre les deux haut-parleurs ; une source au bord de cet angle est sur un seul haut-parleur.
 * Null si même une source à 90° n'y arrive pas (couple très ouvert, image resserrée).
 */
export function angleEnregistrement(c) {
  // on balaie l'azimut : la position n'est pas toujours monotone (un micro en 8 change de signe derrière son axe)
  for (let phi = 0; phi <= 90; phi += 0.25) if (couple(c, phi).pos >= 100) return 2 * phi;
  return null;
}
/** un couple MS décodé équivaut à un XY : l'angle entre les capsules virtuelles et leur directivité dépendent du niveau du S */
export function msVersXY(gS, aM = 0.5) {
  // L(φ) = aM + (1 − aM) cos φ + gS sin φ = aM + A cos(φ − β) : une capsule virtuelle de diagramme aM / (aM + A), tournée de β
  const beta = Math.atan2(gS, 1 - aM);
  const A = Math.hypot(1 - aM, gS);
  const a = aM / (aM + A);
  return { angle: 2 * beta * 180 / Math.PI, a, nom: nomDirectivite(a) };
}
/** le nom du diagramme du premier ordre le plus proche */
export function nomDirectivite(a) {
  return DIRECTIVITES.reduce((best, d) => (Math.abs(d.a - a) < Math.abs(best.a - a) ? d : best), DIRECTIVITES[0]).nom;
}
/** la somme mono d'un couple espacé : un filtre en peigne dont le premier creux est à 1 / (2 Δt) */
export const premierCreuxHz = (dtMs) => (Math.abs(dtMs) < 1e-6 ? Infinity : 1000 / (2 * Math.abs(dtMs)));

// ---------------- les liaisons ----------------
/** ce qu'il reste d'un parasite (mV) après une entrée symétrique de réjection de mode commun donnée (dB) */
export const residuModeCommun = (parasiteMv, cmrrDb) => parasiteMv * dbRatio(-cmrrDb);
/** la perte d'une source d'impédance Zs sur une charge Zc (pont diviseur) ; on « ponte » avec Zc ≥ 10 Zs */
export const perteAdaptation = (zs, zc) => ratioDb(zc / (zs + zc));

// ---------------- la dynamique ----------------
/**
 * Le niveau de sortie d'un compresseur pour un niveau d'entrée (dB), au-dessus du seuil : 1 dB d'entrée en plus
 * donne 1/ratio dB de sortie en plus ; un genou doux (largeur en dB) arrondit la transition ; ratio ≥ 20 : limiteur.
 */
export function compresseur(inDb, seuil, ratio, genou = 0) {
  const r = ratio >= 20 ? Infinity : ratio;
  const slope = r === Infinity ? 0 : 1 / r;
  if (genou > 0 && inDb > seuil - genou / 2 && inDb < seuil + genou / 2) {
    const x = inDb - seuil + genou / 2;
    return inDb + (slope - 1) * x * x / (2 * genou);
  }
  return inDb <= seuil ? inDb : seuil + (inDb - seuil) * slope;
}
/** la réduction de gain appliquée (dB, négative ou nulle) */
export const reductionGain = (inDb, seuil, ratio, genou = 0) => compresseur(inDb, seuil, ratio, genou) - inDb;
/** le gain de rattrapage qui ramène les crêtes compressées à leur niveau d'avant */
export const gainRattrapage = (creteDb, seuil, ratio, genou = 0) => creteDb - compresseur(creteDb, seuil, ratio, genou);
/** le gate : sous le seuil, le signal est atténué de « plage » dB */
export const gate = (inDb, seuil, plage = 60) => (inDb < seuil ? inDb - plage : inDb);
/** constantes de temps : ce qu'il reste d'un transitoire après t ms pour un temps d'attaque donné (première approximation exponentielle) */
export const reponseAttaque = (tMs, attaqueMs) => 1 - Math.exp(-tMs / Math.max(0.01, attaqueMs));

// ---------------- le loudness (EBU R128, ITU-R BS.1770) ----------------
const moyennePuissance = (l) => (l.length ? 10 * log10(l.reduce((s, v) => s + dbRatio(v, true), 0) / l.length) : -Infinity);
/**
 * Le loudness intégré d'un programme à partir de ses blocs (400 ms, ou tout autre découpage régulier) en LUFS :
 * porte absolue à −70 LUFS, puis porte relative 10 LU sous la moyenne des blocs restants ; la moyenne est une
 * moyenne de puissances, pas de décibels. Rend aussi ce que donnerait une moyenne sans porte.
 */
export function loudnessIntegre(blocs) {
  const abs = blocs.filter((v) => Number.isFinite(v) && v > -70);
  if (!abs.length) return { lufs: -Infinity, sansPorte: -Infinity, seuilRelatif: -Infinity, gardes: 0, total: blocs.length };
  const seuilRelatif = moyennePuissance(abs) - 10;
  const rel = abs.filter((v) => v > seuilRelatif);
  return { lufs: moyennePuissance(rel), sansPorte: moyennePuissance(blocs.filter(Number.isFinite)), seuilRelatif, gardes: rel.length, total: blocs.length };
}
/** la plage de loudness (LRA, en LU) à partir des valeurs court terme (3 s) : porte absolue −70, relative −20, écart entre les centiles 10 et 95 */
export function plageLoudness(courtTerme) {
  const abs = courtTerme.filter((v) => Number.isFinite(v) && v > -70);
  if (abs.length < 2) return 0;
  const seuil = moyennePuissance(abs) - 20;
  const rel = abs.filter((v) => v > seuil).sort((x, y) => x - y);
  if (rel.length < 2) return 0;
  const centile = (p) => rel[Math.min(rel.length - 1, Math.max(0, Math.round((rel.length - 1) * p)))];
  return centile(0.95) - centile(0.10);
}
/** le gain (dB) qui ramène un programme à la cible, et la crête vraie qu'il aurait ensuite */
export function normaliser(lufs, creteVraieDbtp, cible = -23, plafond = -1) {
  const gain = cible - lufs;
  const crete = creteVraieDbtp + gain;
  return { gain, crete, ok: crete <= plafond, limiter: crete > plafond ? crete - plafond : 0 };
}
/**
 * Pourquoi la crête vraie : une sinusoïde d'amplitude 1 (0 dBTP) échantillonnée peut n'avoir aucun échantillon
 * sur sa crête ; le crête-mètre à échantillons lit moins. Rend la crête lue (dBFS) pour une fréquence, une
 * fréquence d'échantillonnage et une phase de départ (degrés) ; le pire cas est à fs/4 avec 45° de phase : −3 dB.
 */
export function creteEchantillons(fHz, fs = 48000, phaseDeg = 45, n = 4096) {
  let m = 0;
  const w = 2 * Math.PI * fHz / fs, p = phaseDeg * Math.PI / 180;
  for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(Math.sin(w * i + p)));
  return ratioDb(m);
}

// ---------------- l'audio numérique ----------------
/** le débit d'un flux PCM (b/s) : fréquence d'échantillonnage × bits × canaux */
export const debitPcm = (fs, bits, canaux = 1) => fs * bits * canaux;
/** la dynamique théorique d'une quantification sur n bits (sinusoïde pleine échelle contre bruit de quantification) */
export const dynamiqueDb = (bits) => 6.02 * bits + 1.76;
/** la fréquence la plus haute qu'un échantillonnage peut porter (Nyquist) */
export const nyquist = (fs) => fs / 2;
/** AES3 : deux canaux, 32 bits par sous-trame, 64 bits par trame → 64 × fs bits par seconde (3,072 Mb/s à 48 kHz) */
export const debitAes3 = (fs) => 64 * fs;
/** MADI (AES10) : 64 canaux à 48 kHz, 32 à 96 kHz, 16 à 192 kHz ; 56 canaux en mode d'origine */
export const canauxMadi = (fs, mode64 = true) => Math.floor((mode64 ? 64 : 56) * 48000 / fs);
/** Dante : un flux porte jusqu'à 4 canaux ; ordre de grandeur de 1,5 Mb/s par canal, en-têtes compris */
export const debitDante = (canaux) => Math.ceil(canaux / 4) * 4 * 1.5e6;
/** la latence d'un tampon de n échantillons (ms) */
export const latenceTampon = (n, fs) => n / fs * 1000;
/** deux horloges à 48 kHz qui s'écartent de p ppm : le nombre d'échantillons de décalage par seconde (le clic vient quand il atteint 1) */
export const deriveEchantillons = (ppm, fs = 48000) => ppm * 1e-6 * fs;

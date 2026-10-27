// @ts-check
// ----------------------------------------------------------------------------------
// Les calculs des leçons « La console analogique », « Les sorties de la console », « L'audio numérique »
// et « Mesurer le programme » (cours/son_console.js), repris par leur vue 3D et leurs exercices : purs,
// sans interface, testés (tests/unit/son-console.test.mjs).
//  · niveaux électriques : 0 dBu = 0,775 V efficaces, 0 dBV = 1 V ; ligne pro +4 dBu, grand public −10 dBV ;
//  · une console analogique du type de la gamme Antmix : « 0 » des vumètres au niveau nominal interne (0 dBu),
//    écrêtage interne vers +21 dBu (ordre de grandeur : de +20 à +22 dBu selon les consoles), LED PEAK quelques
//    dB avant ; sortie principale symétrique +4 dBu au « 0 », sortie d'enregistrement −10 dBV (ordres de
//    grandeur, à lire dans la notice de la console) ;
//  · égaliseur trois bandes (80 Hz, 2,5 kHz, 12 kHz, ±15 dB), coupe-bas : un modèle d'énergie par bandes
//    (simplification : chaque bouton agit sur sa part de l'énergie de la source) ;
//  · panoramique à puissance constante (−3 dB au centre) ; sources différentes additionnées en puissance ;
//  · micro : sensibilité en mV/Pa (Shure SM58 : 1,85 mV/Pa, −54,5 dBV/Pa), 94 dB SPL = 1 Pa ;
//  · numérique : Nyquist, repliement, dynamique 6,02 N + 1,76 dB, AES3 (64 bits par période d'échantillon),
//    MADI (AES10 : 64 canaux à 48 kHz, 125 Mb/s sur la ligne), alignements EBU R68 et SMPTE RP 155 ;
//  · loudness : ITU-R BS.1770-4 (blocs de 400 ms, recouvrement de 75 %, porte absolue −70 LUFS, porte
//    relative −10 LU), EBU R128 (−23 LUFS, crête vraie −1 dBTP), LRA selon EBU Tech 3342 (court terme
//    de 3 s, porte relative −20 LU, écart entre les centiles 10 et 95).
// ----------------------------------------------------------------------------------
const log10 = Math.log10;

// ================= niveaux électriques =================
/** 0 dBu : 0,775 V efficaces (la tension qui dissipe 1 mW dans 600 Ω) */
export const V0_DBU = 0.775;
export const dbuDeV = (/** @type {number} */ v) => 20 * log10(Math.max(1e-12, v) / V0_DBU);
export const vDeDbu = (/** @type {number} */ d) => V0_DBU * 10 ** (d / 20);
/** dBV (0 dBV = 1 V) vers dBu : +2,21 dB */
export const dbuDeDbv = (/** @type {number} */ d) => d - 20 * log10(V0_DBU);
export const dbvDeDbu = (/** @type {number} */ d) => d + 20 * log10(V0_DBU);
/** le niveau ligne professionnel et le niveau grand public */
export const LIGNE_PRO = 4, GRAND_PUBLIC_DBV = -10;
/** écart entre +4 dBu et −10 dBV : ≈ 11,8 dB */
export const ECART_PRO_GP = LIGNE_PRO - dbuDeDbv(GRAND_PUBLIC_DBV);

// ================= le micro =================
/** tension d'un micro, en dBu : sensibilité (mV/Pa) et pression acoustique (dB SPL ; 94 dB SPL = 1 Pa) */
export const micDbu = (/** @type {number} */ sensMv, /** @type {number} */ spl) => dbuDeV(sensMv / 1000 * 10 ** ((spl - 94) / 20));

// ================= la console analogique =================
/** le « 0 » des vumètres : le niveau nominal interne de la console, en dBu (ordre de grandeur) */
export const NOMINAL = 0;
/** écrêtage interne d'une petite console analogique, en dBu (ordre de grandeur : +20 à +22 dBu) */
export const ECRETAGE = 21;
/** la LED PEAK s'allume quelques dB avant l'écrêtage (ordre de grandeur) */
export const PEAK = 17;
/** gain de la sortie principale symétrique (XLR) : +4 dBu au « 0 » des vumètres */
export const GAIN_XLR = LIGNE_PRO - NOMINAL;
/** gain de la sortie d'enregistrement (RCA) : −10 dBV au « 0 » des vumètres */
export const GAIN_REC = dbuDeDbv(GRAND_PUBLIC_DBV) - NOMINAL;
/** l'égaliseur : fréquences et plage des trois boutons, et ce que retire le coupe-bas sous sa fréquence */
export const EQ = { low: 80, mid: 2500, high: 12000, plage: 15 };
export const COUPE_BAS = { f: 75, db: 18 };

/**
 * Des sources typiques : sensibilité du micro (mV/Pa), pression des crêtes (dB SPL, ordres de grandeur),
 * part de leur énergie dans chaque bande (grondement sous 80 Hz, graves, médiums, aigus), besoin du 48 V.
 * Une source ligne (clavier, lecteur) donne directement son niveau en dBu.
 * @typedef {{ id: string, nom: string, sens?: number, spl?: number, ligne?: number, bandes: number[], p48?: boolean, micro: string }} Source
 */
/** @type {Source[]} */
export const SOURCES = [
  { id: 'chant', nom: 'Chant', micro: 'micro dynamique type SM58', sens: 1.85, spl: 110, bandes: [0.05, 0.25, 0.55, 0.15] },
  { id: 'guitare', nom: 'Guitare acoustique', micro: 'micro statique', sens: 10, spl: 100, bandes: [0.08, 0.32, 0.4, 0.2], p48: true },
  { id: 'parole', nom: 'Présentateur', micro: 'micro dynamique type SM58', sens: 1.85, spl: 100, bandes: [0.06, 0.3, 0.5, 0.14] },
  { id: 'clavier', nom: 'Clavier (ligne)', micro: 'sortie ligne', ligne: 0, bandes: [0.02, 0.33, 0.4, 0.25] },
];
export const sourceById = (/** @type {string} */ id) => SOURCES.find((s) => s.id === id) || SOURCES[0];
/** niveau des crêtes d'une source à l'entrée de la tranche, en dBu ; un micro statique sans 48 V ne délivre rien */
export function niveauEntree(/** @type {Source} */ s, p48 = true) {
  if (s.ligne != null) return s.ligne;
  if (s.p48 && !p48) return -Infinity;
  return micDbu(/** @type {number} */ (s.sens), /** @type {number} */ (s.spl));
}
/** le gain qui amène les crêtes d'une entrée au niveau visé (par défaut le « 0 » des vumètres) */
export const gainPour = (/** @type {number} */ entree, cible = NOMINAL) => cible - entree;

/**
 * L'égaliseur trois bandes et le coupe-bas sur une source : variation de son niveau global, en dB.
 * bandes : parts de puissance [grondement, graves, médiums, aigus] (somme 1) ; le bouton LOW agit sur le
 * grondement et les graves, MID sur les médiums, HIGH sur les aigus ; le coupe-bas retire COUPE_BAS.db au grondement.
 */
export function gainEq(/** @type {number[]} */ bandes, /** @type {{ low?: number, mid?: number, high?: number }} */ eq = {}, coupeBas = false) {
  const g = [(eq.low || 0) - (coupeBas ? COUPE_BAS.db : 0), eq.low || 0, eq.mid || 0, eq.high || 0];
  const tot = bandes.reduce((s, p) => s + p, 0) || 1;
  return 10 * log10(bandes.reduce((s, p, k) => s + (p / tot) * 10 ** (g[k] / 10), 0));
}
/** loi de panoramique à puissance constante : [gauche, droite] en dB, pan de −1 (tout à gauche) à +1 (tout à droite) */
export function panDb(/** @type {number} */ p) {
  const a = (Math.max(-1, Math.min(1, p)) + 1) * Math.PI / 4;
  const d = (v) => (v < 1e-6 ? -Infinity : 20 * log10(v));
  return [d(Math.cos(a)), d(Math.sin(a))];
}
/** somme de signaux différents (non corrélés), en dB : les puissances s'ajoutent */
export function somme(/** @type {number[]} */ niveaux) {
  const e = niveaux.filter((l) => Number.isFinite(l)).reduce((s, l) => s + 10 ** (l / 10), 0);
  return e > 0 ? 10 * log10(e) : -Infinity;
}
/** deux signaux identiques (corrélés) : les tensions s'ajoutent, +6 dB */
export const sommeIdentiques = (/** @type {number} */ l) => l + 20 * log10(2);

/** le souffle d'un préampli micro ramené à son entrée (EIN), et celui du bus de mélange, en dBu (ordres de grandeur) */
export const EIN = -128, BUS_BRUIT = -90;
/**
 * Une tranche jusqu'au bus principal, puis le master et les sorties : niveau des crêtes à chaque étage, en dBu,
 * le souffle à la sortie et le rapport signal sur bruit (rsb, entre les crêtes et le souffle).
 * @param {{ entree: number, gain: number, eq?: { low?: number, mid?: number, high?: number }, bandes?: number[], coupeBas?: boolean, fader: number, pan?: number, master?: number, bruitEntree?: number }} t
 */
export function chaine(t) {
  const apresGain = t.entree + t.gain;
  const apresEq = apresGain + gainEq(t.bandes || [0, 0.3, 0.5, 0.2], t.eq, !!t.coupeBas);
  const apresFader = apresEq + t.fader;
  const [pg, pd] = panDb(t.pan || 0);
  // le bus principal : la voie la plus forte (gauche ou droite), puis le master
  const bus = apresFader + Math.max(pg, pd);
  const master = bus + (t.master ?? 0);
  const etages = [
    { id: 'entree', nom: 'Entrée (micro)', v: t.entree },
    { id: 'gain', nom: 'Après le gain', v: apresGain },
    { id: 'eq', nom: 'Après l\'égaliseur', v: apresEq },
    { id: 'fader', nom: 'Après le fader', v: apresFader },
    { id: 'bus', nom: 'Bus principal', v: bus },
    { id: 'master', nom: 'Après le master', v: master },
  ];
  // l'écrêtage : le premier étage qui dépasse ECRETAGE (le préampli et l'égaliseur sont avant le fader)
  const ecrete = etages.find((e) => e.v > ECRETAGE) || null;
  const avantFader = etages.slice(0, 3).reduce((m, e) => Math.max(m, e.v), -Infinity);
  // le souffle : celui du préampli monte avec le gain, puis suit le fader ; le bus ajoute le sien
  const bruitGain = (t.bruitEntree ?? EIN) + t.gain, bruitBus = somme([bruitGain + t.fader, BUS_BRUIT]), bruit = bruitBus + (t.master ?? 0);
  return {
    etages, apresGain, apresEq, apresFader, bus, master, bruit, rsb: master - bruit,
    gauche: apresFader + pg, droite: apresFader + pd,
    xlr: master + GAIN_XLR, rec: master + GAIN_REC,
    /** le vumètre de la tranche en PFL (avant le fader), et celui du master, relatifs au nominal */
    vuPfl: apresEq - NOMINAL, vuMaster: master - NOMINAL,
    peak: avantFader > PEAK, ecrete, marge: ECRETAGE - Math.max(...etages.slice(1).map((e) => e.v)),
  };
}
/** ce que dit le vumètre, en mots */
export function verdictNiveau(/** @type {number} */ vu) {
  if (!Number.isFinite(vu)) return 'aucun signal';
  if (vu > ECRETAGE - NOMINAL) return 'écrêté';
  if (vu > PEAK - NOMINAL) return 'trop fort, la LED PEAK s\'allume';
  if (vu > 6) return 'fort, peu de marge';
  if (vu >= -6) return 'bien, autour du « 0 »';
  if (vu >= -20) return 'faible, près du souffle';
  return 'très faible';
}

// ================= les sorties : envois pré et post-fader =================
/**
 * Les sorties de la console pour un ensemble de tranches : principale (post-fader, panoramique), AUX 1
 * (pré-fader : les retours de scène), FX (post-fader : les effets intégrés, dont le retour revient dans
 * le bus principal), enregistrement (copie de la principale à −10 dBV), casque (PFL si pressé, sinon la principale).
 * niveau : la crête de la tranche après le gain et l'égaliseur (dBu) ; aux, fx : position des boutons (dB, −Infinity = fermé).
 * @param {{ nom: string, niveau: number, fader: number, pan?: number, aux?: number, fx?: number }[]} tr
 * @param {{ master?: number, auxMaster?: number, fxMaster?: number, fxRetour?: number, pfl?: number }} [m]
 */
export function sorties(tr, m = {}) {
  const master = m.master ?? 0, auxM = m.auxMaster ?? 0, fxM = m.fxMaster ?? 0, fxR = m.fxRetour ?? -Infinity;
  const part = (l) => (Number.isFinite(l) ? l : -Infinity);
  const aux = tr.map((t) => ({ nom: t.nom, v: part(t.niveau + (t.aux ?? -Infinity) + auxM) }));
  const fx = tr.map((t) => ({ nom: t.nom, v: part(t.niveau + t.fader + (t.fx ?? -Infinity) + fxM) }));
  const fxEnvoi = somme(fx.map((x) => x.v));
  // l'effet (une réverbération) rend à peu près le niveau qu'on lui envoie, au centre du mélange
  const fxRet = fxEnvoi + fxR + panDb(0)[0];
  const princ = tr.map((t) => { const [g, d] = panDb(t.pan || 0); return { nom: t.nom, g: part(t.niveau + t.fader + g + master), d: part(t.niveau + t.fader + d + master) }; });
  if (Number.isFinite(fxRet)) princ.push({ nom: 'Retour d\'effet', g: fxRet + master, d: fxRet + master });
  const G = somme(princ.map((p) => p.g)), D = somme(princ.map((p) => p.d));
  const pfl = m.pfl != null && tr[m.pfl] ? tr[m.pfl] : null;
  return {
    principale: { g: G, d: D, xlr: Math.max(G, D) + GAIN_XLR, parts: princ },
    aux: { v: somme(aux.map((a) => a.v)), parts: aux },
    fx: { v: fxEnvoi, parts: fx, retour: fxRet },
    rec: Math.max(G, D) + GAIN_REC,
    casque: pfl ? { quoi: `PFL : ${pfl.nom} seule, avant son fader`, v: pfl.niveau } : { quoi: 'le mélange principal', v: Math.max(G, D) },
  };
}
/** la part d'une source dans une sortie : son niveau moins celui de la sortie (dB ; 0 : elle seule) */
export const partDans = (/** @type {number} */ l, /** @type {number} */ total) => (Number.isFinite(l) && Number.isFinite(total) ? l - total : -Infinity);

// ================= le larsen =================
/**
 * Le gain de la boucle micro → console → retour → micro, en dB (modèle simplifié) : ce que le système rend à
 * 1 m du retour en plus de ce qu'il capte au micro (gainSysteme, réglé par l'AUX), moins la perte avec la
 * distance (20 log10 d, en champ libre) et le rejet du micro dans la direction du retour. À 0 dB, larsen.
 * @param {{ gainSysteme: number, distance: number, rejet: number }} o
 */
export function boucle(o) {
  const g = o.gainSysteme - 20 * log10(Math.max(0.05, o.distance)) - o.rejet;
  return { gain: g, marge: -g, larsen: g >= 0 };
}
/** rejet d'un micro cardioïde à l'angle a (degrés) : 1 / ((1 + cos a) / 2), en dB, borné à 25 dB (vers l'arrière, un vrai micro ne rejette pas à l'infini) */
export function rejetCardio(/** @type {number} */ a) {
  const k = (1 + Math.cos(a * Math.PI / 180)) / 2;
  return Math.min(25, k <= 1e-6 ? 25 : -20 * log10(k));
}

// ================= l'audio numérique =================
export const nyquist = (/** @type {number} */ fs) => fs / 2;
/** la fréquence entendue après échantillonnage à fs : une fréquence au-delà de fs/2 se replie */
export function repliement(/** @type {number} */ f, /** @type {number} */ fs) {
  const k = Math.round(f / fs);
  return Math.abs(f - k * fs);
}
/** dynamique théorique d'une quantification sur n bits (sinus pleine échelle) : 6,02 n + 1,76 dB */
export const dynamique = (/** @type {number} */ n) => 6.02 * n + 1.76;
/** nombre de valeurs d'un échantillon sur n bits */
export const valeurs = (/** @type {number} */ n) => 2 ** n;
/** débit brut d'un signal PCM, en bit/s */
export const debitPcm = (/** @type {number} */ fs, /** @type {number} */ bits, canaux = 1) => fs * bits * canaux;
/** AES3 : deux canaux, deux sous-trames de 32 bits par période d'échantillon ; 110 Ω en XLR, 75 Ω en coaxial (AES-3id) */
export const AES3 = { canaux: 2, bitsParPeriode: 64, xlr: 110, coax: 75 };
export const debitAes3 = (/** @type {number} */ fs) => AES3.bitsParPeriode * fs;
/** MADI (AES10) : 64 canaux à 48 kHz (56 en varispeed, 32 à 96 kHz), 32 bits par canal, ligne à 125 Mb/s (codage 4B5B) */
export const MADI = { canaux: 64, varispeed: 56, a96k: 32, bitsParCanal: 32, ligne: 125e6, utile: 100e6 };
export const debitMadi = (/** @type {number} */ fs, canaux = MADI.canaux) => canaux * MADI.bitsParCanal * fs;
/** combien de canaux MADI tiennent dans les 100 Mb/s utiles à fs (au plus 64) */
export const canauxMadi = (/** @type {number} */ fs) => Math.min(MADI.canaux, Math.floor(MADI.utile / (MADI.bitsParCanal * fs) / 8) * 8);
/** les alignements : le niveau numérique du signal d'alignement et la tension qui lui correspond */
export const ALIGNEMENTS = {
  r68: { nom: 'EBU R68 (Europe)', dbfs: -18, dbu: 0 },
  rp155: { nom: 'SMPTE RP 155 (États-Unis)', dbfs: -20, dbu: 4 },
};
/** tension (dBu) d'un niveau numérique (dBFS) sous un alignement, et l'inverse */
export const dbuDeDbfs = (/** @type {number} */ dbfs, A = ALIGNEMENTS.r68) => dbfs - A.dbfs + A.dbu;
export const dbfsDeDbu = (/** @type {number} */ dbu, A = ALIGNEMENTS.r68) => dbu - A.dbu + A.dbfs;
/** latence d'un traitement de n échantillons, en ms */
export const latenceMs = (/** @type {number} */ n, /** @type {number} */ fs) => n / fs * 1000;
/** échantillons audio par image vidéo */
export const echParImage = (/** @type {number} */ fs, /** @type {number} */ ips) => fs / ips;

// ================= la loudness (ITU-R BS.1770-4, EBU R128, EBU Tech 3342) =================
export const R128 = { cible: -23, tol: 0.5, tolDirect: 1, crete: -1, porteAbs: -70, porteRel: -10, porteLra: -20 };
const energie = (/** @type {number} */ l) => (Number.isFinite(l) ? 10 ** (l / 10) : 0);
const lufs = (/** @type {number} */ e) => (e > 0 ? 10 * log10(e) : -Infinity);
const moyenne = (/** @type {number[]} */ a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
/** un programme fait de segments [{ duree (s), lufs, crete? (dBTP) }] → sa loudness par tranches de 100 ms */
export function sousBlocs(/** @type {{ duree: number, lufs: number }[]} */ segments) {
  const out = [];
  for (const s of segments) for (let k = 0, n = Math.round(s.duree * 10); k < n; k++) out.push(s.lufs);
  return out;
}
/** la loudness sur une fenêtre de n tranches de 100 ms finissant à la tranche i (momentanée : 4, court terme : 30) */
export function fenetre(/** @type {number[]} */ sb, /** @type {number} */ i, /** @type {number} */ n) {
  const a = sb.slice(Math.max(0, i - n + 1), i + 1);
  return a.length < n ? -Infinity : lufs(moyenne(a.map(energie)));
}
/** les blocs de 400 ms de la loudness intégrée : un bloc toutes les 100 ms (recouvrement de 75 %) */
export function blocs(/** @type {number[]} */ sb) {
  const out = [];
  for (let i = 3; i < sb.length; i++) out.push(fenetre(sb, i, 4));
  return out;
}
/**
 * La loudness intégrée (BS.1770-4) : on écarte les blocs sous −70 LUFS (porte absolue), on moyenne en énergie
 * ceux qui restent, puis on écarte ceux qui sont plus de 10 LU sous cette moyenne (porte relative) et on refait la moyenne.
 * @param {number[]} b loudness des blocs de 400 ms
 */
export function integree(b) {
  const a = b.filter((l) => l > R128.porteAbs);
  if (!a.length) return { I: -Infinity, porteRel: -Infinity, gardes: 0, total: b.length, sousAbs: b.length, sousRel: 0 };
  const porteRel = lufs(moyenne(a.map(energie))) + R128.porteRel;
  const g = a.filter((l) => l > porteRel);
  return { I: lufs(moyenne(g.map(energie))), porteRel, gardes: g.length, total: b.length, sousAbs: b.length - a.length, sousRel: a.length - g.length };
}
/** un centile (méthode du rang le plus proche) d'une liste */
function centile(/** @type {number[]} */ a, /** @type {number} */ p) {
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p / 100 * s.length) - 1))];
}
/** la plage de loudness (LRA, EBU Tech 3342) : court terme de 3 s, portes −70 LUFS et −20 LU, centiles 10 et 95 */
export function lra(/** @type {number[]} */ sb) {
  const st = sb.map((_, i) => fenetre(sb, i, 30)).filter((l) => Number.isFinite(l) && l > R128.porteAbs);
  if (st.length < 2) return 0;
  const porte = lufs(moyenne(st.map(energie))) + R128.porteLra;
  const g = st.filter((l) => l > porte);
  return g.length < 2 ? 0 : centile(g, 95) - centile(g, 10);
}
/** la mesure complète d'un programme : intégrée, LRA, momentanée et court terme maximales, crête vraie, gain pour −23 LUFS */
export function mesure(/** @type {{ duree: number, lufs: number, crete?: number }[]} */ segments) {
  const sb = sousBlocs(segments);
  const b = blocs(sb), I = integree(b);
  const mom = b.length ? Math.max(...b) : -Infinity;
  const ct = sb.map((_, i) => fenetre(sb, i, 30)).filter(Number.isFinite);
  const crete = Math.max(...segments.map((s) => s.crete ?? -Infinity));
  return { ...I, lra: lra(sb), momMax: mom, ctMax: ct.length ? Math.max(...ct) : -Infinity, crete, correction: Number.isFinite(I.I) ? R128.cible - I.I : 0, duree: sb.length / 10 };
}
/** ce que dit la R128 d'une mesure : intégrée dans la tolérance (±0,5 LU, ±1 LU pour le direct), crête vraie sous −1 dBTP */
export function conformeR128(/** @type {number} */ I, /** @type {number} */ crete, direct = false) {
  const tol = direct ? R128.tolDirect : R128.tol;
  return { loudness: Math.abs(I - R128.cible) <= tol + 1e-9, crete: !(crete > R128.crete), tol };
}

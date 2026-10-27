// @ts-check
// ----------------------------------------------------------------------------------
// Les calculs de la synchro : purs, sans interface, lus par les leçons (cours/synchro_ref.js,
// cours/synchro_spg.js), la vue 3D du SPG (vues3d/vues/synchro_spg.js) et les exercices en autonomie
// (cours/exos/synchro.js) ; testés par tests/unit/synchro.test.mjs.
//  · les rythmes d'un format (image, ligne, échantillon vidéo et audio) et la dérive de deux horloges libres ;
//  · les formes d'onde des références : black burst 625 et 525 lignes (ITU-R BT.1700, SMPTE ST 170 / ST 318),
//    tri-level 1080 et 720 (SMPTE ST 274, ST 296 : 44 ou 40 périodes de 74,25 MHz par demi-impulsion) ;
//  · la ligne de référence : pont diviseur d'un générateur adapté 75 Ω, réflexion Γ, retard (≈ 5 ns/m) ;
//  · un générateur type Tektronix SPG700, simplifié : sa référence d'entrée, ses trois sorties BLACK, son word
//    clock, son LTC, et ce qui se verrouille sur quoi ;
//  · le word clock (AES11 annexe B) : niveau reçu selon les terminaisons, seuils des récepteurs, échantillons
//    audio par image (1 920 à 25 i/s, séquence de 5 images en 29,97) ;
//  · SMPTE ST 2059-1 : l'heure PTP (secondes TAI depuis le 1er janvier 1970) → numéro d'image, phase, prochain
//    top image, timecode de l'heure du jour.
// Les valeurs qui ne sont que des ordres de grandeur (tolérance d'une entrée de référence, impédance du pilote
// word clock, seuils des récepteurs) le disent là où elles sont définies.
// ----------------------------------------------------------------------------------

// ================= les rythmes d'un format =================
/**
 * @typedef {{ nom: string, ips: number, champs: number, lignes: number, horloge: number, famille: number }} Format
 * ips : images par seconde ; champs : 2 en entrelacé ; horloge : fréquence d'échantillonnage (MHz) ;
 * famille : 50 (cadences 25 et 50) ou 59,94 (cadences 29,97 et 59,94)
 */
/** @type {Record<string, Format>} */
export const FORMATS = {
  '1080i50': { nom: '1080i50', ips: 25, champs: 2, lignes: 1125, horloge: 74.25, famille: 50 },
  '1080p50': { nom: '1080p50', ips: 50, champs: 1, lignes: 1125, horloge: 148.5, famille: 50 },
  '1080p25': { nom: '1080p25', ips: 25, champs: 1, lignes: 1125, horloge: 74.25, famille: 50 },
  '720p50': { nom: '720p50', ips: 50, champs: 1, lignes: 750, horloge: 74.25, famille: 50 },
  '625i50': { nom: '625 lignes (SD)', ips: 25, champs: 2, lignes: 625, horloge: 13.5, famille: 50 },
  '1080i59': { nom: '1080i59,94', ips: 30000 / 1001, champs: 2, lignes: 1125, horloge: 74.25 / 1.001, famille: 59.94 },
  '525i59': { nom: '525 lignes (SD)', ips: 30000 / 1001, champs: 2, lignes: 525, horloge: 13.5, famille: 59.94 },
};
/** fréquence d'échantillonnage de l'audio du car (Hz) */
export const FS_AUDIO = 48000;
/**
 * Les durées d'un format : une image, un champ, une ligne, un échantillon vidéo, un échantillon audio à 48 kHz.
 * @param {string} id clé de FORMATS
 */
export function rythmes(id) {
  const F = FORMATS[id];
  const imageMs = 1000 / F.ips, ligneUs = 1e6 / (F.ips * F.lignes), echNs = 1000 / F.horloge;
  return {
    F, imageMs, champMs: imageMs / F.champs, ligneUs, echNs,
    echParLigne: Math.round(F.horloge * ligneUs), lignesParSeconde: F.ips * F.lignes,
    audioUs: 1e6 / FS_AUDIO, audioParImage: FS_AUDIO / F.ips,
  };
}

// ================= la dérive de deux horloges libres =================
/** écart accumulé (µs) entre deux horloges qui diffèrent de ppm parties par million, au bout de s secondes */
export const derive = (ppm, s) => ppm * s;
/** secondes qu'il faut à un écart de ppm pour cumuler us microsecondes (une ligne, une image…) */
export const secondesPour = (ppm, us) => (ppm === 0 ? Infinity : us / Math.abs(ppm));
/**
 * La phase de B par rapport à A au bout de s secondes, ramenée dans une période (une image, une ligne) :
 * entre −période/2 et +période/2 (µs). ppm : écart de B sur A.
 */
export function phaseApres(ppm, s, periodeUs, departUs = 0) {
  const d = departUs + derive(ppm, s);
  let p = ((d % periodeUs) + periodeUs) % periodeUs;
  if (p > periodeUs / 2) p -= periodeUs;
  return p;
}

// ================= les formes d'onde des références =================
/**
 * Le black burst : le noir d'un signal composite, réduit à ses tops de synchronisation et à la salve de
 * sous-porteuse. Niveaux par rapport au niveau de suppression (0 mV). 0H : le milieu (50 %) du front
 * descendant du top de ligne. PAL : ITU-R BT.1700 (625 lignes, 50 trames/s) ; NTSC : SMPTE ST 170 et ST 318
 * (noir à 7,5 IRE aux États-Unis, 0 au Japon). Fronts (10 à 90 %) : 200 ns en PAL, 140 ns en NTSC.
 * @typedef {{ nom: string, court: string, ligneUs: number, topUs: number, topMv: number, frontUs: number, salve: { debutUs: number, cycles: number, fMHz: number, ppMv: number }, actifUs: number, palierUs: number, noirMv: number, lignes: number, ips: number, famille: number }} BlackBurst
 */
/** @type {Record<string, BlackBurst>} */
export const BB = {
  pal: { nom: 'Black burst PAL (625 lignes, 50 trames/s)', court: 'BB PAL', ligneUs: 64, topUs: 4.7, topMv: -300, frontUs: 0.2,
    salve: { debutUs: 5.6, cycles: 10, fMHz: 4.43361875, ppMv: 300 }, actifUs: 10.5, palierUs: 1.65, noirMv: 0, lignes: 625, ips: 25, famille: 50 },
  ntsc: { nom: 'Black burst NTSC (525 lignes, 59,94 trames/s)', court: 'BB NTSC', ligneUs: 1e6 / (525 * 30000 / 1001), topUs: 4.7, topMv: -285.7, frontUs: 0.14,
    salve: { debutUs: 5.3, cycles: 9, fMHz: 3.579545, ppMv: 285.7 }, actifUs: 9.4, palierUs: 1.5, noirMv: 53.6, lignes: 525, ips: 30000 / 1001, famille: 59.94 },
};
/**
 * Le tri-level (SMPTE ST 274 pour le 1080, ST 296 pour le 720) : une impulsion à −300 mV puis +300 mV, de
 * « demi » périodes d'horloge chacune ; le repère 0H est le passage à 0 V du front montant, au milieu ; fronts
 * de 4 périodes. T = 1 / 74,25 MHz (÷ 1,001 en 59,94). Beaucoup de générateurs ne sortent pas de tri-level
 * 1080p50 : les appareils 1080p50 se calent en général sur un tri-level 1080i50 ou un black burst (leur notice).
 * @typedef {{ nom: string, court: string, fmt: string, demi: number, total: number, horloge: number, montee: number, famille: number }} TriLevel
 */
/** @type {Record<string, TriLevel>} */
export const TRI = {
  '1080i50': { nom: 'Tri-level 1080i50', court: 'TRI 1080i50', fmt: '1080i50', demi: 44, total: 2640, horloge: 74.25, montee: 4, famille: 50 },
  '1080p25': { nom: 'Tri-level 1080p25', court: 'TRI 1080p25', fmt: '1080p25', demi: 44, total: 2640, horloge: 74.25, montee: 4, famille: 50 },
  '720p50': { nom: 'Tri-level 720p50', court: 'TRI 720p50', fmt: '720p50', demi: 40, total: 1980, horloge: 74.25, montee: 4, famille: 50 },
  '1080i59': { nom: 'Tri-level 1080i59,94', court: 'TRI 1080i59,94', fmt: '1080i59', demi: 44, total: 2200, horloge: 74.25 / 1.001, montee: 4, famille: 59.94 },
};
/** une rampe de a à b entre t0 et t1 */
const rampe = (t, t0, t1, a, b) => a + (b - a) * Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
/** la tension (mV) d'un black burst à t µs de 0H (ligne ordinaire, hors suppression trame) */
export function bbMv(tUs, std = 'pal') {
  const B = BB[std], L = B.ligneUs, f = B.frontUs;
  let t = ((tUs % L) + L) % L; if (t > L - B.palierUs) t -= L; // le palier avant : la fin de la ligne d'avant
  if (t < -f / 2) return 0;
  if (t < f / 2) return rampe(t, -f / 2, f / 2, 0, B.topMv);
  if (t < B.topUs - f / 2) return B.topMv;
  if (t < B.topUs + f / 2) return rampe(t, B.topUs - f / 2, B.topUs + f / 2, B.topMv, 0);
  const s = B.salve, d = s.cycles / s.fMHz;
  if (t >= s.debutUs && t < s.debutUs + d) {
    const u = (t - s.debutUs) / d, env = Math.min(1, u * s.cycles, (1 - u) * s.cycles);
    return s.ppMv / 2 * env * Math.sin(2 * Math.PI * s.fMHz * (t - s.debutUs));
  }
  if (t >= B.actifUs) return B.noirMv;
  return 0;
}
/** la tension (mV) d'un tri-level à t µs de 0H */
export function triMv(tUs, fmt = '1080i50') {
  const R = TRI[fmt], T = 1 / R.horloge, L = R.total * T, h = R.demi * T, m = R.montee * T;
  let t = ((tUs % L) + L) % L; if (t > L / 2) t -= L;
  if (t < -h - m / 2) return 0;
  if (t < -h + m / 2) return rampe(t, -h - m / 2, -h + m / 2, 0, -300);
  if (t < -m / 2) return -300;
  if (t < m / 2) return rampe(t, -m / 2, m / 2, -300, 300);
  if (t < h - m / 2) return 300;
  if (t < h + m / 2) return rampe(t, h - m / 2, h + m / 2, 300, 0);
  return 0;
}
/** la forme d'onde d'une sortie (black burst 'pal', 'ntsc' ou tri-level '1080i50'…) à t µs de 0H */
export const ondeMv = (sortie, tUs) => (BB[sortie] ? bbMv(tUs, sortie) : TRI[sortie] ? triMv(tUs, sortie) : 0);
/** ce qu'on mesure sur un black burst */
export function mesureBB(std = 'pal') {
  const B = BB[std], s = B.salve;
  return {
    nom: B.nom, ligneUs: B.ligneUs, topUs: B.topUs, topMv: B.topMv, frontNs: B.frontUs * 1000,
    fMHz: s.fMHz, periodeNs: 1000 / s.fMHz, cycles: s.cycles, salveUs: s.cycles / s.fMHz, salveDebutUs: s.debutUs, salvePpMv: s.ppMv,
    lignes: B.lignes, imageMs: 1000 / B.ips, lignesParSeconde: B.lignes * B.ips, famille: B.famille,
  };
}
/** ce qu'on mesure sur un tri-level */
export function mesureTri(fmt = '1080i50') {
  const R = TRI[fmt], Tns = 1000 / R.horloge, F = FORMATS[R.fmt];
  return {
    nom: R.nom, Tns, demiNs: R.demi * Tns, impulsionNs: 2 * R.demi * Tns, monteeNs: R.montee * Tns, ligneUs: R.total * Tns / 1000,
    ppMv: 600, demi: R.demi, total: R.total, lignes: F.lignes, imageMs: 1000 / F.ips, famille: R.famille,
  };
}

// ================= la ligne de référence : terminaison, réflexion, retard =================
/** impédance caractéristique de la vidéo (Ω) */
export const Z0 = 75;
/** retard d'un coaxial vidéo, ordre de grandeur (facteur de vélocité ≈ 0,66) : ≈ 5 ns par mètre */
export const NS_PAR_M = 5;
/** plusieurs résistances en parallèle (Ω) ; aucune : Infinity (ligne ouverte) */
export const parallele = (/** @type {number[]} */ ...R) => (R.length ? 1 / R.reduce((s, r) => s + 1 / r, 0) : Infinity);
/** coefficient de réflexion au bout d'une ligne 75 Ω fermée sur zl (Infinity : ouverte) */
export const reflexion = (zl) => (zl === Infinity ? 1 : (zl - Z0) / (zl + Z0));
/**
 * Le niveau reçu au bout d'une ligne de référence, rapporté au niveau nominal, quand le générateur est adapté
 * (75 Ω interne, réglé pour donner le nominal sur une seule charge de 75 Ω) : pont diviseur.
 * nTerm : charges de 75 Ω au bout (bouchon, entrées terminées en interne) ; 0 : ligne ouverte.
 * @returns {{ RL: number, k: number, dB: number, gamma: number, verdict: 'ok' | 'limite' | 'hors' }}
 *   k : amplitude reçue ÷ nominale ; verdict selon une tolérance d'entrée de l'ordre de ± 3 dB (ordre de grandeur,
 *   la notice de chaque appareil donne la sienne)
 */
export function niveauLigne(nTerm) {
  const RL = nTerm > 0 ? Z0 / nTerm : Infinity;
  const k = RL === Infinity ? 2 : 2 * RL / (Z0 + RL);
  const dB = 20 * Math.log10(k);
  return { RL, k, dB, gamma: reflexion(RL), verdict: Math.abs(dB) <= 1 ? 'ok' : Math.abs(dB) <= 3 ? 'limite' : 'hors' };
}
/** retard d'un câble (ns) */
export const retardCable = (m, nsParM = NS_PAR_M) => m * nsParM;
/** l'écho d'une ligne mal terminée revient au départ après un aller-retour (ns) */
export const echoNs = (m, nsParM = NS_PAR_M) => 2 * m * nsParM;

// ================= un générateur de synchro type Tektronix SPG700 (simplifié) =================
/** les formats qu'une sortie BLACK peut prendre : black burst ou tri-level */
export const SORTIE_FORMATS = ['pal', 'ntsc', '1080i50', '1080p25', '720p50', '1080i59'];
export const nomSortie = (f) => (BB[f] ? BB[f].court : TRI[f] ? TRI[f].court : 'éteinte');
/** la famille de cadence d'une sortie (50 ou 59,94) */
export const familleDe = (f) => (BB[f] ? BB[f].famille : TRI[f] ? TRI[f].famille : 0);
/**
 * Des appareils et l'entrée de référence de chacun : ce qu'elle accepte (d'après des notices types ; un vrai
 * appareil a sa propre liste) et ce qu'il demande en timecode et en word clock.
 * @typedef {{ id: string, nom: string, fmt: string, accepte: string[], entree: 'ref' | 'wc' | 'ltc' }} Appareil
 */
/** @type {Appareil[]} */
export const APPAREILS = [
  { id: 'ccu', nom: 'CCU (caméras en 1080i50)', fmt: '1080i50', accepte: ['1080i50', 'pal'], entree: 'ref' },
  { id: 'melangeur', nom: 'Mélangeur (1080p50)', fmt: '1080p50', accepte: ['pal', '1080i50'], entree: 'ref' },
  { id: 'serveur', nom: 'Serveur ralenti (1080p50)', fmt: '1080p50', accepte: ['pal', '1080i50'], entree: 'ref' },
  { id: 'ptz', nom: 'Caméra PTZ (720p50)', fmt: '720p50', accepte: ['720p50', 'pal'], entree: 'ref' },
  { id: 'console', nom: 'Console son (48 kHz)', fmt: '', accepte: ['wc'], entree: 'wc' },
  { id: 'enregistreur', nom: 'Enregistreur (timecode 25 i/s)', fmt: '1080i50', accepte: ['ltc'], entree: 'ltc' },
];
export const appareil = (id) => APPAREILS.find((a) => a.id === id) || null;
/**
 * L'état de la référence d'entrée du générateur.
 * @param {{ mode: 'interne' | 'genlock', entree?: string, stay?: boolean, perdue?: boolean }} r
 *   entree : ce qui arrive sur l'entrée genlock bouclée ('pal', '1080i50', '10mhz' ou '') ; perdue : l'entrée vient de disparaître
 * @returns {{ etat: 'interne' | 'verrouille' | 'stay' | 'libre', texte: string }}
 */
export function referenceSpg(r) {
  if (r.mode === 'interne') return { etat: 'interne', texte: 'Référence interne : l\'oscillateur thermostaté du générateur donne le rythme (free run). Il ne suit personne : tout le site se cale sur lui.' };
  const ok = !!r.entree && !r.perdue && ['pal', 'ntsc', '1080i50', '1080p25', '720p50', '1080i59', '10mhz'].includes(r.entree);
  if (ok) return { etat: 'verrouille', texte: `Verrouillé sur l'entrée genlock (${r.entree === '10mhz' ? 'un 10 MHz' : nomSortie(r.entree)}) : le générateur suit une référence de plus haut niveau, ses sorties en dérivent.` };
  if (r.stay) return { etat: 'stay', texte: 'Entrée perdue, Stay GenLock : les sorties gardent leur fréquence et leur phase ; au retour de la référence, le générateur rattrape l\'écart en douceur, sans saut.' };
  return { etat: 'libre', texte: 'Entrée perdue, sans Stay GenLock : le générateur repasse sur son oscillateur ; au retour de la référence, ses sorties sautent pour se recaler, et tout le car décroche un instant.' };
}
/**
 * Un appareil se verrouille-t-il sur la sortie qu'on lui donne ?
 * @param {string} id appareil (APPAREILS)
 * @param {string} sortie format de la sortie BLACK branchée ('' : rien)
 * @returns {{ ok: boolean, texte: string }}
 */
export function verrou(id, sortie) {
  const A = appareil(id); if (!A || A.entree !== 'ref') return { ok: false, texte: 'Cet appareil ne prend pas de référence vidéo.' };
  if (!sortie) return { ok: false, texte: 'Pas de référence : il tourne sur son quartz, libre, et dérive.' };
  if (familleDe(sortie) !== FORMATS[A.fmt].famille) return { ok: false, texte: `${nomSortie(sortie)} est de la famille ${familleDe(sortie) === 50 ? '50' : '59,94'} Hz, l'appareil de la famille ${FORMATS[A.fmt].famille === 50 ? '50' : '59,94'} Hz : il ne peut pas s'y verrouiller.` };
  if (!A.accepte.includes(sortie)) return { ok: false, texte: `${nomSortie(sortie)} : même famille, mais son entrée de référence ne l'accepte pas (elle prend ${A.accepte.map(nomSortie).join(' ou ')}).` };
  return { ok: true, texte: `Verrouillé sur ${nomSortie(sortie)}.` };
}
/**
 * Un décalage de phase (µs, + : la sortie est retardée) écrit comme sur un générateur : des lignes entières et
 * un reste en µs, dans le format de la sortie.
 */
export function decalage(us, sortie) {
  const L = BB[sortie] ? BB[sortie].ligneUs : TRI[sortie] ? TRI[sortie].total / TRI[sortie].horloge : 1;
  const lignes = Math.round(us / L) + 0; // + 0 : pas de « −0 ligne »
  return { lignes, us: us - lignes * L, ligneUs: L };
}
/** le décalage à donner à la référence d'un appareil qui sort ses images avec un retard de traitement (µs) : on l'avance d'autant */
export const avancePour = (retardUs) => -retardUs;
/**
 * Le LTC : cadence et heure. L'enregistreur attend 25 i/s, heure locale.
 * @param {{ cadence: string, source: 'heure' | 'programme', fuseau: number }} l cadence '25', '30', '29.97' ou '24' ; fuseau en heures sur UTC
 * @param {{ cadence?: string, fuseau?: number }} [attendu]
 */
export function ltcVerdict(l, attendu = { cadence: '25', fuseau: 1 }) {
  if (l.cadence !== (attendu.cadence ?? '25')) return { ok: false, texte: `LTC à ${l.cadence.replace('.', ',')} i/s : l'enregistreur compte à ${(attendu.cadence ?? '25')} i/s, son timecode est faux ou refusé.` };
  if (l.source !== 'heure') return { ok: false, texte: 'LTC en heure programme : il compte depuis un départ choisi, pas l\'heure du jour ; la scripte et le serveur ne parleront pas la même heure.' };
  if (l.fuseau !== (attendu.fuseau ?? 1)) return { ok: false, texte: `Fuseau UTC${l.fuseau >= 0 ? '+' : '−'}${Math.abs(l.fuseau)} : l'heure du LTC est décalée de ${Math.abs(l.fuseau - (attendu.fuseau ?? 1))} h sur l'heure locale.` };
  return { ok: true, texte: 'LTC à 25 i/s, heure du jour locale : l\'enregistreur date ses images comme tout le car.' };
}

// ================= le word clock =================
/**
 * Les deux niveaux de la sortie word clock (48 kHz). Modèle, ordre de grandeur à vérifier sur la notice du
 * générateur : « 5 V » est un pilote CMOS couplé en continu, capable de 75 Ω (faible impédance interne, ici 10 Ω) ;
 * « 1 V » donne 1 V crête à crête sur 75 Ω, centré sur 0 V (pilote adapté 75 Ω).
 * @type {Record<string, { nom: string, E: number, Rs: number, continu: boolean }>}
 */
export const WC_SORTIES = {
  '5V': { nom: '5 V (CMOS, couplé en continu)', E: 5, Rs: 10, continu: true },
  '1V': { nom: '1 V sur 75 Ω (alternatif)', E: 2, Rs: Z0, continu: false },
};
/**
 * Des entrées word clock types (AES11, annexe B) : la plupart attendent des niveaux TTL (un haut au-dessus de
 * 2,4 V, un bas sous 0,4 V) ; selon les appareils, de 1 à 5 V crête à crête ; certaines décrochent au-delà de
 * 3 V, d'autres demandent 4 V. La notice de l'appareil fait foi.
 * @type {Record<string, { nom: string, min: number, max: number, ttl: boolean }>}
 */
export const RECEPTEURS = {
  ttl: { nom: 'entrée TTL (la plupart des consoles et convertisseurs)', min: 2.4, max: Infinity, ttl: true },
  large: { nom: 'entrée à large plage (1 à 5 V crête à crête)', min: 1, max: 5.6, ttl: false },
  exigeant: { nom: 'entrée qui demande 4 V au moins', min: 4, max: Infinity, ttl: true },
  fragile: { nom: 'entrée qui décroche au-delà de 3 V', min: 1, max: 3, ttl: false },
};
/**
 * Le word clock reçu au bout d'une chaîne : la sortie choisie, les entrées terminées en interne (chacune 75 Ω),
 * le bouchon 75 Ω au bout ; et ce qu'en pense une entrée type.
 * @param {{ sortie: string, terminees?: number, bouchon?: boolean, recepteur?: string }} o
 */
export function wordclock(o) {
  const S = WC_SORTIES[o.sortie] || WC_SORTIES['5V'];
  const n = (o.terminees || 0) + (o.bouchon ? 1 : 0);
  const RL = n ? Z0 / n : Infinity;
  const vpp = RL === Infinity ? S.E : S.E * RL / (S.Rs + RL);
  const haut = S.continu ? vpp : vpp / 2, bas = S.continu ? 0 : -vpp / 2;
  const gamma = reflexion(RL);
  const R = RECEPTEURS[o.recepteur || 'ttl'];
  let ok, raison;
  if (R.ttl && (haut < R.min || bas > 0.4)) { ok = false; raison = `le haut n'atteint que ${fmt2(haut)} V : l'entrée en attend au moins ${fmt2(R.min)}`; }
  else if (!R.ttl && vpp < R.min) { ok = false; raison = `${fmt2(vpp)} V crête à crête : trop faible, l'entrée en demande ${fmt2(R.min)} au moins`; }
  else if (vpp > R.max) { ok = false; raison = `${fmt2(vpp)} V crête à crête : trop fort pour cette entrée (${fmt2(R.max)} V au plus)`; }
  else { ok = true; raison = `${fmt2(vpp)} V crête à crête : dans ce que l'entrée accepte`; }
  return { vpp, haut, bas, RL, n, gamma, ok, reflexions: n === 0 || Math.abs(gamma) > 0.1, raison };
}
const fmt2 = (v) => (Math.round(v * 100) / 100).toString().replace('.', ',');
/** le plus grand diviseur commun */
export const pgcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
/**
 * Les échantillons audio par image : en moyenne fs ÷ cadence ; si ce n'est pas un entier (29,97), une séquence de
 * n images qui en compte un nombre entier, et le motif image par image (arrondis cumulés, le motif de SMPTE ST 272 :
 * 1 602, 1 601, 1 602, 1 601, 1 602 à 48 kHz en 29,97).
 * @param {number} fs fréquence d'échantillonnage (Hz)
 * @param {number} num cadence = num / den images par seconde (25 / 1, 30000 / 1001)
 */
export function audioParImage(fs, num, den = 1) {
  const moyen = fs * den / num;
  const n = num / pgcd(fs * den, num);
  const motif = []; for (let k = 0; k < n; k++) motif.push(Math.round((k + 1) * moyen) - Math.round(k * moyen));
  return { moyen, sequence: n, total: Math.round(n * moyen), motif };
}

// ================= SMPTE ST 2059-1 : l'heure PTP et la phase des images =================
/** TAI − UTC depuis le 1er janvier 2017 (secondes intercalaires), annoncé par le grand maître (currentUtcOffset) */
export const TAI_UTC = 37;
/** l'heure PTP (secondes TAI depuis l'origine SMPTE, 1970-01-01 00:00:00 TAI) d'un instant UTC donné en ms (Date.UTC) */
export const ptpDeUtc = (msUtc) => msUtc / 1000 + TAI_UTC;
/**
 * L'image en cours à l'heure PTP t (secondes, fraction comprise), pour une cadence num / den : toutes les images
 * sont calées sur l'origine, la n-ième commence à n × den / num secondes.
 * @returns {{ n: number, phaseMs: number, prochainMs: number, imageMs: number }}
 */
export function imagePtp(tS, num, den = 1) {
  const s = Math.floor(tS), frac = tS - s;
  // s × num est un entier exact en double (moins de 2^53) : on ne perd que la fraction de seconde ; EPS rattrape
  // l'arrondi d'une fraction écrite en décimal (1 000,04 s tombe bien au début de l'image 25 001)
  const n = Math.floor((s * num + frac * num) / den + EPS);
  const imageMs = 1000 * den / num;
  // le temps écoulé depuis le début de l'image n, en « num-ièmes de seconde » : s × num et n × den sont exacts
  const phaseMs = Math.max(0, ((s * num - n * den) + frac * num) / num * 1000);
  return { n, phaseMs, prochainMs: imageMs - phaseMs, imageMs };
}
/** marge d'arrondi des flottants : un millionième d'image (40 ns à 25 i/s) ou d'échantillon */
const EPS = 1e-6;
/** l'échantillon audio en cours (48 kHz) à l'heure PTP t, et sa place dans l'image (25 i/s : 1 920 par image) */
export function echantillonPtp(tS, fs = FS_AUDIO, ips = 25) {
  const s = Math.floor(tS), n = s * fs + Math.floor((tS - s) * fs + EPS);
  return { n, dansImage: n % Math.round(fs / ips) };
}
const deux = (v) => String(v).padStart(2, '0');
/**
 * Le timecode de l'heure du jour à l'heure PTP t (cadence entière : 25 ou 50 ; en 50, les images de 00 à 49) :
 * TAI → UTC (− 37 s) → heure locale (+ fuseau, en heures).
 */
export function timecodePtp(tS, ips = 25, fuseau = 1) {
  const local = tS - TAI_UTC + fuseau * 3600;
  const jour = ((local % 86400) + 86400) % 86400;
  const sec = Math.floor(jour), img = Math.floor((jour - sec) * ips + 1e-9);
  return `${deux(Math.floor(sec / 3600))}:${deux(Math.floor(sec / 60) % 60)}:${deux(sec % 60)}:${deux(img)}`;
}

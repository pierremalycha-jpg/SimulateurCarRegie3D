// @ts-check
// ----------------------------------------------------------------------------------
// Modèle de l'instrument de mesure (type Tektronix / Telestream PRISM) et de la couche physique SDI.
//   · paramètres des interfaces SDI selon le format du car (normes SMPTE ST 292-1, ST 424, ST 2082-1) ;
//   · points de mesure : sorties des CCU, sorties de la grille, PGM, mire du SPG… et leur liaison coaxiale ;
//   · couche physique calculée : affaiblissement du câble, égaliseur du récepteur, œil (simulé bit par bit),
//     gigue de timing et d'alignement, erreurs CRC, perte de verrouillage ;
//   · timing de chaque source par rapport à la référence du SPG (tri-level ou black burst) ;
//   · pannes de couche physique (cordon abîmé qui s'aggrave, touret de câble trop long) ;
//   · état des deux instruments (poste vision, baie de mesure) : entrée choisie et affichage de chaque tuile.
// Aucune interface ici : le dessin est dans ui/prism.js, les postes dans ui/st_vision.js et ui/prism_station.js.
//
// Valeurs de référence (vérifiées, voir le rapport du chantier) :
//   · amplitude 800 mV ± 10 %, temps de montée et de descente mesurés de 20 à 80 % ;
//   · HD-SDI (ST 292-1, 1,485 Gb/s) : montée ≤ 270 ps, écart montée / descente ≤ 100 ps, dépassement ≤ 10 %,
//     gigue de timing ≤ 1 UI (filtre 10 Hz), gigue d'alignement ≤ 0,2 UI (filtre 100 kHz) ;
//   · 3G-SDI (ST 424, 2,97 Gb/s) : montée ≤ 135 ps, écart ≤ 50 ps, timing ≤ 2 UI, alignement ≤ 0,3 UI ;
//   · 12G-SDI (ST 2082-1, 11,88 Gb/s) : montée ≤ 45 ps, écart ≤ 18 ps, timing ≤ 8 UI, alignement ≤ 0,3 UI ;
//   · récepteurs : au moins 20 dB d'affaiblissement à la moitié de la fréquence d'horloge en HD et 3G,
//     40 dB en 6G et 12G ;
//   · câble Belden 1694A (datasheet) : 5,4 dB/100 ft à 750 MHz, 7,8 à 1,5 GHz, 17,7 à 6 GHz.
// ----------------------------------------------------------------------------------
import { S, emit, camById } from './state.js';
import { FAULTS } from './faults.js';
import { LINKS } from './data/cameras.js';
import { clamp, randPick } from './util.js';
import { feedOf, sourceLabel, MIX, meSource } from './pipeline.js';
import { ptpLocked } from './ipnet.js';

// ---------------- interfaces SDI ----------------
/**
 * @typedef {object} SdiStd
 * @property {string} key format du car (HDi, HD, UHD)
 * @property {string} name nom courant de l'interface
 * @property {string} std norme SMPTE
 * @property {string} rate débit affiché
 * @property {number} ui durée d'un bit (UI) en ps
 * @property {number} half moitié de la fréquence d'horloge (MHz)
 * @property {number} tr temps de montée maximal (ps)
 * @property {number} dtr écart montée / descente maximal (ps)
 * @property {number} tj gigue de timing maximale (UI)
 * @property {number} aj gigue d'alignement maximale (UI)
 * @property {string} ajf filtre de la gigue d'alignement
 * @property {number} loss affaiblissement garanti par la norme côté récepteur (dB à la demi-fréquence d'horloge)
 * @property {number} cab affaiblissement du câble 1694A à la demi-fréquence d'horloge (dB/100 m)
 * @property {string} fmt format vidéo
 * @property {string} vpid identifiant de charge utile (ST 352)
 * @property {number} lines lignes par image
 * @property {number} lineUs durée d'une ligne (µs)
 * @property {string} ref référence tri-level
 */
/** @type {Record<string, SdiStd>} */
export const SDI_STD = {
  HDi: { key: 'HDi', name: 'HD-SDI', std: 'SMPTE ST 292-1', rate: '1,485 Gb/s', ui: 673.4, half: 742.5, tr: 270, dtr: 100, tj: 1, aj: 0.2, ajf: '100 kHz', loss: 20, cab: 17.72, fmt: '1080i50', vpid: '1080i50 · YCbCr 4:2:2 10 bits · BT.709', lines: 1125, lineUs: 1e6 / (1125 * 25), ref: 'tri-level 1080i50' },
  HD: { key: 'HD', name: '3G-SDI', std: 'SMPTE ST 424 (niveau A, ST 425-1)', rate: '2,97 Gb/s', ui: 336.7, half: 1485, tr: 135, dtr: 50, tj: 2, aj: 0.3, ajf: '100 kHz', loss: 20, cab: 25.59, fmt: '1080p50', vpid: '1080p50 niveau A · YCbCr 4:2:2 10 bits · BT.709', lines: 1125, lineUs: 1e6 / (1125 * 50), ref: 'tri-level 1080p50' },
  UHD: { key: 'UHD', name: '12G-SDI', std: 'SMPTE ST 2082-1', rate: '11,88 Gb/s', ui: 84.2, half: 5940, tr: 45, dtr: 18, tj: 8, aj: 0.3, ajf: 'filtre haut de la norme', loss: 40, cab: 58.07, fmt: '2160p50 HDR', vpid: '2160p50 · YCbCr 4:2:2 10 bits · BT.2100 HLG', lines: 2250, lineUs: 1e6 / (2250 * 50), ref: 'tri-level 1080p50' },
};
export const AMP_NOM = 800, AMP_TOL = 0.1, OVERSHOOT_MAX = 10;
export const CABLE = 'Belden 1694A';
export const sdiStd = () => SDI_STD[S.format] || SDI_STD.HD;
// égaliseur des récepteurs du car (grille, PRISM) : on lui donne la portée des liaisons coaxiales du
// catalogue (data/cameras.js) ; c'est mieux que le minimum garanti par la norme (loss), comme les puces actuelles
export const eqMax = (f = sdiStd()) => (LINKS.coax.max[f.key] || 100) * f.cab / 100;
export const lossOf = (m, f = sdiStd()) => m * f.cab / 100;
export const lenOf = (db, f = sdiStd()) => db / f.cab * 100;

// petite variation propre à chaque point (toujours la même) : deux CCU ne mesurent pas exactement pareil
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10007) / 10007; }

// ---------------- points de mesure ----------------
/**
 * @typedef {object} Point
 * @property {string} id
 * @property {string} label nom complet
 * @property {string} short nom court (touche)
 * @property {string} group famille (CCU, grille, mélangeur, référence)
 * @property {string} src source vidéo mesurée (identifiant du simulateur : CAM3, PGM…)
 * @property {number} len longueur du câble jusqu'au point de mesure (m)
 * @property {string} path liaison décrite
 * @property {string} kind ccu | coax | conv | hf | gw | router | mixer | dec | spg
 * @property {number} [cam] caméra concernée
 */
/** @returns {Point[]} */
export function measurePoints() {
  /** @type {Point[]} */ const pts = [];
  for (const c of [...S.cams].sort((a, b) => a.id - b.id)) {
    const n = c.id;
    if (c.rf) pts.push({ id: 'ccu' + n, label: `Récepteur HF ${n} · sortie SDI`, short: `HF ${n}`, group: 'Sorties caméras', src: 'CAM' + n, cam: n, len: 7, kind: 'hf', path: `Récepteur HF de la CAM ${n} → cordon 7 m → entrée ${n} de la grille` });
    else if (c.link === 'coax') { const L = Math.round((c.route ? c.route.length : 60) + 6); pts.push({ id: 'ccu' + n, label: `CAM ${n} · liaison coaxiale`, short: `CAM ${n}`, group: 'Sorties caméras', src: 'CAM' + n, cam: n, len: L, kind: 'coax', path: `Sortie SDI de la caméra ${n} → câble coaxial de ${L} m (stade, puis pied de car) → entrée ${n} de la grille` }); }
    else if (c.link === 'smf') pts.push({ id: 'ccu' + n, label: `Convertisseur fibre ${n} · sortie SDI`, short: `CONV ${n}`, group: 'Sorties caméras', src: 'CAM' + n, cam: n, len: 8, kind: 'conv', path: `Caméra ${n} → fibre monomode → convertisseur optique / SDI → cordon 8 m → entrée ${n} de la grille` });
    else if (c.link === 'ip') pts.push({ id: 'ccu' + n, label: `Passerelle IP ${n} · sortie SDI`, short: `PASS. ${n}`, group: 'Sorties caméras', src: 'CAM' + n, cam: n, len: 6, kind: 'gw', path: `Caméra ${n} en IP → passerelle ST 2110 / SDI → cordon 6 m → entrée ${n} de la grille` });
    else { const L = Math.round(6 + n * 0.4); pts.push({ id: 'ccu' + n, label: `CCU ${n} · sortie SDI`, short: `CCU ${n}`, group: 'Sorties caméras', src: 'CAM' + n, cam: n, len: L, kind: 'ccu', path: `CCU ${n} (baie CCU) → cordon de ${L} m par la baie de brassage → entrée ${n} de la grille` }); }
  }
  pts.push(
    { id: 'pgm', label: 'Mélangeur · sortie PGM', short: 'PGM', group: 'Mélangeur et grille', src: 'PGM', len: 9, kind: 'mixer', path: 'Sortie PGM du mélangeur → cordon 9 m → grille et départs' },
    { id: 'clean', label: 'Mélangeur · clean feed', short: 'CLEAN', group: 'Mélangeur et grille', src: 'CLEAN', len: 9, kind: 'mixer', path: 'Sortie clean feed (sans habillage) du mélangeur → cordon 9 m' },
    { id: 'tx1', label: 'Grille · départ TX1', short: 'TX1', group: 'Mélangeur et grille', src: feedOf('AUX_TX1') || 'BLACK', len: 7, kind: 'router', path: 'Sortie de la grille (départ TX1, vers l\'encodeur de la fibre opérateur) → cordon 7 m' },
    { id: 'tx2', label: 'Grille · départ TX2', short: 'TX2', group: 'Mélangeur et grille', src: feedOf('AUX_TX2') || 'BLACK', len: 7, kind: 'router', path: 'Sortie de la grille (départ TX2, vers le satellite) → cordon 7 m' },
    { id: 'auxv', label: 'Grille · AUX vision', short: 'AUX VIS.', group: 'Mélangeur et grille', src: feedOf('AUX_VISION') || 'BLACK', len: 14, kind: 'router', path: 'Sortie AUX de la grille → câble de 14 m jusqu\'au moniteur Grade 1 et au PRISM de la vision' },
    { id: 'ret', label: 'Décodeur · retour antenne', short: 'RETOUR', group: 'Mélangeur et grille', src: 'RETANT', len: 5, kind: 'dec', path: 'Décodeur du retour antenne (baie transmission) → cordon 5 m' },
    { id: 'spg', label: 'SPG · sortie mire SDI', short: 'MIRE SPG', group: 'Référence', src: 'BARS', len: 1, kind: 'spg', path: 'Sortie SDI TEST du générateur de synchro → cordon de 1 m (mesure de référence, comme le demande la norme)' },
  );
  return pts;
}
export const pointById = (id) => measurePoints().find((p) => p.id === id) || null;
// point de mesure de la sortie d'une caméra
export const camPoint = (n) => pointById('ccu' + n);

// ---------------- état des pannes et compteurs ----------------
/** @type {{ faults: Record<string, { kind: string, t0: number, ramp: number, len: number, rep?: boolean }>, ctr: Record<string, { y: number, c: number, es: number, t0: number, sec: number, err: boolean }>, lost: Set<number> }} */
export const PHY = { faults: {}, ctr: {}, lost: new Set() };

// la source a-t-elle un signal (hors panne de couche physique sur ce point) ?
function srcSignal(p) {
  if (p.cam) { const c = camById(p.cam); if (!c) return false; if (c._sdiLost) return true; return c.signalOK; }
  if (p.kind === 'router') { const s = p.src; if (s && s.startsWith('CAM')) { const c = camById(+s.slice(3)); return !!c && (c.signalOK || !!c._sdiLost) && !PHY.lost.has(c.id); } }
  if (p.kind === 'dec') return !(S.faults.tx && S.txPath === 1);
  return true;
}
const BASE = { ccu: [0.25, 0.15], coax: [0.3, 0.18], conv: [0.25, 0.15], hf: [0.22, 0.12], gw: [0.22, 0.12], router: [0.2, 0.15], mixer: [0.2, 0.12], dec: [0.22, 0.12], spg: [0.12, 0.06] };

/**
 * Couche physique d'un point de mesure, à l'instant présent.
 * @param {Point} p
 */
export function linkOf(p) {
  const f = sdiStd(); const h = hash(p.id);
  if (S.ipMode && p.kind !== 'spg') return { ip: true, f, p };
  const fl = PHY.faults[p.id] || null;
  let len = p.len, extraDb = 0, rho = 0;
  if (fl && fl.kind === 'touret' && !fl.rep) len += fl.len;
  const attCable = lossOf(len, f);
  const eq = eqMax(f);
  if (fl && fl.kind === 'cable') {
    // faux contact qui s'aggrave : la marge fond vite, puis lentement à travers la zone des erreurs CRC, puis plus rien
    rho = 0.16;
    const sev = clamp((S.time - fl.t0) / fl.ramp, 0, 1);
    const m0 = eq - attCable - 2 - 12 * rho;
    const m = sev < 0.4 ? m0 + (2.5 - m0) * sev / 0.4 : 2.5 - 5 * (sev - 0.4) / 0.6;
    extraDb = Math.max(0, eq - attCable - 12 * rho - m);
  }
  const att = attCable + extraDb;
  const margin = eq - att - 12 * rho; // marge de l'égaliseur ; une rupture d'impédance (réflexion) en mange
  const src = srcSignal(p);
  const lock = src && margin > -1.5;
  // lignes en erreur par seconde : l'effet de falaise du numérique (rien, puis tout d'un coup)
  const crc = lock ? Math.min(3000, Math.pow(10, 0.2 - 1.7 * margin)) : 0;
  const E = lock ? clamp(0.15 + 0.75 * (1 - Math.exp(-(margin + 1.5) / 3)), 0.05, 0.9) : 0; // ouverture de l'œil égalisé
  const [ajB, tjB] = BASE[p.kind] || BASE.ccu;
  const aj0 = f.aj * ajB * (0.85 + 0.3 * h);
  const ajX = f.aj * 1.1 * Math.pow(clamp(1 - E / 0.85, 0, 1), 2) + rho * 0.6 * f.aj;
  const aj = aj0 + (lock ? ajX : 0);
  const tj = f.tj * tjB * (0.85 + 0.3 * hash(p.id + 't')) + (lock ? ajX : 0);
  const ampSrc = p.kind === 'spg' ? 800 : 800 * (0.985 + 0.03 * h);
  const trSrc = f.tr * (p.kind === 'spg' ? 0.5 : 0.52 + 0.1 * h);
  return { ip: false, f, p, fl, len, att, attCable, extraDb, eq, margin, rho, src, lock, crc, E, aj, tj, ampSrc, trSrc, tfSrc: trSrc * 1.05, ovs: 2.5 + 2 * h };
}
/** @typedef {ReturnType<typeof linkOf>} Link */

// compteurs d'erreurs CRC (lignes Y et C) et secondes en erreur, depuis la dernière remise à zéro
export function counters(id) { return (PHY.ctr[id] ||= { y: 0, c: 0, es: 0, t0: S.time, sec: Math.floor(S.time), err: false }); }
export function resetCounters(id) { delete PHY.ctr[id]; return counters(id); }
function poisson(l) { if (l > 30) return Math.max(0, Math.round(l + Math.sqrt(l) * gaussR())); let k = 0, p = Math.exp(-l), s = p; const u = Math.random(); while (u > s && k < 200) { k++; p *= l / k; s += p; } return k; }
function gaussR() { let u = 0; while (u === 0) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random()); }
/** avance les compteurs d'un point de dt secondes (L : couche physique du point) */
export function tickCounters(L, dt) {
  if (L.ip || !(dt > 0)) return;
  const C = counters(L.p.id);
  const n = L.lock ? poisson(L.crc * Math.min(dt, 2)) : 0;
  if (n) { const y = Math.round(n * (0.4 + 0.2 * Math.random())); C.y += y; C.c += n - y; C.err = true; }
  const sec = Math.floor(S.time);
  if (sec !== C.sec) { if (C.err) C.es++; C.err = false; C.sec = sec; }
}

// ---------------- perte d'image : la grille ne reçoit plus la caméra ----------------
// La couche physique d'une sortie caméra en panne fait tomber l'entrée de la grille : toute la
// chaîne (multiview, mélangeur, EVS) voit « PAS DE SIGNAL ». On le dit à la caméra par son état de
// liaison (status), recalculé par checkLink() : ce point le complète tant que la liaison est perdue.
const LOST_WHY = 'Plus de signal SDI à l\'entrée de la grille : la liaison coaxiale ne passe plus (erreurs CRC puis perte de verrouillage). Mesurer cette sortie à la baie de mesure.';
function setLost(c, lost) {
  if (!!c._sdiLost === lost) return;
  c._sdiLost = lost;
  if (lost) {
    PHY.lost.add(c.id);
    if (!Object.prototype.hasOwnProperty.call(c, 'checkLink')) {
      const base = Object.getPrototypeOf(c).checkLink; const cc = /** @type {any} */ (c);
      cc.checkLink = () => { base.call(cc); if (cc._sdiLost) cc.status = { ok: false, reason: LOST_WHY, power: cc.status.power, warn: '' }; };
    }
  } else {
    PHY.lost.delete(c.id);
    if (Object.prototype.hasOwnProperty.call(c, 'checkLink')) delete c.checkLink;
  }
  c.checkLink();
  emit('phy', { type: lost ? 'lost' : 'back', cam: c.id });
}
// appelé régulièrement (pannes, instrument ouvert) : met à jour la perte d'image des caméras en panne
export function tickPhy() {
  for (const [id, fl] of Object.entries(PHY.faults)) {
    void fl;
    const p = pointById(id); if (!p || !p.cam) continue;
    const c = camById(p.cam); if (!c) continue;
    const L = linkOf(p); if (L.ip) continue;
    setLost(c, !L.lock && L.margin <= -1.5);
  }
  for (const n of [...PHY.lost]) { const c = camById(n); if (!c) { PHY.lost.delete(n); continue; } if (!PHY.faults['ccu' + n]) setLost(c, false); }
}

// ---------------- pannes ----------------
/**
 * injecte une panne de couche physique sur un point (sortie d'une caméra)
 * @param {'cable' | 'touret'} kind @param {string} id @param {{ ramp?: number, start?: number }} [o]
 */
export function phyFault(kind, id, o = {}) {
  const f = sdiStd(); const p = pointById(id); if (!p) return null;
  if (kind === 'touret') {
    // touret resté en ligne : la liaison arrive juste au bout de l'égaliseur (quelques erreurs CRC) ; en 12G, souvent au-delà
    const len = Math.max(20, Math.round(lenOf(eqMax(f) - 0.3, f) - p.len));
    PHY.faults[id] = { kind, t0: S.time, ramp: 1, len };
  } else {
    // faux contact qui s'aggrave jusqu'à dépasser l'égaliseur (start : déjà avancé, de 0 à 1)
    const ramp = o.ramp || 180;
    PHY.faults[id] = { kind, t0: S.time - (o.start || 0) * ramp, ramp, len: 0 };
  }
  resetCounters(id);
  tickPhy();
  emit('phy', { type: 'fault', id, kind });
  return PHY.faults[id];
}
/**
 * geste de réparation sur la liaison d'un point ; renvoie le résultat expliqué
 * @param {string} id @param {'cordon' | 'reclocker'} act
 */
export function repairLink(id, act) {
  const fl = PHY.faults[id];
  let fixed = false, why = '';
  if (act === 'cordon') {
    if (fl) { fixed = true; why = fl.kind === 'touret' ? 'Le touret est retiré : un cordon de la bonne longueur relie directement la sortie à la grille. L\'affaiblissement retombe à quelques dB, l\'œil égalisé se rouvre, les CRC s\'arrêtent.' : 'Cordon remplacé : plus de rupture d\'impédance (le dépassement redescend sous 10 %), l\'affaiblissement redevient celui de quelques mètres de câble, l\'œil se rouvre et les CRC s\'arrêtent.'; }
    else why = 'Le cordon était bon : la mesure ne change pas. On mesure avant de changer quoi que ce soit, sinon on perd du temps (et on coupe peut-être une liaison qui marchait).';
  } else if (act === 'reclocker') {
    if (fl && fl.kind === 'touret') { fixed = true; why = 'Un répéteur (reclocker) est inséré au milieu de la liaison : il égalise, régénère et réhorloge le signal. Chaque tronçon est assez court pour l\'égaliseur suivant : les erreurs disparaissent.'; }
    else if (fl) why = 'Le répéteur régénère le signal, mais il reçoit déjà un signal abîmé par le faux contact : la rupture d\'impédance reste dans la liaison. Il faut changer le cordon.';
    else why = 'Rien à réparer ici : la liaison est courte et propre, un répéteur n\'apporterait qu\'un appareil de plus à alimenter.';
  }
  if (fixed) { delete PHY.faults[id]; resetCounters(id); tickPhy(); emit('repair', { type: 'phy', id, act }); }
  emit('phy', { type: 'repair', id, act, fixed });
  return { fixed, why };
}
export const phyFaultAt = (id) => PHY.faults[id] || null;
// caméra filaire de préférence hors antenne (la panne ne casse pas le programme d'entrée)
export function pickFaultCam() {
  const pgm = meSource(MIX.pgm);
  const all = S.cams.filter((c) => !c.rf && c.signalOK && !PHY.faults['ccu' + c.id]);
  const free = all.filter((c) => 'CAM' + c.id !== pgm);
  return (free.length ? randPick(free) : randPick(all)) || null;
}
const sdiCar = () => !S.ipMode && S.cams.some((c) => !c.rf && c.signalOK);
/** @type {any[]} */ (FAULTS).push(
  {
    id: 'sdicable', label: 'Cordon SDI abîmé entre une CCU et la grille (faux contact qui s\'aggrave)', where: 'Baie de mesure',
    can: sdiCar,
    inject() { const c = pickFaultCam(); phyFault('cable', 'ccu' + c.id); return { cam: c.id, point: 'ccu' + c.id }; },
    check: (st) => { tickPhy(); return !PHY.faults[st.point]; },
    repair: (st) => { delete PHY.faults[st.point]; tickPhy(); },
    hint: 'Une caméra fait des erreurs puis disparaît. Baie de mesure : la sortie de la CCU a un dépassement de plus de 10 % et un œil qui se ferme → remplacer le cordon.',
  },
  {
    id: 'sditouret', label: 'Liaison SDI trop longue : touret de câble resté en ligne', where: 'Baie de mesure',
    can: sdiCar,
    inject() { const c = pickFaultCam(); phyFault('touret', 'ccu' + c.id); return { cam: c.id, point: 'ccu' + c.id }; },
    check: (st) => { tickPhy(); return !PHY.faults[st.point]; },
    repair: (st) => { delete PHY.faults[st.point]; tickPhy(); },
    hint: 'Des erreurs CRC sur une caméra, sans coupure franche. Baie de mesure : longueur estimée bien trop grande et œil brut fermé → cordon direct ou répéteur.',
  },
);

// ---------------- timing par rapport à la référence ----------------
/**
 * décalage d'une source par rapport à la référence du SPG : lignes (vertical) et µs (horizontal)
 * @param {Point} p
 */
export function timingOf(p) {
  const f = sdiStd();
  if (S.ipMode && p.kind !== 'spg') return { ip: true, ptp: ptpLocked(), v: 0, h: 0, locked: ptpLocked(), why: '' };
  let src = p.src, cam = p.cam ? camById(p.cam) : null;
  if (!cam && src && src.startsWith('CAM')) cam = camById(+src.slice(3));
  if (cam && !cam.genlock) {
    // CCU libre : son horloge n'est pas celle du car, l'écart dérive sans arrêt
    const ph = S.time * 0.021 + cam.id * 0.37;
    const v = Math.round(((ph % 1) - 0.5) * f.lines);
    const h = (((S.time * 0.43 + cam.id * 0.61) % 1) - 0.5) * f.lineUs;
    return { ip: false, v, h, locked: false, why: `${sourceLabel('CAM' + cam.id)} n'est pas verrouillée sur la référence` };
  }
  const h = cam ? (((cam.id * 7) % 5) - 2) * 0.004 : 0;
  return { ip: false, v: 0, h, locked: true, why: '' };
}

// ---------------- l'œil, simulé bit par bit ----------------
/**
 * Simule quelques centaines de bits à travers la liaison et les replie sur 2 UI, comme
 * l'échantillonneur de l'instrument ; mesure l'œil sur le résultat (amplitude, montée, descente,
 * dépassement, ouverture). eq : œil vu après l'égaliseur du récepteur ; sinon, œil brut à l'entrée.
 * @param {Link} L @param {boolean} eq @param {number} [nb] bits simulés
 */
export function eyeSim(L, eq, nb = 360) {
  const f = L.f; const spb = 24; const N = nb * spb;
  const A = L.ampSrc / 2;
  const uiPs = f.ui;
  // caractéristiques de la liaison vue par l'œil
  const tauS = Math.max(0.02, (L.trSrc / 1.386) / uiPs); // front de l'émetteur (UI)
  let tauC, sig;
  // câble : pôle unique réglé sur l'affaiblissement à la demi-fréquence d'horloge (coefficient 0,55 : l'effet
  // de peau d'un vrai coaxial ralentit moins le début du front qu'un simple filtre RC)
  const tauRaw = 0.55 * Math.sqrt(Math.max(0, Math.pow(10, L.att / 10) - 1)) / Math.PI;
  // après l'égaliseur : reste un peu d'interférence entre symboles et du bruit, d'autant plus que la marge est faible
  if (eq) { tauC = Math.min(tauRaw, 0.03 + 1.1 * Math.pow(1 - L.E, 1.5)); sig = 0.006 + 0.07 * Math.pow(1 - L.E, 2); }
  else { tauC = tauRaw; sig = 0.006; }
  const rho = L.rho;
  const ajSig = L.aj / 6; // gigue d'alignement (crête à crête ≈ 6 écarts-types)
  const bits = new Uint8Array(nb);
  for (let i = 0; i < nb; i++) bits[i] = Math.random() < 0.5 ? 1 : 0;
  const edge = new Float32Array(nb);
  const ph = Math.random() * 6.28;
  for (let k = 0; k < nb; k++) edge[k] = k + ajSig * gaussR() + 0.25 * L.aj * Math.sin(k * 0.21 + ph);
  const aS = 1 - Math.exp(-1 / (spb * tauS)), aC = tauC > 1e-4 ? 1 - Math.exp(-1 / (spb * tauC)) : 1;
  const d = Math.max(1, Math.round(0.55 * spb));
  const y = new Float32Array(N);
  let s1 = bits[0] ? A : -A, s2 = s1;
  for (let n = 0, k = 0; n < N; n++) {
    const t = n / spb;
    while (k + 1 < nb && t >= edge[k + 1]) k++;
    const lv = bits[k] ? A : -A;
    s1 += (lv - s1) * aS; s2 += (s1 - s2) * aC;
    y[n] = s2;
  }
  // réflexion sur une rupture d'impédance proche : dépassement et petite oscillation après chaque front
  if (rho > 0) { const z = Float32Array.from(y); for (let n = d; n < N; n++) y[n] = z[n] + rho * (z[n] - z[n - d]) - 0.35 * rho * (z[n - d] - (n >= 2 * d ? z[n - 2 * d] : z[n - d])); }
  for (let n = 0; n < N; n++) y[n] += sig * 2 * A * gaussR();
  // repli sur 2 UI : fenêtre de k − 0,5 à k + 1,5 UI (fronts à 0,5 et 1,5 UI, œil centré à 1 UI)
  const W = 2 * spb + 1; const segs = []; const pat = [];
  for (let k = 6; k < nb - 3; k++) { const n0 = Math.round((k - 0.5) * spb); segs.push(y.subarray(n0, n0 + W)); pat.push((bits[k - 1] << 2) | (bits[k] << 1) | bits[k + 1]); }
  // mesures
  const cIdx = spb; // échantillon du centre de l'œil (1 UI)
  // niveaux haut et bas : centre de l'œil sur les suites de trois bits identiques (comme les histogrammes de l'instrument)
  let up = 0, nu = 0, dn = 0, nd = 0, minUp = Infinity, maxDn = -Infinity;
  for (let i = 0; i < segs.length; i++) {
    const v = segs[i][cIdx], P = pat[i];
    if (P === 0b111) { up += v; nu++; } else if (P === 0b000) { dn += v; nd++; }
    if (P & 0b010) { if (v < minUp) minUp = v; } else if (v > maxDn) maxDn = v;
  }
  const top = nu ? up / nu : 0, base = nd ? dn / nd : 0, amp = top - base;
  const open = amp > 0 && nu && nd ? Math.max(0, (minUp - maxDn) / amp) : 0;
  // temps de montée et de descente (20 à 80 % entre les niveaux), dépassement
  const cross = (s, lvl, rising) => { for (let j = 1; j < W; j++) { const a = s[j - 1], b = s[j]; if (rising ? a < lvl && b >= lvl : a > lvl && b <= lvl) return j - 1 + (lvl - a) / (b - a); } return NaN; };
  let tr = 0, ntr = 0, tf = 0, ntf = 0, ovR = 0, ovF = 0;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]; const P = pat[i];
    if (P === 0b011) { const a = cross(s, base + 0.2 * amp, true), b = cross(s, base + 0.8 * amp, true); if (b > a) { tr += b - a; ntr++; } let mx = -Infinity; for (let j = spb / 2; j < W; j++) mx = Math.max(mx, s[j]); ovR = Math.max(ovR, (mx - top) / amp); }
    if (P === 0b100) { const a = cross(s, top - 0.2 * amp, false), b = cross(s, top - 0.8 * amp, false); if (b > a) { tf += b - a; ntf++; } let mn = Infinity; for (let j = spb / 2; j < W; j++) mn = Math.min(mn, s[j]); ovF = Math.max(ovF, (base - mn) / amp); }
  }
  const valid = L.lock && amp > 0.12 * L.ampSrc && ntr > 3 && ntf > 3;
  const toPs = (smp) => smp / spb * uiPs;
  return {
    segs, spb, W, A,
    meas: {
      valid, amp, open,
      tr: valid ? toPs(tr / ntr) : NaN, tf: valid ? toPs(tf / ntf) : NaN,
      ovR: valid ? Math.max(0, ovR * 100 - 3 + L.ovs) : NaN, ovF: valid ? Math.max(0, ovF * 100 - 3 + L.ovs * 0.9) : NaN,
    },
  };
}

// ---------------- instruments : entrée et tuiles ----------------
// affichages proposés dans chaque tuile (identifiant, nom affiché)
export const APPS = [
  ['pic', 'Image'], ['wfm', 'Waveform'], ['vec', 'Vecteurscope'], ['lightning', 'Lightning'], ['diamond', 'Diamant'], ['split', 'Split diamant'],
  ['arrow', 'Arrowhead'], ['cie', 'CIE 1931'], ['histo', 'Histogramme'], ['eye', 'Diagramme de l\'œil'], ['jitter', 'Gigue'], ['timing', 'Timing'], ['status', 'État SDI'],
];
export const APP_NAME = Object.fromEntries(APPS);
// réglages par défaut de chaque affichage
const DEF = { wfm: { mode: 'y', scale: 'mv', cursor: null }, vec: { bars: 75, zoom: 1 }, eye: { eq: false }, jitter: { filt: 'align' }, timing: { ref: 'tri' }, pic: { gamut: false, safe: false }, histo: {}, lightning: { bars: 75 }, diamond: {}, split: {}, arrow: {}, cie: {}, status: {} };
const tile = (app, o = {}) => ({ app, ...DEF[app], ...o });
export const PRESETS = {
  vision: { label: 'Vision', tiles: [tile('wfm'), tile('wfm', { mode: 'rgb' }), tile('vec'), tile('pic')] },
  gamut: { label: 'Gamut', tiles: [tile('diamond'), tile('split'), tile('arrow'), tile('pic', { gamut: true })] },
  phy: { label: 'Couche physique', tiles: [tile('eye'), tile('jitter'), tile('status'), tile('timing')] },
  hdr: { label: 'HDR', tiles: [tile('wfm', { scale: 'pct' }), tile('cie'), tile('pic'), tile('histo')] },
};
/** @typedef {{ app: string, [k: string]: any }} Tile */
/** @type {Record<string, { input: string, hdr: boolean, layout: number, sel: number, tiles: Tile[], frozen: boolean }>} */
export const PRISM = {
  vision: { input: 'cam', hdr: false, layout: 4, sel: 0, tiles: PRESETS.vision.tiles.map((t) => ({ ...t })), frozen: false },
  mesure: { input: 'spg', hdr: false, layout: 4, sel: 0, tiles: PRESETS.phy.tiles.map((t) => ({ ...t })), frozen: false },
};
const log = (type, o) => { emit('netlog', { type, ...o }); emit('prism', { type, ...o }); };
/** change l'affichage (ou un réglage) d'une tuile */
export function setTile(key, i, patch) {
  const P = PRISM[key]; if (!P || !P.tiles[i]) return;
  if (patch.app && patch.app !== P.tiles[i].app) P.tiles[i] = tile(patch.app, patch);
  else Object.assign(P.tiles[i], patch);
  P.sel = i;
  log('prism', { key, i, ...P.tiles[i] });
}
export function setPreset(key, k) {
  const P = PRISM[key], R = PRESETS[k]; if (!P || !R) return;
  P.tiles = R.tiles.map((t) => ({ ...t }));
  log('prism', { key, preset: k, app: P.tiles[0].app });
}
export function setLayout(key, n, sel = PRISM[key].sel) { const P = PRISM[key]; P.layout = n; P.sel = sel; log('prism', { key, layout: n }); }
export function setInput(key, id) { const P = PRISM[key]; if (!P) return; P.input = id; log('prism-input', { key, id }); }
// tuiles visibles (une seule en plein écran)
export const visibleTiles = (key) => { const P = PRISM[key]; return P.layout === 1 ? [P.tiles[P.sel]] : P.tiles; };
/** un affichage est-il à l'écran ? (pred : réglage attendu) */
export const showing = (key, app, pred = (_t) => true) => visibleTiles(key).some((t) => t.app === app && pred(t));

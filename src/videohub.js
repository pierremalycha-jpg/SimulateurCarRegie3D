// @ts-check
import { S, emit, camById } from './state.js';
import { ROUTER, route } from './pipeline.js';
import { EQUIP, mixInputs, evsLayout } from './equip.js';
import { FAULTS } from './faults.js';
import { intercom } from './ui/common.js';

// ----------------------------------------------------------------------------------
// Grille du car SDI : une Videohub 40 × 40 12G (inspiration Blackmagic Design). Modèle sans
// interface, utilisé par le poste (ui/st_videohub.js), les parcours du chef et les pannes :
//   · plan des 40 entrées et des 40 sorties, tel que le car est câblé (même numérotation que la
//     liste de câblage et la baie de brassage) ;
//   · étiquettes (labels) des entrées et des sorties, modifiables comme dans Videohub Setup ;
//   · verrouillage des sorties (états du protocole Ethernet : U libre, O verrouillée par ce poste,
//     L verrouillée par un autre poste) : une sortie verrouillée refuse toute commutation ;
//   · routage par numéro de port : une sortie câblée vers une destination du simulateur
//     (ME1…, REC1…, AUX_TX1…, MV13…) passe par route(dest, src) de pipeline.js ; une sortie
//     libre garde seulement son point de croisement.
// Les 52 destinations du simulateur ne tiennent pas toutes sur 40 sorties : les tuiles 1 à 12 du
// multiview sont câblées en direct (hors grille), la dernière rangée (tuiles 13 à 18) passe par
// les sorties 35 à 40.
// ----------------------------------------------------------------------------------
export const VH_N = 40;
export const VH_MODEL = 'Videohub 40×40 12G';
// réseau de contrôle : valeurs du simulateur (à aligner sur le plan d'adressage du car SDI)
export const VH_NET = { name: 'GRILLE CAR SDI', ip: '10.1.30.20', mask: '255.255.255.0', gw: '10.1.30.1', dhcp: false, port: 9990 }; // même adresse que la machine « grid » du réseau de contrôle (net/ctrlnet.js)

/** @typedef {{ labels: { in: Record<number, string>, out: Record<number, string> }, locks: Record<number, 'O' | 'L'>, xp: Record<number, number>, take: boolean, last: { out: number, inp: number, t: number } | null, lockedBy: Record<number, string> }} VhState */
/** @returns {VhState} */
function fresh() { return { labels: { in: {}, out: {} }, locks: {}, xp: {}, take: true, last: null, lockedBy: {} }; }
if (!ROUTER.vh) ROUTER.vh = fresh();
/** @type {VhState} */
export const VH = ROUTER.vh;

// sélection de la façade (partagée par le poste et la visionneuse de matériel) :
// mode 'out' (choix de la destination), 'in' (choix de la source), 'menu' ; inp = source préparée avant TAKE
export const VH_PANEL = { mode: 'out', out: 1, inp: /** @type {number | null} */ (null), pending: false, menu: 0, video: true };
// dernières vignettes cliquées dans le monitoring (le chef de car vérifie qu'on a su lire la mosaïque)
export const VH_MON = { pickIn: /** @type {number | null} */ (null), pickOut: /** @type {number | null} */ (null) };

// ---------------- plan des entrées ----------------
// entrées fixes : [source du simulateur, étiquette du car, appareil câblé]
const IN_FIXED = {
  17: ['EVSA', 'EVS A', 'Serveur XT4K · sortie de lecture PGM1'], 18: ['EVSB', 'EVS B', 'Serveur XT4K · sortie de lecture PGM2'],
  19: ['GFX', 'GFX FILL', 'Moteur graphique · fill (l\'image)'], 20: ['GFXK', 'GFX KEY', 'Moteur graphique · key (la découpe)'],
  21: ['STUDIO', 'STUDIO', 'Décodeur du duplex avec le studio'], 22: ['BARS', 'MIRE SPG', 'Générateur de synchro · mire de test'],
  23: ['BLACK', 'NOIR', 'Générateur de synchro · noir'], 24: ['PGM', 'PGM', 'Mélangeur · sortie programme (avec habillage)'],
  25: ['CLEAN', 'CLEAN', 'Mélangeur · clean feed (sans habillage)'], 26: ['PVW', 'PVW', 'Mélangeur · preview'],
  27: ['RETANT', 'RET ANT', 'Récepteur du retour antenne'],
};
/**
 * @param {number} n
 * @returns {{ n: number, src: string, def: string, from: string, live: boolean }}
 */
export function inPlan(n) {
  if (n >= 1 && n <= 16) {
    const c = camById(n);
    return { n, src: 'CAM' + n, def: 'CAM ' + n, from: c ? (c.link === 'hf' ? `Récepteur HF · caméra ${n}` : c.link === 'smpte' || c.link === 'triax' ? `CCU ${n} · SDI 1` : `Convertisseur fibre · caméra ${n}`) : `CCU ${n} : aucune caméra installée`, live: !!c };
  }
  const f = IN_FIXED[n];
  if (f) {
    const evsB = n === 18 && evsLayout().plays < 2;
    return { n, src: f[0], def: f[1], from: evsB ? 'Serveur XT4K : pas de 2e canal de lecture en UHD' : f[2], live: !evsB };
  }
  const k = n - 32;
  if (S.format === 'UHD' && k >= 1 && k <= 8 && camById(k)) return { n, src: 'VH' + n, def: `CAM ${k} SDR`, from: `CCU ${k} · SDI 2 (copie HD SDR pour les diffuseurs HD)`, live: true };
  return { n, src: 'VH' + n, def: 'Input ' + n, from: '', live: false };
}
/** numéro d'entrée qui porte une source du simulateur (CAM3, PGM, VH28…) ; null si aucune */
export function inOfSrc(src) {
  if (!src) return null;
  if (src.startsWith('CAM')) { const n = +src.slice(3); return n >= 1 && n <= 16 ? n : null; }
  if (/^VH\d+$/.test(src)) return +src.slice(2);
  for (const k in IN_FIXED) if (IN_FIXED[k][0] === src) return +k;
  return null;
}
export const srcOfIn = (n) => inPlan(n).src;

// ---------------- plan des sorties ----------------
const AUX_OUT = { 31: ['AUX_TX1', 'TX1 FIBRE', 'Embedder puis encodeur TX1 (fibre vers la chaîne)'], 32: ['AUX_TX2', 'TX2 SAT', 'Encodeur satellite TX2 (secours)'], 33: ['AUX_GIANT', 'ÉCRAN GÉANT', 'Fibre vers l\'écran géant du stade'], 34: ['AUX_VISION', 'GRADE 1', 'Moniteur de référence de l\'ingénieur vision'] };
/**
 * @param {number} n
 * @returns {{ n: number, dest: string | null, def: string, to: string, group: string }}
 */
export function outPlan(n) {
  if (n >= 1 && n <= 22) return n <= mixInputs() ? { n, dest: 'ME' + n, def: 'MÉL ' + n, to: `Mélangeur ${EQUIP.mixer} · entrée ${n}`, group: 'mel' } : { n, dest: null, def: 'Output ' + n, to: '', group: 'free' };
  if (n >= 23 && n <= 30) {
    const k = n - 22, L = evsLayout();
    return k <= L.rec ? { n, dest: 'REC' + k, def: 'EVS REC ' + k, to: `Serveur XT4K ${L.recServer(k)} · entrée d'enregistrement ${L.recPort(k)}`, group: 'evs' } : { n, dest: null, def: 'Output ' + n, to: '', group: 'free' };
  }
  if (AUX_OUT[n]) { const [dest, def, to] = AUX_OUT[n]; return { n, dest, def, to, group: n <= 32 ? 'tx' : 'aux' }; }
  if (n >= 35 && n <= 40) return { n, dest: 'MV' + (n - 22), def: 'MV ' + (n - 22), to: `Multiviewer · tuile ${n - 22}`, group: 'mv' };
  return { n, dest: null, def: 'Output ' + n, to: '', group: 'free' };
}
/** sortie de la Videohub qui alimente une destination du simulateur ; null si elle est hors grille */
export function outOfDest(dest) {
  if (!dest) return null;
  let m = /^ME(\d+)$/.exec(dest); if (m) return +m[1] <= 22 ? +m[1] : null;
  m = /^REC(\d+)$/.exec(dest); if (m) return 22 + +m[1];
  m = /^MV(\d+)$/.exec(dest); if (m) return +m[1] >= 13 && +m[1] <= 18 ? +m[1] + 22 : null;
  for (const k in AUX_OUT) if (AUX_OUT[k][0] === dest) return +k;
  return null;
}

// ---------------- étiquettes ----------------
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 20);
export const inLabel = (n) => VH.labels.in[n] ?? inPlan(n).def;
export const outLabel = (n) => VH.labels.out[n] ?? outPlan(n).def;
export function setInLabel(n, s) { const v = clean(s); if (!v || v === inPlan(n).def) delete VH.labels.in[n]; else VH.labels.in[n] = v; emit('router', { vhLabel: 'in', n }); }
export function setOutLabel(n, s) { const v = clean(s); if (!v || v === outPlan(n).def) delete VH.labels.out[n]; else VH.labels.out[n] = v; emit('router', { vhLabel: 'out', n }); }
export function resetLabels() { VH.labels.in = {}; VH.labels.out = {}; emit('router', { vhLabel: 'all' }); }
/** étiquettes qui ne correspondent plus au câblage (entrées) */
export function wrongInLabels() { const r = []; for (let n = 1; n <= VH_N; n++) if (VH.labels.in[n] && VH.labels.in[n] !== inPlan(n).def && /^CAM \d+$/.test(VH.labels.in[n])) r.push(n); return r; }

// ---------------- points de croisement ----------------
/** entrée routée sur la sortie n (null : rien de routé, par exemple une entrée REC libérée) */
export function xpOf(n) {
  const p = outPlan(n);
  if (p.dest) return inOfSrc(ROUTER.map[p.dest]);
  return VH.xp[n] ?? n; // sortie libre : routage 1 → 1 par défaut
}
/** sorties qui reçoivent l'entrée n */
export function outsOfIn(n) { const r = []; for (let o = 1; o <= VH_N; o++) if (xpOf(o) === n) r.push(o); return r; }

// ---------------- verrouillage ----------------
/** @returns {'U' | 'O' | 'L'} */
export const lockState = (n) => VH.locks[n] || 'U';
export function lockMsg(n) {
  const l = lockState(n);
  return `Sortie ${n} « ${outLabel(n)} » verrouillée${l === 'L' ? ` depuis un autre poste (${VH.lockedBy[n] || 'autre client du réseau'})` : ''} : la grille refuse de la commuter. Déverrouillez-la d'abord (LOCK).`;
}
/** @param {number} n @param {'O' | 'L' | null} owner @param {string} [by] */
export function setLock(n, owner, by = '') {
  if (owner) { VH.locks[n] = owner; if (by) VH.lockedBy[n] = by; else delete VH.lockedBy[n]; } else { delete VH.locks[n]; delete VH.lockedBy[n]; }
  emit('router', { vhLock: n, lock: owner || 'U' });
}
// toute commutation (poste, parcours, pannes, autres postes) passe par route() : une sortie verrouillée refuse
ROUTER.guard = (dest) => {
  if (S.ipMode) return null;
  const n = outOfDest(dest);
  if (!n || !VH.locks[n]) return null;
  emit('router', { vhRefused: n });
  return lockMsg(n);
};

/**
 * route l'entrée inp sur la sortie out ; renvoie un message d'erreur ou null
 * @param {number} out @param {number} inp
 */
export function vhRoute(out, inp) {
  const p = outPlan(out); const src = srcOfIn(inp);
  if (p.dest) { const err = route(p.dest, src); if (err) return err; }
  else {
    if (VH.locks[out]) { emit('router', { vhRefused: out }); return lockMsg(out); }
    VH.xp[out] = inp; emit('router', { vhOut: out, src });
  }
  VH.last = { out, inp, t: S.time };
  return null;
}
/** configuration du car : étiquettes d'origine, aucun verrou, sorties libres en 1 → 1 */
export function vhReset() { VH.labels.in = {}; VH.labels.out = {}; VH.locks = {}; VH.lockedBy = {}; VH.xp = {}; emit('router', { vhLabel: 'all' }); }

// ---------------- protocole Ethernet (TCP 9990) ----------------
// blocs de texte que la Videohub envoie à un client qui se connecte ; ports numérotés à partir de 0
export function protocolBlocks() {
  const rows = (f) => Array.from({ length: VH_N }, (_, i) => f(i + 1));
  return [
    ['PROTOCOL PREAMBLE:', ['Version: 2.8']],
    ['VIDEOHUB DEVICE:', ['Device present: true', `Model name: ${VH_MODEL}`, `Video inputs: ${VH_N}`, `Video outputs: ${VH_N}`]],
    ['INPUT LABELS:', rows((n) => `${n - 1} ${inLabel(n)}`)],
    ['OUTPUT LABELS:', rows((n) => `${n - 1} ${outLabel(n)}`)],
    ['VIDEO OUTPUT LOCKS:', rows((n) => `${n - 1} ${lockState(n)}`)],
    ['VIDEO OUTPUT ROUTING:', rows((n) => { const x = xpOf(n); return `${n - 1} ${x ? x - 1 : -1}`; })],
  ];
}
export const protocolText = () => protocolBlocks().map(([h, l]) => [h, ...l].join('\n')).join('\n\n') + '\n';

// ---------------- pannes ----------------
const camsOnGrid = () => S.cams.filter((c) => c.id <= 16).map((c) => c.id).sort((a, b) => a - b);
/** @type {any[]} */
const VH_FAULTS = [
  {
    id: 'vhlock', label: 'Sortie de la grille verrouillée depuis un autre poste', where: 'Grille (Videohub)',
    can: () => !S.ipMode,
    inject() {
      const prev = ROUTER.map.AUX_GIANT;
      if (VH.locks[33]) setLock(33, null);
      route('AUX_GIANT', 'BARS');
      setLock(33, 'L', 'Videohub Control du poste chef de car');
      intercom('STADE', 'L\'écran géant affiche la mire depuis dix minutes, vous pouvez remettre l\'image ?', 'bad');
      return { prev: prev && prev !== 'BARS' ? prev : 'CLEAN' };
    },
    check: () => ROUTER.map.AUX_GIANT !== 'BARS' && lockState(33) !== 'L',
    repair: (st) => { setLock(33, null); route('AUX_GIANT', st.prev || 'CLEAN'); },
    hint: 'L\'écran géant du stade montre la mire et la grille refuse la commutation : la sortie 33 est verrouillée (cadenas rouge, état L) depuis un autre poste. Videohub Control : déverrouiller la sortie, remettre CLEAN.',
  },
  {
    id: 'vhlabel', label: 'Étiquettes de deux caméras inversées sur la grille', where: 'Grille (Videohub)',
    can: () => !S.ipMode && camsOnGrid().length >= 2,
    inject() {
      const ids = camsOnGrid(); const a = ids.includes(3) && ids.includes(4) ? 3 : ids[0], b = a === 3 ? 4 : ids[1];
      VH.labels.in[a] = 'CAM ' + b; VH.labels.in[b] = 'CAM ' + a;
      if (VH.locks[35]) setLock(35, null);
      // l'opérateur a routé « CAM a » d'après l'étiquette : c'est la caméra b qui part sur la tuile 13
      route('MV13', 'CAM' + b);
      emit('router', { vhLabel: 'in', n: a });
      intercom('RÉALISATEUR', `J'ai demandé la CAM ${a} sur la tuile 13 du multiview : j'y vois la CAM ${b} !`, 'bad');
      return { a, b };
    },
    check: (st) => inLabel(st.a) === 'CAM ' + st.a && inLabel(st.b) === 'CAM ' + st.b && ROUTER.map.MV13 === 'CAM' + st.a,
    repair: (st) => { delete VH.labels.in[st.a]; delete VH.labels.in[st.b]; if (VH.locks[35]) setLock(35, null); route('MV13', 'CAM' + st.a); },
    hint: 'La tuile 13 du multiview ne montre pas la caméra demandée. Monitoring des entrées de la grille : comparez chaque image à son étiquette ; deux étiquettes sont inversées. Videohub Setup : corriger les étiquettes, puis router la bonne caméra sur la sortie 35 (MV 13).',
  },
];
FAULTS.push(...VH_FAULTS);

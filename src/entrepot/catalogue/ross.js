// @ts-check
// ----------------------------------------------------------------------------------
// Catalogue, groupe Ross Video : le mélangeur Carbonite Black Solo 13, « tout en un » : le pupitre
// de table intègre le châssis 1 U (13 entrées : 12 SDI + 1 HDMI ; 6 sorties : 5 SDI + 1 HDMI).
// Le pupitre CB9 n'est pas modélisé à part. DashBoard (le logiciel de configuration) tourne sur
// le PC de régie (groupe réseau) et parle au mélangeur en IP.
// Sources (extraits de recherche) : Carbonite Black Solo Setup Manual v2.0 et Operation Manual
// (adresse d'usine 192.168.0.123, ports tally / GPI / série), page « Carbonite Black Solo
// Specifications » (rossvideo.com : 13 entrées, 6 sorties, 24 GPI/O, 24 tallies), fiches
// revendeurs (88 W pour le châssis Solo, AES, REF IN). Ce qui manque est dans `averifier`.
// ----------------------------------------------------------------------------------
import { row } from './divers.js';

/** @typedef {import('../types.js').Modele} Modele */
/** @typedef {import('../types.js').Port} Port */
/** @typedef {import('../types.js').FaceItem} FaceItem */

const IN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const OUT = [1, 2, 3, 4, 5];
/** formats HD du Solo (50 Hz et 59,94 Hz) ; le premier est l'usine supposée pour l'Europe */
const FORMATS = ['1080i50', '1080p50', '720p50', '1080i59', '1080p59'];

/** @type {Port[]} */
const SOLO_PORTS = [
  ...IN.map((n) => /** @type {Port} */ ({ id: 'sdi-in-' + n, label: `IN ${n}`, kind: 'bnc', sig: 'sdi', dir: 'in', group: 'Entrées', desc: `Entrée SDI n° ${n} (3G/HD/SD, synchroniseur de trame par entrée) : une caméra, un lecteur. Le format doit être celui du mélangeur.` })),
  { id: 'hdmi-in', label: 'HDMI IN', kind: 'hdmi', sig: 'hdmi', dir: 'in', group: 'Entrées', desc: 'Entrée 13 : HDMI (un ordinateur, une caméra HDMI). Mise à l\'échelle vers le format du mélangeur.' },
  ...OUT.map((n) => /** @type {Port} */ ({ id: 'sdi-out-' + n, label: `OUT ${n}`, kind: 'bnc', sig: 'sdi', dir: 'out', group: 'Sorties', desc: `Sortie SDI n° ${n}, affectable (programme, prévisualisation, multiviewer, aux, clean feed) ; d'usine : ${n === 1 ? 'programme' : n === 2 ? 'prévisualisation' : n === 5 ? 'multiviewer' : 'aux ' + (n - 2)}.` })),
  { id: 'hdmi-out', label: 'HDMI OUT', kind: 'hdmi', sig: 'hdmi', dir: 'out', group: 'Sorties', desc: 'Sortie HDMI, affectable comme les sorties SDI (multiviewer d\'usine) : un moniteur de régie.' },
  { id: 'aes-out', label: 'AES', kind: 'bnc', sig: 'aes', dir: 'out', group: 'Sorties', desc: 'Sortie audio numérique AES/EBU (une paire) : le mixage audio du mélangeur vers un enregistreur ou une console.' },
  { id: 'ref-in', label: 'REF IN', kind: 'bnc', sig: 'ref', dir: 'in', group: 'Synchro', desc: 'Référence externe (black burst ou tri-level) ; sans elle, le mélangeur travaille sur son horloge interne.' },
  { id: 'tally', label: 'TALLY', kind: 'dsub25', sig: 'tally', dir: 'out', group: 'Tally et GPI', desc: 'Sorties tally à contacts (16 affectables, D-sub 25 broches) : vers TALLY/GPIO 1 du pupitre AW-RP150 ou les voyants des caméras. Le mapping sortie ↔ entrée est dans cfg.tally.' },
  { id: 'gpi', label: 'GPI', kind: 'dsub25', sig: 'gpio', dir: 'io', group: 'Tally et GPI', desc: 'Entrées / sorties GPI (24, D-sub 25 broches) : déclencher une transition, une macro, ou signaler un état.' },
  { id: 'lan', label: 'ETHERNET', kind: 'rj45', sig: 'ip', dir: 'io', group: 'Réseau', nic: true, desc: 'Réseau IP (RJ45, 1000BASE-T) : DashBoard (configuration, port 5253), RossTalk (TCP 7788), tally TSL, mise à jour.' },
  { id: 'rs422', label: 'SERIAL', kind: 'rj45', sig: 'rs422', dir: 'io', group: 'Réseau', desc: 'Port série RS-422 (8 broches) : pilotage d\'un appareil externe (enregistreur, serveur) ou d\'un éditeur.' },
  { id: 'iec', label: 'AC IN', kind: 'iec', sig: 'secteur', dir: 'in', group: 'Alimentation', watts: 88, desc: 'Secteur 100 à 240 V (cordon IEC C13), ≈ 88 W.' },
];
/** le dessin de la visionneuse pour chaque connecteur (même table que CONNECTEURS, sans import circulaire) */
const DESSIN = { bnc: 'bnc', hdmi: 'usb', rj45: 'rj45', dsub25: 'dsub25', iec: 'iec' };
const pi = (/** @type {string} */ id, x, y, extra = {}) => { const p = /** @type {Port} */ (SOLO_PORTS.find((q) => q.id === id)); return /** @type {FaceItem} */ ({ t: 'port', id, k: DESSIN[p.kind] || 'multi', x, y, l: p.label, ...extra }); };

/** la configuration d'usine : 13 entrées nommées, programme sur l'entrée 1, prévisualisation sur la 2, tally n ↔ entrée n */
function cfgSolo() {
  /** @type {Record<number, { nom: string }>} */ const entrees = {};
  for (let n = 1; n <= 13; n++) entrees[n] = { nom: n === 13 ? 'HDMI' : 'IN ' + n };
  /** @type {Record<number, number>} */ const tally = {};
  for (let n = 1; n <= 13; n++) tally[n] = n;
  return { format: FORMATS[0], entrees, pgm: 1, pvw: 2, multiview: '10', tally, reseau: { dhcp: false, ip: '192.168.0.123', mask: '255.255.255.0', gw: '192.168.0.1' } };
}

/** @type {Modele} */
const SOLO13 = {
  id: 'carbonite-solo13', marque: 'Ross Video', nom: 'Carbonite Black Solo 13', court: 'Solo 13', famille: 'melangeur', pose: 'table',
  role: 'Mélangeur 1 M/E « tout en un » : pupitre de table avec châssis intégré, 12 entrées SDI + 1 HDMI, 5 sorties SDI + 1 HDMI, multiviewer, tally et GPI à contacts, configuré par DashBoard en IP.',
  ports: SOLO_PORTS,
  reseau: { dhcp: false, ip: '192.168.0.123', mask: '255.255.255.0', gw: '192.168.0.1' },
  services: [
    { id: 'rosstalk', role: 'serveur', port: 7788, desc: 'RossTalk (TCP 7788) : commandes texte (prise d\'antenne, macros) depuis DashBoard, un automate ou le PC de régie.' },
    { id: 'dashboard', role: 'serveur', port: 5253, desc: 'DashBoard : configuration et pilotage complets du mélangeur depuis le PC de régie.' },
  ],
  watts: 88, prix: 9500, formats: FORMATS,
  cfg: cfgSolo(),
  faces: {
    avant: { label: 'Pupitre (dessus)', w: 900, h: 330, items: [
      { t: 'body', x: 10, y: 10, w: 880, h: 310, r: 10 }, { t: 'text', x: 24, y: 36, s: 'CARBONITE BLACK SOLO 13 · 1 M/E · 13 ENTRÉES · MULTIVIEWER · CHÂSSIS INTÉGRÉ', size: 13 },
      { t: 'lcd', id: 'menu', x: 30, y: 50, w: 250, h: 70 },
      { t: 'text', x: 300, y: 70, s: 'PGM', size: 11 }, { t: 'keys', id: 'pgm', x: 330, y: 50, w: 34, h: 30, gap: 4, rows: 1, cols: 13, labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 'HDMI'] },
      { t: 'text', x: 300, y: 112, s: 'PST', size: 11 }, { t: 'keys', id: 'pst', x: 330, y: 92, w: 34, h: 30, gap: 4, rows: 1, cols: 13, labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 'HDMI'] },
      { t: 'text', x: 300, y: 154, s: 'KEY', size: 11 }, { t: 'keys', id: 'key', x: 330, y: 134, w: 34, h: 30, gap: 4, rows: 1, cols: 13, labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 'HDMI'] },
      { t: 'keys', id: 'keyers', x: 30, y: 140, w: 56, h: 30, gap: 6, rows: 1, cols: 4, labels: ['KEY 1', 'KEY 2', 'KEY 3', 'KEY 4'] },
      { t: 'keys', id: 'trans', x: 30, y: 190, w: 56, h: 30, gap: 6, rows: 2, cols: 4, labels: ['BKGD', 'DISS', 'WIPE', 'DVE', 'MEDIA', 'MACRO', 'MV', 'MENU'] },
      { t: 'btn', id: 'cut', x: 330, y: 200, w: 80, h: 44, l: 'CUT' }, { t: 'btn', id: 'auto', x: 420, y: 200, w: 80, h: 44, l: 'AUTO TRANS' },
      { t: 'lever', id: 'levier', x: 790, y: 60, w: 36, h: 230, fader: true, l: 'FADER' },
      { t: 'knob', id: 'knob1', x: 560, y: 230, r: 20, l: '' }, { t: 'knob', id: 'knob2', x: 620, y: 230, r: 20, l: '' }, { t: 'knob', id: 'knob3', x: 680, y: 230, r: 20, l: '' },
      { t: 'led', id: 'power', x: 860, y: 40, c: 'green', l: 'ON' },
    ] },
    arriere: { label: 'Face arrière (connecteurs)', w: 900, h: 230, items: [
      { t: 'body', x: 10, y: 10, w: 880, h: 210, r: 8 }, { t: 'text', x: 24, y: 36, s: 'CARBONITE BLACK SOLO 13 · IN 1-12 · HDMI IN · OUT 1-5 · HDMI OUT · AES · REF IN · TALLY · GPI · ETHERNET · SERIAL · AC IN', size: 12 },
      { t: 'group', x: 24, y: 50, w: 600, h: 75, l: 'Entrées' },
      ...(() => { /** @type {FaceItem[]} */ const it = []; row(it, IN.map((n) => 'sdi-in-' + n), 55, 92, 44, 'bnc', IN.map((n) => 'IN ' + n), { small: true }); return it; })(),
      pi('hdmi-in', 585, 92, { small: true }),
      { t: 'group', x: 640, y: 50, w: 235, h: 75, l: 'Réseau · série · secteur' }, pi('lan', 680, 92), pi('rs422', 740, 92), pi('iec', 820, 92),
      { t: 'group', x: 24, y: 135, w: 420, h: 75, l: 'Sorties' },
      ...(() => { /** @type {FaceItem[]} */ const it = []; row(it, OUT.map((n) => 'sdi-out-' + n), 55, 177, 50, 'bnc', OUT.map((n) => 'OUT ' + n), { small: true }); return it; })(),
      pi('hdmi-out', 320, 177, { small: true }), pi('aes-out', 380, 177, { small: true }), pi('ref-in', 425, 177, { small: true }),
      { t: 'group', x: 460, y: 135, w: 415, h: 75, l: 'Tally et GPI' }, pi('tally', 560, 177), pi('gpi', 760, 177),
    ] },
  },
  specs: [
    '1 M/E, 4 incrustateurs (chroma, luma, DVE), MediaStore (images, animations), multiviewer, macros, XPression CG light fourni.',
    '13 entrées (12 SDI 3G/HD/SD avec synchroniseur de trame, 1 HDMI mise à l\'échelle) et 6 sorties affectables (5 SDI, 1 HDMI) ; une sortie AES, une entrée de référence REF IN.',
    'Formats : 1080p 50/59,94 (3G), 1080i 50/59,94, 720p 50/59,94 ; toutes les entrées d\'une même production sont dans le format du mélangeur (même cadence).',
    'Tally : 24 tallies à contacts (TALLY, D-sub 25), 24 GPI/O (GPI, D-sub 25) ; tally série TSL par le réseau.',
    'Contrôle : Ethernet (DashBoard sur le PC de régie, RossTalk TCP 7788), port série RS-422 (SERIAL). Adresse d\'usine 192.168.0.123 / 255.255.255.0 ; le pupitre CB9 séparé est en 192.168.0.129.',
    'Châssis sans ventilateur ; secteur 100 à 240 V, ≈ 88 W (chiffre du châssis Solo 1 U).',
  ],
  doc: 'Ross Video, Carbonite Black Solo Setup Manual v2.0 et Operation Manual v2.0 ; page « Carbonite Black Solo Specifications » (rossvideo.com).',
  averifier: [
    'Connecteurs : TALLY et GPI en D-sub 25 broches (les tables de brochage du manuel vont jusqu\'à la broche 25 ; le type n\'est pas écrit en clair) ; le port série RS-422 est décrit par un brochage 8 broches (RJ45 supposé) ; la sortie AES est supposée en BNC 75 Ω.',
    'Consommation : 88 W est le chiffre publié pour le châssis Solo 1 U (100 à 240 V) ; le « tout en un » Solo 13 n\'a pas de chiffre trouvé. Une alimentation redondante est possible (option non modélisée).',
    'Dimensions du Solo 13 tout en un : non trouvées (le châssis seul fait 48,2 × 25,4 × 4,1 cm ; poids 3,6 kg pour le CB-SOLO-13 d\'après le manuel) ; la boîte 3D est une estimation.',
    'Passerelle d\'usine 192.168.0.1 : supposée (le manuel ne donne que l\'adresse 192.168.0.123 et le masque). Multiviewer d\'usine (10 fenêtres), affectation d\'usine des sorties, format d\'usine 1080i50 : supposés.',
    'Ports TCP 7788 (RossTalk) et 5253 (DashBoard) : valeurs connues de la gamme Carbonite, pas lues dans le manuel du Solo.',
    'Prix : ordre de grandeur (le Solo 9 entrées vaut 6 930 $ US ; le Solo 13 ≈ 15 000 $ AU TTC).',
  ],
  boite: { w: 0.483, h: 0.1, d: 0.33, couleur: '#1f2327' },
};

/** @type {Record<string, Modele>} */
export const ROSS = { 'carbonite-solo13': SOLO13 };

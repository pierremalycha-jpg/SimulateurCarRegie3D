// @ts-check
// ----------------------------------------------------------------------------------
// Les liens du Cours avec le reste du simulateur : la fiche de chaque terme du glossaire, la
// fiche ouverte par le bouton « Cours » de chaque poste, et le poste où l'on retrouve chaque
// famille du lexique (bouton « Emmène-moi » des fiches du lexique). Une liste donne des fiches
// par ordre de préférence : la première qui est écrite l'emporte, si bien qu'un lien vers une
// fiche en préparation s'allume tout seul le jour où elle est écrite.
// ----------------------------------------------------------------------------------
import { FICHES } from './index.js';
import { TERMS } from '../netterms.js';

/** la fiche existe et elle est écrite (fiche du cours ou du lexique) */
export const ecrite = (id) => (FICHES[id] ? !FICHES[id].prevu : !!TERMS[id]);
/** la première fiche écrite de la liste (avec `prevu`, à défaut la première qui existe) */
export function premiere(ids, prevu = false) {
  const l = typeof ids === 'string' ? [ids] : ids || [];
  return l.find(ecrite) || (prevu ? l.find((k) => FICHES[k] || TERMS[k]) : '') || '';
}

/** terme du glossaire (tel qu'écrit dans content/glossary.js) → fiche(s) du Cours */
/** @type {Record<string, string | string[]>} */
export const GLOSSAIRE = {
  '(S,G)': 'mroute', 'AES3 / AES67 / Dante': 'st2110-30', 'Bilan de liaison / marge': 'hf', 'Black burst / tri-level': ['genlock', 'timing-ref'],
  BMCA: 'bmca', BNC: 'sdi', 'BT.709 / BT.2020': 'cie1931', 'Caméra HF': 'hf', 'CMAX / CINST': 'cmax', 'Codes 64-940': ['quantification', 'mv-pct'],
  COFDM: 'hf', 'Contrôleur SDN': 'sdn', 'Diversité': 'hf', DSCP: 'qos', 'Écart 2022-7': 'ecart', ECMP: 'ecmp', 'Effet falaise': ['effet-falaise', 'sdi'],
  'Embedder / désembedder': 'audio-embed', FEC: 'fec', 'Fibre hybride SMPTE': 'fibre-smpte', 'Fibre monomode': 'fibre-smpte',
  'Genlock / référence': ['genlock', 'timing-ref'], 'Grand maître PTP': 'grand-maitre', Grille: 'grille', 'HDR / HLG / SDR': 'hdr-hlg', Holdover: 'holdover',
  'Horloge frontière (BC)': 'bc', IGMPv3: 'igmp', 'JPEG XS': 'st2110-22', Latence: 'latence', 'Leaf / ToR': 'leaf', 'MAC multicast': 'mac-mcast',
  'Mire / barres': 'mire-75', MTU: 'mtu', 'N-1 (mix-minus)': 'audio-embed', 'Niveau optique': 'fibre-smpte', 'NMOS IS-04 / IS-05': ['is-04', 'is-05'],
  'Numéro de séquence RTP': 'rtp', 'Offset PTP': 'offset', OSPF: 'ospf', 'Parade RVB': 'parade-rvb', 'Passerelle IP ↔ SDI': 'passerelle-ip',
  'PIM-SSM': ['ssm', 'pim'], 'Point de croisement': 'point-croisement', PTP: 'ptp', 'Quad-link / 2SI': '12g-sdi', 'Querier IGMP': 'querier',
  'Réseaux rouge et bleu': 'reseaux-ab', 'RFC 4175': 'st2110-20', RPF: 'rpf', 'running / startup-config': 'config', SDI: 'sdi', SDP: 'sdp',
  SPG: ['genlock', 'timing-ref'], 'SMPTE ST 2110': 'st2110', 'Snooping IGMP': 'snooping', 'SPAN / port miroir': 'span', 'Spine-leaf': 'spine-leaf',
  'ST 2022-7': 'st2022-7', 'ST 2110-21': 'st2110-21', 'Super-blancs': ['quantification', 'mv-pct'], SVI: 'svi', 'Synchroniseur d\'images (frame sync)': ['genlock', 'timing-ref'],
  Tally: 'tsl-umd', 'Timecode (LTC)': 'timecode', Triax: 'fibre-smpte', 'TSL UMD': 'tsl-umd', 'UHD / HD': ['formats', '12g-sdi'], UMD: 'tsl-umd',
  Vecteurscope: 'vecteurscope', VLAN: 'vlan', VRX_FULL: 'vrx', 'Waveform (oscilloscope)': 'waveform',
};

/** poste → fiche(s) ouvertes par son bouton « Cours » ; selon le car, SDI ou IP */
/** @type {Record<string, string[] | { sdi: string[], ip: string[] }>} */
export const POSTES = {
  brassage: ['sdi'],
  grille: { sdi: ['grille'], ip: ['is-05', 'nmos'] },
  mesure: ['waveform', 'prism'],
  vision: ['waveform'],
  reseau: { sdi: ['ctrl-sdi'], ip: ['st2110'] },
  synchro: { sdi: ['genlock', 'timing-ref'], ip: ['ptp'] },
  ccu: ['fibre-smpte'],
  hf: ['hf'],
  son: ['audio-embed'],
  transmission: ['formats', '12g-sdi'],
};
/** la fiche du bouton « Cours » d'un poste ('' : pas de fiche, le Cours s'ouvre où on l'a laissé) */
export function posteFiche(id, ip = false) {
  const p = POSTES[id]; if (!p) return '';
  return premiere(Array.isArray(p) ? p : ip ? p.ip : p.sdi);
}

const IP = { label: 'Emmène-moi au poste Réseau IP', station: 'reseau', ip: true };
/** famille du lexique → poste où on la voit (bouton « Emmène-moi » des fiches du lexique) */
/** @type {Record<string, { label: string, station: string, ip?: boolean }>} */
export const FAMILLE_POSTE = {
  'ST 2110': IP, 'Transport et multicast': IP, 'Réseau': IP, PTP: IP, NMOS: IP, Mesures: IP, Exploitation: IP,
  'Mesure vidéo': { label: 'Emmène-moi à la baie de mesure', station: 'mesure' },
  'Couche physique SDI': { label: 'Emmène-moi à la baie de mesure', station: 'mesure' },
  'Grille SDI': { label: 'Emmène-moi à la grille', station: 'grille' },
  'Bases du réseau': { label: 'Emmène-moi au réseau de contrôle', station: 'reseau' },
};

// ---------------- glossaire → fiche ----------------
const nz = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
/** @type {Map<string, string> | null} titres des fiches, sans accents ni casse */
let TITRES = null;
/** la fiche écrite d'un terme du glossaire : la liste GLOSSAIRE, sinon une fiche du même titre ('' : aucune) */
export function ficheDuTerme(t) {
  if (GLOSSAIRE[t]) return premiere(GLOSSAIRE[t]);
  if (!TITRES) {
    TITRES = new Map();
    for (const [k, F] of Object.entries(FICHES)) if (!F.term) TITRES.set(nz(F.t), k);
    for (const [k, T] of Object.entries(TERMS)) if (!TITRES.has(nz(T.t))) TITRES.set(nz(T.t), k);
  }
  return premiere(TITRES.get(nz(t)) || []);
}

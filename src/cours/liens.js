// @ts-check
import { lessonById, allLessons } from './index.js';
import { TERMS } from '../content/netterms.js';
// les fiches « ? » des autres postes complètent le registre (mesure vidéo, réseau de contrôle, grille)
import '../content/terms_mesure.js';
import '../content/terms_ctrlnet.js';
import '../content/terms_videohub.js';

// ----------------------------------------------------------------------------------
// Les liens du Cours avec le reste du simulateur : la leçon (ou la fiche « ? ») de chaque terme du
// glossaire, la leçon ouverte par le bouton « Cours » et la touche G de chaque poste. Une liste
// donne des cibles par ordre de préférence : la première leçon écrite l'emporte, sinon la première
// fiche « ? » qui existe ; un lien vers une leçon pas encore écrite s'allume tout seul le jour où
// elle l'est.
// ----------------------------------------------------------------------------------
/** la cible existe : une leçon du Cours ou une fiche « ? » */
export const existe = (id) => !!(lessonById(id) || TERMS[id]);
/** la première leçon écrite de la liste, sinon la première fiche « ? » ('' : aucune) */
export function premiere(ids) {
  const l = typeof ids === 'string' ? [ids] : ids || [];
  return l.find((k) => !!lessonById(k)) || l.find((k) => !!TERMS[k]) || '';
}
/** titre d'une leçon ou d'une fiche */
export const titreDe = (id) => { const f = lessonById(id); return f ? f.lesson.title : TERMS[id] ? TERMS[id].t : id; };
/** c'est une leçon (sinon une fiche « ? ») */
export const estLecon = (id) => !!lessonById(id);

/** terme du glossaire (tel qu'écrit dans content/glossary.js) → leçon(s) puis fiche(s) « ? » */
/** @type {Record<string, string | string[]>} */
export const GLOSSAIRE = {
  '(S,G)': ['reseau-multicast', 'mroute'], 'AES3 / AES67 / Dante': 'st2110-30', 'Bilan de liaison / marge': ['hf-bilan'], 'Black burst / tri-level': ['synchro-genlock', 'timing-ref'],
  BMCA: ['reseau-ptp', 'bmca'], BNC: ['sdi-cable', 'sdi-cest-quoi'], 'BT.709 / BT.2020': ['signal-couleur', 'cie1931'], 'Caméra HF': ['hf-bilan', 'hf-frequences'], 'CMAX / CINST': 'cmax', 'Codes 64-940': ['signal-niveaux', 'mv-pct'],
  COFDM: ['hf-cofdm'], 'Contrôleur SDN': 'sdn', 'Diversité': ['hf-antennes'], DSCP: 'qos', 'Écart 2022-7': 'ecart', ECMP: 'ecmp', 'Effet falaise': ['sdi-falaise', 'sdi-oeil', 'effet-falaise'],
  'Embedder / désembedder': ['sdi-embedded'], FEC: 'fec', 'Fibre hybride SMPTE': ['camera-systeme', 'sdi-cable'], 'Fibre monomode': ['sdi-cable'],
  'Genlock / référence': ['synchro-genlock', 'timing-ref'], 'Grand maître PTP': ['reseau-ptp', 'grand-maitre'], Grille: ['sdi-grille', 'grille'], 'HDR / HLG / SDR': ['signal-couleur', 'hdr-hlg'], Holdover: 'holdover',
  'Horloge frontière (BC)': ['reseau-ptp', 'bc'], IGMPv3: ['reseau-multicast', 'igmp'], 'JPEG XS': 'st2110-22', Latence: 'latence', 'Leaf / ToR': 'leaf', 'MAC multicast': ['reseau-multicast', 'mac-mcast'],
  'Mire / barres': ['signal-niveaux', 'mire-75'], MTU: 'mtu', 'N-1 (mix-minus)': ['son-n1', 'sdi-embedded'], 'Niveau optique': ['sdi-cable'], 'NMOS IS-04 / IS-05': ['is-04', 'is-05'],
  'Numéro de séquence RTP': 'rtp', 'Offset PTP': ['reseau-ptp', 'offset'], OSPF: 'ospf', 'Parade RVB': ['signal-422', 'parade-rvb'], 'Passerelle IP ↔ SDI': 'passerelle-ip',
  'PIM-SSM': ['reseau-multicast', 'ssm', 'pim'], 'Point de croisement': 'point-croisement', PTP: ['reseau-ptp', 'ptp'], 'Quad-link / 2SI': ['signal-formats', '12g-sdi'], 'Querier IGMP': ['reseau-multicast', 'querier'],
  'Réseaux rouge et bleu': 'reseaux-ab', 'RFC 4175': 'st2110-20', RPF: 'rpf', 'running / startup-config': 'config', SDI: ['sdi-cest-quoi'], SDP: 'sdp',
  SPG: ['synchro-genlock', 'timing-ref'], 'SMPTE ST 2110': ['reseau-multicast', 'st2110'], 'Snooping IGMP': ['reseau-multicast', 'snooping'], 'SPAN / port miroir': 'span', 'Spine-leaf': 'spine-leaf',
  'ST 2022-7': 'st2022-7', 'ST 2110-21': 'st2110-21', 'Super-blancs': ['signal-niveaux', 'mv-pct'], SVI: ['reseau-vlan', 'svi'], 'Synchroniseur d\'images (frame sync)': ['synchro-genlock', 'timing-ref'],
  'Timecode (LTC)': ['synchro-timecode'], Tally: ['real-melangeur', 'tsl-umd'], Triax: ['sdi-cable'], 'TSL UMD': 'tsl-umd', 'UHD / HD': ['signal-formats', '12g-sdi'], UMD: 'tsl-umd',
  Vecteurscope: ['signal-couleur', 'vecteurscope'], VLAN: ['reseau-vlan', 'vlan'], VRX_FULL: 'vrx', 'Waveform (oscilloscope)': ['signal-niveaux', 'waveform'],
  '4:2:2': ['signal-422'], 'Sous-réseau / masque': ['reseau-ip', 'sous-reseau'], 'Adresse IP': ['reseau-ip', 'sous-reseau'], Multicast: ['reseau-multicast', 'groupe'],
};

/** poste → leçon(s) ou fiche(s) ouvertes par son bouton « Cours » et la touche G ; selon le car, SDI ou IP */
/** @type {Record<string, string[] | { sdi: string[], ip: string[] }>} */
export const POSTES = {
  brassage: ['sdi-cable', 'sdi-cest-quoi'],
  grille: { sdi: ['sdi-grille', 'sdi-cable', 'grille'], ip: ['reseau-multicast', 'is-05', 'nmos'] },
  mesure: ['sdi-oeil', 'sdi-falaise', 'waveform', 'prism'],
  vision: ['signal-422', 'signal-niveaux', 'waveform'],
  reseau: { sdi: ['reseau-ip', 'reseau-vlan', 'ctrl-sdi'], ip: ['reseau-multicast', 'reseau-ptp', 'st2110'] },
  synchro: { sdi: ['synchro-genlock', 'timing-ref'], ip: ['reseau-ptp', 'ptp'] },
  ccu: ['camera-systeme', 'sdi-cable', 'sdi-cest-quoi'],
  hf: ['hf-bilan', 'hf-frequences', 'hf-antennes'],
  son: ['son-tranche', 'son-n1', 'sdi-embedded'],
  transmission: ['expl-transmission', 'signal-formats', 'sdi-cest-quoi', '12g-sdi'],
  melangeur: ['real-melangeur', 'signal-422', 'signal-formats'],
  habillage: ['real-incrustations'],
  realisateur: ['real-ordres'],
  scripte: ['real-ordres'],
  producteur: ['real-ordres'],
  evs: ['ralentis-evs', 'signal-formats', 'signal-bits'],
  ipdirector: ['ralentis-clips'],
  intercom: ['expl-intercom'],
  chefdecar: ['expl-lineup', 'expl-depannage'],
  pieddecar: ['camera-systeme', 'expl-transmission'],
  cadreur: ['camera-systeme'],
};
/** la cible du bouton « Cours » d'un poste ('' : aucune, le Cours s'ouvre où on l'a laissé) */
export function posteCible(id, ip = false) {
  const p = POSTES[id]; if (!p) return '';
  return premiere(Array.isArray(p) ? p : ip ? p.ip : p.sdi);
}

// ---------------- glossaire → leçon ou fiche ----------------
const nz = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
/** @type {Map<string, string> | null} titres des leçons et fiches, sans accents ni casse */
let TITRES = null;
/** la leçon ou la fiche d'un terme du glossaire : la liste GLOSSAIRE, sinon un titre identique ('' : aucune) */
export function cibleDuTerme(t) {
  if (GLOSSAIRE[t]) return premiere(GLOSSAIRE[t]);
  if (!TITRES) {
    TITRES = new Map();
    for (const { lesson } of allLessons()) TITRES.set(nz(lesson.title), lesson.id);
    for (const [k, T] of Object.entries(TERMS)) if (!TITRES.has(nz(T.t))) TITRES.set(nz(T.t), k);
  }
  return premiere(TITRES.get(nz(t)) || []);
}

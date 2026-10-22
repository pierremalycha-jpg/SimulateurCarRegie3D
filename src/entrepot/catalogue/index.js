// @ts-check
// ----------------------------------------------------------------------------------
// Le catalogue de l'entrepôt : tous les modèles, rangés par groupe de rédaction. Chaque groupe
// exporte un objet { id: Modele } dans son fichier (blackmagic.js, panasonic.js, ross.js,
// reseau.js, divers.js) ; ce registre les réunit. Les familles, les signaux et les sortes de
// connecteurs (avec leur couleur et leur nom) sont définis ici, une seule fois.
// ----------------------------------------------------------------------------------
import { BLACKMAGIC } from './blackmagic.js';
import { PANASONIC } from './panasonic.js';
import { ROSS } from './ross.js';
import { RESEAU } from './reseau.js';
import { DIVERS } from './divers.js';

/** @typedef {import('../types.js').Modele} Modele */
/** @typedef {import('../types.js').Signal} Signal */
/** @typedef {import('../types.js').PortKind} PortKind */

/** les signaux : nom, couleur des liaisons (synoptique, 3D), câble qui les porte */
/** @type {Record<Signal, { nom: string, couleur: string, cable: string }>} */
export const SIGNAUX = {
  sdi: { nom: 'Vidéo SDI', couleur: '#46c6f2', cable: 'coaxial BNC 75 Ω' },
  hdmi: { nom: 'Vidéo HDMI', couleur: '#8fd3ff', cable: 'câble HDMI' },
  ip: { nom: 'Réseau IP', couleur: '#2fd25a', cable: 'RJ45 catégorie 5e ou 6' },
  audio: { nom: 'Audio analogique', couleur: '#ffd23f', cable: 'XLR 3 broches (symétrique)' },
  aes: { nom: 'Audio numérique AES/EBU', couleur: '#e6c21a', cable: 'XLR 3 broches 110 Ω' },
  ref: { nom: 'Référence (genlock)', couleur: '#c77dff', cable: 'coaxial BNC 75 Ω' },
  tc: { nom: 'Timecode', couleur: '#b388ff', cable: 'coaxial BNC 75 Ω' },
  rs422: { nom: 'Série RS-422', couleur: '#ff9f43', cable: 'RJ45 (série) ou RJ12' },
  rs232: { nom: 'Série RS-232C', couleur: '#ffb86b', cable: 'mini-DIN 8 broches' },
  gpio: { nom: 'GPI / GPO', couleur: '#ff7f50', cable: 'D-sub 25 broches' },
  tally: { nom: 'Tally (contacts)', couleur: '#ff3b30', cable: 'D-sub 25 broches' },
  secteur: { nom: 'Secteur 230 V', couleur: '#9aa1a8', cable: 'cordon secteur IEC C13' },
  dc12: { nom: 'Alimentation 12 V', couleur: '#c9ced3', cable: 'câble DC (jack ou XLR 4 broches)' },
  usb: { nom: 'USB', couleur: '#7f8c8d', cable: 'câble USB-C' },
  madi: { nom: 'Audio MADI', couleur: '#f1c40f', cable: 'coaxial BNC 75 Ω' },
  media: { nom: 'Support d\'enregistrement', couleur: '#95a5a6', cable: '' },
};
/** les connecteurs : nom lisible, et le dessin de la visionneuse (equipment/viewer.js) qui le représente */
/** @type {Record<PortKind, { nom: string, dessin: string }>} */
export const CONNECTEURS = {
  bnc: { nom: 'BNC 75 Ω', dessin: 'bnc' }, hdmi: { nom: 'HDMI', dessin: 'usb' }, rj45: { nom: 'RJ45', dessin: 'rj45' },
  xlr3: { nom: 'XLR 3 broches', dessin: 'xlr' }, xlr4: { nom: 'XLR 4 broches', dessin: 'xlr' }, xlr5: { nom: 'XLR 5 broches', dessin: 'xlr' },
  rca: { nom: 'RCA', dessin: 'jack' }, toslink: { nom: 'TOSLINK optique', dessin: 'jack' }, usbc: { nom: 'USB-C', dessin: 'usb' }, usba: { nom: 'USB-A', dessin: 'usb' },
  minidin8: { nom: 'mini-DIN 8 broches', dessin: 'multi' }, dsub25: { nom: 'D-sub 25 broches', dessin: 'dsub25' }, dsub9: { nom: 'D-sub 9 broches', dessin: 'dsub9' }, rj12: { nom: 'RJ12', dessin: 'rj45' },
  dc: { nom: 'Jack DC', dessin: 'jack' }, iec: { nom: 'Secteur IEC C14', dessin: 'iec' }, sfp: { nom: 'Cage SFP', dessin: 'sfp' },
  jack35: { nom: 'Mini-jack 3,5 mm', dessin: 'jack' }, jack63: { nom: 'Jack 6,35 mm', dessin: 'jack' }, sd: { nom: 'Lecteur de carte SD', dessin: 'multi' }, ssd: { nom: 'Logement SSD', dessin: 'multi' },
  mur: { nom: 'Prise murale 16 A', dessin: 'iec' },
};
/** les familles du stock, dans l'ordre des rayons de l'entrepôt */
export const FAMILLES = [
  ['camera', 'Caméras'], ['pupitre', 'Pupitres et télécommandes'], ['melangeur', 'Mélangeurs et régies logicielles'], ['enregistreur', 'Enregistreurs'],
  ['convertisseur', 'Convertisseurs et interfaces'], ['son', 'Son'], ['reseau', 'Réseau'], ['ordinateur', 'Ordinateurs'], ['moniteur', 'Moniteurs'], ['alimentation', 'Énergie'], ['accessoire', 'Accessoires et supports'],
];

/** quels connecteurs peuvent se relier entre eux (le même connecteur, et quelques adaptations courantes) */
const COMPAT = { rj45: ['rj45', 'rj12'], rj12: ['rj45', 'rj12'], xlr3: ['xlr3', 'rca', 'jack63'], rca: ['xlr3', 'rca', 'jack63'], jack63: ['xlr3', 'rca', 'jack63'], iec: ['iec', 'mur'], mur: ['iec', 'mur'], dc: ['dc', 'xlr4'], xlr4: ['dc', 'xlr4'] };
/** deux ports peuvent-ils être reliés par un câble ? (même signal, sens compatibles, connecteurs compatibles) */
export function compatibles(/** @type {import('../types.js').Port} */ a, /** @type {import('../types.js').Port} */ b) {
  if (a.sig !== b.sig) return { ok: false, why: `${SIGNAUX[a.sig].nom} d'un côté, ${SIGNAUX[b.sig].nom} de l'autre : ce ne sont pas les mêmes signaux.` };
  if (a.dir === 'in' && b.dir === 'in') return { ok: false, why: 'Deux entrées : rien ne sort de l\'une pour aller dans l\'autre.' };
  if (a.dir === 'out' && b.dir === 'out') return { ok: false, why: 'Deux sorties l\'une sur l\'autre : les deux signaux se court-circuitent.' };
  const ka = COMPAT[a.kind] || [a.kind], kb = COMPAT[b.kind] || [b.kind];
  if (!ka.includes(b.kind) && !kb.includes(a.kind)) return { ok: false, why: `${CONNECTEURS[a.kind].nom} et ${CONNECTEURS[b.kind].nom} : il n'existe pas de câble direct entre ces connecteurs.` };
  return { ok: true, why: '' };
}

/** @type {Record<string, Modele>} */
export const CATALOGUE = { ...BLACKMAGIC, ...PANASONIC, ...ROSS, ...RESEAU, ...DIVERS };
export const modeleById = (/** @type {string} */ id) => CATALOGUE[id] || null;
export const portOf = (/** @type {string} */ modele, /** @type {string} */ port) => { const m = CATALOGUE[modele]; return m ? m.ports.find((p) => p.id === port) || null : null; };
/** les modèles d'une famille, dans l'ordre du catalogue */
export const modelesDe = (/** @type {string} */ famille) => Object.values(CATALOGUE).filter((m) => m.famille === famille);
/** tous les modèles, rangés par famille (pour le stock) */
export const parFamille = () => FAMILLES.map(([id, nom]) => ({ id, nom, modeles: modelesDe(id) })).filter((f) => f.modeles.length);

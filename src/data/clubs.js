// @ts-check
// ----------------------------------------------------------------------------------
// Les adversaires du RC Lens à Bollaert : des clubs de Ligue 1 qui existent, avec leur nom et leurs couleurs
// (la tenue portée à Lens, choisie pour trancher sur le maillot or et les manches rouges des Lensois). Pas de
// blason ni de logo ; les joueurs sont fictifs (noms tirés d'une liste, toujours les mêmes pour un club) ; le
// niveau est un niveau de jeu du simulateur, un ordre de grandeur fictif qui ne prétend pas classer les clubs.
// Simulation non officielle, sans lien avec les clubs.
// ----------------------------------------------------------------------------------
import { mulberry32 } from '../util.js';

/**
 * @typedef {object} Club
 * @property {string} id
 * @property {string} name nom affiché (bandeau du score, habillage), en capitales
 * @property {string} short trois ou quatre lettres (score, statistiques)
 * @property {string} appel comment le commentateur et l'habillage le nomment (« Marseille »)
 * @property {string} ville
 * @property {number} shirt maillot @property {number} sleeves manches @property {number} shorts short @property {number} socks chaussettes
 * @property {number} gk maillot du gardien @property {number} num couleur des noms et numéros au dos
 * @property {string} color couleur de l'équipe dans l'interface (barres du score, statistiques)
 * @property {number} niveau niveau de jeu du simulateur (0 à 100, fictif)
 */

/** @type {Club[]} */
export const CLUBS = [
  { id: 'psg', name: 'PARIS SG', short: 'PSG', appel: 'Paris', ville: 'Paris', shirt: 0x0b1f4b, sleeves: 0x0b1f4b, shorts: 0x0b1f4b, socks: 0x0b1f4b, gk: 0x2f9e44, num: 0xf4f6f8, color: '#0b1f4b', niveau: 90 },
  { id: 'om', name: 'OLYMPIQUE DE MARSEILLE', short: 'OM', appel: 'Marseille', ville: 'Marseille', shirt: 0xf4f6f8, sleeves: 0x2faee0, shorts: 0xf4f6f8, socks: 0xf4f6f8, gk: 0x111111, num: 0x1b3c6e, color: '#2faee0', niveau: 82 },
  { id: 'monaco', name: 'AS MONACO', short: 'ASM', appel: 'Monaco', ville: 'Monaco', shirt: 0x1c1d20, sleeves: 0x1c1d20, shorts: 0x1c1d20, socks: 0x1c1d20, gk: 0x2fbf9a, num: 0xd4a017, color: '#e2001a', niveau: 80 },
  { id: 'lille', name: 'LOSC LILLE', short: 'LOSC', appel: 'Lille', ville: 'Lille', shirt: 0xf4f6f8, sleeves: 0xf4f6f8, shorts: 0x16244f, socks: 0xf4f6f8, gk: 0x7b2cbf, num: 0x16244f, color: '#16244f', niveau: 79 },
  { id: 'lyon', name: 'OLYMPIQUE LYONNAIS', short: 'OL', appel: 'Lyon', ville: 'Lyon', shirt: 0xf6f7f9, sleeves: 0xf6f7f9, shorts: 0xf6f7f9, socks: 0xf6f7f9, gk: 0xff8a1f, num: 0x1d4fa0, color: '#1d4fa0', niveau: 78 },
  { id: 'nice', name: 'OGC NICE', short: 'OGCN', appel: 'Nice', ville: 'Nice', shirt: 0xf4f6f8, sleeves: 0x111214, shorts: 0x111214, socks: 0xf4f6f8, gk: 0x22a6d6, num: 0x111214, color: '#111214', niveau: 74 },
  { id: 'strasbourg', name: 'RC STRASBOURG', short: 'RCSA', appel: 'Strasbourg', ville: 'Strasbourg', shirt: 0x0058a8, sleeves: 0x0058a8, shorts: 0xf4f6f8, socks: 0x0058a8, gk: 0xf2a900, num: 0xf4f6f8, color: '#0058a8', niveau: 74 },
  { id: 'rennes', name: 'STADE RENNAIS', short: 'SRFC', appel: 'Rennes', ville: 'Rennes', shirt: 0x17181b, sleeves: 0x17181b, shorts: 0x17181b, socks: 0x17181b, gk: 0x8bc34a, num: 0xe03a3e, color: '#17181b', niveau: 73 },
  { id: 'brest', name: 'STADE BRESTOIS', short: 'SB29', appel: 'Brest', ville: 'Brest', shirt: 0xf4f6f8, sleeves: 0xf4f6f8, shorts: 0xf4f6f8, socks: 0xf4f6f8, gk: 0x1f8a70, num: 0xd0021b, color: '#d0021b', niveau: 70 },
  { id: 'toulouse', name: 'TOULOUSE FC', short: 'TFC', appel: 'Toulouse', ville: 'Toulouse', shirt: 0x5b2c83, sleeves: 0x5b2c83, shorts: 0xf4f6f8, socks: 0x5b2c83, gk: 0xf2a900, num: 0xf4f6f8, color: '#5b2c83', niveau: 70 },
  { id: 'parisfc', name: 'PARIS FC', short: 'PFC', appel: 'le Paris FC', ville: 'Paris', shirt: 0x1b2a4a, sleeves: 0x1b2a4a, shorts: 0x1b2a4a, socks: 0x1b2a4a, gk: 0xe0e0e0, num: 0x8ec5ff, color: '#3d6ec9', niveau: 68 },
  { id: 'nantes', name: 'FC NANTES', short: 'FCN', appel: 'Nantes', ville: 'Nantes', shirt: 0x0b7a3e, sleeves: 0x0b7a3e, shorts: 0x0b7a3e, socks: 0x0b7a3e, gk: 0x111111, num: 0xf6d000, color: '#0b7a3e', niveau: 68 },
  { id: 'auxerre', name: 'AJ AUXERRE', short: 'AJA', appel: 'Auxerre', ville: 'Auxerre', shirt: 0xf4f6f8, sleeves: 0x1f5fae, shorts: 0x1f5fae, socks: 0xf4f6f8, gk: 0xff8a1f, num: 0x1f5fae, color: '#1f5fae', niveau: 66 },
  { id: 'lorient', name: 'FC LORIENT', short: 'FCL', appel: 'Lorient', ville: 'Lorient', shirt: 0x1a1a1c, sleeves: 0xf26522, shorts: 0x1a1a1c, socks: 0x1a1a1c, gk: 0x2fbf9a, num: 0xf26522, color: '#f26522', niveau: 65 },
  { id: 'angers', name: 'ANGERS SCO', short: 'SCO', appel: 'Angers', ville: 'Angers', shirt: 0x111214, sleeves: 0xf4f6f8, shorts: 0x111214, socks: 0x111214, gk: 0xc6e04a, num: 0xf4f6f8, color: '#111214', niveau: 64 },
  { id: 'lehavre', name: 'LE HAVRE AC', short: 'HAC', appel: 'Le Havre', ville: 'Le Havre', shirt: 0x7fb3e0, sleeves: 0x0b2341, shorts: 0x0b2341, socks: 0x7fb3e0, gk: 0xf2a900, num: 0x0b2341, color: '#0b2341', niveau: 64 },
  { id: 'metz', name: 'FC METZ', short: 'FCM', appel: 'Metz', ville: 'Metz', shirt: 0x7a1531, sleeves: 0x7a1531, shorts: 0x7a1531, socks: 0x7a1531, gk: 0x22a6d6, num: 0xf4f6f8, color: '#7a1531', niveau: 62 },
];
/** le niveau du RC Lens (même échelle, fictive) */
export const NIVEAU_LENS = 76;

export const clubById = (/** @type {string} */ id) => CLUBS.find((c) => c.id === id) || null;
/** un adversaire au hasard (r : tirage dans [0, 1[) */
export const clubAuHasard = (r = Math.random()) => CLUBS[Math.floor(r * CLUBS.length) % CLUBS.length];

// joueurs fictifs : un effectif par club, toujours le même (tiré de l'identifiant du club)
const INITIALES = 'ABCDEFGHIJKLMNOPRSTVWYZ';
const NOMS = ['Abdou', 'Bakayoko', 'Barbier', 'Benoît', 'Bernard', 'Bonnet', 'Boyer', 'Caron', 'Chevalier', 'Colin', 'Coulibaly', 'Da Silva', 'Delmas', 'Diop', 'Dumas', 'Durand', 'Fabre', 'Faure', 'Fofana', 'Fournier', 'Gauthier', 'Gomes', 'Guerin', 'Henry', 'Jacquet', 'Lacroix', 'Lambert', 'Leroy', 'Lopez', 'Lucas', 'Marchand', 'Masson', 'Meyer', 'Michel', 'Morel', 'Muller', 'N\'Diaye', 'Nicolas', 'Noël', 'Perrin', 'Picard', 'Renard', 'Robin', 'Roche', 'Rolland', 'Sanchez', 'Sarr', 'Simon', 'Touré', 'Vidal', 'Vincent', 'Weber', 'Yilmaz', 'Zidi'];
const graineDe = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
/** les onze noms (gardien en premier, dans l'ordre des postes de data/match.js) d'un club */
export function effectif(/** @type {string} */ id) {
  const r = mulberry32(graineDe(id)); const pris = new Set(); const out = [];
  while (out.length < 11) {
    const nom = NOMS[Math.floor(r() * NOMS.length)]; if (pris.has(nom)) continue;
    pris.add(nom); out.push(`${INITIALES[Math.floor(r() * INITIALES.length)]}. ${nom}`);
  }
  return out;
}

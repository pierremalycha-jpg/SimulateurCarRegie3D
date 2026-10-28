// @ts-check
// Équipes et joueurs du match simulé : le RC Lens à domicile (couleurs du Racing, sans écusson officiel) contre un
// club de Ligue 1 (data/clubs.js : nom et couleurs, sans blason) ; joueurs fictifs. Simulation non officielle.
import { CLUBS, clubById, effectif, NIVEAU_LENS } from './clubs.js';

export const TEAMS = [
  // équipe à domicile : le Racing, sang et or (maillot or, manches rouges) ; pas d'écusson officiel
  { id: 'lens', name: 'RC LENS', short: 'RCL', appel: 'Lens', ville: 'Lens', shirt: 0xf5c400, sleeves: 0xc8102e, shorts: 0xc8102e, socks: 0xf5c400, gk: 0x22c55e, num: 0xc8102e, color: '#c8102e', niveau: NIVEAU_LENS },
  // l'adversaire du soir : rempli par setAdversaire (le Derby du Nord tant que rien n'est choisi)
  /** @type {import('./clubs.js').Club} */ ({ ...CLUBS[0] }),
];
export const PLAYER_NAMES = [
  ['M. Laurent', 'L. Benali', 'T. Moreau', 'J. Diallo', 'A. Fontaine', 'K. Traoré', 'R. Lefèvre', 'S. Martin', 'Y. Kanté', 'N. Girard', 'E. Rousseau'],
  [],
];
export const POSITIONS = ['Gardien', 'Défenseur', 'Défenseur', 'Défenseur', 'Défenseur', 'Milieu', 'Milieu', 'Milieu', 'Milieu', 'Attaquant', 'Attaquant'];

/**
 * L'adversaire du soir : ses couleurs, son nom et ses joueurs remplacent ceux de TEAMS[1] et PLAYER_NAMES[1]
 * (mêmes objets : tout ce qui les lit suit). Renvoie le club, ou null si l'identifiant est inconnu.
 * Le rendu (maillots, tribune visiteurs) se met à jour par adversaire.js.
 */
export function setAdversaire(/** @type {string} */ id) {
  const c = clubById(id); if (!c) return null;
  for (const k of Object.keys(TEAMS[1])) delete TEAMS[1][k];
  Object.assign(TEAMS[1], c);
  PLAYER_NAMES[1].splice(0, 11, ...effectif(c.id));
  return c;
}
setAdversaire('lille');

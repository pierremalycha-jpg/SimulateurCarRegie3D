// @ts-check
// Équipes et joueurs du match simulé (noms fictifs ; couleurs du Racing, sans écusson officiel).

export const TEAMS = [
  // équipe à domicile : le Racing, sang et or (maillot or, manches rouges) ; pas d'écusson officiel
  { name: 'RC LENS', short: 'RCL', shirt: 0xf5c400, sleeves: 0xc8102e, shorts: 0xc8102e, socks: 0xf5c400, gk: 0x22c55e, color: '#c8102e' },
  { name: 'AS RIVIÈRE', short: 'RIV', shirt: 0xf2f4f6, sleeves: 0x1d3a8a, shorts: 0x1d3a8a, socks: 0xf2f4f6, gk: 0xff8a1f, color: '#1d3a8a' },
];
export const PLAYER_NAMES = [
  ['M. Laurent', 'L. Benali', 'T. Moreau', 'J. Diallo', 'A. Fontaine', 'K. Traoré', 'R. Lefèvre', 'S. Martin', 'Y. Kanté', 'N. Girard', 'E. Rousseau'],
  ['P. Garnier', 'H. Mendy', 'C. Dubois', 'O. Camara', 'B. Lemaire', 'I. Sissoko', 'F. Roux', 'D. Petit', 'A. Koné', 'V. Mercier', 'G. Blanc'],
];
export const POSITIONS = ['Gardien', 'Défenseur', 'Défenseur', 'Défenseur', 'Défenseur', 'Milieu', 'Milieu', 'Milieu', 'Milieu', 'Attaquant', 'Attaquant'];

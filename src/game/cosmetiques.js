// @ts-check
// ----------------------------------------------------------------------------------
// Ce qui habille un profil : l'avatar (une icône du métier sur un disque de couleur), la bannière
// (un fond qui rappelle le car : la mire de barres, les zébras, la forme d'onde…), le cadre de
// l'avatar et le titre affiché sous le pseudo. Tout est dessiné par le code (dégradés CSS, icônes
// intégrées) : aucune image de fichier. Les couleurs sont du contenu (comme les médias de l'émission),
// pas des couleurs d'interface : la feuille styles/profil.css n'en a aucune.
// Données pures : le pass (game/pass.js) dit à quel niveau chaque objet se gagne.
// ----------------------------------------------------------------------------------
/** @typedef {'avatar' | 'banniere' | 'cadre' | 'titre'} TypeCosmetique */
/** @typedef {{ id: string, nom: string, ico: string, fond: [string, string] }} Avatar */
/** @typedef {{ id: string, nom: string, fond: string, sombre?: boolean }} Banniere */
/** @typedef {{ id: string, nom: string, anneau: string }} Cadre */
/** @typedef {{ id: string, nom: string }} Titre */

/** @type {Avatar[]} */
export const AVATARS = [
  { id: 'casque', nom: 'Casque d\'ordres', ico: 'chef', fond: ['#2b5cff', '#1b2f7a'] },
  { id: 'camera', nom: 'Caméra système', ico: 'ccu', fond: ['#3a3f4b', '#14161b'] },
  { id: 'micro', nom: 'Micro de scène', ico: 'micro', fond: ['#ff7a45', '#a3301a'] },
  { id: 'clap', nom: 'Clap', ico: 'realisateur', fond: ['#f2f2f2', '#7d8592'] },
  { id: 'ralenti', nom: 'Ralenti', ico: 'evs', fond: ['#7b61ff', '#33227a'] },
  { id: 'melangeur', nom: 'Mélangeur', ico: 'melangeur', fond: ['#00b3a4', '#005a52'] },
  { id: 'hf', nom: 'Liaison HF', ico: 'hf', fond: ['#ff4d6d', '#7a1430'] },
  { id: 'car', nom: 'Le car', ico: 'car', fond: ['#ffb020', '#8a4b00'] },
  { id: 'ballon', nom: 'Ballon', ico: 'terrain', fond: ['#2fbf5b', '#0d5a26'] },
  { id: 'drone', nom: 'Drone', ico: 'aerien', fond: ['#5ac8fa', '#1b5b80'] },
  { id: 'reseau', nom: 'Réseau', ico: 'reseau', fond: ['#3d7bff', '#0a2a66'] },
  { id: 'brassage', nom: 'Jarretières', ico: 'brassage', fond: ['#c3cad6', '#4b5462'] },
  { id: 'mire', nom: 'Moniteur', ico: 'mire', fond: ['#d63cff', '#4a0f66'] },
  { id: 'diaph', nom: 'Diaphragme', ico: 'vision', fond: ['#1e1e24', '#5b5b6b'] },
  { id: 'onde', nom: 'Forme d\'onde', ico: 'mixage', fond: ['#16d47b', '#03381f'] },
  { id: 'casque-son', nom: 'Casque de mixage', ico: 'casque', fond: ['#ff9f0a', '#6b3a00'] },
  { id: 'synchro', nom: 'Métronome', ico: 'synchro', fond: ['#8e9aaf', '#2e3644'] },
  { id: 'intercom', nom: 'Intercom', ico: 'intercom', fond: ['#00c2ff', '#004a63'] },
  { id: 'satellite', nom: 'Transmission', ico: 'transmission', fond: ['#1d3557', '#457b9d'] },
  { id: 'planete', nom: 'Diffusion mondiale', ico: 'planete', fond: ['#6a4cff', '#120b40'] },
  { id: 'fusee', nom: 'Fusée', ico: 'fusee', fond: ['#ff375f', '#2d0a3d'] },
  { id: 'diamant', nom: 'Diamant', ico: 'diamant', fond: ['#7df9ff', '#2a5d9f'] },
  { id: 'filante', nom: 'Étoile filante', ico: 'filante', fond: ['#ffd60a', '#ff2d55'] },
  { id: 'couronne', nom: 'Couronne', ico: 'couronne', fond: ['#ffd60a', '#a06b00'] },
];

const BARRES = 'linear-gradient(90deg, #bfbfbf 0 14.3%, #bfbf00 0 28.6%, #00bfbf 0 42.9%, #00bf00 0 57.1%, #bf00bf 0 71.4%, #bf0000 0 85.7%, #0000bf 0)';
/** @type {Banniere[]} */
export const BANNIERES = [
  { id: 'nuit', nom: 'Nuit de régie', fond: 'linear-gradient(135deg, #10182b, #23324f 60%, #0b0f1a)', sombre: true },
  { id: 'pelouse', nom: 'Pelouse tondue', fond: 'repeating-linear-gradient(90deg, #1f7a3a 0 34px, #23893f 34px 68px)', sombre: true },
  { id: 'tally', nom: 'Tally rouge', fond: 'linear-gradient(120deg, #4a0710, #d0021b 55%, #ff5a5f)', sombre: true },
  { id: 'mire', nom: 'Mire de barres 75 %', fond: BARRES },
  { id: 'vumetre', nom: 'Vumètre', fond: 'linear-gradient(90deg, #0f5132 0, #22c55e 55%, #facc15 78%, #ef4444 92%)' },
  { id: 'forme-onde', nom: 'Moniteur de forme d\'onde', fond: 'repeating-linear-gradient(0deg, rgba(64,255,128,.28) 0 1px, transparent 1px 14px), linear-gradient(#020a05, #06170c)', sombre: true },
  { id: 'fibre', nom: 'Fibre monomode', fond: 'repeating-linear-gradient(170deg, #f5c400 0 3px, #2a2205 3px 18px)', sombre: true },
  { id: 'crepuscule', nom: 'Golden hour', fond: 'linear-gradient(180deg, #1b1f4b, #7a2e6b 45%, #ff8a3d 80%, #ffd27a)', sombre: true },
  { id: 'grille', nom: 'Grille de brassage', fond: 'repeating-linear-gradient(0deg, rgba(255,255,255,.12) 0 2px, transparent 2px 22px), repeating-linear-gradient(90deg, rgba(255,255,255,.12) 0 2px, transparent 2px 22px), linear-gradient(#262b36, #171a21)', sombre: true },
  { id: 'zebra', nom: 'Zébras à 100 %', fond: 'repeating-linear-gradient(45deg, #1a1a1a 0 12px, #e8e8e8 12px 24px)' },
  { id: 'sang-or', nom: 'Sang et or', fond: 'linear-gradient(115deg, #b0001e 0 48%, #f5c400 48% 52%, #b0001e 52% 70%, #f5c400 70%)' },
  { id: 'projecteurs', nom: 'Projecteurs du stade', fond: 'radial-gradient(circle at 15% 0%, rgba(255,255,255,.55), transparent 35%), radial-gradient(circle at 85% 0%, rgba(255,255,255,.55), transparent 35%), linear-gradient(#0a1a2f, #0d3b1f)', sombre: true },
  { id: 'aurore', nom: 'Aurore boréale', fond: 'linear-gradient(160deg, #031b2e, #0b6e4f 40%, #3fd7a5 60%, #6a3cbc 85%)', sombre: true },
  { id: 'bt2020', nom: 'Gamut BT.2020', fond: 'linear-gradient(90deg, #ff0040, #ff8a00, #ffe600, #00e05a, #00b7ff, #4b3cff, #c400ff)' },
  { id: 'black-burst', nom: 'Black burst', fond: 'repeating-linear-gradient(90deg, #050505 0 40px, #0d0d0d 40px 41px), linear-gradient(#000, #111)', sombre: true },
  { id: 'plateau-or', nom: 'Plateau d\'or', fond: 'linear-gradient(135deg, #7a5200, #f5c400 30%, #fff3b0 50%, #d9a400 70%, #6b4700)' },
  { id: 'legende', nom: 'Légende du car', fond: 'conic-gradient(from 200deg at 70% 120%, #2b0a3d, #7b2ff7, #ff2d55, #ffd60a, #2b0a3d)', sombre: true },
];

/** @type {Cadre[]} */
export const CADRES = [
  { id: 'aucun', nom: 'Sans cadre', anneau: 'transparent' },
  { id: 'bronze', nom: 'Bronze', anneau: 'linear-gradient(135deg, #f0b27a, #8a4b1f 50%, #e6a06a)' },
  { id: 'argent', nom: 'Argent', anneau: 'linear-gradient(135deg, #ffffff, #8d96a3 50%, #e6e9ee)' },
  { id: 'or', nom: 'Or', anneau: 'linear-gradient(135deg, #fff1a8, #c79a00 50%, #ffe066)' },
  { id: 'tally', nom: 'Tally', anneau: 'linear-gradient(135deg, #ff6b6b, #c00018)' },
  { id: 'mire', nom: 'Mire', anneau: 'conic-gradient(#bfbfbf, #bfbf00, #00bfbf, #00bf00, #bf00bf, #bf0000, #0000bf, #bfbfbf)' },
  { id: 'platine', nom: 'Platine', anneau: 'linear-gradient(135deg, #e8f4ff, #7fa7c9 45%, #ffffff 55%, #9cc3e6)' },
  { id: 'diamant', nom: 'Diamant', anneau: 'conic-gradient(#7df9ff, #b18cff, #ff8ad8, #ffd60a, #7df9ff)' },
];

/** @type {Titre[]} (« grade » : le titre du niveau atteint, par défaut) */
export const TITRES = [
  { id: 'grade', nom: 'Mon grade' },
  { id: 'pousse-cable', nom: 'Pousse-câble' },
  { id: 'oeil-de-lynx', nom: 'Œil de lynx' },
  { id: 'roi-brassage', nom: 'Roi du brassage' },
  { id: 'oreille-or', nom: 'Oreille d\'or' },
  { id: 'as-ralenti', nom: 'As du ralenti' },
  { id: 'voix-intercom', nom: 'Voix de l\'intercom' },
  { id: 'chasseur-pannes', nom: 'Chasseur de pannes' },
  { id: 'maitre-genlock', nom: 'Maître du genlock' },
  { id: 'sorcier-lineup', nom: 'Sorcier du line-up' },
  { id: 'main-sure', nom: 'Main sûre au mélangeur' },
  { id: 'gardien-ptp', nom: 'Gardien du PTP' },
  { id: 'architecte-reseau', nom: 'Architecte réseau' },
  { id: 'zero-noir', nom: 'Zéro image noire' },
  { id: 'pilier', nom: 'Pilier du car' },
  { id: 'legende', nom: 'Légende du car' },
];

export const COSMETIQUES = { avatar: AVATARS, banniere: BANNIERES, cadre: CADRES, titre: TITRES };
/** ce qu'on porte sans rien avoir gagné */
export const PAR_DEFAUT = { avatar: 'casque', banniere: 'nuit', cadre: 'aucun', titre: 'grade' };
export const NOM_TYPE = { avatar: 'Avatar', banniere: 'Bannière', cadre: 'Cadre', titre: 'Titre' };
/** @param {TypeCosmetique} type @param {string} id @returns {any} */
export function objet(type, id) {
  const l = /** @type {any[]} */ (COSMETIQUES[type] || []);
  return l.find((x) => x.id === id) || l.find((x) => x.id === PAR_DEFAUT[type]) || null;
}

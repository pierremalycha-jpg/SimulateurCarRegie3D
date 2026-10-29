// @ts-check
// Aide : commandes clavier et souris.

export const CONTROLS_HELP = [
  ['Clic dans la vue', 'Capturer la souris (vue à la première personne)'],
  ['Z Q S D / W A S D / flèches', 'Se déplacer'],
  ['Maj', 'Courir'],
  ['E', 'Interagir : ouvrir un poste, prendre une caméra, lire une info'],
  ['V', 'Vol libre (Espace = monter, C = descendre)'],
  ['P', 'Plan des caméras (vue de dessus)'],
  ['Tab ou T', 'Le téléphone : aller à un poste ou un endroit (car, terrain, passerelle…), les missions, Olivier, tous les outils ; Échap ou Tab le range'],
  ['G', 'Cours : les notions techniques (schémas, manipulations), les chapitres, le glossaire, les postes'],
  ['L', 'Journal des missions : l\'objectif en cours, les exercices du poste, toutes les missions, les badges'],
  ['J', 'Chef de car : explications du poste et parcours guidés pas à pas'],
  ['M', 'Moniteur retour PGM (coin de l\'écran)'],
  ['1 à 9 · 0', 'Commuter le mélangeur partout (mode DIRECT : à l\'antenne ; mode PRESET : au bus B, puis Entrée = CUT) · B : changer de mode'],
  ['K', 'Matériel du car : faces avant/arrière, connecteurs, raccordements'],
  ['I', 'Fiche du poste visé · sur une caméra : son matériel (connecteurs)'],
  ['Au poste', 'Bouton « Moniteur flottant » : un écran déplaçable au choix ; bouton « Matériel » : l\'appareil du poste'],
  ['Atelier de montage', 'E (ou clic) : prendre, monter, agir — maintenir pour les gestes longs · Q : reposer la pièce · molette : bulle et équilibrage'],
  ['Échap', 'Libérer la souris, puis ouvrir le menu (Cours, chef de car, réglages, formateur…) · dans un poste : le quitter'],
];

// premiers gestes, rappelés au premier lancement (encart « Prise en main » ou chef de car)
export const FIRST_STEPS = [['Z Q S D', 'se déplacer (flèches aussi)'], ['Souris', 'regarder : clique d\'abord dans la vue'], ['E', 'utiliser ce que tu vises'], ['Tab', 'le téléphone : aller à un poste, missions, outils'], ['1 – 9', 'commuter une caméra à l\'antenne'], ['L', 'les missions : objectif, exercices, badges'], ['Échap', 'le menu']];
/** les mêmes gestes, en un mot : la ligne de prise en main du HUD */
export const FIRST_STEPS_SHORT = [['Z Q S D', 'se déplacer'], ['Souris', 'regarder'], ['E', 'utiliser'], ['Tab', 'téléphone'], ['1 – 9', 'commuter'], ['L', 'missions'], ['Échap', 'menu']];
export const FIRST_STEPS_TOUCH_SHORT = [['Pouce gauche', 'se déplacer'], ['Glisser', 'regarder'], ['Action', 'utiliser'], ['Aller à', 'se téléporter']];
export const FIRST_STEPS_TOUCH = [['Pouce gauche', 'se déplacer'], ['Glisser', 'regarder'], ['Bouton action', 'utiliser ce que tu vises'], ['Aller à', 'se téléporter devant un poste']];

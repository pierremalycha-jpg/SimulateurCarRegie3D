// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Les fichiers de réglage ». Mode d'emploi HXC-FB80 : menu FILE, pages F01 OPERATOR FILE
// (les réglages du menu OPERATION et le menu USER personnalisé), F02 SCENE FILE (fichiers 1 à 5 :
// STORE puis le numéro enregistre, le numéro seul rappelle), F03 REFERENCE (STORE FILE, ALL
// PRESET), F04 LENS FILE, F05 FILE CLEAR (valeurs d'usine). Le RCP du simulateur garde lui aussi
// cinq fichiers de scène par caméra (STORE, RECALL). La manipulation (camlab/labs/ch4.js,
// « fichiers ») enregistre le plateau du soir en 1, le jour en 2, et rappelle le 1 en une touche.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const FICHIERS = {
  t: 'Les fichiers de réglage', aka: 'Menu FILE : operator file, scene file, reference file, lens file', chap: 4, lot: 3, point: 'menu',
  short: 'Scène, référence, objectif, opérateur : quatre sortes de fichiers du menu FILE, pour retrouver un réglage en une touche, demain ou à la prochaine scène.',
  fig: 'fichiers',
  lab: 'fichiers',
  cours: 'expl-lineup',
  body: "**Pourquoi des fichiers.** Une caméra de plateau a des dizaines de réglages. Les refaire à chaque changement de lumière, de cadreur ou d'objectif prendrait des heures. Le menu FILE les range dans des mémoires :\n- le **fichier de scène** garde la peinture d'une situation (le plateau du soir, l'extérieur jour, la nuit) : gamma, knee, détail, couleurs. Il y en a cinq ;\n- le **fichier de référence** est la base de la caméra : les valeurs que la maintenance a réglées et validées, celles dont on repart avant un line-up ;\n- le **fichier d'objectif** garde les corrections propres à un objectif, pour les retrouver quand on le remonte ;\n- le **fichier opérateur** garde les réglages du viseur du cadreur : zebra, marqueurs, son menu USER.\n\n**Enregistrer, rappeler.** Pour un fichier de scène : STORE, puis le numéro du fichier. Pour le rappeler : le numéro seul. Toute la peinture revient d'un coup.\n\n**Qui touche à quoi.** Le cadreur a son fichier opérateur. La vision a ses fichiers de scène. La référence et les fichiers d'objectif sont l'affaire de la maintenance : on ne les écrase pas avec un réglage du moment.\n\n**Remettre à zéro.** FILE CLEAR revient aux valeurs d'usine. Ça dépanne une caméra déréglée par un essai, mais ça efface aussi ce qui était juste : à n'utiliser qu'en sachant ce qu'on perd.",
  vraie: "Sur la FB80, le menu FILE a cinq pages : F01 OPERATOR FILE, F02 SCENE FILE, F03 REFERENCE, F04 LENS FILE et F05 FILE CLEAR. Le fichier opérateur garde les réglages du menu OPERATION et le menu USER personnalisé. La page SCENE FILE propose les fichiers 1 à 5 : STORE puis un numéro enregistre, un numéro seul rappelle. La page REFERENCE enregistre la référence (STORE FILE) ou la remet aux valeurs d'usine (ALL PRESET).\n\n**Le bon geste.** Un fichier de scène par situation, noté dans le cahier de la caméra (1 : plateau, 2 : jour, 3 : nuit…), et le même numéro pour la même situation sur toutes les caméras.\n\n**L'erreur fréquente.** Faire STORE sur le mauvais numéro et écraser la scène du soir avec celle du jour. Ou enregistrer un réglage d'essai dans la référence : le prochain line-up repart d'une base fausse.",
  plus: "- **Avec la CCU.** Reliée à la CCU, la peinture est pilotée par le RCP : la vision rappelle ses fichiers de scène depuis le pupitre, sans toucher à la caméra.\n- **Les objectifs.** Chaque objectif voile un peu les noirs ou assombrit un peu les coins à sa façon : le fichier d'objectif garde la correction qui lui va. Le Fujinon de l'établissement, relié par son câble 12 broches, se présente à la caméra.\n- **Avant un événement.** On prépare les fichiers de scène la veille, au line-up : le jour même, un changement de lumière se règle en une touche.\n- **Le line-up part de la référence.** On recharge la même base sur toutes les caméras, puis on raccorde : c'est plus rapide que de corriger des caméras parties de réglages différents.",
  car: "Dans le car, la vision prépare au line-up un fichier de scène par situation et par HDC : le soleil, l'ombre, la nuit, l'éclairage du stade. Au poste vision du simulateur, la page SCÈNES du RCP garde cinq fichiers par caméra, STORE pour enregistrer, RECALL pour rappeler : quand le soleil passe derrière la tribune, un geste et la caméra reprend tout son réglage.",
  quiz: [
    {
      q: 'La vision a réglé le plateau du soir et veut le retrouver demain. Où le range-t-elle ?',
      a: [
        ['Dans le fichier de référence.', 'La référence est la base de la caméra, réglée par la maintenance : on ne l\'écrase pas avec un réglage de scène.'],
        ['Dans un fichier de scène : STORE, puis un numéro.', 'Exact : un fichier par situation.'],
        ['Dans le fichier opérateur.', 'Il garde les réglages du viseur du cadreur, pas la peinture de l\'image.'],
      ],
      ok: 1,
    },
    {
      q: 'Comment rappelle-t-on le fichier de scène 2 ?',
      a: [
        ['En appuyant sur 2, sans STORE.', 'Exact : un numéro seul rappelle ; STORE puis un numéro enregistre.'],
        ['STORE, puis 2.', 'C\'est l\'inverse : STORE puis 2 écrase le fichier 2 avec le réglage en cours.'],
        ['Par FILE CLEAR.', 'FILE CLEAR remet les valeurs d\'usine.'],
      ],
      ok: 0,
    },
    {
      q: 'Un cadreur prend la caméra et retrouve d\'un coup ses zébras et ses marqueurs. Quel fichier a-t-il rappelé ?',
      a: [
        ['Le fichier d\'objectif.', 'Il garde les corrections propres à un objectif.'],
        ['Un fichier de scène.', 'La scène garde la peinture de l\'image, pas le viseur.'],
        ['Son fichier opérateur.', 'Exact : il garde les réglages du menu OPERATION et le menu USER du cadreur.'],
      ],
      ok: 2,
    },
  ],
  see: ['menu', 'lineup', 'rcp', 'gamma', 'knee', 'matrice'],
  ref: 'Mode d\'emploi HXC-FB80 : menu FILE, pages F01 OPERATOR FILE (menu OPERATION et menu USER), F02 SCENE FILE (fichiers 1 à 5 : STORE puis le numéro ; le numéro seul rappelle), F03 REFERENCE (STORE FILE, ALL PRESET), F04 LENS FILE, F05 FILE CLEAR',
  competences: ['2.9', '3.12'],
};

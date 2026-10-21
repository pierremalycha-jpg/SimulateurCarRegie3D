// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Le menu de la caméra ». Mode d'emploi HXC-FB80 : TOP MENU = USER, USER MENU CUSTOMIZE,
// ALL, OPERATION, PAINT, MAINTENANCE, FILE, DIAGNOSIS ; pages OPERATION 01 VF DISPLAY à
// 16 OPERATOR FILE, PAINT P01 SW STATUS à P14 USER MATRIX, MAINTENANCE M01 AUTO SETUP à M14 DATE,
// FILE F01 OPERATOR FILE à F05 FILE CLEAR, DIAGNOSIS D01 TRANSMISSION, D03 ROM VERSION.
// Commutateur DISPLAY/MENU, molette (tourner, appuyer), STATUS/CANCEL ; le « ? » clignote pendant
// l'édition. La manipulation (camlab/labs/corps.js, « menu ») reproduit les pages du viseur.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const MENU = {
  t: 'Le menu de la caméra', aka: 'Menu system ; TOP MENU, pages OPERATION, PAINT, MAINTENANCE, FILE', chap: 5, lot: 1, point: 'menu',
  short: 'Les pages OPERATION, PAINT, MAINTENANCE et FILE : où trouver chaque réglage, et lesquels la CCU ou le RCP verrouillent.',
  fig: 'menu',
  lab: 'menu',
  body: "**Où est le menu.** Dans le viseur. Le commutateur DISPLAY/MENU sur MENU affiche le TOP MENU par-dessus l'image : USER, USER MENU CUSTOMIZE, ALL, OPERATION, PAINT, MAINTENANCE, FILE, DIAGNOSIS. Le menu ne sort pas sur l'image envoyée à la régie : seul le cadreur le voit.\n\n**Quatre familles.**\n- **OPERATION**, le cadreur : l'affichage du viseur (VF DISPLAY), les marqueurs (zone de sécurité, centre), le zebra, la voie affichée (VF OUT), les touches ASSIGN, le fichier opérateur.\n- **PAINT**, l'image : niveaux, température de couleur, gamma, knee, détail, matrice. C'est le territoire de la vision, piloté depuis le RCP.\n- **MAINTENANCE**, l'installation : réglage automatique, système, réseau, date. On y va rarement, et jamais à l'antenne.\n- **FILE**, les sauvegardes : fichier opérateur, fichier de scène, référence, fichier d'objectif, remise à zéro.\n\nUSER est un menu personnel, fait des pages que l'on utilise vraiment (USER MENU CUSTOMIZE) ; ALL montre tout ; DIAGNOSIS dit l'état de la liaison avec la CCU et les versions.\n\n**Comment on navigue.** La molette fait tout :\n1. tourner déplace le curseur, appuyer entre dans la page ou l'élément ;\n2. sur une valeur, un point d'interrogation clignote : on est en train de la modifier. Tourner change, appuyer enregistre ;\n3. CANCEL (le commutateur STATUS/CANCEL vers le bas) avant d'appuyer remet l'ancienne valeur ;\n4. DISPLAY/MENU sur DISPLAY referme le menu.\n\nLes pages sont numérotées : O01 VF DISPLAY, O03 VF MARKER, O06 ZEBRA, O08 VF OUT… Le numéro est le même sur toutes les caméras de la famille : « page O06 » suffit pour se comprendre.\n\n**Qui a la main.** Reliée à la CCU, la caméra obéit au RCP pour toute la peinture : les valeurs du menu PAINT suivent celles du RCP, et c'est la vision qui les règle. Le cadreur règle son viseur dans OPERATION ; la vision règle l'image depuis le car.",
  vraie: "Les commandes du menu sont sur le côté droit, derrière la trappe : la molette (tourner et appuyer), le commutateur DISPLAY/MENU au-dessus, le commutateur STATUS/CANCEL à ressort. STATUS vers le haut affiche l'état de la caméra sans entrer dans le menu : filtre, gain, balance, shutter en un coup d'œil.\n\n**Le bon geste.** Se faire un menu USER avec ses quatre ou cinq pages : zebra, marqueurs, VF OUT, affichage. Et refermer le menu avant l'antenne : tant qu'il est ouvert, il cache une partie de l'image du viseur.\n\n**L'erreur fréquente.** Changer une valeur et sortir sans appuyer : le point d'interrogation clignotait, rien n'est enregistré. Ou aller modifier une page PAINT depuis la caméra et s'étonner que le RCP ne suive pas : c'est lui qui commande.",
  plus: "- **Les fichiers.** Un fichier de scène garde la peinture d'une situation (le plateau du soir, l'extérieur jour) ; le fichier de référence est le zéro de la caméra, celui qu'on recharge avant un line-up ; le fichier opérateur garde les réglages du viseur de chaque cadreur ; FILE CLEAR remet tout d'usine.\n- **Le menu du RCP et de la CCU.** La CCU a ses propres menus, et le RCP accède aux mêmes paramètres de peinture que la caméra : un seul réglage, trois endroits pour le voir.\n- **DIAGNOSIS.** Quand l'image n'arrive pas au car, la page TRANSMISSION dit si la liaison optique est établie et avec quel niveau. C'est la première page à ouvrir.\n- **Les caractères.** Le menu et les affichages du viseur peuvent aussi sortir sur TEST OUT, pour un moniteur de poche à côté de la caméra.",
  car: "Dans le car, la vision n'entre pas dans le menu de la caméra : le RCP et la CCU atteignent les mêmes réglages de peinture, à portée de main. Le menu de la caméra, c'est l'affaire du cadreur pour son viseur, et de la maintenance pour l'installation.",
  quiz: [
    {
      q: 'Le cadreur veut un zebra à 70 % dans son viseur. Dans quelle famille du menu ?',
      a: [
        ['PAINT, puisque c\'est l\'image.', 'Le zebra ne change pas l\'image : c\'est une aide du viseur. PAINT, c\'est la peinture de l\'image, côté vision.'],
        ['OPERATION, page ZEBRA.', 'Exact : tout ce qui concerne le viseur et le cadreur est dans OPERATION.'],
        ['MAINTENANCE, page AUTO SETUP.', 'MAINTENANCE sert à l\'installation et au système, pas au viseur.'],
      ],
      ok: 1,
    },
    {
      q: 'Le point d\'interrogation clignote à côté d\'une valeur. Que signifie-t-il ?',
      a: [
        ['La valeur est en cours de modification : tourner change, appuyer enregistre, CANCEL annule.', 'Exact : tant qu\'il clignote, rien n\'est enregistré.'],
        ['La valeur est verrouillée par le RCP.', 'Une valeur verrouillée ne se laisse pas éditer ; le point d\'interrogation dit au contraire que l\'édition est ouverte.'],
        ['La caméra signale une panne sur cet élément.', 'Les diagnostics sont dans DIAGNOSIS, pas dans un clignotement à côté d\'une valeur.'],
      ],
      ok: 0,
    },
    {
      q: 'Pendant le direct, la vision change le gamma depuis le RCP. Le cadreur le voit-il dans son menu PAINT ?',
      a: [
        ['Non : le menu de la caméra et le RCP sont deux réglages indépendants.', 'Ce sont les mêmes paramètres : la caméra n\'a qu\'un seul gamma.'],
        ['Oui, et il peut le remettre à sa valeur depuis la caméra.', 'Il le voit, mais reliée à la CCU, c\'est le RCP qui a la main sur la peinture.'],
        ['Oui : la valeur du menu suit celle du RCP, et c\'est la vision qui a la main.', 'Exact : un seul réglage, piloté par le RCP ; le cadreur regarde, la vision règle.'],
      ],
      ok: 2,
    },
  ],
  see: ['commandes', 'viseur', 'fichiers', 'rcp', 'shutter', 'gamma'],
  ref: 'Mode d\'emploi HXC-FB80 : TOP MENU (USER, USER MENU CUSTOMIZE, ALL, OPERATION, PAINT, MAINTENANCE, FILE, DIAGNOSIS) ; pages OPERATION 01 à 16, PAINT P01 à P14, MAINTENANCE M01 à M14, FILE F01 à F05 ; commutateur DISPLAY/MENU, molette, STATUS/CANCEL',
  competences: ['2.7', '2.9'],
};

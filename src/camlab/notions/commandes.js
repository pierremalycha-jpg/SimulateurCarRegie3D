// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Les commandes du corps ». Mode d'emploi HXC-FB80 : bouton FILTER (1 CLEAR, 2 1/4 ND,
// 3 1/16 ND, 4 1/64 ND), touche COLOR TEMP. (fonction ASSIGN CTEMP : 5600K d'usine, ou ELECTRICAL
// CC), touches ASSIGN 1, 2, 3 (ASSIGNABLE 1/2/3 de la page SWITCH ASSIGN1 du menu OPERATION, sans
// fonction d'usine : RETURN1 SW…, ZEBRA, VF DETAIL, D.EXTENDER, TLCS, ATW…), commutateur GAIN L/M/H
// (valeurs réglées par GAIN de la page SWITCH ASSIGN1 : 0, 6 et 12 dB d'usine, de −6 à +12 dB par
// pas de 3 dB), OUTPUT/AUTO KNEE (BARS, CAM), WHITE BAL (B, A, PRST à 3200 K), WHT/BLK, SHUTTER.
// « Reliée à une CCU ou à un appareil de commande (RCP, RM), SHUTTER, WHT/BLK, OUTPUT/AUTO KNEE,
// WHITE BAL, GAIN et le bouton FILTER sont commandés par l'appareil relié ; les commutateurs de la
// caméra ne fonctionnent pas. » La manipulation (camlab/labs/ch56.js, « commandes ») : caméra
// seule, gain au sélecteur, touche ASSIGN programmée, puis reliée à la CCU, les barres au RCP.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const COMMANDES = {
  t: 'Les commandes du corps', aka: 'FILTER, COLOR TEMP., ASSIGN 1 à 3, GAIN, OUTPUT/AUTO KNEE, WHITE BAL, WHT/BLK', chap: 5, lot: 2, point: 'commandes',
  short: 'FILTER, COLOR TEMP., ASSIGN 1 à 3, gain, sortie, balance : ce que l\'on règle sur le flanc de la caméra, et ce que la vision reprend à distance dès que la caméra est reliée à la CCU.',
  fig: 'commandes',
  lab: 'commandes',
  body: "**Un panneau, deux situations.** Sous la trappe du flanc de la caméra, un panneau réunit les commandes de l'image : le filtre, le gain, la sortie, la balance. Elles servent quand la caméra travaille **seule**, sans CCU (Camera Control Unit, la voie caméra du car) : un petit plateau, une captation avec un enregistreur branché sur SDI OUT. Dès qu'elle est **reliée à la CCU**, c'est le **RCP** (Remote Control Panel, le pupitre de la vision) qui commande l'image ; les commutateurs de la caméra ne font plus rien.\n\n**Les commandes, une par une.**\n- **FILTER** : la roue des filtres ND, 1 CLEAR, 2 1/4, 3 1/16, 4 1/64 (fiche Les filtres ND).\n- **COLOR TEMP.** : une touche dont la fonction se choisit au menu ; d'usine, elle bascule la caméra sur 5600K, la lumière du jour.\n- **GAIN** L, M, H : trois valeurs choisies au menu, d'usine 0, 6 et 12 dB. +6 dB double le signal : un diaphragme de plus, et plus de bruit.\n- **OUTPUT/AUTO KNEE** : BARS envoie des barres de couleur, CAM l'image ; le même commutateur met en service l'AUTO KNEE, qui comprime les hautes lumières.\n- **WHITE BAL** (B, A, PRST) et **WHT/BLK** : les balances (fiche Balance des blancs et des noirs).\n- **SHUTTER** : l'obturateur électronique.\n- **ASSIGN 1, 2, 3** : trois touches sans fonction d'usine, auxquelles on donne celle qu'on veut.\n\n**Les touches ASSIGN.** Dans le menu OPERATION, page 09 SWITCH ASSIGN1, les lignes ASSIGNABLE1, 2 et 3 donnent une fonction à chaque touche : par exemple ZEBRA (allumer les zébras), VF DETAIL (le peaking du viseur), RETURN1 SW (voir le retour 1 tant qu'on appuie) ou l'extender numérique. Chaque cadreur règle les siennes et les garde dans son fichier opérateur.\n\n**Qui a la main.** Reliée à la CCU ou à un pupitre (RCP, RM), la caméra obéit à l'appareil relié pour SHUTTER, WHT/BLK, OUTPUT/AUTO KNEE, WHITE BAL, GAIN et FILTER : c'est écrit tel quel dans le mode d'emploi. Le cadreur garde ce qui fait son métier : le cadre, le zoom et le point, son viseur, les touches ASSIGN, le menu OPERATION, l'intercom et le CALL. La vision règle l'image, pour que toutes les caméras se ressemblent.",
  vraie: "Le panneau est sur le flanc du corps, sous une trappe (la pastille « Les commandes du corps ») : FILTER en haut, COLOR TEMP. à côté, les trois touches ASSIGN au milieu, puis la rangée des commutateurs GAIN, OUTPUT et WHITE BAL et, en bas, les touches du menu. STATUS affiche dans le viseur l'état en cours : filtre, gain, balance, shutter.\n\n**Le bon geste.** Avant de relier la caméra, remettre le panneau dans une position neutre : FILTER sur 1, GAIN sur L, OUTPUT sur CAM. Si la caméra repasse un jour en autonome, elle repart d'un état connu. Et programmer ses touches ASSIGN en début de journée, pas pendant le direct.\n\n**L'erreur fréquente.** Basculer GAIN ou FILTER sur une caméra reliée à la CCU et croire avoir changé l'image : rien ne bouge, c'est le RCP qui commande. Le réflexe : demander à la vision, sur l'intercom ENG. Autre piège : appuyer à l'antenne sur une touche ASSIGN sans savoir ce qu'elle fait. D'usine elle ne fait rien, mais celle d'un collègue peut allumer l'extender, qui agrandit l'image envoyée.",
  plus: "- **La page SWITCH ASSIGN1.** Elle range les valeurs du GAIN (de −6 à +12 dB par pas de 3 dB pour chaque position), la fonction de COLOR TEMP. (ASSIGN CTEMP : 5600K ou ELECTRICAL CC) et celles des trois touches ASSIGN. La page 10, SWITCH ASSIGN2, règle d'autres touches, dont celles des retours.\n- **Une conversion électronique.** La caméra n'a pas de roue de filtres colorés : le passage à 5600 K est un calcul sur les voies rouge et bleue, comme la balance (fiche Température de couleur et filtres CC).\n- **AUTO KNEE.** Le coude (knee) comprime les hautes lumières au-dessus d'un niveau ; en automatique, la caméra le place selon l'image (fiche Knee et white clip).\n- **Les barres.** Elles servent à aligner la chaîne : la vision les demande au line-up pour régler ses moniteurs et vérifier les niveaux jusqu'à la grille.\n- **TLCS.** Une touche ASSIGN peut aussi allumer le TLCS (Total Level Control System), qui garde le niveau de l'image en jouant sur l'iris, le gain et le shutter. Pratique en reportage, à proscrire sur un plateau à plusieurs caméras.",
  car: "Dans le car, les caméras HDC du stade sont toutes reliées à leur CCU : leurs commutateurs de gain et de filtre ne servent jamais pendant le match. La vision règle tout depuis les RCP, filtres et gain compris, et passe les caméras en barres au line-up. Le cadreur, lui, se sert de ses touches ASSIGN pour son viseur : zébras, peaking, retours.",
  quiz: [
    {
      q: 'La caméra est reliée à la CCU. Le cadreur passe GAIN de L à H. Que voit la vision ?',
      a: [
        ['L\'image monte de 12 dB.', 'Reliée à la CCU, le commutateur GAIN de la caméra ne fait plus rien : c\'est le RCP qui fixe le gain.'],
        ['Rien ne change : le gain est commandé par le RCP.', 'Exact : GAIN, FILTER, OUTPUT/AUTO KNEE, WHITE BAL, WHT/BLK et SHUTTER obéissent à l\'appareil relié.'],
        ['Le RCP passe tout seul sur H.', 'Le RCP ne suit pas la caméra : c\'est la caméra qui suit le RCP.'],
      ],
      ok: 1,
    },
    {
      q: 'Le cadreur appuie sur ASSIGN 1 d\'une caméra sortie d\'usine. Que se passe-t-il ?',
      a: [
        ['Les zébras s\'allument.', 'Seulement si l\'on a donné la fonction ZEBRA à ASSIGN 1 dans la page SWITCH ASSIGN1.'],
        ['Le retour 1 s\'affiche dans le viseur.', 'Ce serait la fonction RETURN1 SW, qu\'il faut choisir : elle n\'y est pas d\'usine.'],
        ['Rien : d\'usine, ASSIGN 1 à 3 n\'ont pas de fonction.', 'Exact : on leur en donne une dans le menu OPERATION, page SWITCH ASSIGN1.'],
      ],
      ok: 2,
    },
    {
      q: 'Caméra seule, plateau sombre : on passe le gain de 0 à 12 dB. Que gagne-t-on, et à quel prix ?',
      a: [
        ['Deux diaphragmes, et plus de bruit.', 'Exact : +6 dB double le signal, +12 dB le quadruple ; le bruit est amplifié avec lui.'],
        ['Douze diaphragmes, sans contrepartie.', '6 dB valent un diaphragme : 12 dB en valent deux. Et le bruit monte.'],
        ['Un diaphragme, et une image plus nette.', '12 dB, c\'est deux diaphragmes ; le gain n\'ajoute aucune netteté, le bruit masque même le détail.'],
      ],
      ok: 0,
    },
  ],
  see: ['menu', 'gain', 'nd', 'balance', 'cc', 'rcp', 'viseur', 'retours'],
  ref: 'Mode d\'emploi HXC-FB80 : FILTER, COLOR TEMP. (ASSIGN CTEMP, 5600K), ASSIGN 1 à 3 (ASSIGNABLE 1/2/3, page SWITCH ASSIGN1, sans fonction d\'usine), GAIN L/M/H (0, 6, 12 dB d\'usine, de −6 à +12 dB), OUTPUT/AUTO KNEE, WHITE BAL (PRST 3200 K), WHT/BLK ; reliée à une CCU ou un RCP, SHUTTER, WHT/BLK, OUTPUT/AUTO KNEE, WHITE BAL, GAIN et FILTER sont commandés par l\'appareil relié',
  competences: ['2.9', '2.7'],
  cours: 'camera-systeme',
};

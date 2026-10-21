// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Le moniteur forme d'onde ». ITU-R BT.709 : noir au code 64, blanc au code 940 en 10 bits
// (0 à 100 %, 0 à 700 mV) ; le SDI porte du code 4 au code 1019 (−7 à 109 %). EBU R 103 : luminance
// de −1 à 103 %, composantes R, V, B de −5 à 105 %. Courbe BT.709 : une carte grise à 18 % donne
// 41 % quand un blanc parfait est à 100 %. Repères d'usage, pas des normes : noirs posés entre 0 et
// 2 %, visages de peau claire vers 60 à 70 %, pelouse de jour vers 40 à 55 % (Cours, « Niveaux » et
// « Le line-up »). HLG : blanc de référence à 75 %, gris 18 % à 38 % (ITU-R BT.2408). Mode d'emploi
// HXC-FB80 : zébras, page O06 ZEBRA (ZEBRA1 à 70 %, ZEBRA2 à 100 % à l'usine). La manipulation
// (camlab/labs/ch89.js, « waveform ») calcule chaque point de l'image par la courbe BT.709.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const WAVEFORM = {
  t: 'Le moniteur forme d\'onde', aka: 'Waveform monitor (WFM) ; la mesure des niveaux de l\'image', chap: 8, lot: 2, point: 'mesure',
  short: 'Lire une exposition en pourcentage : le noir à 0 %, les visages vers 60 à 70 %, le blanc à 100 %, rien au-dessus de 103 %.',
  fig: 'waveform',
  lab: 'waveform',
  cours: 'signal-niveaux',
  body: "**Ce que trace l'appareil.** Le moniteur forme d'onde (en anglais waveform monitor, WFM) superpose toutes les lignes de l'image. Chaque point garde sa place de gauche à droite ; sa hauteur donne son niveau, de 0 % (le noir) à 100 % (le blanc). Une chemise blanche à gauche de l'image fait une trace en haut à gauche ; un rideau sombre derrière tout le plateau, une bande basse sur toute la largeur. On ne voit plus l'image : on voit ses niveaux.\n\n**L'échelle.**\n- 0 % : le noir, code 64 en 10 bits ; 100 % : le blanc, code 940 (BT.709).\n- Les appareils peuvent aussi graduer en millivolts, un héritage de l'analogique : de 0 à 700 mV, soit 7 mV pour 1 %.\n- Au-dessus de 100 %, le signal numérique (SDI) porte encore jusqu'à 109 % : les super-blancs. Mais la diffusion n'en accepte pas plus de 103 % (EBU R 103) : au-delà, un appareil placé plus loin dans la chaîne, le légaliseur, les écrête.\n\n**Les repères de l'exposition.** Ce sont des ordres de grandeur d'usage, pas des normes :\n- les noirs posés entre 0 et 2 % ;\n- un visage de peau claire vers 60 à 70 % ; une peau mate ou foncée se pose plus bas ;\n- une carte grise à 18 % vers 41 % quand un blanc parfait touche 100 % : la courbe de la caméra n'est pas une règle de trois ;\n- une pelouse de jour vers 40 à 55 % ;\n- les blancs juste sous 100 %, les reflets sous 103 %.\n\n**Lire la trace.** Un trait plat sur la ligne des 100 % : un blanc écrêté, ses détails sont perdus. Une trace tassée contre le 0 % : des noirs bouchés. Une trace épaisse et floue dans les sombres : du bruit, souvent du gain. Et ce qui compte, c'est le sujet : un plan de nuit n'a pas à monter jusqu'à 100 %.\n\n**Pourquoi un appareil.** L'œil s'adapte : un blanc à 95 % et un blanc à 108 % se ressemblent sur un écran, et un moniteur mal réglé trompe. La forme d'onde mesure le signal qui part vers le car, quel que soit l'écran.",
  vraie: "La mesure qui fait foi est en régie : au poste de la vision, la forme d'onde lit la sortie de la CCU, à côté du moniteur de référence (sa pastille, dans le coin vision du plateau). Sur la caméra, l'outil du cadreur est le zébra du viseur, menu OPERATION, page O06 ZEBRA : ZEBRA1 hachure ce qui est autour de son niveau (70 % à l'usine), là où se posent les visages ; ZEBRA2 hachure ce qui dépasse le sien (100 %), ce qui écrête. Sans car, sur un tournage léger, on branche un moniteur de terrain à forme d'onde sur la sortie SDI OUT.\n\n**Le bon geste.** Repérer d'abord où est le sujet sur la trace (la forme d'onde garde la gauche et la droite), puis l'exposer à son niveau. Poser les noirs avant les blancs. Parler la même unité que l'équipe : en pour cent, 70 %, pas 490 mV.\n\n**L'erreur fréquente.** Ouvrir l'iris jusqu'à ce que le haut de la trace touche 100 %, même quand l'image n'a pas de blanc : le plan de nuit devient gris et bruité. Ou confondre 70 % et 700 mV : 700 mV, c'est 100 %.",
  plus: "- **Pour cent, millivolts, IRE.** En HD, 100 % = 700 mV. On entend encore « IRE », une unité de la télévision analogique américaine, employée aujourd'hui comme un pour cent.\n- **Luminance ou parade.** La trace habituelle est la luminance (Y). La parade montre côte à côte le rouge, le vert et le bleu : sur un gris bien balancé, les trois sont à la même hauteur. Les trois doivent aussi rester entre −5 et 105 % (EBU R 103), même quand la luminance est juste.\n- **Une ligne ou toute l'image.** Les appareils savent ne montrer qu'une ligne choisie, pour mesurer un seul objet, ou filtrer le détail fin pour lire les niveaux moyens.\n- **En HDR.** En HLG, les repères changent : le blanc de référence à 75 %, le gris 18 % à 38 % (BT.2408), et rien n'écrête avant 100 %.\n- **Sous le noir.** Le signal porte jusqu'à −7 % (code 4), mais ce qui est sous le noir disparaît à l'affichage : on ne pose rien d'utile sous 0 %.",
  car: "Au poste vision du car, le PRISM affiche la forme d'onde de la caméra que le RCP a sélectionnée : l'ingénieur vision expose au manche de l'iris en regardant la trace, visages et pelouse à leur niveau, crêtes sous 103 %. La baie de mesure donne la même mesure sur n'importe quelle source de la grille.",
  quiz: [
    {
      q: 'Le présentateur porte une chemise blanche, et il est à gauche de l\'image. Où lis-tu le niveau de sa chemise ?',
      a: [
        ['En haut, à gauche de la trace : la forme d\'onde garde la place de chaque point de gauche à droite.', 'Exact : un objet à gauche de l\'image est à gauche de la trace ; sa hauteur donne son niveau.'],
        ['Au milieu de la trace, là où elle est la plus dense.', 'La densité dit combien de points ont ce niveau, pas où ils sont. La chemise est à gauche de l\'image, donc à gauche de la trace.'],
        ['Nulle part : la forme d\'onde mélange toute l\'image.', 'Elle superpose les lignes, mais chaque colonne garde sa place : on retrouve chaque objet en largeur.'],
      ],
      ok: 0,
    },
    {
      q: 'Plan de nuit : le stade est sombre, aucun blanc dans l\'image. Faut-il ouvrir jusqu\'à ce que le haut de la trace touche 100 % ?',
      a: [
        ['Oui : une image doit toujours aller de 0 à 100 %.', 'C\'est l\'erreur : le plan de nuit tiré jusqu\'à 100 % devient un plan gris, avec du bruit si l\'on a monté le gain.'],
        ['Non : on expose ce qui compte, les visages et la pelouse, à leur niveau ; la nuit reste sombre.', 'Exact : la forme d\'onde dit où est chaque chose, c\'est le sujet qui décide de l\'exposition.'],
        ['Oui, mais avec le gain plutôt qu\'avec l\'iris.', 'Le gain monte aussi le bruit ; et il n\'y a de toute façon pas de raison de tirer la nuit à 100 %.'],
      ],
      ok: 1,
    },
    {
      q: 'La forme d\'onde du car est graduée en millivolts. Les visages sont à 455 mV. En pour cent ?',
      a: [
        ['45,5 %.', 'Ce serait vrai si 100 % valait 1 000 mV. En HD, 100 % vaut 700 mV.'],
        ['91 %.', 'C\'est le calcul à l\'envers. 455 ÷ 7 = 65.'],
        ['65 %, un visage bien exposé.', 'Exact : 100 % = 700 mV, donc 7 mV par pour cent ; 455 ÷ 7 = 65 %.'],
      ],
      ok: 2,
    },
  ],
  see: ['vecto', 'moniteur', 'iris', 'exposition', 'noir', 'knee', 'viseur', 'lineup'],
  ref: 'ITU-R BT.709 : noir au code 64, blanc au code 940 en 10 bits (0 à 700 mV) ; SDI de −7 à 109 % (codes 4 à 1019) ; EBU R 103 : luminance de −1 à 103 %, R, V, B de −5 à 105 % ; ITU-R BT.2408 : HLG, blanc de référence à 75 % ; mode d\'emploi HXC-FB80 : menu OPERATION, page O06 ZEBRA',
  competences: ['1.4', '2.2'],
};

// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Les filtres ND ». Mode d'emploi HXC-FB80 : bouton FILTER, 1 CLEAR, 2 1/4 ND, 3 1/16 ND,
// 4 1/64 ND, soit 0, 2, 4 et 6 diaphragmes (densités optiques 0,6 · 1,2 · 1,8). Repères de
// lumière : plateau de quelques centaines à 2000 lux, ciel couvert 10 000 à 20 000, plein soleil
// 50 000 à 100 000. La manipulation (camlab/labs/bloc.js, « nd ») garde f/5,6 d'une scène à l'autre.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const ND_FILTRES = {
  t: 'Les filtres ND', aka: 'Neutral density ; densité neutre, filtres gris', chap: 2, lot: 1, point: 'filtres',
  short: 'Des verres gris neutres qui retirent de la lumière sans changer les couleurs : CLEAR, 1/4, 1/16, 1/64. Ils permettent de garder l\'iris ouvert en plein soleil.',
  fig: 'nd',
  lab: 'nd',
  body: "**Un verre gris.** ND veut dire densité neutre : un verre qui absorbe la même proportion de toutes les couleurs. L'image est moins lumineuse, pas plus chaude ni plus froide. Chaque filtre est nommé par ce qu'il laisse passer :\n- **1/4** : un quart de la lumière, deux diaphragmes de moins ;\n- **1/16** : quatre diaphragmes ;\n- **1/64** : six diaphragmes.\n\n**Où il est.** Dans le corps de la caméra, entre l'objectif et le prisme, sur une roue à quatre positions : 1 CLEAR (pas de filtre), 2, 3, 4. Le bouton FILTER sur le côté droit la tourne ; le RCP de la vision aussi, à distance. Le viseur affiche la position en cours.\n\n**Pourquoi ne pas fermer l'iris.** Dehors, il y a assez de lumière pour fermer à f/16 et exposer juste. Mais :\n- à f/16, la diffraction adoucit l'image ;\n- la profondeur de champ devient énorme : plus moyen de détacher un sujet du fond ;\n- l'iris est en butée : la vision n'a plus de marge pour corriger.\n\nLe ND retire la lumière en trop et laisse l'iris à sa meilleure place, vers f/4 à f/5,6.\n\n**Combien de lumière.** Sur un plateau éclairé à quelques centaines de lux, la caméra travaille vers f/4 à f/5,6 sans filtre. Un ciel couvert, c'est seize fois plus de lumière : quatre diaphragmes, ND 1/16 pour garder le même iris. Le plein soleil, soixante-quatre fois plus : ND 1/64. On choisit le filtre qui ramène l'iris dans sa zone, et on finit à l'iris.",
  vraie: "Le bouton FILTER est sur le côté droit du corps, positions 1 à 4, derrière la trappe des commandes. Dans le viseur, l'affichage ND donne la position en cours ; sur le RCP, quatre touches font la même chose. Une position du filtre, c'est un petit temps mécanique pendant lequel l'image bouge : on ne change pas de ND à l'antenne.\n\n**Le bon geste.** Avant de sortir, mettre le ND avant de passer la porte : l'image ne part pas dans le blanc. En rentrant, la roue sur 1 (CLEAR) avant de rouvrir l'iris. Après un changement de filtre, un coup d'œil à la balance des blancs, par habitude : un bon ND ne change rien, un ND sale ou ancien un peu.\n\n**L'erreur fréquente.** Rentrer sur le plateau avec le ND 1/64 oublié : l'image est six diaphragmes trop sombre. On la rattrape en ouvrant l'iris à fond puis en montant le gain, et on se demande pourquoi l'image est bruitée et le point difficile. Le réflexe, c'est FILTER sur 1.",
  plus: "- **La densité optique.** Les fabricants notent aussi le ND par sa densité d = −log10 (transmission) : 1/4 est un ND 0,6, 1/16 un ND 1,2, 1/64 un ND 1,8. En photo, on écrit ND4, ND16, ND64, ou « 2 stops », « 4 stops », « 6 stops » : quatre écritures pour les mêmes verres.\n- **Les filtres de conversion.** Les caméras d'avant avaient une seconde roue de filtres colorés (A 3200 K, B 4300 K, C 5600 K, D 6300 K) pour adapter la caméra à la lumière. La FB80 fait cette conversion électroniquement : page CC du menu, et le bouton COLOR TEMP. pour 5600 K.\n- **Devant l'objectif.** On peut aussi mettre un ND devant la lentille frontale, dans un porte-filtre ; les ND variables sont deux polariseurs qu'on tourne l'un sur l'autre. Pratique en tournage, rare sur un plateau où la roue interne suffit.\n- **L'infrarouge.** Un ND très dense retire la lumière visible mais laisse passer l'infrarouge, que le capteur voit un peu : les noirs virent au marron ou au magenta. Les ND de qualité coupent aussi l'infrarouge.",
  car: "Au stade, les caméras de tribune passent l'après-midi entre le soleil et l'ombre : la vision commute les ND depuis les RCP et rattrape le reste à l'iris. Quand la nuit tombe, les ND reviennent sur CLEAR les uns après les autres, puis le gain monte.",
  quiz: [
    {
      q: 'Dehors, il y a seize fois plus de lumière que sur le plateau. Quel ND pour garder le même iris ?',
      a: [
        ['1/4', '1/4 ne retire que deux diaphragmes (quatre fois). Il en reste quatre fois trop.'],
        ['1/16', 'Exact : seize fois moins de lumière, quatre diaphragmes, et l\'iris ne bouge pas.'],
        ['1/64', 'Trop : l\'image serait quatre fois trop sombre, il faudrait rouvrir l\'iris.'],
      ],
      ok: 1,
    },
    {
      q: 'Pourquoi ne pas simplement fermer l\'iris à f/16 en plein soleil ?',
      a: [
        ['Parce que l\'iris ne ferme pas au-delà de f/8.', 'Il ferme jusqu\'à f/16, et même C. Ce n\'est pas une question de butée.'],
        ['Parce que fermer l\'iris change les couleurs.', 'L\'iris ne change pas les couleurs. C\'est la quantité de lumière qu\'il règle.'],
        ['Parce qu\'à f/16 l\'image perd du piqué par diffraction, et qu\'on perd le choix de la profondeur de champ.', 'Exact : le ND retire la lumière et laisse l\'iris à sa meilleure ouverture.'],
      ],
      ok: 2,
    },
    {
      q: 'On rentre du plein soleil sur le plateau en oubliant le ND 1/64. Que voit-on ?',
      a: [
        ['Une image très sombre, six diaphragmes sous l\'exposition : on ne la rattrape pas avec l\'iris seul.', 'Exact : il manque soixante-quatre fois de lumière. Le réflexe, c\'est FILTER sur 1 (CLEAR), pas le gain.'],
        ['Une image normale : la caméra compense le filtre.', 'Rien ne compense un filtre : la lumière retirée est perdue.'],
        ['Une image orange : le filtre change la température de couleur.', 'Le ND est neutre : il change la quantité de lumière, pas sa couleur.'],
      ],
      ok: 0,
    },
  ],
  see: ['iris', 'exposition', 'cc', 'pdc', 'rcp', 'gain'],
  ref: 'Mode d\'emploi HXC-FB80 : bouton FILTER, positions 1 CLEAR, 2 1/4 ND, 3 1/16 ND, 4 1/64 ND ; densité optique d = −log10 de la transmission (0,6 · 1,2 · 1,8)',
  competences: ['2.9'],
};

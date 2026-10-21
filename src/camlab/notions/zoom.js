// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Le zoom ». Fujinon ZA12x4.5BERD : rapport 12×, 4,5–54 mm, servo de zoom (bascule
// W–T de la poignée, sélecteur servo/manuel), commandes reportées sur les manches du pied.
// Éléments de l'objectif d'après le mode d'emploi HXC-FB80 (« Objectif »).
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const ZOOM = {
  t: 'Le zoom', aka: 'Objectif à focale variable, zoom parfocal, servo de zoom', chap: 1, lot: 1, point: 'zoom',
  short: 'Rapport de zoom, zoom motorisé ou à la main, et zoom parfocal : le point reste juste quand on zoome, si le tirage est bien réglé.',
  fig: 'zoom',
  lab: 'zoom',
  body: "**Un objectif à focale variable.** À l'intérieur, plusieurs groupes de lentilles se déplacent quand on tourne la bague de zoom : le variateur change la focale, le compensateur le suit pour que l'image reste au même endroit. Le groupe arrière (le relais) conduit l'image jusqu'aux capteurs.\n\n**Le rapport de zoom.** C'est la focale la plus longue divisée par la plus courte : 54 ÷ 4,5 = 12. D'où le nom de l'objectif, ZA**12x4.5** : 12 fois, à partir de 4,5 mm. Un zoom de stade 86 × 9,3 va de 9,3 à 800 mm.\n\n**Parfocal.** Un zoom de télévision est parfocal : une fois le point fait, il reste juste sur toute la course du zoom. C'est ce qui permet de faire le point en serré puis d'élargir. Il faut pour cela que le tirage soit bien réglé.\n\n**Le servo.** Le zoom est motorisé : la bascule W–T de la poignée commande sa vitesse. Appuyer légèrement donne un zoom lent, appuyer à fond un zoom rapide ; relâchée, la bascule revient au milieu et le zoom s'arrête. Sur un pied de plateau, la commande de zoom est reportée sous le pouce droit du cadreur.",
  vraie: "**Sur l'objectif.** La bascule W–T est sur la poignée du servo, sous les doigts de la main droite. Le sélecteur servo/manuel du zoom passe à la commande à la main : on tourne alors la bague avec son levier. La touche RET de la poignée affiche le retour vidéo dans le viseur.\n\n**Sur le pied.** Les commandes reportées se branchent sur la poignée (les prises à embout vert sur les photos du plateau) : le zoom sur le manche droit, sous le pouce ; le point sur le manche gauche, à la manivelle.\n\n**Le bon geste.** Un zoom à l'antenne démarre et s'arrête en douceur : on effleure la bascule, on garde la même pression, on relâche doucement.\n\n**L'erreur fréquente.** Zoomer à fond pour recadrer pendant que la caméra est à l'antenne. Si le plan doit changer vite, on attend que le réalisateur passe sur une autre caméra.",
  plus: "- **La respiration.** Sur certains objectifs, tourner la bague de point change un peu le cadre, comme un petit zoom. Les zooms de télévision sont corrigés pour que cela se voie peu.\n- **Les mémoires de zoom.** Certaines commandes reportées numériques gardent des positions et des vitesses : un recadrage exact, à la même vitesse, à chaque prise.\n- **Le zoom numérique.** Le D.EXT de la caméra (doubleur numérique) agrandit l'image électroniquement : il ne gagne aucun détail, il agrandit les pixels.",
  car: "Dans le car, le réalisateur demande « resserre » ou « élargis » à l'intercom. Au stade, les cadreurs de tribune zooment en permanence pour suivre le jeu : un zoom qui saute à l'antenne est l'erreur qui se voit le plus.",
  quiz: [
    {
      q: 'Que veut dire « 12x4.5 » dans le nom de l\'objectif ?',
      a: [
        ['12 lentilles, ouverture 4,5', 'L\'ouverture maximale est f/1,8, et 12 n\'est pas un nombre de lentilles.'],
        ['Un zoom 12 fois, dont la plus courte focale est 4,5 mm', 'Exact : 4,5 × 12 = 54 mm, la focale la plus longue.'],
        ['Une focale de 4,5 à 12 cm', 'Les focales sont en millimètres, et le zoom va de 4,5 à 54 mm.'],
      ],
      ok: 1,
    },
    {
      q: 'Pourquoi peut-on faire le point en serré, puis élargir sans le refaire ?',
      a: [
        ['Parce que le zoom est parfocal, si le tirage est juste.', 'Exact : c\'est la conception de l\'objectif qui garde le point sur toute la course.'],
        ['Parce que la caméra refait le point toute seule.', 'Ce n\'est pas un autofocus : c\'est l\'objectif qui garde le point.'],
        ['Parce qu\'en grand angle, rien n\'est jamais flou.', 'La profondeur de champ aide en large, mais c\'est le zoom parfocal qui garde le point.'],
      ],
      ok: 0,
    },
    {
      q: 'Le cadreur doit faire un zoom lent à l\'antenne. Que fait-il ?',
      a: [
        ['Il tourne vite la bague en manuel.', 'À la main, on obtient difficilement un mouvement régulier.'],
        ['Il enfonce la bascule à fond, brièvement.', 'À fond, la bascule donne la vitesse maximale : le zoom saute.'],
        ['Il effleure la bascule et garde la même pression.', 'Exact : la vitesse dépend de la pression.'],
      ],
      ok: 2,
    },
  ],
  see: ['focale', 'tirage', 'point', 'doubleur', 'cadreur'],
  ref: 'Fujinon ZA12x4.5BERD : zoom 12×, 4,5–54 mm, servo de zoom ; mode d\'emploi HXC-FB80, « Objectif » (bascule de zoom, sélecteur servo/manuel)',
  competences: ['2.9'],
};

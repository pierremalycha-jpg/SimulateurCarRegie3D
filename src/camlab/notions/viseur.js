// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Le viseur et ses aides ». Fiche technique HXC-FB80 : viseur 7" fourni, écran
// 155,5 × 87,5 mm, 1920 × 1080 (bandes RVB). Mode d'emploi : boutons BRIGHT et CONTRAST (l'écran
// seulement), PEAKING (« sans effet sur le signal de sortie de la caméra »), commutateur TALLY ;
// menu OPERATION : 03 VF MARKER (MARKER, CENTER, SAFETY ZONE, ZONE 80 / 90 / 92,5 / 95 %, ASPECT),
// 04 VF DETAIL (niveau, FREQUENCY, AREA, CRISP, PEAK COLOR…), 05 FOCUS ASSIST, 06 ZEBRA (ZEBRA1
// LEVEL 70 %, WIDTH 10 %, ZEBRA2 LEVEL 100 %), 08 VF OUT (COLOR, Y, R, G, B) ; extender numérique
// D.EXTENDER ×2 ou ×4, autorisé au menu MAINTENANCE puis donné à une touche ASSIGN : il agrandit
// le centre de l'image (la sortie aussi). Barres de réglage : SMPTE RP 219 (bandeau −2, +2, +4 %).
// La manipulation (camlab/labs/ch56.js, « viseur ») : régler le viseur sur les barres, faire le
// point au peaking et vérifier à l'extender, exposer aux zébras ; la sortie est montrée à côté.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const VISEUR = {
  t: 'Le viseur et ses aides', aka: 'Viewfinder ; BRIGHT, CONTRAST, PEAKING, zébras, VF MARKER, D.EXTENDER', chap: 6, lot: 2, point: 'viseur',
  short: 'Le viseur 7" : luminosité et contraste de l\'écran (qui ne changent pas l\'image), peaking pour le point, zébras pour l\'exposition, marqueurs pour le cadre, et l\'extender numérique pour grossir le centre.',
  fig: 'viseur',
  lab: 'viseur',
  body: "**Un écran pour le cadreur.** Le viseur de plateau est un écran de 7 pouces (155,5 × 87,5 mm), en 1920 × 1080, posé sur le dessus de la caméra. Il montre l'image de la caméra, avec des aides qui n'existent que pour le cadreur : rien de tout cela ne part au car, sauf l'extender.\n\n**L'écran : BRIGHT et CONTRAST.** Comme sur un moniteur, BRIGHT règle le noir de l'écran, CONTRAST son blanc. Ils ne changent pas la sortie de la caméra : un viseur trop lumineux fait croire l'image surexposée, un viseur terne fait ouvrir l'iris pour rien. On les règle sur les barres : le noir bien noir, les petits écarts au-dessus du noir à peine visibles, le blanc lumineux sans être écrêté.\n\n**Le point : PEAKING.** Le bouton PEAKING souligne de blanc les contours nets de l'image. On tourne la bague de point jusqu'à ce que le soulignement s'allume sur ce qui compte. La page 04 VF DETAIL du menu OPERATION règle la même aide plus finement : niveau, finesse des contours détectés, couleur.\n\n**L'exposition : les zébras.** Des hachures sur les zones d'un certain niveau (page 06 ZEBRA). ZEBRA1 hachure ce qui est autour de 70 % (largeur 10 %), le niveau d'un visage bien exposé ; ZEBRA2 tout ce qui atteint 100 % : l'écrêtage.\n\n**Le cadre : les marqueurs.** Page 03 VF MARKER : la croix du centre, la zone de sécurité (80, 90, 92,5 ou 95 % de l'image) pour garder titres et visages loin des bords.\n\n**Grossir le centre : l'extender numérique.** Le D.EXTENDER, donné à une touche ASSIGN, grossit le centre de l'image deux ou quatre fois : le flou se voit mieux. Mais il agrandit l'image elle-même, celle qui part au car. C'est un outil pour vérifier le point avant l'antenne, pas pendant.",
  vraie: "Les trois boutons BRIGHT, CONTRAST et PEAKING sont sur le viseur, avec le commutateur TALLY de la lampe. Les pages ZEBRA, VF MARKER et VF DETAIL sont dans le menu OPERATION ; une touche ASSIGN peut allumer les zébras ou le peaking d'un geste.\n\n**Le bon geste.** Régler le viseur en arrivant, sur les barres, et ne plus y toucher. Faire le point en serré, au peaking, puis élargir. Exposer d'après les zébras ou d'après la vision, jamais d'après la luminosité du viseur.\n\n**L'erreur fréquente.** Monter BRIGHT parce que l'image paraît sombre : la sortie n'a pas changé, et le cadreur juge maintenant tout de travers. Ou laisser l'extender allumé après avoir vérifié le point : l'image envoyée au car est agrandie deux fois.",
  plus: "- **VF OUT.** Page 08 : le viseur peut montrer une seule voie, rouge, verte ou bleue, ou la luminance. Sur la voie verte, la plus riche en détail, le point se voit mieux (fiche Le prisme dichroïque).\n- **FOCUS ASSIST.** Page 05 : un indicateur de netteté dans le viseur, en plus du peaking.\n- **Les barres de réglage.** Les barres de couleur SMPTE RP 219 ont, en bas, un bandeau à −2 %, +2 % et +4 % autour du noir : on règle BRIGHT pour que −2 % et le noir se confondent, que +2 % se devine et que +4 % se voie. La manipulation n'a pas de −2 % : son signal s'arrête au noir.\n- **Les zébras ne sortent pas.** Ils sont dessinés dans le viseur seulement : un moniteur branché sur SDI OUT ne les montre pas.\n- **Pourquoi 70 %.** Un visage clair bien exposé tombe vers 60 à 70 % de la forme d'onde : les zébras à 70 % le signalent sans quitter le viseur des yeux.",
  car: "Dans le car, les cadreurs du stade règlent leur viseur sur les barres au line-up, comme la vision ses moniteurs. Pendant le match, ils font le point au peaking dans le viseur 7\" de leur HDC, zébras éteints : l'exposition, c'est la vision, à la forme d'onde.",
  quiz: [
    {
      q: 'Le cadreur monte BRIGHT sur son viseur. Que voit la vision sur la forme d\'onde ?',
      a: [
        ['Le noir monte de quelques pour cent.', 'BRIGHT ne règle que l\'écran du viseur : la sortie ne bouge pas.'],
        ['Rien ne change.', 'Exact : BRIGHT, CONTRAST et PEAKING n\'agissent que sur l\'affichage du viseur.'],
        ['L\'image devient plus contrastée.', 'Aucun réglage d\'écran du viseur ne passe dans la sortie.'],
      ],
      ok: 1,
    },
    {
      q: 'ZEBRA2 est réglé à 100 %. Les zébras couvrent une chemise blanche. Qu\'est-ce que cela veut dire ?',
      a: [
        ['La chemise est écrêtée : ses détails sont perdus.', 'Exact : ZEBRA2 hachure tout ce qui atteint 100 %.'],
        ['La chemise est bien exposée.', 'Un blanc bien exposé reste sous 100 % : là, il est au plafond.'],
        ['Le point est fait sur la chemise.', 'Le point, c\'est le peaking ; les zébras parlent d\'exposition.'],
      ],
      ok: 0,
    },
    {
      q: 'Pourquoi coupe-t-on l\'extender numérique (D.EXTENDER) après avoir vérifié le point ?',
      a: [
        ['Parce qu\'il use l\'écran du viseur.', 'Ce n\'est pas un réglage d\'écran : il agit sur l\'image.'],
        ['Parce qu\'il empêche le peaking de marcher.', 'Le peaking fonctionne avec ; ce n\'est pas la raison.'],
        ['Parce qu\'il agrandit aussi l\'image envoyée au car.', 'Exact : contrairement aux aides du viseur, l\'extender change la sortie de la caméra.'],
      ],
      ok: 2,
    },
  ],
  see: ['point', 'menu', 'commandes', 'retours', 'iris', 'waveform', 'prisme', 'cadreur'],
  ref: 'Fiche technique et mode d\'emploi HXC-FB80 : viseur 7" 1920 × 1080 (155,5 × 87,5 mm), boutons BRIGHT, CONTRAST et PEAKING (sans effet sur la sortie), commutateur TALLY ; menu OPERATION, pages 03 VF MARKER, 04 VF DETAIL, 05 FOCUS ASSIST, 06 ZEBRA (ZEBRA1 70 %, ZEBRA2 100 %), 08 VF OUT ; extender numérique D.EXTENDER ×2 ou ×4 ; barres de couleur SMPTE RP 219',
  competences: ['2.9', '1.4'],
};

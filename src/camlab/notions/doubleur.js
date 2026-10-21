// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Le doubleur de focale ». Fiche Fujinon ZA12x4.5BERD : doubleur ×2 intégré (le E du nom,
// « extender »), focales 9–108 mm ; angle de champ 56,1° × 33,3° à 9 mm, 5,1° × 2,9° à 108 mm
// (93,6° × 61,8° à 4,5 mm sans doubleur) ; ouverture f/3,6 puis f/4,8 (le double de 1:1,8 et 1:2,4).
// Lumière : l'image est agrandie deux fois, la même lumière s'étale sur quatre fois plus de surface :
// ÷ 4, deux diaphragmes. Mode d'emploi HXC-FB80 : indication EX de la page VF DISPLAY (menu
// OPERATION) ; D.EXT, doubleur numérique de la caméra. Le levier est sous l'objectif, vers l'arrière
// (pastille « doubleur » de la caméra 3D). La manipulation (camlab/labs/ch1.js, « doubleur ») bascule
// le doubleur, rattrape l'exposition, puis refait le même cadre sans lui.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const DOUBLEUR = {
  t: 'Le doubleur de focale', aka: 'Extender ×2, multiplicateur de focale ; le E de ZA12x4.5BERD', chap: 1, lot: 2, point: 'doubleur',
  short: 'Le levier ×2 double la focale (9–108 mm) mais divise la lumière par quatre : deux diaphragmes perdus.',
  fig: 'doubleur',
  lab: 'doubleur',
  body: "**Ce que c'est.** Un petit groupe de lentilles rangé dans l'objectif, derrière l'iris. Un levier le fait basculer dans le faisceau : il agrandit deux fois l'image que forme le reste de l'objectif. Toutes les focales sont multipliées par deux : le 4,5–54 mm devient un 9–108 mm. L'angle de champ est divisé par deux à peu près : 94° au plus large sans doubleur, 56° avec ; 10° au plus serré, 5° avec.\n\n**Pourquoi quatre fois moins de lumière.** Le doubleur ne fait entrer aucune lumière de plus : il agrandit l'image du centre du champ. La même lumière est étalée sur une image deux fois plus large et deux fois plus haute, quatre fois plus grande : chaque photosite en reçoit quatre fois moins. En nombre f, tout double :\n- f/1,8 devient f/3,6 ;\n- au bout du zoom, f/2,4 devient f/4,8 ;\n- deux diaphragmes, l'équivalent de passer de f/4 à f/8.\n\n**Ce qui ne change pas.** Le doubleur est derrière le groupe de mise au point : la distance minimale et l'échelle de la bague de point restent les mêmes. Le zoom reste parfocal, si le tirage a été réglé doubleur sur ×1.\n\n**Ce qui change aussi.** Le doubleur agrandit les défauts de l'objectif avec l'image : un peu moins de piqué, un peu plus de franges colorées. Et la profondeur de champ diminue : à cadre égal, on travaille deux crans plus ouvert.\n\n**Quand s'en servir.** Seulement quand il faut plus serré que 54 mm. En dessous, le même cadre se fait sans doubleur, avec deux diaphragmes de lumière en plus.",
  vraie: "Le levier ×1 / ×2 est sous l'objectif, vers l'arrière (la pastille « doubleur » de la caméra 3D). Quand il est sur ×2, le viseur affiche EX, si l'indication est allumée (page VF DISPLAY du menu OPERATION) : la caméra le sait par le câble de l'objectif.\n\n**Le bon geste.** Basculer hors antenne : pendant le passage, l'image saute et s'assombrit. Prévenir la vision, qui va devoir ouvrir l'iris de deux crans ou monter le gain. Et remettre sur ×1 dès qu'on n'en a plus besoin.\n\n**L'erreur fréquente.** Laisser le doubleur engagé en revenant au plan large : on cadre à 9 mm au lieu de 4,5 mm, avec deux diaphragmes de moins, et on se demande pourquoi l'image est sombre et bruitée. Ou régler le tirage doubleur sur ×2.",
  plus: "- **Doubleur optique et doubleur numérique.** Le D.EXT de la caméra agrandit l'image électroniquement : pas de lumière perdue, mais il recadre l'image et agrandit les pixels, donc perd du détail. Le doubleur optique garde la résolution du capteur et perd de la lumière.\n- **D'autres rapports.** Les grands zooms de stade ont souvent deux doubleurs, ×1,2 et ×2 : le ×1,2 ne coûte qu'un demi-diaphragme (1,2² = 1,44).\n- **Le calcul.** Le nombre f, c'est la focale divisée par la pupille d'entrée. Le doubleur double la focale sans toucher à la pupille : le nombre f double, la lumière est divisée par 2² = 4.\n- **Le quart central.** Avec le doubleur, le capteur ne voit plus que la partie centrale de l'image formée par l'objectif : la moitié de sa largeur, la moitié de sa hauteur, agrandies sur tous les photosites. Un recadrage numérique du même centre n'en garderait qu'un sur quatre.",
  car: "Au stade, les cadreurs de tribune s'en servent pour les serrés sur le banc de touche ou les tribunes d'en face, et la vision le voit tout de suite : l'iris s'ouvre de deux crans, ou le gain monte. En nocturne, un doubleur engagé, c'est souvent une image plus bruitée que les autres caméras.",
  quiz: [
    {
      q: 'Zoom à 54 mm, f/2,4. On engage le doubleur. Quelle focale, quelle ouverture ?',
      a: [
        ['108 mm à f/2,4 : le doubleur ne touche pas à l\'iris.', 'L\'iris ne bouge pas, mais le nombre f double avec la focale : la pupille, elle, reste la même.'],
        ['108 mm à f/4,8 : deux diaphragmes de moins.', 'Exact : la focale double, le nombre f aussi, la lumière est divisée par quatre.'],
        ['54 mm à f/4,8 : il ne fait que fermer l\'iris.', 'Le doubleur change bien la focale : le cadre est deux fois plus serré.'],
      ],
      ok: 1,
    },
    {
      q: 'Pourquoi la lumière est-elle divisée par quatre et pas par deux ?',
      a: [
        ['Parce que l\'image est agrandie deux fois en largeur et deux fois en hauteur : la même lumière s\'étale sur une surface quatre fois plus grande.', 'Exact : 2 × 2 = 4, soit deux diaphragmes.'],
        ['Parce que les lentilles du doubleur absorbent les trois quarts de la lumière.', 'Elles n\'absorbent presque rien : c\'est l\'étalement de l\'image qui fait la perte.'],
        ['Parce que la caméra baisse le gain de 12 dB.', 'Le gain ne change pas : la perte est optique.'],
      ],
      ok: 0,
    },
    {
      q: 'Le réalisateur veut un cadre à 40 mm. Le cadreur le fait au doubleur, à 20 mm × 2. Bonne idée ?',
      a: [
        ['Oui : le doubleur donne un meilleur piqué.', 'C\'est l\'inverse : il agrandit aussi les défauts de l\'objectif.'],
        ['Oui, c\'est la même chose : même focale, même image.', 'Même cadre, mais deux diaphragmes de lumière en moins, et un peu moins de piqué.'],
        ['Non : 40 mm se fait sans doubleur, avec deux diaphragmes de lumière en plus.', 'Exact : le doubleur ne sert qu\'au-delà de 54 mm, là où le zoom seul ne va pas.'],
      ],
      ok: 2,
    },
  ],
  see: ['zoom', 'focale', 'ramping', 'iris', 'monture', 'gain'],
  ref: 'Fiche Fujinon ZA12x4.5BERD : doubleur ×2 intégré, 9–108 mm, angle de champ 56,1° × 33,3° à 9 mm et 5,1° × 2,9° à 108 mm ; mode d\'emploi HXC-FB80 : indications EX et D.EXT de la page VF DISPLAY',
  competences: ['2.9'],
};

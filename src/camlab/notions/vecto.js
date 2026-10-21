// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Le vectorscope ». BT.709 : Y′ = 0,2126 R′ + 0,7152 V′ + 0,0722 B′, Cb = (B′ − Y′) ÷ 1,8556,
// Cr = (R′ − Y′) ÷ 1,5748 (Cb et Cr de −0,5 à +0,5). Cibles des barres à 75 % calculées ainsi
// (camlab/labs/ch89.js, barVector) : R 103°, Mg 50°, B 355°, Cy 283°, G 230°, Yl 175°, mesurés
// depuis l'axe Cb ; en BT.601 (SD), le rouge passe à 109°. Barres 100/0/75/0 (nomenclature ITU-R
// BT.471, mire EBU du car). Ligne des carnations à 123° (l'axe I du NTSC), celle du PRISM. Mode
// d'emploi HXC-FB80 : OUTPUT/AUTO KNEE (BARS, CAM), PAINT P06 SATURATION, P14 USER MATRIX. La
// manipulation (« vecto ») calcule la caméra sous tungstène balancée pour le jour (optics.js, castOf).
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const VECTO = {
  t: 'Le vectorscope', aka: 'Vectorscope ; teinte et saturation, cibles des barres, ligne des carnations', chap: 8, lot: 3, point: 'mesure',
  short: 'Lire les couleurs : la teinte en angle, la saturation en distance du centre, les barres dans leurs cibles, les visages sur la ligne des carnations.',
  fig: 'vecto',
  lab: 'vecto',
  cours: 'signal-couleur',
  body: "**Ce que trace l'appareil.** Le vectorscope ne montre que la couleur. Pour chaque point de l'image, il calcule ses deux différences de couleur, Cb (le bleu moins la luminance) et Cr (le rouge moins la luminance), et place le point : Cb à l'horizontale, Cr à la verticale. La luminance n'y est pas : c'est le travail de la forme d'onde.\n\n**Deux lectures.**\n- **L'angle donne la teinte.** En BT.709, en tournant depuis l'axe Cb : le bleu vers 355°, le magenta vers 50°, le rouge vers 103°, le jaune vers 175°, le vert vers 230°, le cyan vers 283°. Chaque couleur a sa complémentaire à l'opposé.\n- **La distance au centre donne la saturation.** Au centre, le blanc, les gris et le noir ; plus loin, des couleurs plus vives.\n\n**Les cibles.** Le graticule porte six cases, une par barre de couleur. Les barres les plus courantes sont à 75 % (la mire EBU 100/0/75/0 du car, la sortie BARS du module) : chaque tache doit tomber dans sa case 75 %. Si toutes y tombent, la chaîne entre la caméra et l'appareil ne déforme pas les couleurs. Avec les cases d'une mire 100 %, les mêmes taches tombent un peu à l'intérieur, du côté du centre : ce n'est pas une panne, ce sont les mauvaises cibles.\n\n**Ce que la caméra y montre.**\n- **La balance** : un gris bien balancé est une petite tache au centre exact ; décalée vers le rouge, l'image est trop chaude. En zoom ×5, on la juge au pour cent près.\n- **La saturation** : plus de saturation éloigne les points du centre, sans les faire tourner.\n- **La matrice** : elle fait tourner certaines teintes ; c'est elle qui rend juste un rouge qui tire sur l'orange, ou qui raccorde deux caméras.\n- **Les visages** : quelle que soit la couleur de la peau, ils tombent près d'une même ligne, vers 123°, entre le rouge et le jaune : la ligne des carnations. Plus ou moins loin du centre, presque jamais à un autre angle. Un visage à côté de la ligne a une teinte fausse.",
  vraie: "Sur la HXC-FB80, le commutateur OUTPUT/AUTO KNEE sur BARS fait sortir les barres de la caméra : c'est par elles qu'on vérifie la liaison jusqu'au vectorscope du car. Les réglages qui se lisent au vectorscope sont dans le menu PAINT (page P06 SATURATION, page P14 USER MATRIX) et, reliée à la CCU, sur le RCP de la vision : les gains R et B, la saturation, la matrice.\n\n**Le bon geste.** Toujours dans cet ordre : les barres d'abord (si elles ne tombent pas dans leurs cibles, le problème est dans la chaîne, pas dans la caméra) ; puis une charte grise en zoom ×5, pour la balance ; puis l'image, les visages sur la ligne des carnations.\n\n**L'erreur fréquente.** Prendre les cibles 100 % pour des barres à 75 % et « rattraper » une saturation qui était juste. Ou corriger la couleur d'un visage à l'œil, sur un moniteur qui n'est pas réglé.",
  plus: "- **Les formules (BT.709).** Y′ = 0,2126 R′ + 0,7152 V′ + 0,0722 B′ ; Cb = (B′ − Y′) ÷ 1,8556 ; Cr = (R′ − Y′) ÷ 1,5748. Cb et Cr vont de −0,5 à +0,5. La barre rouge à 75 % est à 0,385 du centre (77 % de 0,5), la magenta à 0,447 (89 %).\n- **601 ou 709.** La SD (BT.601) n'a pas les mêmes coefficients : les cibles tournent de quelques degrés, le rouge passe de 103° à 109°. Un appareil qui décode une image HD avec la matrice de la SD sort toutes les barres de leurs cases : une erreur de réglage fréquente dans les convertisseurs.\n- **La ligne des carnations** vient de l'axe I de la télévision couleur américaine (NTSC). On la garde parce qu'elle tombe sur les visages.\n- **Le gamut.** Le vectorscope ne dit pas tout : une couleur peut rester dans le cercle et donner un rouge à 108 %. Le diamant et le lightning du PRISM le montrent.",
  car: "Au poste vision, le vectorscope du PRISM porte les cibles 75 % de la mire du car (EBU 100/0/75/0) et un zoom ×5 pour juger la balance. À chaque line-up, l'ingénieur vision y vérifie les barres de chaque CCU, puis les gris et les visages de chaque caméra, pour qu'elles se raccordent.",
  quiz: [
    {
      q: 'Sur le vectorscope, une tache s\'éloigne du centre sans tourner. Qu\'est-ce qui a changé ?',
      a: [
        ['La teinte.', 'La teinte, c\'est l\'angle : il n\'a pas bougé.'],
        ['La saturation.', 'Exact : la distance au centre, c\'est la saturation ; l\'angle, la teinte, est resté le même.'],
        ['La luminance.', 'Le vectorscope ne montre pas la luminance : un gris clair et un gris sombre sont tous deux au centre. C\'est la forme d\'onde qui la mesure.'],
      ],
      ok: 1,
    },
    {
      q: 'En zoom ×5, sur la charte grise, la tache des gris est décalée vers la cible du rouge. L\'image est…',
      a: [
        ['trop rouge : on baisse le gain R, ou on refait la balance.', 'Exact : un gris doit être au centre exact ; décalé vers le rouge, il a trop de rouge.'],
        ['trop cyan : on monte le gain R.', 'Le cyan est à l\'opposé du rouge, vers 283° : une tache décalée vers le rouge veut dire trop de rouge, pas trop peu.'],
        ['juste : les gris ne sont jamais au centre exact.', 'Un gris bien balancé est au centre exact, à 1 % près en ×5 : un décalage, c\'est une dominante.'],
      ],
      ok: 0,
    },
    {
      q: 'Les barres de la caméra tombent toutes un peu à l\'intérieur de leurs cases, du côté du centre. Que vérifier d\'abord ?',
      a: [
        ['La saturation de la caméra : elle est trop basse.', 'Les barres sont fabriquées par la caméra, sans objectif ni lumière : avant de toucher à l\'image, on vérifie la mesure.'],
        ['Le câble SDI : il affaiblit les couleurs.', 'Un câble numérique ne pâlit pas les couleurs : il les transmet intactes, ou il fait des erreurs.'],
        ['Les cibles choisies : 100 % au lieu de 75 %.', 'Exact : des barres à 75 % tombent aux trois quarts de la distance des cases 100 %. C\'est la première chose à regarder.'],
      ],
      ok: 2,
    },
  ],
  see: ['waveform', 'balance', 'matrice', 'mires', 'lineup', 'moniteur', 'rcp'],
  ref: 'ITU-R BT.709 : Y′ = 0,2126 R′ + 0,7152 V′ + 0,0722 B′, Cb = (B′ − Y′) ÷ 1,8556, Cr = (R′ − Y′) ÷ 1,5748 ; ITU-R BT.601 (coefficients de la SD) ; barres 100/0/75/0 (nomenclature ITU-R BT.471) ; ligne des carnations à 123° (axe I) ; mode d\'emploi HXC-FB80 : OUTPUT/AUTO KNEE (BARS, CAM), PAINT P06 SATURATION et P14 USER MATRIX',
  competences: ['2.2', '1.4'],
};

// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Matrice de couleurs et saturation ». ITU-R BT.709-6 : primaires (CIE 1931) R 0,640 ;
// 0,330, V 0,300 ; 0,600, B 0,150 ; 0,060, blanc D65 0,3127 ; 0,3290 ; Y' = 0,2126 R' + 0,7152 G'
// + 0,0722 B' ; Cb = (B' − Y') / 1,8556, Cr = (R' − Y') / 1,5748. Matrice sous la forme des
// réglages R-G, R-B, G-R, G-B, B-R, B-G : chaque voie reçoit une part de sa différence avec une
// autre, chaque ligne fait 1, le blanc et les gris ne bougent pas. Ligne des chairs du
// vectorscope : 123° (l'axe I du NTSC). Mode d'emploi HXC-FB80 : menu PAINT, P01 SW STATUS
// (MATRIX), P06 SATURATION (SATURATION, LOW KEY SAT), P14 USER MATRIX ; brochure Sony : matrice
// multiple (multi-matrix). La manipulation (camlab/labs/ch4.js, « matrice ») raccorde une CAM 2
// (G-R de −0,10, saturation × 1,12) sur la CAM 1 : il faut G-R = +0,11 et une saturation de 89 %.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const MATRICE = {
  t: 'Matrice de couleurs et saturation', aka: 'Matrice linéaire, USER MATRIX, multi-matrix ; saturation', chap: 4, lot: 3, point: 'menu',
  short: 'Le réglage qui rend les couleurs justes en BT.709, et qui permet de raccorder deux caméras qui ne rendent pas le même rouge.',
  fig: 'matrice',
  lab: 'matrice',
  cours: 'expl-lineup',
  body: "**Pourquoi une matrice.** Les filtres du prisme ne séparent pas la lumière exactement comme les primaires de la norme : le capteur rouge voit un peu de vert, le vert un peu de rouge et de bleu. La caméra corrige en **mélangeant** ses trois voies : chaque couleur de sortie est faite d'un peu de chaque voie d'entrée. Ce calcul à neuf coefficients, c'est la **matrice**. Elle est réglée en usine pour que les couleurs tombent sur les primaires de la HD (ITU-R BT.709).\n\n**Le blanc ne bouge pas.** Les réglages de la matrice ajoutent à chaque voie une part de sa différence avec une autre : rouge moins vert, rouge moins bleu… Sur un blanc ou un gris, rouge, vert et bleu sont égaux, les différences sont nulles : rien ne change. La balance reste juste ; seules les couleurs tournent.\n\n**La saturation.** Elle rapproche toutes les couleurs du gris (moins saturé) ou les en éloigne (plus saturé), sans changer leur teinte ni leur luminance.\n\n**Au vectorscope.** La teinte est l'angle autour du centre, la saturation la distance au centre. Les carnations se rangent près d'une même direction, la **ligne des chairs**, vers 123°.\n\n**Raccorder deux caméras.** Deux modèles, deux marques, deux caméras d'âge différent ne rendent pas le même rouge : un maillot tire vers l'orange sur l'une, vers le magenta sur l'autre. On choisit une caméra de référence, on filme la même mire avec les deux, sous la même lumière, et on règle la matrice de l'autre jusqu'à ce que ses couleurs tombent sur les mêmes points du vectorscope ; la saturation ensuite. On vérifie toujours un visage : une carnation qui change d'une caméra à l'autre se voit tout de suite.",
  vraie: "Sur la FB80, la page P14 USER MATRIX du menu PAINT donne les six réglages R-G, R-B, G-R, G-B, B-R et B-G ; la page P06 SATURATION règle la saturation, et LOW KEY SAT celle des tons sombres ; la page P01 SW STATUS allume ou coupe MATRIX. La caméra a aussi une matrice multiple (multi-matrix), qui ne tourne qu'une plage de teintes. Reliée à la CCU, tout se règle au RCP.\n\n**Le bon geste.** Raccorder sur une mire de couleurs filmée par les deux caméras, sous la même lumière, au vectorscope ; puis vérifier sur un visage. Noter les valeurs et les garder dans un fichier de scène.\n\n**L'erreur fréquente.** Corriger une dominante de toute l'image avec la matrice : c'est le travail de la balance des blancs. Ou pousser la saturation pour faire plus beau : les rouges et les bleus sortent de ce que le signal et l'écran savent montrer, et bavent.",
  plus: "- **Les primaires BT.709** (diagramme CIE 1931) : rouge x 0,640 et y 0,330 ; vert 0,300 et 0,600 ; bleu 0,150 et 0,060 ; blanc D65 0,3127 et 0,3290.\n- **La luminance** : Y' = 0,2126 R' + 0,7152 V' + 0,0722 B' (BT.709). La saturation garde ce Y' et ne change que les différences de couleur, Cb et Cr.\n- **Les tons sombres.** LOW KEY SAT règle la saturation des basses lumières seulement, souvent trop pâles ou trop vives selon les caméras.\n- **Le gamut.** Une couleur très saturée peut demander du rouge, du vert ou du bleu sous 0 ou au-dessus de 100 % : le diamant du PRISM et les légaliseurs la surveillent.\n- **La ligne des chairs** vient de l'axe I du NTSC, à 123° : quelle que soit la couleur de la peau, la teinte d'un visage tombe près de cette direction ; c'est sa saturation et sa luminance qui changent.",
  car: "Dans le car, le matching se fait au line-up : toutes les HDC sur la caméra de référence, souvent la caméra 1, au vectorscope du PRISM. Au poste vision du simulateur, SATURATION est sur l'écran du RCP et la touche MATRIX coupe la matrice : la pelouse et les maillots doivent garder la même couleur à chaque coupe, quelle que soit la caméra.",
  quiz: [
    {
      q: 'Pourquoi la matrice ne change-t-elle pas le blanc ?',
      a: [
        ['Parce qu\'elle ne règle que le rouge.', 'Elle mélange les trois voies, rouge, vert et bleu.'],
        ['Parce que la balance des blancs la coupe.', 'Les deux réglages coexistent : la balance d\'abord, la matrice ensuite.'],
        ['Parce qu\'elle ajoute à chaque voie des différences entre voies, nulles sur un blanc ou un gris.', 'Exact : rouge, vert et bleu égaux, toutes les différences sont nulles.'],
      ],
      ok: 2,
    },
    {
      q: 'Le rouge de la CAM 2 tire vers l\'orange par rapport à la CAM 1 ; le blanc et les gris sont justes. Que règle-t-on ?',
      a: [
        ['La matrice de la CAM 2, jusqu\'à ce que son rouge tombe sur celui de la CAM 1 au vectorscope.', 'Exact : puis on vérifie la saturation et un visage.'],
        ['La balance des blancs de la CAM 2.', 'Le blanc est juste : la balance n\'y est pour rien.'],
        ['La saturation de la CAM 2.', 'La saturation ne change pas la teinte, seulement la distance au centre.'],
      ],
      ok: 0,
    },
    {
      q: 'Au vectorscope, que montre la distance d\'un point au centre ?',
      a: [
        ['Sa luminance.', 'La luminance ne se lit pas au vectorscope : c\'est la forme d\'onde.'],
        ['Sa saturation.', 'Exact : le centre est le gris ; plus on s\'en éloigne, plus la couleur est saturée. L\'angle donne la teinte.'],
        ['Sa teinte.', 'La teinte, c\'est l\'angle autour du centre.'],
      ],
      ok: 1,
    },
  ],
  see: ['balance', 'prisme', 'vecto', 'lineup', 'gamma', 'fichiers'],
  ref: 'ITU-R BT.709-6 (primaires R 0,640 ; 0,330, V 0,300 ; 0,600, B 0,150 ; 0,060, blanc D65 0,3127 ; 0,3290 ; Y\' = 0,2126 R\' + 0,7152 G\' + 0,0722 B\') ; mode d\'emploi HXC-FB80 : menu PAINT, pages P01 SW STATUS (MATRIX), P06 SATURATION (LOW KEY SAT), P14 USER MATRIX (R-G, R-B, G-R, G-B, B-R, B-G)',
  competences: ['1.2', '2.9'],
};

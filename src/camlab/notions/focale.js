// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Focale et angle de champ ». Capteur 2/3" 16:9 : zone image 9,59 × 5,39 mm. Angle de
// champ horizontal 2·arctan(9,59 / 2f) : 93,6° à 4,5 mm, 10,2° à 54 mm. Largeur du champ à la
// distance D : D × 9,59 / f. Équivalence plein format (36 mm de large) : × 3,75 environ.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const FOCALE = {
  t: 'Focale et angle de champ', aka: 'Focal length, angle of view', chap: 1, lot: 1, point: 'zoom',
  short: 'La focale fixe l\'angle de champ : 4,5 mm voit large, 54 mm voit serré. Sur un capteur 2/3", une même focale cadre plus serré que sur un grand capteur.',
  fig: 'focale',
  lab: 'focale',
  body: "**La focale.** C'est la distance, en millimètres, entre le centre optique de l'objectif et l'image nette qu'il forme d'un sujet lointain. Le zoom de la caméra va de 4,5 à 54 mm : sa focale change quand on tourne la bague de zoom.\n\n**L'angle de champ.** Le capteur a une taille fixe : 9,59 × 5,39 mm pour un 2/3\" en 16:9. Plus la focale est longue, plus l'image du sujet est grande sur le capteur, et moins il reste de place autour. L'angle de champ horizontal vaut 2 × arctan(9,59 ÷ 2f) :\n- à 4,5 mm : 94°, le grand angle ;\n- à 25 mm : 22° ;\n- à 54 mm : 10°, le téléobjectif.\n\n**Le champ à une distance donnée.** Largeur du champ = distance × 9,59 ÷ focale. À 3 m, le grand angle couvre 6,4 m de large, le serré 53 cm. C'est le calcul qu'on fait pour placer une caméra : à quelle distance du sujet, avec quelle focale, pour quel cadre.\n\n**La taille du capteur compte.** Une focale ne dit rien sans la taille du capteur. Sur un capteur photo plein format (36 mm de large), il faudrait une focale environ 3,8 fois plus longue pour le même cadre : le 4,5–54 mm de la caméra cadre comme un 17–200 mm en photo.",
  vraie: "La focale se lit sur la bague de zoom (gravures 4.5, 8, 15, 30, 50) et dans le viseur : l'affichage ZOOM indique la position du zoom (page VF DISPLAY du menu OPERATION). Sur le plateau, la même caméra doit tenir le plan large du décor et le gros plan d'un visage : c'est pour cela qu'on lui met un zoom et non une focale fixe.\n\n**Le bon geste.** Choisir d'abord la place de la caméra, puis la focale. Une focale courte de très près déforme les visages (le nez grossit) ; une focale longue de loin aplatit l'image et rapproche les plans. Pour un visage, on recule la caméra et on serre.\n\n**L'erreur fréquente.** Confondre zoom et travelling. Zoomer agrandit l'image sans changer le point de vue : la perspective reste la même. Seul un déplacement de la caméra change la perspective.",
  plus: "- **Le doubleur.** Le levier ×2 de l'objectif double toutes les focales (9–108 mm), mais coûte deux diaphragmes de lumière.\n- **La focale « normale ».** Sur un 2/3\", une focale d'environ 11 mm, la diagonale du capteur, donne un angle proche de celui de l'œil qui regarde sans tourner la tête.\n- **Les objectifs de stade.** Les grands zooms box des caméras de tribune dépassent 800 mm : à 80 m, ils cadrent un joueur en pied. En serré, leur angle de champ tombe sous le degré.",
  car: "Dans le car, le réalisateur demande des valeurs de plan (plan large, plan moyen, gros plan), pas des focales. Le cadreur choisit la focale qui donne ce plan depuis sa position : en tribune, la caméra principale cadre tout le terrain en grand angle, puis serre sur un joueur à 80 m.",
  quiz: [
    {
      q: 'La caméra est à 3 m de la mire, le zoom à 54 mm. Quelle largeur de décor voit-on ?',
      a: [
        ['Environ 6,4 m', 'C\'est le champ du grand angle (4,5 mm). À 54 mm, la focale est 12 fois plus longue : le champ est 12 fois plus étroit.'],
        ['Environ 53 cm', 'Exact : 3 m × 9,59 ÷ 54 = 0,53 m. Le centre de la mire, à peine plus.'],
        ['Environ 1,6 m', 'Ce serait le champ vers 18 mm.'],
      ],
      ok: 1,
    },
    {
      q: 'Sans bouger la caméra, on passe de 10 mm à 20 mm. Que devient la largeur du champ ?',
      a: [
        ['Elle est divisée par deux.', 'Exact : la largeur du champ est inversement proportionnelle à la focale.'],
        ['Elle est divisée par quatre.', 'C\'est la surface du champ qui est divisée par quatre, pas sa largeur.'],
        ['Elle ne change pas : seule la netteté change.', 'Changer de focale, c\'est changer le cadre.'],
      ],
      ok: 0,
    },
    {
      q: 'Un objectif de 25 mm donne-t-il le même cadre sur un capteur 2/3" et sur un capteur plein format ?',
      a: [
        ['Oui : la focale seule fixe le cadre.', 'L\'angle de champ dépend aussi de la taille du capteur.'],
        ['Non : sur le plein format, le cadre est plus serré.', 'C\'est l\'inverse : avec la même focale, le grand capteur voit plus large.'],
        ['Non : sur le 2/3", plus petit, le cadre est plus serré.', 'Exact : le petit capteur ne garde que le centre de l\'image, environ 3,8 fois plus serré.'],
      ],
      ok: 2,
    },
  ],
  see: ['zoom', 'doubleur', 'pdc', 'capteur', 'grandcapteur'],
  ref: 'Format 2/3" 16:9 : zone image 9,59 × 5,39 mm ; Fujinon ZA12x4.5BERD : 4,5–54 mm, angle de champ horizontal 94° à 4,5 mm, 10° à 54 mm',
  competences: ['2.9'],
};

// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Le ramping ». Fiche Fujinon ZA12x4.5BERD : ouverture maximale 1:1,8 de 4,5 à 41 mm, 1:2,4 à
// 54 mm ; avec le doubleur ×2, f/3,6 puis f/4,8 à 108 mm. Pupille d'entrée = focale ÷ nombre f :
// 41 ÷ 1,8 = 22,8 mm, 54 ÷ 2,4 = 22,5 mm. Perte au bout du zoom : 2 × log2(2,4 ÷ 1,8) = 0,83
// diaphragme, (1,8 ÷ 2,4)² = 56 % de la lumière. Entre 41 et 54 mm, optics.js (maxAperture) garde la
// pupille constante : f/1,8 × f ÷ 41, plafonné à f/2,4. La manipulation (camlab/labs/ch1.js,
// « ramping ») zoome iris grand ouvert sur un plateau peu éclairé, puis cherche l'ouverture qui ne
// bouge plus.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const RAMPING = {
  t: 'Le ramping', aka: 'Perte d\'ouverture au long foyer ; F-drop', chap: 1, lot: 2, point: 'zoom',
  short: 'Au bout du zoom, l\'objectif perd de la lumière : f/1,8 jusqu\'à 41 mm, puis f/2,4 à 54 mm. L\'image s\'assombrit si l\'iris est déjà grand ouvert.',
  fig: 'ramping',
  lab: 'ramping',
  body: "**Ce qu'on voit.** Iris grand ouvert, on zoome du large au serré : jusqu'à 41 mm, rien ne bouge ; ensuite l'image s'assombrit peu à peu, jusqu'à la butée. Sur la forme d'onde, le blanc descend. L'affichage de l'iris passe de f/1,8 à f/2,4.\n\n**Pourquoi.** Le nombre f est le rapport focale ÷ diamètre de la pupille d'entrée, le trou de l'iris vu à travers l'avant de l'objectif. Pour garder f/1,8 quand la focale augmente, il faudrait une pupille de plus en plus grande : à 41 mm, 41 ÷ 1,8 = 22,8 mm. Au-delà, les lentilles de devant ne laissent plus passer un faisceau plus large : la pupille reste vers 22,5 mm, et c'est le nombre f qui grandit. À 54 mm : 54 ÷ 22,5 = f/2,4.\n\n**Combien.** De f/1,8 à f/2,4, la lumière est multipliée par (1,8 ÷ 2,4)² = 0,56 : un peu moins d'un diaphragme (0,83). Avec le doubleur engagé, tout est multiplié par deux : f/3,6 jusqu'à 82 mm, f/4,8 à 108 mm.\n\n**Quand ça compte.** Seulement quand l'iris est plus ouvert que ce que permet la focale. À f/2,8 ou plus fermé, l'objectif donne cette ouverture sur toute la course du zoom : pas de ramping du tout. C'est en lumière faible, iris en butée, qu'il se voit :\n- un zoom avant à l'antenne qui s'assombrit au dernier moment ;\n- un serré qui demande plus de gain que le large.\n\n**La parade.** Si l'on sait qu'un zoom va partir à l'antenne, l'iris réglé à f/2,4 au lieu de f/1,8 : un peu moins de lumière au large, mais la même du large au serré. Ou rester sous 41 mm.",
  vraie: "Rien à régler sur l'objectif : le ramping est dans sa construction, il est écrit sur sa fiche (1:1,8 de 4,5 à 41 mm, 1:2,4 à 54 mm). Il se lit dans le viseur, sur l'affichage IRIS (page VF DISPLAY du menu OPERATION), et au RCP.\n\n**Le bon geste.** Avant un plan qui finit en serré dans une lumière faible, essayer le zoom en entier en regardant la forme d'onde. Si le blanc descend en fin de course, refermer l'iris jusqu'à ce qu'il ne bouge plus, et compenser ailleurs (la lumière du plateau, ou le gain) plutôt que de le découvrir à l'antenne.\n\n**L'erreur fréquente.** Croire que l'iris automatique va rattraper la perte : il est déjà grand ouvert, il n'a plus de marge. Ou chercher une panne d'iris : l'objectif fait exactement ce que dit sa fiche.",
  plus: "- **Un objectif de stade aussi.** Les grands zooms box ont le même comportement, bien plus loin : un UA80x9 garde f/1,7 jusqu'à 350 mm, puis descend à f/3,5 à 720 mm. Leur pupille fait 350 ÷ 1,7 ≈ 206 mm : c'est la taille de leur lentille frontale qui coûte cher et pèse lourd.\n- **Pourquoi ne pas faire plus grand ?** Pour garder f/1,8 jusqu'à 54 mm, il faudrait une pupille de 30 mm, donc un groupe frontal plus gros : un objectif plus lourd et plus cher, pour un serré qui sert peu sur un plateau.\n- **Les objectifs de cinéma.** Beaucoup de zooms de cinéma n'ont pas de ramping : leur ouverture est la même sur toute la course, au prix d'un rapport de zoom plus faible et d'une ouverture plus modeste.\n- **Et la profondeur de champ.** Au bout du zoom, f/2,4 au lieu de f/1,8 : la zone nette est un peu plus profonde que prévu. Le ramping ne change pas le point, seulement la lumière.",
  car: "Dans le car, la vision le connaît pour chaque objectif : en nocturne, iris en butée, la caméra principale perd un peu de lumière quand le cadreur serre sur un joueur ; l'ingénieur vision anticipe au gain, ou garde un iris un peu fermé pour que le serré et le large se raccordent.",
  quiz: [
    {
      q: 'Iris à f/1,8, on zoome de 4,5 à 54 mm. Que devient la lumière reçue par le capteur ?',
      a: [
        ['Elle ne change pas : le nombre f compense la focale.', 'C\'est vrai jusqu\'à 41 mm. Au-delà, l\'objectif ne peut plus tenir f/1,8.'],
        ['Elle diminue d\'un peu moins d\'un diaphragme entre 41 et 54 mm : l\'ouverture passe à f/2,4.', 'Exact : (1,8 ÷ 2,4)² = 0,56, soit 0,83 diaphragme.'],
        ['Elle est divisée par quatre au bout du zoom.', 'Ce serait deux diaphragmes, comme le doubleur. Le ramping de cet objectif est plus faible.'],
      ],
      ok: 1,
    },
    {
      q: 'L\'iris est à f/4. Le cadreur zoome du large au serré. L\'image s\'assombrit-elle ?',
      a: [
        ['Oui, d\'un peu moins d\'un diaphragme au bout.', 'Seulement si l\'iris est plus ouvert que f/2,4. À f/4, l\'objectif tient cette ouverture partout.'],
        ['Oui, mais l\'iris automatique la corrige.', 'Il n\'y a rien à corriger : à f/4, pas de ramping.'],
        ['Non : f/4 est plus fermé que f/2,4, l\'objectif donne f/4 sur toute la course du zoom.', 'Exact : le ramping ne mord que sur un iris plus ouvert que ce que permet la focale.'],
      ],
      ok: 2,
    },
    {
      q: 'Pourquoi l\'ouverture se ferme-t-elle au bout du zoom ?',
      a: [
        ['Parce que la pupille d\'entrée ne peut plus grandir : au-delà de 41 mm, elle reste vers 22,5 mm, et le nombre f = focale ÷ pupille augmente.', 'Exact : 41 ÷ 1,8 = 22,8 mm ; 54 ÷ 22,5 = 2,4.'],
        ['Parce que l\'iris se ferme mécaniquement quand la bague de zoom tourne.', 'Les lames de l\'iris ne bougent pas : c\'est le faisceau qui est limité par les lentilles de devant.'],
        ['Parce que la caméra baisse le gain au téléobjectif.', 'Le gain ne dépend pas du zoom. Le ramping est optique.'],
      ],
      ok: 0,
    },
  ],
  see: ['iris', 'zoom', 'doubleur', 'exposition', 'gain', 'focale'],
  ref: 'Fiche Fujinon ZA12x4.5BERD : ouverture maximale 1:1,8 (4,5–41 mm), 1:2,4 (54 mm) ; doubleur ×2 : 9–108 mm ; nombre d\'ouverture N = f ÷ D (pupille d\'entrée) ; mode d\'emploi HXC-FB80 : affichage IRIS du viseur',
  competences: ['2.9', '1.4'],
};

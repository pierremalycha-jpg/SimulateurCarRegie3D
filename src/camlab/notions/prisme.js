// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Le prisme dichroïque ». Bloc à trois voies (type Philips) : deux surfaces à couches
// interférentielles, la première réfléchit le bleu, la seconde le rouge, le vert traverse tout
// droit. Chaque voie a son capteur 1920 × 1080, calé sur les deux autres à une fraction de
// photosite (5 µm). Luminance BT.709 : Y = 0,2126 R + 0,7152 G + 0,0722 B. La manipulation
// (camlab/labs/bloc.js, « prisme ») éteint les capteurs un à un et décale le rouge.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const PRISME = {
  t: 'Le prisme dichroïque', aka: 'Bloc prisme, bloc optique ; 3-CMOS, tri-capteur', chap: 2, lot: 1, point: 'bloc',
  short: 'Le bloc prisme sépare la lumière blanche en rouge, vert et bleu, et envoie chaque couleur sur son propre capteur. Les trois capteurs sont calés au pixel près.',
  fig: 'prisme',
  lab: 'prisme',
  body: "**Trois capteurs, une image.** Derrière l'objectif, un bloc de verre fait de trois prismes collés. Deux de ses faces internes portent une couche dichroïque : un empilement de couches très minces qui réfléchit une bande de couleurs et laisse passer les autres, par interférences, presque sans rien absorber.\n1. La première surface réfléchit le bleu vers le capteur bleu ; le reste continue.\n2. La seconde réfléchit le rouge vers le capteur rouge.\n3. Le vert traverse tout droit jusqu'au capteur vert.\n\nChaque capteur reçoit l'image complète de sa couleur, sur ses 1920 × 1080 photosites.\n\n**Pourquoi trois capteurs.** Un capteur unique voit la couleur grâce à une mosaïque de petits filtres collés sur les photosites (la matrice de Bayer) : un photosite sur quatre voit le rouge, un sur quatre le bleu, deux sur quatre le vert, et la caméra devine le reste. Avec trois capteurs, rien n'est deviné : chaque couleur est captée en pleine résolution, et aucun filtre n'absorbe la lumière, le prisme la trie. Le prix : un bloc lourd et coûteux, et des objectifs calculés pour traverser son verre, la monture B4.\n\n**Au pixel près.** Les trois images doivent se superposer à une fraction de photosite, soit mieux que deux ou trois micromètres. Les capteurs sont collés sur le prisme en usine, à la machine ; si l'un d'eux bouge, chaque contour de l'image prend un liseré coloré d'un côté et de la couleur complémentaire de l'autre. C'est le défaut de registration.\n\n**La voie verte.** Dans la luminance, le vert pèse plus de 70 %, le rouge 21 %, le bleu 7 % : c'est le capteur vert qui porte presque tout le détail de l'image. Le cadreur fait le point sur la voie verte (VF OUT sur G), plus nette que l'image couleur.\n\n**Devant les capteurs.** Sur chaque voie, un filtre passe-bas optique adoucit très légèrement l'image pour éviter le moiré, et un filtre arrête l'infrarouge. La roue des filtres ND est avant le prisme.",
  vraie: "Le prisme ne se voit pas : objectif démonté, on aperçoit sa face avant au fond de la monture, derrière la roue des filtres. On n'y touche jamais, on ne souffle pas dessus de près, et on remet le bouchon de monture aussitôt : une poussière sur la face avant du prisme est floue et passe presque inaperçue, mais sur un capteur, c'est une tache nette sur toutes les images.\n\n**Le bon geste.** Changer d'objectif vite, à l'abri, monture vers le bas. Vérifier la registration sur une mire en noir et blanc, avec la loupe du viseur : les branches de l'étoile doivent rester grises, sans liseré.\n\n**L'erreur fréquente.** Prendre pour un défaut de registration le liseré violet ou vert qu'on voit sur les bords du cadre, sur un contraste fort : c'est l'aberration chromatique de l'objectif, nulle au centre et plus forte dans les coins, pire avec le doubleur. Un vrai décalage de capteur est le même partout, au centre comme au bord.",
  plus: "- **Dichroïque, pas coloré.** Un filtre coloré absorbe ce qu'il arrête et chauffe. Une couche dichroïque réfléchit par interférences entre ses couches, d'épaisseur réglée au quart de longueur d'onde : la lumière arrêtée part ailleurs, elle n'est pas perdue. C'est ce qui donne au tri-capteur sa sensibilité.\n- **La lame d'air.** Entre le premier et le deuxième prisme, une très mince lame d'air fait réfléchir une seconde fois le bleu, par réflexion totale, pour le faire sortir sur le côté. Un bloc prisme n'est pas une pièce symétrique : chaque voie a sa longueur de verre, et le capteur est placé en conséquence.\n- **Le capteur unique.** Les caméras de cinéma et les caméras 4K grand capteur n'ont qu'un capteur, à mosaïque de Bayer : plus simple, des objectifs plus courts, mais une couleur interpolée et une profondeur de champ mince. Le direct multicaméra reste souvent au tri-capteur 2/3\".\n- **Avant.** Les tubes des années 1960 à 1980 (Plumbicon) étaient déjà trois, derrière un prisme ; puis trois CCD, puis trois CMOS. Le principe n'a pas changé.",
  car: "Dans le car, personne ne touche au prisme, mais la vision en voit la trace sur la forme d'onde en parade : trois signaux, rouge, vert et bleu, côte à côte. Une caméra dont un capteur a bougé montre un liseré coloré sur tous les contours : elle part en maintenance, ça ne se règle pas sur place.",
  quiz: [
    {
      q: 'Que fait la première surface dichroïque du bloc prisme ?',
      a: [
        ['Elle absorbe le bleu pour ne laisser passer que le rouge et le vert.', 'Elle ne l\'absorbe pas : elle le réfléchit vers son capteur. Un filtre absorbant perdrait de la lumière.'],
        ['Elle réfléchit le bleu vers le capteur bleu et laisse passer le reste.', 'Exact : une réflexion sélective par interférences, presque sans perte.'],
        ['Elle sépare la lumière en trois faisceaux d\'un coup.', 'Il faut deux surfaces : une pour le bleu, une pour le rouge ; le vert va tout droit.'],
      ],
      ok: 1,
    },
    {
      q: 'Quel est l\'avantage principal de trois capteurs sur un capteur unique à mosaïque de filtres (Bayer) ?',
      a: [
        ['Chaque couleur est captée en pleine résolution, sans rien deviner.', 'Exact : 1920 × 1080 photosites pour le rouge, autant pour le vert et pour le bleu.'],
        ['La caméra est plus petite et plus légère.', 'C\'est le contraire : le bloc prisme prend de la place et pèse.'],
        ['On peut monter n\'importe quel objectif.', 'C\'est l\'inverse : l\'objectif doit être calculé pour traverser le verre du prisme (monture B4).'],
      ],
      ok: 0,
    },
    {
      q: 'Sur chaque contour de l\'image, un liseré rouge d\'un côté et cyan de l\'autre, partout, même au centre. D\'où vient-il ?',
      a: [
        ['De l\'aberration chromatique de l\'objectif.', 'Elle est forte dans les coins et presque absente au centre. Ici, le décalage est le même sur toute l\'image.'],
        ['Du filtre ND, qui colore l\'image.', 'Un ND est neutre et ne décale rien.'],
        ['D\'un capteur rouge décalé par rapport aux deux autres : un défaut de registration.', 'Exact : le rouge ne se superpose plus au vert et au bleu. Caméra à la maintenance.'],
      ],
      ok: 2,
    },
  ],
  see: ['capteur', 'olpf', 'tirage', 'monture', 'matrice', 'defauts'],
  ref: 'Bloc prisme à trois voies, deux surfaces dichroïques ; Sony HXC-FB80 : trois capteurs CMOS 2/3" ; luminance BT.709 : Y = 0,2126 R + 0,7152 G + 0,0722 B',
  competences: ['2.9'],
};

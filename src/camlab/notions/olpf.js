// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Filtre passe-bas optique et filtre infrarouge ». Photosite 2/3" HD : 9,59 mm ÷ 1920 =
// 5 µm. Un motif est compté juste s'il couvre au moins deux photosites par période (Nyquist) :
// 100 paires de lignes par mm, 960 cycles sur la largeur. Au-delà, il se replie en franges
// fausses : le moiré. Filtre passe-bas biréfringent : des lames de quartz font d'un point deux
// puis quatre points, écartés de l'ordre d'un photosite (principe ; Sony ne publie pas le détail
// de ce filtre). Réponse d'un écart d'un photosite : cos(π f), nulle à la limite des deux
// photosites. Diffraction à f/5,6 : coupure 1 ÷ (0,55 µm × 5,6) = 325 cycles/mm. Chemise à
// rayures de 2 mm à 3 m : deux photosites par rayure vers 15 mm de focale ; mur LED au pas de
// 3,9 mm à 8 m : vers 20 mm. Infrarouge : l'œil voit de 400 à 700 nm environ, le silicium
// jusque vers 1100 nm ; filtre infrarouge coupant vers 700 nm (ordre de grandeur) ; LED de
// télécommande à 940 nm ; maximum d'une lampe à 3200 K : 2898 µm·K ÷ 3200 K = 906 nm (Wien).
// La manipulation (camlab/labs/ch23.js, « olpf ») : chemise, mur LED, tissu noir et télécommande.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const OLPF = {
  t: 'Filtre passe-bas optique et filtre infrarouge', aka: 'Optical low-pass filter (OLPF), IR cut filter ; moiré, repliement (aliasing)', chap: 2, lot: 3, point: 'bloc',
  short: 'Devant les capteurs, un filtre adoucit très légèrement l\'image pour éviter le moiré (un détail plus fin que deux photosites), un autre arrête l\'infrarouge invisible à l\'œil que le silicium verrait.',
  fig: 'olpf',
  lab: 'olpf',
  body: "**Compter avec des photosites.** Le capteur ne voit pas une image continue : il la découpe en 1920 photosites de 5 µm sur la largeur, et chacun donne une seule valeur. Pour qu'un motif régulier soit compté juste, il faut au moins deux photosites par période, un pour le clair, un pour le sombre : c'est la limite de **Nyquist**, ici 100 paires de lignes par millimètre de capteur. Plus fin, le motif n'est pas seulement perdu : il se **replie**, et les photosites dessinent une onde lente qui n'existe pas. Ce sont les franges du **moiré**.\n\n**Le filtre passe-bas optique.** C'est une lame de quartz, un cristal **biréfringent** : chaque rayon qui la traverse en ressort en deux, décalés de quelques micromètres. Deux lames croisées font de chaque point lumineux quatre points, à environ un photosite d'écart. Un détail plus fin que deux photosites est ainsi effacé avant d'être mal compté ; un détail plus gros passe presque intact. « Passe-bas » : il laisse passer les basses fréquences, les grands motifs, et arrête les hautes, les motifs trop fins. Son prix : une image un tout petit peu plus douce, que le **détail** de la caméra rattrape.\n\n**Pourquoi le moiré existe encore.** Le filtre est calculé pour la limite des deux photosites. Une chemise à rayures de 2 mm, à 3 m, tombe pile sur cette limite vers 15 mm de focale ; un mur LED au pas de 3,9 mm, à 8 m, vers 20 mm. Le filtre et l'objectif adoucissent le motif, ils ne l'effacent pas toujours : il reste des franges faibles, que le détail peut renforcer.\n\n**Le filtre infrarouge.** L'œil voit de 400 à 700 nm environ ; le silicium du capteur voit jusque vers 1100 nm. Sans filtre, l'infrarouge s'ajoute à l'image, surtout dans la voie rouge : les tissus noirs synthétiques virent au bordeaux, la végétation au rose, le blanc rosit, et la LED d'une télécommande (940 nm) brille. Une lampe tungstène en émet beaucoup : à 3200 K, son maximum est à 906 nm, dans l'infrarouge. Le filtre coupe tout ce qui dépasse 700 nm environ.",
  vraie: "On ne voit ni ne règle ces filtres : ils sont dans le bloc optique, devant les capteurs, et la fiche de la FB80 ne les décrit même pas. Ce qu'on voit, c'est ce qu'ils laissent passer : des franges qui ondulent sur une veste à chevrons, une chemise rayée ou un mur LED, qui bougent quand on zoome et changent quand la caméra se déplace.\n\n**Le bon geste.** Essayer les tenues à la caméra avant le direct : rayures fines, chevrons et petits carreaux sont les ennemis. Devant un mur LED, changer un peu la focale ou la distance, ou garder le mur légèrement hors de la zone nette : flou, il n'a plus de détail à replier. Baisser le détail de la caméra concernée.\n\n**L'erreur fréquente.** Appeler la maintenance pour un moiré : la caméra n'est pas en panne, c'est la scène. Ou monter le détail pour « piquer » l'image d'une veste rayée : il dessine les franges encore plus nettement.",
  plus: "- **Nyquist et Shannon.** Pour échantillonner un signal sans le replier, il faut au moins deux échantillons par période de sa composante la plus rapide. Le même théorème explique les 48 kHz du son : deux échantillons par période jusqu'à 24 kHz, au-delà de ce qu'on entend.\n- **L'iris filtre aussi.** À f/16, la tache de diffraction couvre quatre photosites : l'objectif devient lui-même un passe-bas, et l'image s'adoucit. À f/5,6, sa coupure est à 325 cycles/mm, plus de trois fois la limite du capteur.\n- **Le capteur unique.** Avec une mosaïque de Bayer, le rouge et le bleu ne sont mesurés qu'un photosite sur deux : le moiré y devient coloré (fausses couleurs). Le tri-capteur mesure les trois couleurs au même endroit et en a moins.\n- **En 4K.** Un capteur 2/3\" 4K a des photosites de 2,5 µm : sa limite est deux fois plus fine, et son filtre passe-bas aussi.\n- **Les ND et l'infrarouge.** Un filtre ND très dense placé devant l'objectif, sans traitement infrarouge, retire le visible et laisse l'infrarouge : les noirs virent au bordeaux. Les ND de qualité coupent aussi l'infrarouge.",
  car: "Au stade, les pièges à moiré sont les panneaux LED du bord du terrain, l'écran géant, le filet du but et les rangées de sièges vides. Les HDC-5500 du car, en 4K, ont des photosites de 2,5 µm : leur limite est plus fine, mais un plan large sur un panneau LED peut encore onduler. La vision baisse le détail de la caméra concernée, et le réalisateur change de focale ou de valeur de plan.",
  quiz: [
    {
      q: 'En plan large, une chemise à fines rayures se couvre de larges franges ondulées qui disparaissent en plan serré. Pourquoi ?',
      a: [
        ['En large, les rayures deviennent plus fines que deux photosites sur le capteur : elles se replient en franges qui n\'existent pas.', 'Exact : c\'est le moiré. En serré, chaque rayure couvre assez de photosites pour être comptée juste.'],
        ['Le filtre passe-bas est sale.', 'Une poussière fait une tache fixe, pas des franges qui changent avec le zoom.'],
        ['Le tissu bouge pendant le temps de pose.', 'Le mouvement donne du flou, pas des franges régulières.'],
      ],
      ok: 0,
    },
    {
      q: 'Que fait le filtre passe-bas optique ?',
      a: [
        ['Il coupe l\'infrarouge.', 'C\'est l\'autre filtre, le filtre infrarouge.'],
        ['Il retire de la lumière, comme un ND.', 'Il n\'en retire presque pas : il la déplace de quelques micromètres.'],
        ['Il étale chaque point sur environ deux photosites, pour effacer les détails trop fins avant qu\'ils soient mal comptés.', 'Exact : des lames de quartz biréfringentes, au prix d\'un très léger flou.'],
      ],
      ok: 2,
    },
    {
      q: 'Sans filtre infrarouge, sous des projecteurs tungstène, un costume noir synthétique paraîtrait…',
      a: [
        ['plus noir encore, l\'infrarouge étant invisible.', 'Invisible pour l\'œil, pas pour le silicium, qui le compte comme de la lumière.'],
        ['bordeaux ou violacé : il renvoie de l\'infrarouge, que le capteur voit surtout dans la voie rouge.', 'Exact : c\'est pour cela que le filtre est collé devant les capteurs.'],
        ['vert : l\'infrarouge entre dans la voie verte.', 'C\'est la voie rouge, qui reçoit les grandes longueurs d\'onde, qui en prend le plus.'],
      ],
      ok: 1,
    },
  ],
  see: ['prisme', 'capteur', 'nd', 'detail', 'defauts', 'iris'],
  ref: 'Échantillonnage : au moins deux photosites par période (Nyquist) ; photosite 2/3" HD : 9,59 mm ÷ 1920 = 5 µm, 100 paires de lignes par mm ; filtre passe-bas biréfringent (quartz) ; diffraction : coupure à 1 ÷ (λ N) ; loi de Wien : maximum à 2898 µm·K ÷ T, 906 nm à 3200 K ; LED infrarouge de télécommande : 940 nm',
  competences: ['2.9', '1.4'],
};

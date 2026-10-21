// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Le diaphragme ». Nombre d'ouverture N = focale ÷ diamètre de la pupille d'entrée.
// Chaque cran de l'échelle (1,8 · 2 · 2,8 · 4 · 5,6 · 8 · 11 · 16) divise la surface de la pupille,
// donc la lumière, par deux. Fujinon ZA12x4.5BERD : f/1,8 à f/16, puis C (fermé). Diffraction :
// tache d'Airy ≈ 2,44 × 0,55 µm × N, soit 11 µm à f/8, deux photosites de 5 µm. La manipulation
// (camlab/labs/optique.js, « iris ») expose la mire à l'iris, avec une lumière qui change.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const IRIS = {
  t: 'Le diaphragme', aka: 'Iris ; nombre d\'ouverture, nombre f (f-stop)', chap: 1, lot: 1, point: 'iris',
  short: 'L\'iris dose la lumière. Chaque cran du nombre f (1,8 · 2,8 · 4 · 5,6 · 8…) laisse passer deux fois moins de lumière que le précédent.',
  fig: 'iris',
  lab: 'iris',
  body: "**Ce qu'est l'iris.** Un jeu de lames, dans l'objectif, qui forme un trou de diamètre réglable. Plus le trou est grand, plus il entre de lumière. C'est le premier réglage de l'exposition, et le seul qui ne coûte ni bruit ni saccade.\n\n**Le nombre f.** On ne note pas le diamètre du trou en millimètres mais le rapport focale ÷ diamètre, écrit f/4 ou N = 4. À 20 mm de focale, f/4 est un trou de 5 mm. La lumière passe par la surface du trou, qui grandit avec le carré du diamètre : entre deux nombres f dans un rapport de 1,41 (√2), la surface, donc la lumière, change du simple au double. C'est l'échelle gravée sur la bague :\n- 1,8 · 2 · 2,8 · 4 · 5,6 · 8 · 11 · 16 ;\n- un cran = un diaphragme = deux fois moins de lumière ;\n- de f/2,8 à f/5,6, deux crans : quatre fois moins.\n\n**Pourquoi un rapport et pas des millimètres.** À f/4, l'exposition est la même à 4,5 mm (trou de 1,1 mm) et à 54 mm (trou de 13,5 mm) : au téléobjectif, l'image est plus grande, la lumière plus étalée, et le trou plus grand compense exactement. On peut zoomer sans réexposer. Seule exception : le ramping au bout du zoom.\n\n**Ouvert ou fermé.** Grand ouvert (f/1,8), beaucoup de lumière, très peu de profondeur de champ, et l'objectif est un peu moins piqué dans les coins. Très fermé (f/11, f/16), peu de lumière, beaucoup de profondeur de champ, mais la diffraction adoucit l'image : à f/16, la tache que fait un point lumineux couvre quatre photosites. La position C ferme complètement : image noire, c'est la position de la balance des noirs.\n\n**Où on se place.** Vers f/4 à f/5,6 : le meilleur piqué, une profondeur de champ confortable, et de la marge dans les deux sens. On atteint cette ouverture en réglant la lumière sur le plateau, ou avec les filtres ND dehors, pas l'inverse.",
  vraie: "La bague d'iris est à l'arrière de l'objectif, gravée 1.8 · 2 · 2.8 · 4 · 5.6 · 8 · 11 · 16 · C. Sur la poignée, le sélecteur A/M choisit l'iris automatique ou manuel ; en automatique, la caméra mesure l'image et commande le moteur de l'iris. Dans le viseur, l'affichage IRIS donne le nombre f en cours (page VF DISPLAY du menu OPERATION).\n\nReliée à la CCU, c'est le RCP de la vision qui commande l'iris, par le câble 12 broches de l'objectif : la bague tourne toute seule, le cadreur n'y touche pas.\n\n**Le bon geste.** Exposer sur ce qui compte, un visage ou le blanc de référence, pas sur le fond. Vérifier au zebra du viseur ou à la forme d'onde : les visages vers 60 à 70 %, le blanc sous 100 %.\n\n**L'erreur fréquente.** Laisser l'iris automatique pendant le direct : une chemise blanche qui entre dans le champ, et toute l'image s'assombrit d'un coup (le « pompage »). Ou rattraper un manque de lumière en ouvrant à f/1,8 sans voir que le point ne tient plus.",
  plus: "- **La pupille d'entrée.** Le trou physique est au milieu de l'objectif ; vu de l'avant, à travers la lentille frontale, il paraît plus grand. C'est ce trou apparent, la pupille d'entrée, que mesure le nombre f.\n- **Les nombres T.** Au cinéma, on grave des nombres T, qui tiennent compte de la lumière perdue dans le verre : T/2,8 laisse vraiment passer la lumière d'un f/2,8 parfait. Les objectifs broadcast restent en nombres f.\n- **Entre deux crans.** L'iris est continu : le RCP affiche f/4,2 ou f/5,0. Un tiers de cran, c'est déjà visible sur la forme d'onde.\n- **La diffraction.** La lumière qui passe par un petit trou s'étale : la tache d'un point vaut environ 2,44 × 0,55 µm × N. À f/5,6, 7,5 µm, un photosite et demi ; à f/16, 21 µm, quatre photosites. C'est pour cela que les filtres ND existent.",
  car: "Dans le car, la vision règle l'iris de toutes les caméras depuis les RCP, le manche sous la main, en regardant la forme d'onde : le cadreur ne touche jamais à la bague. Sur un plateau à une seule caméra, c'est le cadreur, en manuel, avec le zebra.",
  quiz: [
    {
      q: 'On passe de f/4 à f/8. La lumière reçue par le capteur…',
      a: [
        ['est divisée par deux.', 'Un cran divise par deux ; de 4 à 8, il y a deux crans (4 → 5,6 → 8).'],
        ['est divisée par quatre.', 'Exact : deux crans, deux fois deux.'],
        ['est divisée par huit.', 'Ce serait trois crans (4 → 5,6 → 8 → 11).'],
      ],
      ok: 1,
    },
    {
      q: 'Pourquoi f/4 à 54 mm expose-t-il comme f/4 à 4,5 mm, alors que le trou est douze fois plus grand ?',
      a: [
        ['Parce que le nombre f rapporte le trou à la focale : la lumière par unité de surface du capteur est la même.', 'Exact : à 54 mm, l\'image est plus grande et la lumière plus étalée ; le trou plus grand compense.'],
        ['Parce que la caméra corrige le gain pendant le zoom.', 'Aucun gain n\'intervient : le nombre f est une propriété de l\'optique.'],
        ['Il n\'expose pas pareil : au téléobjectif, l\'image est toujours plus sombre.', 'Seulement au-delà de 41 mm sur cet objectif, à cause du ramping, et de moins d\'un cran.'],
      ],
      ok: 0,
    },
    {
      q: 'Sur le plateau, l\'image est trop claire à f/5,6. Que fait-on en priorité ?',
      a: [
        ['On ferme l\'iris à f/16.', 'Ça expose juste, mais f/16 fait perdre du piqué (diffraction) et donne une profondeur de champ énorme.'],
        ['On raccourcit le shutter à 1/1000.', 'Ça expose moins, mais le mouvement devient saccadé. Ce n\'est pas l\'outil pour ça.'],
        ['On baisse la lumière ou on met un filtre ND, pour rester vers f/4 à f/5,6.', 'Exact : l\'iris est à sa meilleure place ; on agit sur la lumière qui arrive.'],
      ],
      ok: 2,
    },
  ],
  see: ['pdc', 'nd', 'exposition', 'ramping', 'rcp', 'gain'],
  ref: 'Nombre d\'ouverture N = f ÷ D (pupille d\'entrée) ; Fujinon ZA12x4.5BERD : f/1,8 (f/2,4 à 54 mm) à f/16 et C ; mode d\'emploi HXC-FB80 : commande de l\'iris par le RCP, affichage IRIS du viseur',
  competences: ['2.9'],
};

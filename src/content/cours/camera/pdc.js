// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « La profondeur de champ ». Cercle de confusion c = 0,011 mm (deux photosites de 5 µm,
// capteur 2/3"). Hyperfocale H = f² ÷ (N × c). Point à la distance s : net de H·s ÷ (H + s) à
// H·s ÷ (H − s), l'infini si s ≥ H. Chiffres du texte, point à 3 m : 54 mm f/1,8 de 2,94 à
// 3,06 m ; 54 mm f/2 de 2,93 à 3,07 m ; 54 mm f/8 de 2,75 à 3,30 m ; 20 mm f/4 de 2,26 à 4,48 m ;
// 4,5 mm f/1,8 de 0,76 m à l'infini (H = 1,02 m) ; 4,5 mm f/4 : H = 0,46 m. La manipulation
// (camlab/labs/optique.js, « pdc ») met trois cartons à 2, 3 et 4,5 m.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const PDC = {
  t: 'La profondeur de champ', aka: 'Depth of field ; hyperfocale, cercle de confusion', chap: 1, lot: 1, point: 'point',
  short: 'La zone nette devant et derrière le point. Elle grandit quand on ferme l\'iris, quand on élargit et quand le sujet s\'éloigne.',
  fig: 'pdc',
  lab: 'pdc',
  body: "**Une zone, pas un plan.** L'objectif ne forme une image parfaitement nette qu'à une seule distance, celle du point. Devant et derrière, chaque point du sujet devient une petite tache, de plus en plus large à mesure qu'on s'éloigne du point. Tant que la tache reste plus petite que ce que l'image sait montrer, environ 0,011 mm sur un capteur 2/3\", deux photosites, on la voit nette. Toute la zone où c'est vrai, c'est la profondeur de champ.\n\n**Trois leviers.** La taille de la tache dépend du cône de rayons qui vient se croiser sur le capteur :\n- **l'iris** : fermé, le cône est plus fin, la tache grandit moins vite. La profondeur de champ grandit avec le nombre f ;\n- **la focale** : courte, le cône est plus fin aussi. La profondeur de champ grandit quand on élargit, très vite : comme l'inverse du carré de la focale ;\n- **la distance** : loin, la profondeur de champ grandit ; près, elle fond.\n\n**Les chiffres de la caméra.** Point à 3 m :\n- 54 mm à f/1,8 : net de 2,94 à 3,06 m, douze centimètres ;\n- 54 mm à f/8 : de 2,75 à 3,30 m ;\n- 20 mm à f/4 : de 2,3 à 4,5 m ;\n- 4,5 mm à f/1,8 : de 76 cm à l'infini.\n\nLa zone nette s'étend plus loin derrière le point que devant : environ un tiers devant, deux tiers derrière, aux distances courantes.\n\n**L'hyperfocale.** À chaque focale et chaque iris, il existe une distance H = f² ÷ (N × 0,011) : si on fait le point à H, tout est net de H ÷ 2 à l'infini. À 4,5 mm f/4, H vaut 46 cm : le plan large ne décroche jamais. À 54 mm f/4, H vaut 66 m : au téléobjectif, le point se suit en permanence.",
  vraie: "Sur un capteur 2/3\", la profondeur de champ est confortable par rapport aux caméras de cinéma, et c'est une des raisons pour lesquelles le direct lui reste fidèle. Le cadreur s'en sert : en plan large à 8 mm, le point est « tranquille » ; en gros plan à 54 mm et f/2, un présentateur qui se penche de dix centimètres sort de la zone nette. Il faut alors suivre le point, à la commande reportée sur le manche.\n\n**Le bon geste.** Pour isoler un sujet sur un fond flou : focale longue, iris ouvert, sujet loin du fond, et on recule la caméra. Pour tout garder net : focale courte, iris fermé si la lumière le permet. Quand un sujet va bouger, anticiper : on fait le point là où il va arriver.\n\n**L'erreur fréquente.** Vérifier le point en plan large, où tout paraît net, puis serrer pendant le direct et découvrir que c'est flou : la profondeur de champ cachait l'erreur. On fait toujours le point en serré.",
  plus: "- **Le cercle de confusion.** 0,011 mm, c'est une convention pour le 2/3\" : la taille de tache qu'un œil ne distingue plus d'un point, à la taille de l'image et à la distance de vision habituelles. Sur un grand capteur, on prend 0,025 à 0,03 mm, mais la focale pour le même cadre est 3,8 fois plus longue, et c'est le carré de la focale qui gagne : la profondeur de champ y est bien plus mince.\n- **Fermer n'apporte pas tout.** Au-delà de f/8, la diffraction adoucit l'image : la zone nette grandit, mais rien n'est plus vraiment piqué.\n- **Le flou d'arrière-plan.** La forme des taches floues est celle du trou de l'iris : plus il a de lames, plus les points lumineux du fond sont ronds (le « bokeh »).\n- **La formule complète.** Devant : H × s ÷ (H + s). Derrière : H × s ÷ (H − s), l'infini si s dépasse H. Avec H = f² ÷ (N × c) et toutes les longueurs en millimètres.",
  car: "Au stade, la caméra de tribune cadre un joueur à 80 m avec 800 mm de focale, à f/2,8 : la zone nette fait 60 cm. Le cadreur suit le point en permanence, et c'est le point, plus que le cadre, qui fait la différence entre un bon et un très bon cadreur de sport.",
  quiz: [
    {
      q: 'Point à 3 m, zoom à 54 mm. Pour agrandir la zone nette sans bouger la caméra, le cadreur peut…',
      a: [
        ['ouvrir l\'iris.', 'C\'est l\'inverse : ouvrir réduit la zone nette.'],
        ['fermer l\'iris, si la lumière le permet.', 'Exact : à f/8, la zone nette passe de 12 cm à 55 cm.'],
        ['zoomer encore plus serré.', 'Allonger la focale réduit la profondeur de champ, très vite : comme le carré de la focale.'],
      ],
      ok: 1,
    },
    {
      q: 'Pourquoi un plan large à 4,5 mm semble-t-il toujours net ?',
      a: [
        ['Parce que la caméra fait le point automatiquement en grand angle.', 'Il n\'y a pas d\'autofocus : c\'est la profondeur de champ qui couvre presque tout.'],
        ['Parce que l\'image est plus petite sur le capteur.', 'Le capteur est toujours couvert en entier. C\'est le cône de rayons qui est plus fin.'],
        ['Parce qu\'à courte focale, la zone nette va de moins d\'un mètre à l\'infini.', 'Exact : à 4,5 mm f/4, l\'hyperfocale est à 46 cm ; net de 23 cm à l\'infini.'],
      ],
      ok: 2,
    },
    {
      q: 'Un présentateur en gros plan (54 mm, f/2, point à 3 m) se penche de 15 cm vers la caméra. Que se passe-t-il ?',
      a: [
        ['Il devient flou : la zone nette fait à peine 14 cm.', 'Exact : net de 2,93 à 3,07 m. Le cadreur doit suivre le point.'],
        ['Rien : 15 cm, c\'est trop peu pour que ça se voie.', 'À 54 mm et f/2, 15 cm suffisent largement.'],
        ['Il devient plus net : il se rapproche de l\'objectif.', 'Se rapprocher du plan de netteté rend plus net ; le dépasser rend flou. Là, il le dépasse.'],
      ],
      ok: 0,
    },
  ],
  see: ['iris', 'focale', 'point', 'nd', 'tirage', 'grandcapteur'],
  ref: 'Cercle de confusion 0,011 mm pour le format 2/3" ; hyperfocale H = f² ÷ (N × c) ; limites de netteté H·s ÷ (H ± s) ; Fujinon ZA12x4.5BERD : 4,5–54 mm, f/1,8',
  competences: ['2.9'],
};

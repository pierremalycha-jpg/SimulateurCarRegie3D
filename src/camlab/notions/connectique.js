// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « La connectique ». Mode d'emploi HXC-FB80, « Arrière » : DC IN (XLR 4), INTERCOM (XLR 5),
// AUDIO 2 IN (XLR 3, sélecteur LINE / MIC / MIC +48V), EARPHONE (mini-jack), REMOTE (8 broches),
// DC OUT (4 broches), TEST OUT, PROMPTER/GENLOCK, SDI OUT, SDI I/O (BNC) ; « Avant gauche » :
// USB, VF (20 broches), monture, CCU (fibre hybride), TRUNK (D-sub 9), LENS (12 broches),
// AUDIO 1 IN. La manipulation (camlab/labs/corps.js, « connectique ») fait brancher dix équipements.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const CONNECTIQUE = {
  t: 'La connectique', aka: 'Connectors ; face arrière et face avant gauche', chap: 5, lot: 1, point: 'connectique',
  short: 'DC IN, AUDIO 2 IN, intercom, EARPHONE, REMOTE, DC OUT, TEST OUT, PROMPTER/GENLOCK, SDI OUT, SDI I/O : à quoi sert chaque prise de la face arrière.',
  fig: 'connectique',
  lab: 'connectique',
  body: "**Trois familles de prises.**\n\n**L'image**, en BNC : \n- **SDI OUT** : l'image de la caméra en SDI, pour un moniteur sur le pied ou un enregistreur ;\n- **SDI I/O** : entrée ou sortie, au choix dans le menu. En entrée, elle reçoit un retour vidéo quand la caméra travaille sans CCU ;\n- **TEST OUT** : une sortie analogique de contrôle, avec les caractères du viseur si on veut ;\n- **PROMPTER/GENLOCK** : avec la CCU, la sortie du texte du prompteur, venu du car par la fibre ; sans CCU, l'entrée de la référence de synchronisation.\n\n**Le son et l'intercom** :\n- **AUDIO 1 IN** (avant gauche) et **AUDIO 2 IN** (arrière), XLR 3 broches : deux micros ou deux lignes, avec un sélecteur LINE, MIC ou MIC +48V (alimentation fantôme pour un micro à condensateur). Le son remonte vers la CCU par la fibre ;\n- **INTERCOM**, XLR 5 broches : le casque-micro du cadreur, écoute et micro dans le même câble ;\n- **EARPHONE**, mini-jack : une oreillette, pour écouter l'intercom ou le son.\n\n**L'alimentation et la commande** :\n- **DC IN**, XLR 4 broches : 12 V, quand la CCU ne peut pas alimenter la caméra (fibre trop longue, fibre monomode) ou quand il n'y a pas de CCU ;\n- **DC OUT**, 4 broches : du courant pour un accessoire, 1,5 A au plus, une lampe ou un récepteur HF ;\n- **REMOTE**, 8 broches : un pupitre de commande relié directement à la caméra, sans CCU ;\n- **LENS**, 12 broches (avant gauche) : le câble de l'objectif, pour l'iris, le zoom et les données de l'objectif ;\n- **VF**, 20 broches : le viseur ; **USB** : les fichiers et les mises à jour ; **TRUNK**, D-sub 9 : une liaison de données transparente entre le car et la caméra, pour une tête télécommandée par exemple.\n\n**Et la fibre.** Un seul connecteur, à l'avant gauche sous la monture, porte tout ce qui va et vient de la CCU : l'image, les retours, l'intercom, le tally, le prompteur, les commandes et l'alimentation. Avec une CCU, la plupart des prises de l'arrière restent bouchées : elles servent quand la caméra travaille seule, ou pour un accessoire local.\n\n**Reconnaître une prise.** BNC : baïonnette à quart de tour, vidéo en 75 Ω. XLR 3 : audio symétrique, 1 masse, 2 point chaud, 3 point froid. XLR 4 : alimentation. XLR 5 : intercom. Les prises rondes à broches ont un détrompeur et une bague qui se visse ou se clipse : on ne force jamais.",
  vraie: "À l'arrière, les XLR en bas (DC IN, INTERCOM, AUDIO 2 IN), les BNC en haut (TEST OUT, PROMPTER/GENLOCK, SDI OUT, SDI I/O), REMOTE et DC OUT entre les deux, avec les voyants et le commutateur de tally, le bouton CALL et les niveaux de l'intercom. À l'avant gauche, sous la monture, le câble de l'objectif et la fibre.\n\n**Le bon geste.** Les bouchons sur les prises libres, surtout la fibre. Le sélecteur LINE / MIC / MIC +48V avant de brancher, jamais après. Un câble qui part vers le bas, avec du mou, et pas en traction sur la prise. Quand il n'y a pas d'image au car, on vérifie d'abord les deux câbles qui ne sont pas sur cette face : la fibre et le câble LENS.\n\n**L'erreur fréquente.** Brancher le casque dans EARPHONE : on entend, mais personne ne t'entend, le micro passe par l'INTERCOM. Ou envoyer du +48 V sur une source ligne : certains appareils n'aiment pas.",
  plus: "- **Le tally.** Les voyants rouge et vert à l'arrière, et le commutateur qui les coupe, sont la face visible d'une information qui vient du mélangeur par la CCU et la fibre.\n- **3G, HD, SD.** SDI OUT sort du 3G-SDI (1080p50), du HD-SDI (1080i50, 720p50) ou du SD-SDI selon le format de la caméra : même BNC, même câble, un débit différent.\n- **Deux alimentations.** Fibre et DC IN branchées en même temps, ce n'est pas dangereux : la caméra se sert de l'une ou de l'autre. C'est prévu pour les longues distances, où la fibre ne porte plus assez de puissance.\n- **Côté car.** La CCU a les prises en face : sorties SDI vers la grille, entrées de retour, prompteur, intercom, tally, référence. C'est elle qui fait le lien entre la caméra et la régie.",
  car: "Au stade, l'arrière d'une caméra ne voit que la fibre, le casque de l'intercom, parfois un DC OUT pour une lampe ou un moniteur sur SDI OUT ; tout le reste reste bouché. Le branchement se fait côté car, sur la CCU, et c'est là que l'on cherche quand une caméra n'arrive pas.",
  quiz: [
    {
      q: 'Caméra reliée à la CCU par la fibre. Par où passe le retour vidéo que le cadreur voit dans son viseur ?',
      a: [
        ['Par SDI I/O, en entrée.', 'SDI I/O reçoit un retour seulement quand la caméra n\'a pas de CCU.'],
        ['Par la fibre : la CCU y envoie les retours, l\'intercom, le tally et le prompteur.', 'Exact : un seul câble porte tout, dans les deux sens.'],
        ['Par PROMPTER/GENLOCK.', 'Cette prise sort le prompteur ou reçoit une référence ; elle ne porte pas le retour.'],
      ],
      ok: 1,
    },
    {
      q: 'Quelle prise pour un micro d\'ambiance à condensateur monté sur la caméra ?',
      a: [
        ['AUDIO 2 IN, XLR 3 broches, sélecteur sur MIC +48V.', 'Exact : un micro à condensateur a besoin de l\'alimentation fantôme 48 V.'],
        ['INTERCOM, XLR 5 broches.', 'L\'INTERCOM est pour le casque-micro du cadreur, pas pour une prise de son.'],
        ['EARPHONE.', 'C\'est une sortie pour écouter, pas une entrée.'],
      ],
      ok: 0,
    },
    {
      q: 'Un bloc secteur sur DC IN et la fibre branchée en même temps : la caméra est-elle alimentée deux fois ?',
      a: [
        ['Oui, et ça l\'abîme : il ne faut jamais les deux.', 'Ce n\'est pas dangereux : la caméra se sert d\'une source à la fois.'],
        ['Non : seule la fibre alimente, DC IN ne sert à rien dans ce cas.', 'DC IN sert justement quand la fibre ne peut pas alimenter ; les deux peuvent être branchées.'],
        ['Non : la caméra se sert de l\'une des deux ; DC IN est là pour les fibres trop longues ou les caméras sans CCU.', 'Exact : au-delà de la portée en alimentation de la fibre hybride, la caméra s\'alimente sur place.'],
      ],
      ok: 2,
    },
  ],
  see: ['fibre', 'alimentation', 'tally', 'retours', 'ccu', 'monture', 'viseur'],
  ref: 'Mode d\'emploi HXC-FB80, « Arrière » et « Avant gauche » : DC IN, INTERCOM, AUDIO 2 IN, EARPHONE, REMOTE, DC OUT, TEST OUT, PROMPTER/GENLOCK, SDI OUT, SDI I/O ; USB, VF, CCU, TRUNK, LENS, AUDIO 1 IN',
  competences: ['2.7'],
};

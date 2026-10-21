// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « La monture B4 et le câble de l'objectif ». Norme BTA S-1005 (1992 ; version A de 1994 pour
// l'interface caméra-objectif 2/3") : baïonnette, image à 48 mm de la face d'appui (dans l'air), plans
// rouge et bleu 10 et 5 µm plus loin, diagonale de l'image 11 mm, ergot de l'objectif dans une encoche
// de la caméra. Mode d'emploi HXC-FB80 : monture à baïonnette 2/3" Sony ; levier de verrouillage qui
// fait tourner la bague de la monture ; bouchon de monture ; caoutchouc de sécurité de la monture à
// poser après le verrouillage ; prise LENS 12 broches, « mettre la caméra hors tension avant de
// brancher ou de débrancher le câble de l'objectif » ; réglage du tirage une fois après chaque montage
// ou changement d'objectif. Brochage courant des objectifs B4 (1 RET, 2 VTR, 3 masse, 4 iris auto,
// 5 commande d'iris, 6 +12 V, 7 position de l'iris, 8 iris auto/télécommande, 9 doubleur, 10 position
// du zoom, 11 et 12 données série) : d'après la norme, à vérifier sur la notice de chaque objectif.
// Objectifs box : câble 36 broches vers l'adaptateur grand objectif (leçon « Monter une caméra de
// stade »). La manipulation (camlab/labs/ch1.js, « monture ») fait monter l'objectif, brancher le câble
// caméra éteinte, vérifier ses fonctions, puis retrouver un grain de 0,1 mm sur la face d'appui.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const MONTURE = {
  t: 'La monture B4 et le câble de l\'objectif', aka: 'Monture à baïonnette 2/3" (B4, BTA S-1005) ; prise LENS 12 broches', chap: 1, lot: 2, point: 'monture',
  short: 'La baïonnette 2/3" verrouille l\'objectif sur la caméra ; le câble 12 broches l\'alimente et transmet l\'iris, le zoom et les données de l\'objectif.',
  fig: 'monture',
  lab: 'monture',
  body: "**Une monture pour tous.** Presque tous les objectifs et caméras broadcast 2/3\" partagent la même monture, la **B4**, fixée par une norme japonaise (BTA S-1005, 1992). Un zoom Fujinon ou Canon se monte sur une Sony, une Panasonic ou une Grass Valley. La norme fixe :\n- la baïonnette elle-même : l'objectif entre droit, son ergot dans l'encoche du haut, et une bague le plaque contre la face d'appui ;\n- la distance de la face d'appui à l'image : 48 mm dans l'air, à travers le prisme, avec les plans rouge et bleu un peu plus loin que le vert ;\n- la taille de l'image : 11 mm de diagonale, le format 2/3\".\n\n**Pourquoi la face d'appui compte.** Si l'objectif n'est pas plaqué, ou s'il repose sur un grain de poussière, l'image ne tombe plus à 48 mm. Un dixième de millimètre suffit : c'est une erreur de tirage. La bague de point la rattrape en serré, pas en large.\n\n**Le câble de l'objectif.** Un câble court à 12 broches relie l'objectif à la prise LENS de la caméra. Il porte :\n- l'alimentation de l'objectif (12 V), pour les moteurs du zoom et de l'iris ;\n- la commande de l'iris, et sa position en retour : c'est par lui que le RCP règle l'iris ;\n- la position du zoom, l'état du doubleur, les touches RET et VTR de la poignée ;\n- une liaison de données, pour les objectifs qui donnent leurs positions et leur identité à la caméra.\n\nSans ce câble, l'objectif est une optique à la main : il forme l'image, mais la caméra ne sait plus rien de lui.\n\n**Monter un objectif.**\n1. Relever le levier de verrouillage, retirer le bouchon de la monture.\n2. Présenter l'objectif, ergot dans l'encoche du haut, bien droit.\n3. Le tenir et rabattre le levier : la bague tourne et le plaque.\n4. Poser le caoutchouc de sécurité sur la monture.\n5. Caméra éteinte, brancher le câble sur la prise LENS et l'attacher.\n6. Allumer, vérifier l'iris, le zoom, RET, puis le tirage.",
  vraie: "Sur la HXC-FB80, la monture est à l'avant du corps, le levier de verrouillage à côté, la prise LENS en dessous, à l'avant gauche. Le mode d'emploi demande deux précautions : poser le caoutchouc de sécurité après avoir verrouillé l'objectif, pour qu'il ne puisse pas se détacher, et mettre la caméra hors tension avant de brancher ou de débrancher le câble de l'objectif.\n\n**Le bon geste.** Souffler les deux faces d'appui, celle de l'objectif et celle de la caméra, à chaque montage. Remettre tout de suite le bouchon de la monture quand l'objectif est retiré : la poussière entre sur le prisme. Poser l'objectif démonté sur son bouchon arrière. Après chaque montage, refaire le tirage : le mode d'emploi le demande une fois par montage ou par changement d'objectif.\n\n**L'erreur fréquente.** Brancher le câble caméra allumée. Lâcher l'objectif avant que le levier soit rabattu. Oublier le câble : l'image est là, mais l'iris ne répond plus au RCP, le viseur n'affiche plus ni zoom ni iris, et la touche RET ne fait rien.",
  plus: "- **Le brochage.** Le brochage courant des objectifs B4 : 1 RET, 2 VTR, 3 masse, 4 iris automatique, 5 commande d'iris, 6 +12 V, 7 position de l'iris, 8 iris auto ou télécommandé, 9 doubleur engagé, 10 position du zoom, 11 et 12 données série. Il varie un peu d'un constructeur à l'autre : la notice de l'objectif fait foi.\n- **Le fichier d'objectif.** Comme chaque objectif a ses particularités, la caméra garde des réglages par objectif (page F04 LENS FILE du menu FILE), à rappeler quand on le remonte.\n- **Les objectifs box.** Un grand zoom de stade se monte sur un adaptateur grand objectif, qui porte lui-même la caméra ; le câble de l'objectif y a 36 broches. Voir « Objectif portable ou box ».\n- **D'autres montures.** Les caméras à grand capteur unique ont d'autres montures (PL, la monture du cinéma, à 52 mm de tirage). Un objectif B4 s'y monte par un adaptateur optique, qui agrandit l'image et corrige le chromatisme prévu pour le prisme.",
  car: "Au stade, l'équipe caméra monte les objectifs au déchargement du car, sur chaque caméra ; la vision voit au line-up si l'iris répond au RCP et si l'objectif est bien plaqué : un large flou sur une seule caméra, c'est souvent un objectif mal monté ou un tirage pas refait.",
  quiz: [
    {
      q: 'Pourquoi éteindre la caméra avant de brancher le câble de l\'objectif ?',
      a: [
        ['Parce que le câble alimente l\'objectif en 12 V et porte ses commandes : le mode d\'emploi le demande pour ne rien abîmer.', 'Exact : caméra hors tension pour brancher ou débrancher.'],
        ['Parce que l\'objectif ne fonctionne qu\'avec une caméra éteinte.', 'L\'objectif fonctionne caméra allumée, une fois branché.'],
        ['Parce que sinon la caméra efface ses fichiers de réglage.', 'Ce n\'est pas le risque : c\'est l\'électronique de l\'objectif et de la prise qu\'on protège.'],
      ],
      ok: 0,
    },
    {
      q: 'Objectif monté sans son câble. Qu\'est-ce qui ne marche plus ?',
      a: [
        ['L\'image : elle est noire.', 'L\'image se forme quand même : l\'optique n\'a pas besoin de courant.'],
        ['Le prisme : les couleurs sont fausses.', 'Le prisme est dans la caméra, il ne dépend pas du câble.'],
        ['L\'iris commandé par la vision, les affichages du zoom et de l\'iris, la touche RET, l\'indication du doubleur.', 'Exact : tout ce qui est électrique entre l\'objectif et la caméra passe par les 12 broches.'],
      ],
      ok: 2,
    },
    {
      q: 'Après un montage, le serré est net et le large est flou. Que soupçonne-t-on d\'abord ?',
      a: [
        ['Un défaut du capteur vert.', 'Un capteur ne donne pas un défaut qui dépend de la focale.'],
        ['L\'objectif mal plaqué ou posé sur un grain, ou le tirage pas refait : l\'image n\'est plus à 48 mm.', 'Exact : on vérifie la monture, on souffle les faces d\'appui, puis on refait le tirage.'],
        ['Le câble de l\'objectif mal branché.', 'Le câble ne change pas la position de l\'image : il porte les commandes et les positions.'],
      ],
      ok: 1,
    },
  ],
  see: ['tirage', 'connectique', 'box-portable', 'iris', 'doubleur', 'prisme'],
  ref: 'Norme BTA S-1005 (monture B4) : 48 mm dans l\'air, image de 11 mm de diagonale ; mode d\'emploi HXC-FB80 : monture à baïonnette 2/3", levier de verrouillage, caoutchouc de sécurité, prise LENS (12 broches) caméra hors tension, réglage du tirage après chaque montage',
  competences: ['2.7', '4.2'],
};

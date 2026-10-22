// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Température de couleur et filtres CC ». Mode d'emploi HXC-FB80 : bouton COLOR TEMP.
// (réglage d'usine : 5600K ON/OFF) ; fonction ELECTRICAL CC, quatre positions A à D (3200K,
// 4300K, 5600K, 6300K), affectable au bouton COLOR TEMP. ou aux touches ASSIGN 1 à 3 (page SWITCH
// ASSIGN1 du menu OPERATION), valeurs réglées dans le menu MAINTENANCE ; WHITE BAL PRST = 3200 K ;
// indicateurs CC et 5600K du viseur (page VF DISPLAY). Fiche technique : filtre CC électrique,
// pas de roue CC optique ; ND et CC commandés aussi par le RCP. Sony HDC-5500 (caméras du car) :
// roue CC optique A croix, B 3200K (verre clair), C 4300K, D 6300K. Mired = 10⁶ ÷ T : 3200 K =
// 312,5 ; 5600 K = 178,6 ; 6300 K = 158,7 ; 3600 K = 277,8. Dominante (optics.js, castOf) :
// réglée 5600 K et filmée en 3200 K, rouge ×1,66, bleu ×0,41. Filtres de conversion (fabricants
// de filtres, ordre de grandeur) : orange 85 (jour → 3200 K) environ 2/3 de diaphragme, bleu 80A
// (3200 K → jour) environ deux diaphragmes. EBU Tech 3355 : indice TLCI des sources pour la
// télévision. La manipulation (camlab/labs/ch23.js, « cc ») : tungstène, soleil, fin de journée.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const CC = {
  t: 'Température de couleur et filtres CC', aka: 'Color temperature, color correction ; kelvins, mireds, ELECTRICAL CC', chap: 2, lot: 2, point: 'filtres',
  short: 'La lumière d\'une lampe tungstène (3200 K) est plus orange que celle du jour (5600 K). Sur la FB80, pas de filtre coloré : le bouton COLOR TEMP. et le CC électronique (3200, 4300, 5600, 6300 K) compensent par les gains des voies.',
  fig: 'cc',
  lab: 'cc',
  body: "**La couleur d'une lumière.** Une lumière « blanche » n'a pas toujours la même couleur. On la décrit par la température d'un corps qu'on chauffe : vers 1800 K (kelvins), une bougie, orange ; 3200 K, le filament d'un projecteur tungstène ; 5600 K, le soleil avec le ciel ; au-delà, l'ombre sous un ciel bleu, de plus en plus bleue. Plus la température monte, plus la lumière est bleue. L'œil s'y adapte sans qu'on y pense ; la caméra, non.\n\n**Les mireds.** Les kelvins trompent : de 3200 à 5600 K, l'écart est énorme ; de 5600 à 6300 K, il se voit à peine, alors qu'il y a 700 K. On compte donc en **mireds** : un million divisé par la température.\n- 3200 K = 312 mired ; 5600 K = 179 mired : 134 mired d'écart ;\n- 5600 K → 6300 K : 20 mired seulement ;\n- un écart d'une dizaine de mireds commence à se remarquer entre deux caméras côte à côte (ordre de grandeur).\n\nL'intérêt : un filtre déplace toujours la lumière du même nombre de mireds, quelle que soit la lampe.\n\n**Deux façons de corriger.**\n1. **Un filtre optique (CC, color correction)**, sur une roue entre l'objectif et le prisme : un verre orange pour filmer le jour avec une caméra faite pour le tungstène. Il corrige avant le capteur, mais il mange un peu de lumière : environ deux tiers de diaphragme pour un orange de conversion, deux diaphragmes pour un bleu (ordre de grandeur des fabricants de filtres). C'est pour cela que les roues CC des caméras de plateau ont un verre clair à 3200 K et des verres orangés pour le jour : on évite les bleus.\n2. **Un CC électronique** : la caméra change les gains de ses voies rouge et bleue comme si le filtre était là. Aucune lumière perdue, aucune pièce qui bouge. C'est ce que fait la FB80 : elle n'a pas de roue de filtres colorés.\n\n**Le CC, puis la balance.** Aucune lumière n'est exactement à 3200 ou 5600 K. Le CC rapproche la caméra de la lumière d'un seul geste ; la balance des blancs sur le carton finit le travail. Partir de la position la plus proche, c'est demander aux gains une petite correction plutôt qu'une grande.",
  vraie: "Le bouton **COLOR TEMP.** est sur le côté droit du corps, avec les commandes de la balance. Réglage d'usine : il allume ou éteint le **5600K** (préréglage lumière du jour) ; le viseur affiche 5600K quand il est en service. Le mode d'emploi permet de lui donner une autre fonction, l'**ELECTRICAL CC** : chaque pression passe à la position suivante, A, B, C, D, réglées d'usine sur 3200K, 4300K, 5600K et 6300K. On peut aussi mettre cette fonction sur une touche ASSIGN (page SWITCH ASSIGN1 du menu OPERATION). Les valeurs de A à D se changent dans le menu MAINTENANCE.\n\nReliée à la CCU, c'est le RCP de la vision qui commande le CC et le ND, à distance.\n\n**Le bon geste.** Choisir la position la plus proche de la lumière (au thermocolorimètre, ou à l'œil : tungstène ou jour), puis faire la balance des blancs sur le carton. Refaire la balance à chaque changement de CC.\n\n**L'erreur fréquente.** Rentrer sur le plateau avec le 5600K resté allumé : toute l'image vire à l'orange. Ou croire que COLOR TEMP. remplace la balance : c'est un préréglage, pas une mesure.",
  plus: "- **CC, deux sens.** Chez Sony, CC veut dire color correction, la conversion orange-bleu. En photographie, les filtres « CC » (color compensating) corrigent aussi le vert et le magenta.\n- **Les LED et les tubes.** Une source LED ou fluorescente n'est pas un corps chauffé : elle peut avoir une « température » de 5600 K et un spectre troué, avec une pointe de vert. L'UER (EBU) a défini l'indice TLCI (Tech 3355) pour noter les sources destinées à la télévision.\n- **Lumière mélangée.** Une fenêtre à 5600 K et un projecteur à 3200 K dans le même plan : aucun réglage de caméra ne rend les deux blancs. On filtre les sources : une gélatine orange sur la fenêtre (CTO) ou bleue sur le projecteur (CTB).\n- **Le réglage fin.** La page COLOR TEMP du menu PAINT (P03) et les gains R et B du RCP permettent à la vision d'ajuster la température au-delà des quatre positions.\n- **Les écrans.** Le blanc de référence des moniteurs est le D65, 6500 K (BT.709) : un moniteur réglé à une autre température fausse le jugement de la balance.",
  car: "Les caméras HDC-5500 du car ont, elles, une vraie roue de filtres CC optiques à côté de la roue ND : A, un filtre étoile (croix), B 3200 K (un verre clair : la caméra est calculée pour le tungstène), C 4300 K, D 6300 K, des verres orangés. Au stade, l'après-midi se tourne au jour, puis les projecteurs LED prennent le relais à la nuit tombée : la vision change le CC depuis les RCP et refait la balance de toutes les caméras sur la même charte, pour qu'elles se raccordent.",
  quiz: [
    {
      q: 'Entre 5600 K et 6300 K, il y a 700 K ; entre 2800 K et 3200 K, 400 K. Quel écart se voit le plus ?',
      a: [
        ['Le premier : 700 K, c\'est presque deux fois plus.', 'En mireds, 5600 → 6300 K ne fait que 20 mired : les kelvins se tassent vers le bleu.'],
        ['Le second : 45 mired, contre 20 pour le premier.', 'Exact : c\'est l\'écart en mireds (un million ÷ T) qui dit ce que l\'œil voit.'],
        ['Les deux se voient autant : tout est question de kelvins.', 'Non : à 2800 K, chaque kelvin compte bien plus qu\'à 6000 K. D\'où les mireds.'],
      ],
      ok: 1,
    },
    {
      q: 'Sous les projecteurs tungstène, la caméra est restée sur 5600K. L\'image est…',
      a: [
        ['orange : la caméra attend une lumière plus bleue et laisse passer tout le rouge du tungstène.', 'Exact : 134 mired d\'écart. Le rouge sort 1,66 fois trop fort, le bleu 0,41 fois.'],
        ['bleue : le 5600K ajoute du bleu.', 'L\'image serait bleue dans le cas inverse : réglée 3200 K, filmée au jour.'],
        ['juste : la balance automatique corrige.', 'Rien ne corrige tout seul sur un plateau : le préréglage reste celui qu\'on a choisi.'],
      ],
      ok: 0,
    },
    {
      q: 'Quelle différence entre le CC de la FB80 et la roue CC d\'une HDC-5500 du car ?',
      a: [
        ['Aucune : dans les deux cas, un verre coloré tourne devant le prisme.', 'La FB80 n\'a pas de roue de filtres colorés : son CC est électronique.'],
        ['Le CC de la FB80 est plus juste, parce qu\'il mesure la lumière.', 'Il ne mesure rien : c\'est un préréglage. La mesure, c\'est la balance des blancs.'],
        ['La FB80 corrige par les gains des voies, sans perdre de lumière ; la HDC-5500 filtre la lumière avant le prisme, au prix d\'un peu de lumière.', 'Exact : deux façons d\'arriver au même blanc, et dans les deux cas on finit par une balance.'],
      ],
      ok: 2,
    },
  ],
  see: ['balance', 'nd', 'matrice', 'lineup', 'commandes', 'mires'],
  ref: 'Mode d\'emploi HXC-FB80 : bouton COLOR TEMP. (5600K ON/OFF d\'usine), fonction ELECTRICAL CC, positions A 3200K, B 4300K, C 5600K, D 6300K, affectable à COLOR TEMP. ou aux touches ASSIGN 1 à 3 (page SWITCH ASSIGN1), indicateurs CC et 5600K (VF DISPLAY) ; fiche technique HXC-FB80 : filtre CC électrique ; Sony HDC-5500 : roue CC optique (croix, 3200K, 4300K, 6300K) ; mired = 10⁶ ÷ T ; EBU Tech 3355 (TLCI)',
  competences: ['2.9', '1.4'],
};

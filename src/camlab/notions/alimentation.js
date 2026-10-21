// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « L'alimentation ». Fiche technique et mode d'emploi HXC-FB80 : consommation ≈ 19 W (corps
// seul), ≈ 32 W avec le viseur fourni ; DC IN XLR 4 broches, 10,5 à 17 V, 5,4 A au plus ; DC OUT
// 4 broches, 1,5 A au plus ; « distance of power supply » : 600 m au plus avec le câble hybride
// Sony CCFN, un objectif portable et la HXCU-FB80 (1000 m pour la HXC-P70) ; fibre monomode à
// connecteurs LC : 10 km au plus, avec une alimentation locale. HXCU-FB80 : secteur 100 à 240 V.
// Ordres de grandeur, dits comme tels : l'objectif ≈ 5 W, une lampe ≈ 12 W, une batterie 14,4 V
// de 95 Wh. Autonomie = énergie (Wh) ÷ puissance (W), pertes négligées. La manipulation
// (camlab/labs/ch56.js, « alimentation ») fait choisir la liaison, la source et les charges.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const ALIMENTATION = {
  t: 'L\'alimentation', aka: 'Power supply ; fibre hybride, DC IN, DC OUT, budget d\'énergie', chap: 5, lot: 2, point: 'connectique',
  short: 'La CCU alimente la caméra par la fibre hybride jusqu\'à 600 m ; au-delà, sur fibre monomode (jusqu\'à 10 km), la caméra s\'alimente sur place par DC IN. Le budget : environ 32 W avec le viseur.',
  fig: 'alimentation',
  lab: 'alimentation',
  body: "**L'énergie arrive avec le câble.** Le câble hybride entre la CCU et la caméra contient des fibres pour les signaux et des conducteurs de cuivre pour l'énergie. La CCU, branchée sur le secteur (100 à 240 V), **télé-alimente** la tête : il n'y a rien d'autre à brancher sur la caméra. C'est le cas normal.\n\n**La longueur a une limite.** Le cuivre a une résistance : plus le câble est long, plus la tension chute en route et plus d'énergie part en chaleur. Au-delà d'une certaine longueur, la CCU ne peut plus faire passer la puissance que demande la tête. Pour la HXC-FB80, le mode d'emploi donne **600 m** avec le câble hybride Sony, un objectif portable et la CCU HXCU-FB80 ; la HXC-P70, une caméra compacte, va jusqu'à 1000 m sur la même CCU. La lumière, elle, irait bien plus loin.\n\n**Au-delà : la fibre seule.** Une fibre monomode (connecteurs LC) ne porte que de la lumière. Elle va jusqu'à **10 km**, mais la caméra doit trouver son énergie sur place, par la prise **DC IN** (XLR 4 broches) : un bloc secteur ou une batterie, entre **10,5 et 17 V**, **5,4 A** au plus.\n\n**Le budget d'énergie.** On additionne ce que consomme la tête :\n- le corps : **environ 19 W** ;\n- le viseur 7\" fourni : **environ 13 W** de plus (32 W en tout, d'après la fiche technique) ;\n- l'objectif et son servo : quelques watts (ordre de grandeur), davantage pendant un zoom rapide ;\n- un accessoire sur **DC OUT** (une lampe, un récepteur) : **1,5 A** au plus.\n\nSur batterie, l'autonomie vaut l'énergie stockée divisée par la puissance : 95 Wh pour 37 W, environ 2 h 30, un peu moins en vrai à cause des pertes. Chaque accessoire branché la raccourcit.",
  vraie: "La prise de la fibre (CCU) est à l'arrière, sous son capot ; DC IN et DC OUT sont sur le panneau des prises, en bas de la face arrière. Quand la CCU alimente la caméra, DC IN reste libre.\n\n**Le bon geste.** Avant de partir loin, faire le compte : la longueur réelle du câble (pas la distance à vol d'oiseau), la puissance de la tête et de ses accessoires. Au-delà de 600 m, prévoir la fibre monomode et une alimentation sur place, avec une seconde batterie ou un bloc secteur. Brancher la source sur DC IN avant de mettre la caméra en marche.\n\n**L'erreur fréquente.** Rallonger la fibre hybride par un second touret et s'étonner que la caméra ne s'allume plus : la lumière passerait, l'énergie non. Ou charger DC OUT (lampe, émetteur, moniteur) sur une caméra sur batterie sans refaire le compte : l'autonomie fond.",
  plus: "- **Pourquoi une tension élevée.** Pour une même puissance, une tension plus haute fait passer moins de courant, donc moins de pertes dans le cuivre, qui croissent comme le carré du courant. C'est pour cela que la CCU envoie une tension élevée dans le câble, que la tête ramène à ses besoins.\n- **Deux sources à la fois.** Fibre hybride et DC IN branchées ensemble, ce n'est pas dangereux : la caméra se sert d'une seule source.\n- **Le courant sur DC IN.** I = P ÷ U : 37 W sous 12 V, 3,1 A ; la même tête sous 14,4 V ne tire que 2,6 A. Le plafond de 5,4 A laisse de la place pour DC OUT.\n- **Les wattheures.** Une batterie de 14,4 V et 6,6 Ah stocke 14,4 × 6,6 ≈ 95 Wh. Au-delà de 100 Wh, une batterie au lithium ne voyage en avion qu'avec l'accord de la compagnie (règles de l'IATA) : c'est pour cela que tant de batteries de caméra s'arrêtent juste en dessous.",
  car: "Au stade, les HDC sont en fibre hybride SMPTE et leurs CCU les alimentent depuis le car : environ 2 km, selon la caméra et le câble. Les positions lointaines (un parvis, un plateau extérieur, une caméra au bout du pré-câblage du stade) passent en fibre monomode, avec un adaptateur et une alimentation sur place. À la baie CCU, la voie indique si la tête est alimentée par la CCU.",
  quiz: [
    {
      q: 'La caméra est à 900 m de la CCU, en fibre hybride. Elle ne s\'allume pas. Pourquoi ?',
      a: [
        ['La lumière n\'arrive plus au bout de 900 m de fibre.', 'La fibre perd très peu de lumière par kilomètre : c\'est l\'énergie qui manque, pas la lumière.'],
        ['Au-delà de 600 m, la CCU ne peut plus faire passer assez d\'énergie dans le cuivre du câble.', 'Exact : la chute de tension dans le cuivre limite l\'alimentation à 600 m pour cette caméra.'],
        ['La CCU coupe l\'image au-delà de 600 m pour protéger la caméra.', 'Ce n\'est pas une coupure de l\'image : la tête ne reçoit plus assez d\'énergie pour fonctionner.'],
      ],
      ok: 1,
    },
    {
      q: 'Sur fibre monomode, d\'où vient l\'énergie de la caméra ?',
      a: [
        ['D\'une source branchée sur DC IN, sur place : bloc secteur ou batterie, entre 10,5 et 17 V.', 'Exact : une fibre ne porte que de la lumière.'],
        ['De la CCU, par la fibre.', 'Une fibre porte de la lumière, pas de puissance utile.'],
        ['De la prise DC OUT.', 'DC OUT est une sortie : elle alimente un accessoire, pas la caméra.'],
      ],
      ok: 0,
    },
    {
      q: 'Sur une batterie de 95 Wh, la tête consomme 37 W. On ajoute une lampe de 12 W sur DC OUT. L\'autonomie passe…',
      a: [
        ['de 2,6 h à 2,6 h : DC OUT a sa propre batterie.', 'DC OUT prend son courant sur l\'alimentation de la caméra, donc sur la même batterie.'],
        ['de 2,6 h à 7,9 h.', 'C\'est l\'inverse : plus de puissance, moins d\'autonomie.'],
        ['d\'environ 2,6 h à environ 1,9 h.', 'Exact : 95 ÷ 37 ≈ 2,6 h, 95 ÷ 49 ≈ 1,9 h, sans compter les pertes.'],
      ],
      ok: 2,
    },
  ],
  see: ['connectique', 'fibre', 'ccu', 'cadreur'],
  ref: 'Fiche technique HXC-FB80 : consommation ≈ 19 W (corps), ≈ 32 W avec le viseur fourni ; DC IN XLR 4 broches, 10,5 à 17 V, 5,4 A au plus ; DC OUT 1,5 A au plus ; alimentation par câble hybride CCFN jusqu\'à 600 m (objectif portable, HXCU-FB80), 1000 m pour la HXC-P70 ; fibre monomode LC jusqu\'à 10 km avec alimentation locale. HXCU-FB80 : secteur 100 à 240 V',
  competences: ['2.7', '3.4', '3.8'],
  cours: 'camera-systeme',
};

// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « La fibre hybride et ses connecteurs ». Câble hybride SMPTE ST 311 : deux fibres
// monomodes (9/125 µm), deux conducteurs d'énergie, deux conducteurs basse tension ; connecteur
// SMPTE ST 304 (type LEMO 3K.93C). Sony HXC-FB80 et HXCU-FB80 (fiches Sony) : versions L
// (connecteur LEMO) et N (Neutrik opticalCON, câble hybride Sony CCFN) ; 600 m au plus en câble
// hybride, la CCU alimentant la caméra (HXC-FB80 avec objectif portable) ; 10 km au plus en fibre
// monomode (connecteurs LC), la caméra alimentée sur place. Diamètre du champ de mode d'une fibre
// G.652 à 1310 nm : 9,2 µm ; une poussière de 4 µm au centre du cœur arrête environ 31 % de la
// lumière (1,6 dB, intégrale du mode gaussien : labs/ch7.js, blockedFraction). Inspection des
// faces : IEC 61300-3-35 (zone du cœur de 25 µm de diamètre, aucune poussière admise). Pertes :
// ≈ 0,4 dB/km dans la fibre, ≈ 0,5 dB par connexion propre (ordres de grandeur, comme le Cours).
// La manipulation (labs/ch7.js, « fibre ») fait inspecter, nettoyer et brancher les quatre faces.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const FIBRE = {
  t: 'La fibre hybride et ses connecteurs', aka: 'Câble caméra hybride (SMPTE ST 311), connecteur SMPTE ST 304 ou Neutrik ; fibre monomode', chap: 7, lot: 2, point: 'fibre',
  short: 'Un seul câble entre la caméra et la CCU : deux fibres pour l\'image, les retours, l\'intercom et le tally, du cuivre pour l\'énergie. Ses connecteurs s\'inspectent et se nettoient avant chaque branchement.',
  fig: 'fibre',
  lab: 'fibre',
  body: "**Un câble pour tout.** Entre la caméra et sa CCU, il n'y a qu'un câble. On le dit **hybride** parce qu'il mêle du verre et du cuivre :\n- deux **fibres monomodes**, une par sens. Chacune est un fil de verre de 125 µm (un cheveu fait 50 à 100 µm) dont le centre, le **cœur**, ne fait que 9 µm : c'est lui qui guide la lumière d'un laser ;\n- des conducteurs de **cuivre** : deux pour l'énergie que la CCU envoie à la caméra, deux pour des signaux basse tension.\n\nVers la CCU montent l'image, le son des micros de la caméra, la voix du cadreur et son appel (CALL). Vers la caméra descendent les retours vidéo, les ordres de l'intercom, le tally, le prompteur, la synchronisation et toutes les commandes du RCP.\n\n**Pourquoi de la lumière.** La lumière perd très peu dans le verre, de l'ordre de 0,4 dB par kilomètre, et ne craint ni les parasites ni les boucles de masse. Sur ce câble, la limite vient du cuivre : plus il est long, plus la tension chute. Avec la HXC-FB80, la CCU alimente la caméra jusqu'à **600 m** de câble hybride (avec un objectif portable, d'après la fiche Sony). Au-delà, on passe en **fibre monomode seule**, connecteurs LC, jusqu'à **10 km**, et la caméra s'alimente sur place par DC IN.\n\n**Deux familles de connecteurs.** Selon la version, la HXC-FB80 et sa CCU ont une prise **SMPTE** (type LEMO 3K.93C : versions L ; câble SMPTE ST 311, connecteur ST 304) ou une prise **Neutrik opticalCON** (versions N, câble hybride Sony CCFN). L'une ne se branche pas sur l'autre : les câbles du plateau doivent être de la même famille que les caméras.\n\n**Le point faible : la poussière.** Dans un connecteur, les deux bouts de fibre se touchent face à face. Une poussière de quelques micromètres posée sur le cœur arrête une partie de la lumière ; au branchement, elle passe sur l'autre face, ou la raye. D'où la règle : **on inspecte et on nettoie les deux faces avant chaque branchement**, et on remet les bouchons dès qu'on débranche.",
  vraie: "La prise CCU du corps (la pastille « La prise fibre ») est protégée par un bouchon. Le connecteur du câble a un repère à aligner ; on l'enfonce, puis on visse ou on verrouille sa bague. Sur la caméra, la page D01 TRANSMISSION du menu DIAGNOSIS dit si la liaison avec la CCU est établie.\n\n**Le bon geste.**\n1. Caméra hors tension : CAM PW éteint au RCP avant de brancher ou de débrancher.\n2. Inspecter les deux faces, celle de la caméra et celle du câble, au microscope de poche.\n3. Nettoyer à sec (stylo de nettoyage ou cassette), puis réinspecter. L'alcool isopropylique seulement si une tache résiste, et toujours suivi d'un nettoyage à sec.\n4. Brancher, verrouiller la bague, attacher le câble pour qu'il ne tire pas sur la prise, sans pli serré.\n5. Remettre les bouchons sur tout ce qui reste libre.\n\n**L'erreur fréquente.** Souffler dans le connecteur (la salive fait pire que la poussière), l'essuyer avec un chiffon ou un tee-shirt, laisser un câble débouché par terre. Et regarder dans un connecteur pour « voir la lumière » : c'est un laser infrarouge, invisible à l'œil, on ne le regarde jamais.",
  plus: "- **Monomode.** Le cœur est si fin que la lumière n'y suit qu'un seul chemin, le « mode » : pas d'étalement des impulsions, pas de limite de débit à ces distances. Les fibres multimodes (cœur de 50 µm) ne servent pas aux caméras.\n- **Ce que coûte une poussière.** La lumière est concentrée au centre, sur un diamètre de 9,2 µm environ (le champ du mode). Une poussière de 4 µm posée au centre en arrête près d'un tiers : 1,6 dB perdus sur une seule connexion. La même sur la gaine, à 30 µm du centre, ne coûte rien… jusqu'au prochain branchement, qui la déplace (ordre de grandeur, calcul de la manipulation).\n- **L'inspection normalisée.** La norme IEC 61300-3-35 découpe la face en zones autour du cœur. Dans la zone centrale, 25 µm de diamètre, aucune poussière n'est admise ; plus loin, sur la gaine, quelques très petites particules sont tolérées.\n- **Le budget d'une liaison.** Une connexion propre coûte de l'ordre de 0,5 dB, la fibre de l'ordre de 0,4 dB par kilomètre : sur 100 m, le câble ne perd presque rien. Une liaison qui décroche sur un plateau, c'est presque toujours un connecteur.\n- **La courbure.** Une fibre trop pliée laisse fuir la lumière. Pas de boucle serrée, pas de câble coincé sous une porte ou écrasé par une roue de praticable.",
  car: "Au stade, les caméras HDC du car utilisent le câble hybride SMPTE (ST 311, connecteur ST 304), bien plus long : de la caméra à la prise de la passerelle, puis le pré-câblage du stade jusqu'au pied de car, environ 2 km au plus avec l'énergie envoyée par la CCU. Chaque raccord est un connecteur de plus à nettoyer : à la baie CCU, le niveau optique de chaque voie trahit tout de suite un connecteur oublié.",
  quiz: [
    {
      q: 'Dans le câble hybride entre la caméra et la CCU, que porte le cuivre ?',
      a: [
        ['L\'image, parce qu\'elle a un trop gros débit pour la fibre.', 'C\'est l\'inverse : la fibre porte sans peine des débits bien plus élevés que le cuivre. L\'image passe par une fibre.'],
        ['L\'énergie que la CCU envoie à la caméra, et des signaux basse tension.', 'Exact : la lumière ne transporte pas de puissance utile. Le cuivre alimente la caméra, et c\'est lui qui limite la longueur à 600 m avec la HXC-FB80.'],
        ['Rien : il ne sert qu\'à rendre le câble plus solide.', 'Le câble a des renforts pour la solidité ; ses conducteurs de cuivre, eux, portent l\'énergie et des signaux basse tension.'],
      ],
      ok: 1,
    },
    {
      q: 'Une poussière de quelques micromètres sur la face d\'une fibre : pourquoi est-ce grave ?',
      a: [
        ['Parce que le cœur ne fait que 9 µm : la poussière arrête une partie de la lumière, et au branchement elle passe sur l\'autre face ou la raye.', 'Exact : c\'est pour cela qu\'on inspecte et qu\'on nettoie les deux faces, pas une seule.'],
        ['Parce qu\'elle met le cuivre en court-circuit.', 'La poussière sur la face d\'une fibre n\'a rien d\'électrique : c\'est la lumière qui passe mal.'],
        ['Ce n\'est pas grave : la CCU corrige les erreurs de transmission.', 'Quand la lumière arrive trop faible, il n\'y a plus rien à corriger : la liaison décroche.'],
      ],
      ok: 0,
    },
    {
      q: 'Un concert dans une salle à 900 m de la régie, avec une HXC-FB80. Comment relier la caméra ?',
      a: [
        ['Deux câbles hybrides de 450 m bout à bout.', 'La longueur reste 900 m, avec un raccord de plus : au-delà de 600 m, la CCU ne peut plus alimenter la caméra par le cuivre.'],
        ['Un câble hybride, et le gain monté pour compenser la perte.', 'Le gain agit sur l\'image, pas sur la liaison ; et ce n\'est pas la lumière qui manque, c\'est l\'énergie.'],
        ['En fibre monomode seule, jusqu\'à 10 km, avec la caméra alimentée sur place par DC IN.', 'Exact : la lumière va bien plus loin que l\'énergie ; on alimente alors la caméra sur place.'],
      ],
      ok: 2,
    },
  ],
  see: ['connectique', 'alimentation', 'ccu', 'menu', 'rcp'],
  ref: 'SMPTE ST 311 (câble hybride : deux fibres monomodes, conducteurs d\'énergie et basse tension) et ST 304 (connecteur, type LEMO 3K.93C) ; fiches Sony HXC-FB80 et HXCU-FB80 : versions L (LEMO) et N (Neutrik, câble CCFN), 600 m au plus en câble hybride alimenté par la CCU (objectif portable), 10 km en fibre monomode LC avec alimentation locale ; inspection des faces : IEC 61300-3-35',
  competences: ['2.7', '4.2', '3.12'],
  cours: 'camera-systeme',
};

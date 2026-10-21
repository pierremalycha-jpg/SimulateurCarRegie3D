// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Le poste du cadreur ». Fiche technique HXC-FB80 : corps 3,4 kg, 6,8 kg avec objectif et
// viseur ; Fujinon ZA12x4.5BERD : 2,07 kg (version RD, sans pare-soleil). Mécanique : couple du
// poids = m × g × d (d : écart horizontal entre le centre de gravité et l'axe d'inclinaison) ;
// couple à compenser par le contrepoids à l'inclinaison θ : m × g × h × sin θ (h : hauteur du
// centre de gravité au-dessus de l'axe). Ordres de grandeur, dits comme tels : viseur 1,4 kg,
// prompteur léger 5 kg, axe 21 cm sous l'axe optique, crans de 2 N·m. La manipulation
// (camlab/labs/ch56.js, « cadreur ») fait équilibrer la caméra : plaque, contrepoids, prompteur.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const CADREUR = {
  t: 'Le poste du cadreur', aka: 'Tête fluide, manches, commandes reportées (zoom et point), équilibrage', chap: 6, lot: 3, point: 'manches',
  short: 'Les manches de la tête fluide, la commande de zoom sous le pouce, celle du point sous l\'autre main, et une caméra équilibrée sur la tête : elle doit rester où on la lâche.',
  fig: 'cadreur',
  lab: 'cadreur',
  body: "**Le pied et la tête.** Sur un plateau, la caméra est posée sur une **tête fluide** : le panoramique (de gauche à droite) et l'inclinaison (de haut en bas) sont freinés par un fluide visqueux, pour des mouvements sans à-coups. La tête est sur un pied ou un piédestal. Le cadreur la conduit par les **manches**, un ou deux bras fixés à l'arrière de la tête.\n\n**Les commandes reportées.** Les mains restent sur les manches : on y fixe les commandes de l'objectif, reliées par câble à sa poignée.\n- La **commande de zoom**, sur le manche droit : une bascule sous le pouce. Plus on appuie, plus le zoom va vite ; relâchée, elle revient au milieu.\n- La **commande de point**, sur le manche gauche : une manivelle ou une molette qui fait tourner la bague de point par le servo.\n\nUne fois branchées, le cadreur ne touche plus l'objectif.\n\n**L'équilibrage.** Le poids de la caméra agit en un point, le **centre de gravité**. S'il est en avant de l'axe d'inclinaison de la tête, la caméra pique du nez ; en arrière, elle part vers le haut. Le couple vaut masse × g × distance : une caméra de 7 kg dont le centre de gravité est à 2 cm de l'axe, c'est 7 × 9,81 × 0,02 ≈ 1,4 N·m. On fait glisser la **plaque** de la tête jusqu'à ce que le centre de gravité soit au-dessus de l'axe : la caméra tient seule à l'horizontale.\n\n**Le contrepoids.** Le centre de gravité est aussi plus haut que l'axe, d'une vingtaine de centimètres. Dès qu'on incline, il sort de la verticale et la caméra tend à continuer. Les ressorts du **contrepoids** compensent ce couple, qui grandit avec la masse et la hauteur : on le règle pour la charge, jusqu'à ce que la caméra reste où on la lâche, vers le haut comme vers le bas. Les **frictions** se règlent en dernier, au goût du cadreur.\n\n**L'ordre des gestes.** Inclinaison verrouillée, on charge et on fait glisser la plaque ; on déverrouille et on essaie ; on règle le contrepoids ; puis les frictions. Tout ajout (pare-soleil, prompteur, housse de pluie) se rééquilibre, verrou fermé.",
  vraie: "Sur la caméra du plateau, la plaque coulisse sous le corps, avec son levier de blocage ; les manches sont à l'arrière de la tête. Les commandes reportées se branchent sous la poignée de l'objectif (les deux prises à embout vert). Avec son objectif et son viseur, la HXC-FB80 pèse de l'ordre de 7 kg (6,8 kg d'après la fiche Sony).\n\n**Le bon geste.** Rééquilibrer à chaque changement de charge, verrou fermé pour faire glisser la plaque. Lâcher la caméra à +30° et à −30° : elle doit rester. Garder une main sur le manche tant que l'équilibrage n'est pas fait. Brancher la commande de zoom et vérifier son sens (T vers le serré) avant de prendre le premier plan.\n\n**L'erreur fréquente.** Serrer les frictions pour « tenir » une caméra mal équilibrée : les mouvements deviennent durs et saccadés, et la caméra part dès qu'on desserre. Ou poser le prompteur tête libre : la caméra bascule d'un coup vers l'avant.",
  plus: "- **Le contrepoids, en chiffres.** Le couple à compenser à l'inclinaison θ vaut m × g × h × sin θ, avec h la hauteur du centre de gravité au-dessus de l'axe : 7 kg à 25 cm, c'est 17 N·m à 90° et 8,6 N·m à 30°. D'où les crans du contrepoids, choisis d'après la charge.\n- **Quand la plaque ne suffit pas.** Un prompteur pèse plusieurs kilos devant l'objectif (ordre de grandeur : 5 kg pour un modèle léger). La caméra double presque de poids et son centre de gravité avance : il faut reculer la plaque, augmenter le contrepoids, parfois changer de tête.\n- **Le zoom en servo.** La commande de zoom pilote le moteur de l'objectif : sa vitesse suit la pression du pouce. Une molette sur la commande en règle souvent la vitesse maximale.\n- **Le piédestal.** Sur les plateaux, un piédestal à colonne pneumatique monte et descend la caméra d'une main ; il s'équilibre lui aussi pour la charge.",
  car: "Au stade, les caméras de tribune sont bien plus lourdes : objectif box et adaptateur, près de 50 kg sur la tête. Les gestes sont les mêmes, à une autre échelle : verrou, plaque, contrepoids, frictions (leçon « Monter une caméra de stade »). Les commandes reportées aussi : le zoom sous le pouce droit, le point à gauche.",
  quiz: [
    {
      q: 'Tête déverrouillée, la caméra pique du nez dès qu\'on la lâche à l\'horizontale. Que fait-on ?',
      a: [
        ['On serre la friction d\'inclinaison.', 'La friction freine, elle ne corrige rien : la caméra partira dès qu\'on desserre, et les mouvements seront durs.'],
        ['On verrouille, puis on recule la plaque jusqu\'à ce que le centre de gravité soit au-dessus de l\'axe.', 'Exact : le centre de gravité est en avant de l\'axe ; on le ramène au-dessus.'],
        ['On monte le contrepoids.', 'Le contrepoids compense la hauteur du centre de gravité quand on incline ; à l\'horizontale, c\'est la plaque qui compte.'],
      ],
      ok: 1,
    },
    {
      q: 'Bien équilibrée à l\'horizontale, la caméra continue de basculer dès qu\'on l\'incline à 30°. Pourquoi ?',
      a: [
        ['Le contrepoids est trop faible : le centre de gravité, plus haut que l\'axe, sort de la verticale.', 'Exact : il faut plus de ressort pour compenser m × g × h × sin θ.'],
        ['La plaque est mal placée.', 'À l\'horizontale, elle tient : la plaque est juste. En inclinant, c\'est la hauteur du centre de gravité qui joue.'],
        ['Le fluide de la tête est usé.', 'Le fluide freine le mouvement, il ne le retient pas : ce n\'est pas lui qui équilibre.'],
      ],
      ok: 0,
    },
    {
      q: 'Où sont les commandes de zoom et de point d\'une caméra de plateau sur sa tête ?',
      a: [
        ['Sur l\'objectif, sous la main droite, pour les deux.', 'C\'est la poignée de l\'objectif, quand la caméra est à l\'épaule ; sur la tête, les mains restent sur les manches.'],
        ['Au RCP de la vision.', 'La vision règle l\'iris et la couleur ; le cadre, le zoom et le point sont au cadreur.'],
        ['Sur les manches : le zoom sous le pouce droit, le point sous la main gauche.', 'Exact : ce sont les commandes reportées, branchées sur la poignée de l\'objectif.'],
      ],
      ok: 2,
    },
  ],
  see: ['zoom', 'point', 'box-portable', 'viseur', 'tally', 'alimentation'],
  ref: 'Fiche technique HXC-FB80 : corps 3,4 kg, 6,8 kg avec objectif et viseur ; Fujinon ZA12x4.5BERD : 2,07 kg (RD, sans pare-soleil) ; couple = m × g × d, contrepoids m × g × h × sin θ ; masses du viseur et du prompteur, position de l\'axe : ordres de grandeur',
  competences: ['2.9', '4.2'],
  cours: 'camera-montage',
};

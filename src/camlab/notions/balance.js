// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Balance des blancs et des noirs ». Mode d'emploi HXC-FB80 : commutateurs WHITE BAL
// (PRST 3200 K, mémoires A et B), WHT/BLK (à ressort), OUTPUT/AUTO KNEE (BARS, CAM),
// COLOR TEMP. (5600 K) ; messages du viseur ABB: EXECUTING / ABB: OK, AWB: EXECUTING / AWB: OK ;
// pendant l'ABB l'iris se ferme tout seul ; pour l'AWB, un blanc bien exposé au centre du cadre.
// Dérive sans balance (optics.js, castOf) : réglée 5600 K et filmée en tungstène 3200 K, la
// caméra voit le rouge 1,66 fois trop fort et le bleu 0,41 fois trop faible. La manipulation
// (camlab/labs/bloc.js, « balance ») enchaîne ABB, AWB sur carton, puis le passage en lumière du jour.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const BALANCE = {
  t: 'Balance des blancs et des noirs', aka: 'White balance (AWB), black balance (ABB)', chap: 4, lot: 1, point: 'commandes',
  short: 'Montrer un carton blanc à la caméra pour qu\'elle le rende blanc, quelle que soit la lumière ; caler les trois noirs, iris fermé.',
  fig: 'balance',
  lab: 'balance',
  body: "**Pourquoi une balance.** Nos yeux s'adaptent à la lumière : une feuille blanche nous paraît blanche sous une lampe comme au soleil. Pas la caméra. Sous une lampe tungstène (3200 K), plus orange, son capteur rouge reçoit bien plus que le bleu ; à la lumière du jour (5600 K), c'est le bleu qui domine. Faire la balance des blancs, c'est régler le gain des voies rouge et bleue pour qu'un blanc donne R = G = B. On le dit à la caméra ; elle ne le devine pas.\n\n**D'abord les noirs (ABB).** Avant le blanc, le zéro : l'iris se ferme tout seul, la caméra mesure le niveau de ses trois voies dans l'obscurité et le ramène à zéro, pour que le noir soit noir, sans teinte dans les ombres. On la fait à la mise en service, après un changement de température ou de gain, et toujours avant la balance des blancs. Le viseur affiche ABB: EXECUTING, puis ABB: OK.\n\n**Puis les blancs (AWB).**\n1. WHITE BAL sur A ou B, OUTPUT sur CAM.\n2. Un carton blanc sous la lumière qui éclairera la scène, face à la caméra, sans ombre ni reflet, remplissant le centre du cadre.\n3. Exposer : le blanc vers 80 %, ni écrêté ni enfoui dans le bruit.\n4. Pousser WHT. AWB: EXECUTING, puis AWB: OK : le réglage est enregistré dans la mémoire choisie.\n\nSi la caméra répond NG, elle dit pourquoi : niveau trop bas ou trop haut, pas de blanc au centre, lumière hors de ce qu'elle sait corriger.\n\n**Deux mémoires et un préréglage.** A et B gardent deux balances, le tungstène dans l'une, la lumière du jour dans l'autre : on passe de l'une à l'autre d'un geste. PRST est un préréglage à 3200 K, sans mesure ; le bouton COLOR TEMP. bascule le préréglage sur 5600 K. Ça dépanne, mais aucune lumière n'est exactement à 3200 ou 5600 K : une balance mesurée reste plus juste.\n\n**Pas un filtre.** Sur cette caméra, l'adaptation à la lumière est électronique : page CC du menu (3200, 4300, 5600, 6300 K) et gains des voies. Il n'y a pas de roue de filtres colorés.",
  vraie: "Les commandes sont sur le côté droit du corps : WHITE BAL (PRST, A, B), WHT/BLK (à ressort, on le pousse vers le haut pour le blanc, vers le bas pour le noir), OUTPUT/AUTO KNEE (BARS ou CAM) et le bouton COLOR TEMP. Les messages s'affichent dans le viseur.\n\nReliée à la CCU, c'est la vision qui lance les balances depuis le RCP (touches AUTO WHITE et AUTO BLACK), pendant que le cadreur tient le carton : « montre-moi le blanc ».\n\n**Le bon geste.** Le carton sous la lumière principale, en face, plein cadre, mat et propre. Noirs d'abord, blancs ensuite. Refaire la balance à chaque changement de lumière : un projecteur de plus, le jour qui entre, un changement de filtre.\n\n**L'erreur fréquente.** Faire la balance sur un blanc qui n'est pas blanc, un mur crème, une chemise : toute l'image bascule dans la couleur opposée. Pousser WHT avec OUTPUT sur BARS : rien ne se passe, la caméra ne voit plus l'image. Ou refaire les blancs sans refaire les noirs après un changement de gain.",
  plus: "- **Les kelvins.** La température de couleur décrit la lumière d'un corps chauffé : plus il est chaud, plus sa lumière est bleue. 3200 K, c'est le filament d'une lampe ; 5600 K, le soleil avec le ciel ; 6500 K, le blanc de référence des écrans (D65). Une bougie est vers 1800 K.\n- **Orange-bleu seulement.** La balance corrige un écart entre le rouge et le bleu. Une dominante verte ou magenta, celle des tubes fluorescents ou de certaines LED, n'est pas sur cet axe : elle se corrige mal, par la matrice ou en changeant de lampes.\n- **Le gris aussi.** Une charte grise à 18 % fait aussi bien l'affaire qu'un blanc, et elle a moins tendance à écrêter.\n- **Réchauffer exprès.** La vision peut décaler la balance à la main (gains R et B du RCP) pour une image plus chaude, à condition de le faire sur toutes les caméras : c'est le line-up.\n- **ATW.** Les caméras d'épaule ont une balance qui suit la lumière en continu. Sur un plateau, on ne s'en sert pas : l'image ne doit pas changer toute seule.",
  car: "Dans le car, la vision fait les balances de toutes les caméras au début, sur le même carton ou sur la charte, dans la même lumière : c'est la base du line-up, pour que l'on puisse couper d'une caméra à l'autre sans que le blanc change. Le cadreur tient le carton, en face, plein cadre, et attend le « merci ».",
  quiz: [
    {
      q: 'Pourquoi fait-on la balance des noirs avant celle des blancs ?',
      a: [
        ['Parce que la caméra refuse l\'AWB tant que l\'ABB n\'a pas été faite.', 'Elle ne la refuse pas. C\'est une question de justesse.'],
        ['Parce que les noirs sont le zéro : un noir coloré fausserait la mesure du blanc, et toute l\'image.', 'Exact : d\'abord le zéro des trois voies, puis le blanc.'],
        ['Parce que l\'ABB ouvre l\'iris, ce qui prépare l\'AWB.', 'C\'est l\'inverse : pendant l\'ABB, l\'iris se ferme tout seul.'],
      ],
      ok: 1,
    },
    {
      q: 'La balance est faite sous tungstène (3200 K) en mémoire A. On passe en lumière du jour sans rien changer. L\'image est…',
      a: [
        ['bleue : la lumière du jour contient plus de bleu, et la caméra l\'amplifie encore comme sous tungstène.', 'Exact : le bleu est deux fois trop fort, le rouge trop faible. On refait la balance en B, ou on passe sur 5600K.'],
        ['orange : la lumière du jour est plus chaude.', 'La lumière du jour est plus bleue, pas plus orange. L\'orange, c\'est l\'erreur inverse : réglée jour, filmée tungstène.'],
        ['inchangée : la caméra suit la lumière.', 'Rien ne suit tout seul : la balance est figée dans la mémoire A.'],
      ],
      ok: 0,
    },
    {
      q: 'AWB : la caméra répond NG, niveau trop bas. Que faire ?',
      a: [
        ['Monter le gain à +12 dB et recommencer.', 'Le gain ajoute du bruit à la mesure. On cherche d\'abord de la lumière, ou de l\'iris.'],
        ['Passer OUTPUT sur BARS.', 'Sur BARS, la balance est impossible : la caméra ne voit plus l\'image.'],
        ['Ouvrir l\'iris jusqu\'à ce que le blanc soit vers 80 %, sans écrêter, puis recommencer.', 'Exact : la balance a besoin d\'un blanc bien exposé, ni écrêté ni enfoui dans le bruit.'],
      ],
      ok: 2,
    },
  ],
  see: ['cc', 'noir', 'rcp', 'lineup', 'mires', 'gain', 'matrice'],
  ref: 'Mode d\'emploi HXC-FB80 : commutateurs WHITE BAL (PRST, A, B), WHT/BLK, OUTPUT/AUTO KNEE (BARS, CAM), bouton COLOR TEMP. ; messages ABB/AWB: EXECUTING et OK ; PRST 3200 K, COLOR TEMP. 5600 K ; page CC du menu',
  competences: ['2.7', '1.4'],
};

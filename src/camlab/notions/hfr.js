// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Le super ralenti ». Caméra k× : 50 k images par seconde en 50 Hz, temps de pose au plus
// 1 ÷ (50 k) s, lumière perdue log2 k diaphragmes (1,6 à 3×, 2,6 à 6×, 3 à 8×) ; sorties sur k phases à
// 50 i/s, enregistrées sur k entrées du serveur (Cours, « Le serveur ralenti » : EVS XT4K). Ralenti
// fluide quand vitesse × k ≥ 1. Fiche Sony HDC-5500 : HFR en HD à 3×, 4×, 6× et 8× (option),
// sensibilité f/11 à 2 000 lx en 1080/50p, donc environ f/6,4 à 3× (f/11 ÷ √3). Sony HXC-FB80 :
// formats jusqu'à 1080/50p (59,94p en 60 Hz). Scintillement (camlab/labs/ch89.js, frameLight) :
// lampe sur secteur 50 Hz, lumière qui bat à 100 Hz ; une image reçoit la moyenne sur sa durée,
// constante si elle contient un nombre entier de battements (1× et 2×). Profondeur du battement
// d'une lampe à décharge sur une seule phase : 35 % dans la manipulation, un ordre de grandeur.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const HFR = {
  t: 'Le super ralenti', aka: 'HFR (High Frame Rate) : caméra à 150, 300 images par seconde et plus', chap: 9, lot: 3,
  short: 'Filmer à 150 ou 300 images par seconde pour ralentir sans saccade : les caméras HFR du car et le serveur EVS.',
  fig: 'hfr',
  lab: 'hfr',
  cours: 'ralentis-evs',
  body: "**Pourquoi une caméra plus rapide.** Le serveur relit les images plus lentement, mais la sortie du car reste à 50 images par seconde. Une caméra normale en prend 50 : relue à 33 %, chaque image doit être montrée trois fois, et le mouvement avance par à-coups. Une caméra **super ralenti** (HFR, pour haute fréquence d'images) en prend davantage :\n- **3×** : 150 images par seconde ; relue à 33 %, chaque image est montrée une seule fois ;\n- **6×** : 300 images par seconde ; fluide jusqu'à 16,7 % ;\n- la règle : le ralenti reste fluide tant que la vitesse de relecture multipliée par la cadence (en multiples de 50) vaut au moins 1.\n\n**Les phases.** La caméra sort ses 150 images sur trois liaisons à 50 images par seconde : la phase A (images 1, 4, 7…), la phase B (2, 5, 8…), la phase C (3, 6, 9…). Le serveur les enregistre sur trois entrées et les recombine. Une phase oubliée, et le ralenti saute une image sur trois.\n\n**Ce que ça coûte en lumière.** Une image ne peut pas durer plus longtemps que l'intervalle entre deux images : 1/150 s à 3×, 1/300 s à 6×. Trois fois moins de lumière à 3× (1,6 diaphragme), six fois moins à 6× (2,6 diaphragmes), huit fois moins à 8× (3 diaphragmes). La HDC-5500, qui donne f/11 à 2 000 lux en 1080/50p (fiche Sony), ne donne plus qu'environ f/6,4 à 3× : il faut ouvrir l'iris, ou monter le gain. En échange, chaque image est plus courte, donc plus nette sur ce qui bouge.\n\n**Le scintillement.** Les lampes à décharge branchées sur le secteur à 50 Hz battent à 100 Hz. À 50 images par seconde (1/50 s), chaque image contient deux battements entiers ; à 100 images par seconde (1/100 s), un battement entier : toutes reçoivent la même lumière. À 150 images par seconde, une image ne dure que les deux tiers d'un battement : les images n'ont plus toutes la même lumière, et le ralenti clignote. C'est pourquoi les stades s'équipent de projecteurs à LED qui ne scintillent pas.",
  vraie: "La HXC-FB80 ne fait pas de super ralenti : ses formats montent jusqu'au 1080/50p (59,94p dans les pays à 60 Hz). Une caméra HFR est une caméra système d'une gamme au-dessus : la HDC-5500 du car tourne en HD à 3×, 4×, 6× ou 8× avec son option HFR, et sort ses phases par sa CCU vers le serveur.\n\n**Le bon geste.** Prévoir la lumière (ouvrir l'iris plutôt que monter le gain) ; vérifier avec l'opérateur ralenti que toutes les phases sont enregistrées ; laisser le temps de pose à la durée de l'image (1/150 s à 3×) ; régler la caméra HFR sur les autres au line-up, comme une caméra normale.\n\n**L'erreur fréquente.** Passer la caméra de 1× à 3× sans rouvrir l'iris : l'image perd 1,6 diaphragme. Ou n'enregistrer que la phase A : le ralenti à 33 % saccade comme celui d'une caméra normale.",
  plus: "- **L'angle d'obturation.** On dit aussi 360° quand l'image est exposée pendant toute sa durée : à 3×, 360° vaut 1/150 s.\n- **En 60 Hz.** Aux États-Unis ou au Japon, 3× vaut 180 images par seconde (3 × 59,94).\n- **Plus vite encore.** Des caméras spéciales tournent à 1 000 images par seconde et plus (ordre de grandeur) ; souvent, elles enregistrent dans une mémoire interne qu'on relit juste après l'action.\n- **Le calcul du scintillement.** Une image de durée T reçoit la moyenne de la lumière pendant T : elle ne varie pas d'une image à l'autre si T contient un nombre entier de battements (1/100 s, 1/50 s). Sous des lampes qui battent à 100 Hz, seules les cadences 1× et 2× sont à l'abri.\n- **Le serveur.** Une caméra 3× occupe trois entrées d'enregistrement : sur un XT4K à six entrées, une caméra 3× et trois caméras normales (le Cours, « Le serveur ralenti »).",
  car: "Le car du simulateur a des caméras super ralenti 3× (une HDC-5500 en HFR, trois phases vers l'EVS) et 6× (six phases, beaucoup de lumière). Au poste vision, l'écran du RCP affiche « HFR 3x » à côté du temps de pose ; au poste Ralentis, la caméra 3× se relit à 33 %.",
  quiz: [
    {
      q: 'Une caméra 6× (300 images par seconde) : à quelle vitesse de relecture chaque image est-elle montrée une seule fois ?',
      a: [
        ['33 %.', 'À 33 %, le serveur ne montre qu\'une image sur deux : c\'est fluide, mais on pourrait ralentir deux fois plus.'],
        ['50 %.', 'À 50 %, il ne montre qu\'une image sur trois.'],
        ['16,7 %, un sixième.', 'Exact : 6 × 1/6 = 1, chaque image enregistrée passe une fois à l\'antenne.'],
      ],
      ok: 2,
    },
    {
      q: 'On passe une caméra de 1× à 3× sans toucher l\'iris. L\'image…',
      a: [
        ['s\'assombrit d\'environ 1,6 diaphragme : chaque image dure trois fois moins longtemps.', 'Exact : 1/150 s au lieu de 1/50 s, trois fois moins de lumière ; il faut rouvrir l\'iris.'],
        ['ne change pas : la caméra compense toute seule.', 'Rien ne compense, sauf un iris automatique ; en régie, c\'est la vision qui rouvre.'],
        ['s\'éclaircit : trois fois plus d\'images.', 'Plus d\'images, mais chacune reçoit moins de lumière.'],
      ],
      ok: 0,
    },
    {
      q: 'Sous des projecteurs qui scintillent à 100 Hz, le ralenti 3× clignote, mais la relecture à 100 % de la même caméra ne clignote pas. Pourquoi ?',
      a: [
        ['Parce que le serveur filtre le scintillement à 100 %.', 'Le serveur ne filtre rien : il relit ce qu\'il a enregistré.'],
        ['Parce qu\'à 100 %, le serveur ne montre qu\'une phase sur trois, toujours la même : ses images ont toutes la même lumière.', 'Exact : 150 i/s et 100 Hz se retrouvent toutes les trois images ; chaque phase a sa lumière, et à 100 % on n\'en voit qu\'une.'],
        ['Parce que le scintillement n\'existe qu\'au ralenti.', 'Il est dans les images enregistrées ; c\'est la relecture qui le montre ou non.'],
      ],
      ok: 1,
    },
  ],
  see: ['shutter', 'formats', 'exposition', 'gain', 'ccu', 'hdr', 'sortie'],
  ref: 'Fiche Sony HDC-5500 : HFR en HD à 3×, 4×, 6× et 8× (option), sensibilité f/11 à 2 000 lx en 1080/50p ; Sony HXC-FB80 : formats jusqu\'à 1080/50p et 59,94p ; temps de pose au plus 1 ÷ cadence ; lampes sur secteur 50 Hz : battement à 100 Hz ; serveur EVS XT4K (Cours, « Le serveur ralenti »)',
  competences: ['2.7', '2.9'],
};

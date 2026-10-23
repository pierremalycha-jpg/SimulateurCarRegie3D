// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Sensibilité, gain et bruit ». Fiche technique HXC-FB80 : sensibilité F12 (59,94 Hz),
// F13 (50 Hz) à 2000 lx, 3200 K, réflectance 89,9 % ; rapport signal sur bruit 60 dB ; gain
// −3, 0, 3, 6, 9, 12 dB. Mode d'emploi : commutateur GAIN L, M, H sur le côté droit, valeurs
// réglées par GAIN dans la page SWITCH ASSIGN1 du menu OPERATION (d'usine L = 0 dB, M = 6 dB,
// H = 12 dB) ; reliée à une CCU ou à un RCP, les commutateurs du corps (GAIN, SHUTTER, WHITE BAL…)
// sont commandés par l'appareil relié. Calculs : amplification 10^(dB/20), +6,02 dB par
// diaphragme ; nombre f à 0 dB pour E lux : 13 × √(E ÷ 2000) (400 lx → f/5,8 ; 20 lx → f/1,3) ;
// lumière pour 100 % à f/5,6 : 2000 × (5,6 ÷ 13)² = 371 lx ; F12 en 59,94 Hz : pose 1/60 au lieu
// de 1/50, (13 ÷ 12)² ≈ 1,17. Le rapport signal sur bruit d'une caméra broadcast se mesure
// objectif fermé : le gain l'abaisse d'autant de dB (54 dB à +6 dB). HFR 3x (150 i/s) : pose
// d'au plus 1/150 s, 1,6 diaphragme de moins. La manipulation (camlab/labs/ch23.js, « gain »).
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const GAIN = {
  t: 'Sensibilité, gain et bruit', aka: 'Sensitivity, gain (dB), signal-to-noise ratio (S/N)', chap: 3, lot: 2, point: 'commandes',
  short: 'Le gain amplifie le signal du capteur : +6 dB vaut un diaphragme de plus, mais aussi deux fois plus de bruit. La FB80 donne f/13 à 2000 lux en 50 Hz.',
  fig: 'gain',
  lab: 'gain',
  body: "**La sensibilité.** La fiche de la FB80 dit **f/13 à 2000 lux** (50 Hz, lumière à 3200 K, un blanc qui renvoie 89,9 % de la lumière) : une scène éclairée à 2000 lux sort au niveau nominal à f/13, sans gain. On en tire l'iris de n'importe quelle scène : N = 13 × √(lux ÷ 2000).\n- 400 lux, un plateau modeste : f/5,8 ;\n- 100 lux : f/2,9 ;\n- 20 lux, une salle très sombre : f/1,3. L'objectif ne s'ouvre qu'à f/1,8 : il manque de la lumière.\n\n**Le gain.** Quand l'iris est grand ouvert et qu'il manque encore de la lumière, la caméra peut amplifier le signal de ses capteurs. Le gain se compte en **décibels** : ×10^(dB ÷ 20).\n- +6 dB : ×2, un diaphragme de plus ;\n- +12 dB : ×4, deux diaphragmes ;\n- −3 dB : ×0,71, un demi-diaphragme de moins.\n\n**Le bruit.** Le gain n'ajoute aucune lumière : il amplifie le signal et le **bruit** du capteur ensemble. La FB80 annonce 60 dB de rapport signal sur bruit, mille contre un, mesuré objectif fermé à 0 dB. À +6 dB, le bruit double : 54 dB ; à +12 dB, 48 dB. Il se voit d'abord dans les noirs et les zones sombres, sous la forme d'un grain qui fourmille.\n\n**Les noirs bougent.** Le niveau de noir des trois voies change un peu avec le gain, et pas de la même façon dans chacune : après un changement de gain, on refait la balance des noirs (ABB), sinon les ombres prennent une teinte.\n\n**La lumière d'abord.** Avant de monter le gain : l'iris grand ouvert, le filtre sur CLEAR, le shutter sur OFF. Le gain vient en dernier, quand toute la lumière disponible est déjà entrée.",
  vraie: "Le commutateur **GAIN** est sur le côté droit du corps, à trois positions : **L, M, H**. D'usine, 0, 6 et 12 dB ; on change ces trois valeurs dans la page SWITCH ASSIGN1 du menu OPERATION. Le viseur affiche le gain pendant quelques secondes quand on bascule le commutateur, et en permanence si l'indicateur GAIN est allumé (page VF DISPLAY).\n\nReliée à la CCU, c'est le RCP qui commande le gain : le commutateur du corps ne fait plus rien. La vision choisit le gain par pas de 3 dB.\n\n**Le bon geste.** Demander de la lumière avant de monter le gain. Mettre toutes les caméras d'une même scène au même gain, pour que leur grain se ressemble. Refaire la balance des noirs après chaque changement de gain.\n\n**L'erreur fréquente.** Laisser le commutateur sur H après une scène sombre, puis fermer l'iris au plein jour : l'image est juste, mais deux fois plus bruitée qu'il ne faut. Ou rattraper un filtre ND oublié par du gain.",
  plus: "- **Pourquoi des décibels.** Le gain d'un amplificateur vidéo se note 20 × log10 du rapport des tensions : ×2 donne 6,02 dB. Les crans de 3 dB tombent sur des demi-diaphragmes.\n- **F12 ou F13.** En 59,94 Hz, chaque image ne dure que 1/60 s au lieu de 1/50 : un peu moins de lumière par image, d'où F12 au lieu de F13 à 2000 lux.\n- **Deux bruits.** Celui de l'électronique, fixe, domine dans les noirs ; celui des photons, qui vaut la racine du nombre d'électrons, domine dans les gris (voir le capteur). Le gain les amplifie tous les deux.\n- **Le détail amplifie le bruit.** Le contour ajouté par le détail se déclenche aussi sur le grain : à fort gain, la vision baisse souvent le détail.\n- **ISO.** Les caméras de cinéma donnent leur sensibilité en ISO ; la télévision la donne en nombre f à 2000 lux. Ce sont deux façons de dire la même chose.",
  car: "Dans le car, le gain est sur le RCP de chaque caméra, et la vision le change pour toutes à la fois, quand l'éclairage baisse en fin de soirée. Les caméras de super ralenti sont les premières à en manquer : en 3x, chaque image ne dure qu'au plus 1/150 s, un diaphragme et demi de lumière en moins que les autres caméras. Après un changement de gain, la vision refait la balance des noirs des caméras concernées.",
  quiz: [
    {
      q: 'On passe de 0 à +12 dB. Combien de diaphragmes gagne-t-on ?',
      a: [
        ['Un.', 'Un diaphragme, c\'est +6 dB, ×2. Ici, c\'est deux fois plus.'],
        ['Deux : +12 dB, c\'est ×4.', 'Exact : 6 dB par diaphragme, et le bruit est multiplié par quatre aussi.'],
        ['Douze : un par décibel.', 'Le décibel n\'est pas un diaphragme : il en faut six pour un diaphragme.'],
      ],
      ok: 1,
    },
    {
      q: 'La FB80 annonce 60 dB de rapport signal sur bruit à 0 dB. À +6 dB, il est d\'environ…',
      a: [
        ['54 dB : le gain double le bruit, le niveau nominal de sortie ne change pas.', 'Exact : le rapport se mesure entre le niveau nominal de sortie et le bruit, objectif fermé. +6 dB double le bruit sans changer ce niveau : 6 dB de rapport en moins. À l\'image, ce niveau est atteint avec deux fois moins de lumière.'],
        ['66 dB : plus de signal, donc un meilleur rapport.', 'Le gain n\'ajoute aucune lumière : il amplifie aussi le bruit du capteur. Le rapport ne peut que baisser.'],
        ['60 dB : signal et bruit sont amplifiés autant.', 'Le bruit est bien doublé, mais le signal de référence reste le niveau nominal de sortie : à +6 dB, on l\'atteint avec deux fois moins de lumière. Le rapport perd 6 dB.'],
      ],
      ok: 0,
    },
    {
      q: 'Salle sombre, iris grand ouvert à f/1,8, l\'image est encore sombre. Avant de monter le gain, que vérifie-t-on ?',
      a: [
        ['Que l\'iris peut encore se fermer.', 'Fermer l\'iris retirerait de la lumière : c\'est l\'inverse.'],
        ['Que le shutter est sur 1/250 pour une image plus nette.', 'Un shutter court retire de la lumière : on le veut sur OFF.'],
        ['Que le filtre est sur CLEAR et le shutter sur OFF : aucune lumière perdue avant de l\'amplifier.', 'Exact : le gain vient en dernier, quand toute la lumière est entrée.'],
      ],
      ok: 2,
    },
  ],
  see: ['capteur', 'exposition', 'iris', 'noir', 'balance', 'rcp', 'hfr'],
  ref: 'Fiche technique HXC-FB80 : sensibilité F12 (59,94 Hz), F13 (50 Hz) à 2000 lx, 3200 K, réflectance 89,9 % ; rapport signal sur bruit 60 dB ; gain −3 à +12 dB ; mode d\'emploi HXC-FB80 : commutateur GAIN L, M, H (0, 6 et 12 dB d\'usine, page SWITCH ASSIGN1), commandé par le RCP quand la caméra est reliée ; 20 × log10 : 6,02 dB par diaphragme',
  competences: ['2.9', '1.4'],
};

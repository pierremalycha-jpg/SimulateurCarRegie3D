// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Le moniteur de référence ». ITU-R BT.709 : primaires et blanc D65 de la HD. ITU-R BT.1886 :
// courbe d'affichage L = a × max(V + b, 0)^2,4 (a et b tirés du blanc et du noir de l'écran).
// ITU-R BT.2035 : environnement de référence, blanc à 100 cd/m², fond d'environ 10 cd/m² derrière
// l'écran. PLUGE : ITU-R BT.814 ; barres HD SMPTE RP 219 avec PLUGE à −2, +2 et +4 %. EBU Tech 3320 :
// moniteurs Grade 1 (évaluation), 2 (contrôle), 3 (présence). HDR : BT.2100, HLG à 1 000 cd/m²,
// blanc de référence à 203 cd/m² (BT.2408). La manipulation (camlab/labs/ch89.js, « moniteur ») :
// luminosité et contraste agissent sur le signal affiché, la chroma sur Cb et Cr ; dalle de 250 cd/m²
// au plus (ordre de grandeur) ; une plage se distingue de sa voisine à 0,5 % d'écart (modèle).
// Le préchauffage d'une demi-heure est un ordre de grandeur d'usage.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const MONITEUR = {
  t: 'Le moniteur de référence', aka: 'Moniteur de contrôle Grade 1 ; réglage à la PLUGE et en bleu seul', chap: 8, lot: 3, point: 'moniteur',
  short: 'Un écran réglé selon la norme (BT.709, gamma 2,4, 100 cd/m²) pour juger l\'image ; son réglage avec la mire PLUGE et le bleu seul.',
  fig: 'moniteur',
  lab: 'moniteur',
  body: "**Pourquoi un écran à part.** Pour juger une image (son noir, ses couleurs, son contraste), il faut un écran qui montre ce que le signal contient, ni plus ni moins. Un téléviseur de salon « embellit » : contraste poussé, couleurs saturées, netteté ajoutée. Le moniteur de référence suit la norme : tous les moniteurs de référence montrent la même image.\n\n**Ce que dit la norme.**\n- Les couleurs de la HD : les primaires de la BT.709 et un blanc D65, autour de 6 500 K.\n- La courbe d'affichage (BT.1886) : un gamma de 2,4. La caméra a comprimé les tons avec une courbe en puissance 0,45 environ ; l'écran les déplie avec 2,4. Le produit, environ 1,2, rend l'image un peu plus contrastée que la scène : c'est voulu, pour une pièce peu éclairée.\n- Le blanc à 100 cd/m² (la candela par mètre carré mesure la lumière qu'émet l'écran), dans une pièce sombre, avec un fond neutre derrière l'écran d'environ 10 cd/m² (BT.2035).\n\n**Les trois réglages, dans l'ordre.**\n1. **La luminosité, à la PLUGE.** La mire PLUGE pose sur le noir trois petites barres : une à −2 %, plus noire que le noir, une à +2 % et une à +4 %. On monte la luminosité jusqu'à voir la −2 %, puis on redescend jusqu'à ce qu'elle disparaisse : la +2 % doit rester juste visible. Le noir de l'écran est alors le noir du signal.\n2. **Le contraste, à la sonde.** Une sonde (un colorimètre) posée sur le blanc 100 % : on règle jusqu'à 100 cd/m².\n3. **La chroma, en bleu seul.** Le moniteur n'affiche plus que sa voie bleue. Sur les barres, le gris, le cyan, le magenta et le bleu contiennent tous du bleu à 75 % : ils doivent avoir la même intensité. Si les barres colorées sont plus claires que la grise, la chroma est trop forte.\n\nPuis on n'y touche plus. On règle les caméras en regardant le moniteur, jamais le moniteur sur les caméras.",
  vraie: "La caméra n'a pas de moniteur de référence : le viseur a ses propres réglages (luminosité, contraste, peaking), qui ne changent que ce que voit le cadreur. Le moniteur de référence est au poste de la vision, branché sur la sortie de la CCU, avec la forme d'onde à côté (sa pastille, dans le coin vision du plateau).\n\n**Le bon geste.** Allumer le moniteur une bonne demi-heure avant de le régler, le temps que la dalle se stabilise (ordre de grandeur) ; régler dans la lumière de travail de la régie, pas en plein jour ; sur une mire générée (les barres de la CCU ou du générateur de synchro), pas sur une image de caméra ; contrôler la PLUGE chaque jour.\n\n**L'erreur fréquente.** Monter la luminosité « pour mieux voir » : les noirs paraissent gris, la vision baisse le noir des caméras pour compenser, et à l'antenne les ombres sont bouchées. Ou juger les couleurs sur le multiviewer, qui n'est pas un moniteur de référence.",
  plus: "- **Les grades (EBU Tech 3320).** Grade 1 : le moniteur de référence, pour juger la qualité (la vision, l'étalonnage) ; Grade 2 : le contrôle courant ; Grade 3 : vérifier qu'une image est là (multiviewer, écrans de pupitre).\n- **La formule de la BT.1886.** L = a × (V + b)^2,4, où a et b se tirent du blanc et du noir mesurés de l'écran : un écran dont le noir n'est pas parfait garde ainsi le détail des ombres.\n- **En HDR.** Un moniteur HDR suit la BT.2100 : primaires BT.2020, courbe HLG ou PQ, une crête de 1 000 cd/m² pour le HLG. Le blanc de référence, un papier blanc, y est à 203 cd/m² (BT.2408).\n- **Le bleu seul et la teinte.** Sur un moniteur analogique (composite), le bleu seul servait aussi à régler la teinte (la phase). Sur un moniteur numérique, la teinte ne dérive pas : il reste la chroma à vérifier.\n- **La sonde.** Les moniteurs de référence se calibrent à la sonde, souvent automatiquement : la PLUGE reste le contrôle de tous les jours.",
  car: "Au poste vision, le moniteur Grade 1 montre l'image de la caméra sélectionnée sur le RCP, à côté du PRISM ; il bascule SDR | HDR. L'ingénieur vision le contrôle à la PLUGE en début de journée : tout le line-up se juge dessus.",
  quiz: [
    {
      q: 'Réglage à la PLUGE : la barre à −2 % se distingue du fond noir. Le moniteur est…',
      a: [
        ['trop sombre : on monte la luminosité.', 'C\'est l\'inverse : un écran trop sombre confond la −2 % et même la +2 % avec le noir.'],
        ['trop lumineux : on baisse la luminosité jusqu\'à ce qu\'elle disparaisse.', 'Exact : la −2 % est plus noire que le noir ; si on la voit, l\'écran montre du gris là où le signal dit noir.'],
        ['bien réglé : c\'est la +2 % qui doit disparaître.', 'Non : la +2 % doit rester juste visible, la −2 % disparaître.'],
      ],
      ok: 1,
    },
    {
      q: 'Pourquoi le blanc du moniteur de référence est-il réglé à 100 cd/m², quand un téléviseur en donne bien plus ?',
      a: [
        ['Parce que les moniteurs professionnels ne savent pas aller plus haut.', 'Ils le savent : un moniteur HDR monte à 1 000 cd/m². 100 cd/m² est une valeur de norme.'],
        ['Pour que la dalle dure plus longtemps.', 'Ce n\'est pas la raison : c\'est une référence commune.'],
        ['Parce que c\'est la référence commune (BT.2035) : dans une pièce sombre, tous les moniteurs montrent la même image.', 'Exact : la même image partout, pour que les réglages faits sur un moniteur valent pour tous.'],
      ],
      ok: 2,
    },
    {
      q: 'Le moniteur de la vision est réglé trop lumineux : les noirs paraissent gris. Que risque-t-on ?',
      a: [
        ['Que la vision baisse le noir des caméras pour compenser : à l\'antenne, les ombres seront bouchées.', 'Exact : on règle les caméras sur le moniteur ; un moniteur faux fausse toutes les caméras.'],
        ['Rien : le moniteur ne change pas le signal.', 'Il ne le change pas, mais il trompe celui qui règle : c\'est le signal des caméras qui sera faux.'],
        ['Que les barres sortent des cibles du vectorscope.', 'Le vectorscope mesure le signal, pas l\'écran : il reste juste. C\'est l\'œil qui est trompé.'],
      ],
      ok: 0,
    },
  ],
  see: ['mires', 'waveform', 'vecto', 'gamma', 'noir', 'lineup', 'hdr'],
  ref: 'ITU-R BT.709 (primaires, blanc D65) ; ITU-R BT.1886 (courbe d\'affichage, gamma 2,4) ; ITU-R BT.2035 (environnement de référence : blanc à 100 cd/m², fond d\'environ 10 cd/m²) ; ITU-R BT.814 (PLUGE) et SMPTE RP 219 (barres HD, PLUGE à −2, +2 et +4 %) ; EBU Tech 3320 (moniteurs Grade 1, 2 et 3)',
  competences: ['2.2', '3.9'],
};

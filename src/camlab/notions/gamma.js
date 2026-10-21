// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Gamma et black gamma ». ITU-R BT.709-6 (OETF) : V = 4,5 L pour L < 0,018, sinon
// V = 1,099 L^0,45 − 0,099 ; 18 % de lumière → 40,9 %, 2 % → 9,0 % ; exposant 0,40 → 45,5 %.
// ITU-R BT.1886 : écran de référence, EOTF d'exposant 2,4 ; 40,9 % de signal → 11,7 % de la
// luminance de l'écran. Gamma de bout en bout d'environ 1,2 (ordre de grandeur, voulu pour une
// image vue dans une pièce peu éclairée). Mode d'emploi HXC-FB80 : menu PAINT, P01 SW STATUS
// (GAMMA, BLK GAM), P04 GAMMA (LEVEL R, G, B, M ; COARSE, 0,45 à l'usine), P05 BLACK GAMMA (LEVEL de
// −99 à +99, RANGE : LOW, L.MID, H.MID, HIGH). Dans la maquette (camlab/vf.js), le black gamma agit
// sous 30 % de signal, au plus ± 4 %. La manipulation (camlab/labs/ch4.js, « gamma ») coupe le
// gamma, éclaircit les tons moyens au COARSE, puis ouvre les ombres au black gamma.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const GAMMA = {
  t: 'Gamma et black gamma', aka: 'Courbe de transfert de la caméra (OETF) ; master gamma, black gamma', chap: 4, lot: 3, point: 'menu',
  short: 'La courbe qui répartit les tons entre le noir et le blanc (BT.709 : exposant 0,45), et le black gamma, qui ouvre ou referme les ombres sans toucher au noir ni au blanc.',
  fig: 'gamma',
  lab: 'gamma',
  cours: 'signal-couleur',
  body: "**Pourquoi une courbe.** Le capteur est linéaire : deux fois plus de lumière, deux fois plus de signal. Notre œil ne l'est pas : il distingue bien mieux les écarts dans les tons sombres que dans les clairs. Et l'écran, de son côté, assombrit les tons moyens. La caméra applique donc une **courbe de transfert** (en anglais OETF), qui relève les tons sombres et moyens : c'est le **gamma**.\n\n**La courbe BT.709.** La norme de la HD la fixe : V = 1,099 × L^0,45 − 0,099, et une droite V = 4,5 × L tout près du noir (sous 1,8 % de lumière), pour ne pas amplifier le bruit sans limite. Quelques points :\n- 18 % de lumière (le gris moyen) → **41 %** de signal ;\n- 2 % de lumière → 9 % ;\n- 100 % → 100 %.\n\n**L'écran fait l'inverse.** Un écran de référence (ITU-R BT.1886) suit une courbe d'exposant **2,4** : 41 % de signal donnent 12 % de sa luminosité. Les deux courbes ne s'annulent pas tout à fait : il reste un léger surcroît de contraste, un gamma de bout en bout d'environ 1,2, voulu pour une image regardée dans une pièce peu éclairée.\n\n**Régler le gamma.** Un exposant plus petit relève les tons moyens : l'image est plus claire, moins contrastée. Un exposant plus grand les abaisse : l'image est plus dense. Le noir et le blanc ne bougent pas. Sans gamma (OFF), le signal est la lumière elle-même : le gris moyen sort à 18 %, l'image est sombre et dure.\n\n**Le black gamma.** Il ne change que le bas de la courbe, sur une plage réglable : il **ouvre** les ombres (on voit dans la tribune à l'ombre) ou les **referme** (des noirs plus denses), sans toucher au noir, aux tons moyens ni au blanc. Le bruit des ombres suit : les ouvrir, c'est aussi le montrer.",
  vraie: "Sur la FB80, le gamma est au menu PAINT, page P04 GAMMA : LEVEL (R, G, B et M) pour l'ajuster finement, et COARSE, l'exposant, à 0,45 à l'usine. Le black gamma est page P05 BLACK GAMMA : LEVEL (de −99 à +99) et RANGE, la plage où il agit (LOW, L.MID, H.MID, HIGH). La page P01 SW STATUS allume ou coupe GAMMA et BLK GAM. Reliée à la CCU, tout se règle au RCP.\n\n**Le bon geste.** Laisser le gamma à sa valeur de référence, la même sur toutes les caméras, et jouer sur le black gamma pour une scène difficile : une tribune à l'ombre, un plateau très contrasté. Juger au moniteur de référence et à la forme d'onde, jamais au viseur.\n\n**L'erreur fréquente.** Couper le gamma « pour voir » et l'oublier. Ou corriger une image sombre au gamma plutôt qu'à l'iris : les tons moyens montent, mais la pelouse ne ressemble plus à celle des autres caméras.",
  plus: "- **Pourquoi 0,45.** C'est l'inverse de 2,22 : la courbe a été choisie pour compenser les tubes cathodiques, dont la luminosité suivait à peu près la tension à la puissance 2,2 à 2,5. La BT.1886 a fixé 2,4 pour les écrans d'aujourd'hui.\n- **La droite près du noir.** Sans elle, la pente de la courbe serait infinie en zéro et le moindre bruit du capteur serait amplifié. La pente est limitée à 4,5.\n- **Le gamma par voie.** Les LEVEL R, G et B déplacent la courbe d'une seule couleur : les tons moyens prennent une teinte, pas le noir ni le blanc. Ça sert à raccorder deux caméras.\n- **HDR.** Les courbes HLG et PQ (ITU-R BT.2100) remplacent la courbe BT.709 pour garder les hautes lumières (voir UHD et HDR).\n- **D'autres courbes.** Beaucoup de caméras proposent aussi des courbes plus douces en haut (l'hyper gamma chez Sony), qui jouent le rôle du knee : c'est un choix d'image, pas la norme.",
  car: "Dans le car, toutes les HDC partent du même gamma, celui de leur fichier de référence : sinon, la pelouse change de densité à chaque coupe. Au poste vision du simulateur, MASTER GAMMA et BLACK GAMMA sont sur l'écran du RCP, et la touche GAMMA le coupe : on voit aussitôt l'image s'assombrir et durcir au moniteur et à la forme d'onde du PRISM.",
  quiz: [
    {
      q: 'Avec la courbe BT.709, à quel niveau sort un gris qui reçoit 18 % de la lumière du blanc ?',
      a: [
        ['18 %.', 'Ce serait sans gamma, le signal égal à la lumière.'],
        ['41 %.', 'Exact : 1,099 × 0,18^0,45 − 0,099 = 0,41.'],
        ['50 %.', 'Le gris moyen n\'est pas au milieu de l\'échelle : la courbe le place vers 41 %.'],
      ],
      ok: 1,
    },
    {
      q: 'La tribune est dans l\'ombre, on n\'y voit rien ; le reste de l\'image est juste. Que règle-t-on ?',
      a: [
        ['Le black gamma, vers le + : il ouvre les ombres sans toucher au noir ni au blanc.', 'Exact : seul le bas de la courbe bouge.'],
        ['Le master black, vers le haut.', 'Le noir monte avec : toute l\'image se délave.'],
        ['L\'iris, plus ouvert.', 'Les blancs et les tons moyens montent aussi, et passent au-dessus de 100 %.'],
      ],
      ok: 0,
    },
    {
      q: 'Pourquoi l\'image d\'une caméra sans gamma paraît-elle sombre et dure au moniteur ?',
      a: [
        ['Parce que le capteur perd de la sensibilité.', 'Le capteur reçoit la même lumière : c\'est la courbe qui manque.'],
        ['Parce que le moniteur coupe le signal sous 18 %.', 'Le moniteur ne coupe rien : il applique sa propre courbe.'],
        ['Parce que l\'écran applique sa courbe (gamma 2,4) qui assombrit les tons moyens, et que la courbe de la caméra n\'est plus là pour la compenser.', 'Exact : le gris moyen sort à 18 % au lieu de 41 %, puis l\'écran l\'assombrit encore.'],
      ],
      ok: 2,
    },
  ],
  see: ['noir', 'knee', 'moniteur', 'hdr', 'waveform', 'matrice'],
  ref: 'ITU-R BT.709-6 (OETF : V = 4,5 L sous 0,018, sinon 1,099 L^0,45 − 0,099) ; ITU-R BT.1886 (EOTF de l\'écran de référence, gamma 2,4) ; mode d\'emploi HXC-FB80 : menu PAINT, pages P01 SW STATUS, P04 GAMMA (LEVEL, COARSE), P05 BLACK GAMMA (LEVEL, RANGE)',
  competences: ['1.4', '2.9'],
};

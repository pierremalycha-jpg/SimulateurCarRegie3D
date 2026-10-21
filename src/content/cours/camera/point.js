// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « La mise au point ». Distance minimale 0,3 m (fiche constructeur du ZA12x4.5BERD).
// Distances comptées depuis le plan des capteurs (repère Φ). Lentille mince : 1/f = 1/d + 1/d'.
// Aides du viseur : PEAKING, VF DETAIL (OPERATION 04), FOCUS ASSIST (OPERATION 05).
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const POINT = {
  t: 'La mise au point', aka: 'Focus ; bague de point, échelle des distances', chap: 1, lot: 1, point: 'point',
  short: 'La bague de point et son échelle des distances ; le geste du cadreur : faire le point en serré, puis élargir. Rien n\'est net plus près que la distance minimale (0,3 m).',
  fig: 'point',
  lab: 'point',
  body: "**Ce que fait la bague de point.** Un objectif ne forme une image parfaitement nette que d'un seul plan à la fois. La bague de point déplace un groupe de lentilles pour choisir ce plan : de l'infini (∞) jusqu'à la distance minimale de mise au point, 0,3 m pour ce zoom.\n\n**L'échelle des distances.** La bague porte une échelle en mètres (en blanc) et en pieds (en orange). Les distances se comptent depuis le plan des capteurs, repéré par le signe Φ sur le côté de la caméra, et non depuis la lentille frontale.\n\n**Pourquoi en serré.** En serré, la profondeur de champ est faible : une petite erreur de point se voit tout de suite. En grand angle, elle est cachée. On fait donc le point en serré, sur les yeux d'un visage ou le centre d'une mire, puis on élargit jusqu'au cadre voulu : le zoom parfocal garde le point.\n\n**Suivre le point.** Quand le sujet avance ou recule, le cadreur tourne la commande de point pour le garder net : c'est le suivi de point. En serré, iris ouvert, c'est le geste le plus difficile du métier.",
  vraie: "Sur le pied de plateau, le point se commande depuis le manche gauche, avec la manivelle de la commande reportée. Sur l'épaule, on tourne la bague à la main.\n\n**Les aides du viseur.** Le peaking (bouton PEAKING du viseur, réglages VF DETAIL du menu OPERATION) souligne les contours nets ; FOCUS ASSIST (menu OPERATION, page 05) affiche un indicateur de netteté.\n\n**L'erreur fréquente.** Faire le point en large et croire l'image nette : au premier serré, le visage est flou. Autre piège : régler le contraste ou la luminosité du viseur en croyant améliorer la netteté ; ces boutons ne changent que l'affichage du viseur, pas l'image envoyée.",
  plus: "- **La distance minimale.** Plus près que 0,3 m, aucune position de la bague ne donne une image nette. La macro permet alors de s'approcher encore.\n- **L'image dans l'objectif.** En lentille mince, 1/f = 1/d + 1/d' : quand le sujet se rapproche (d diminue), l'image s'éloigne de l'objectif (d' augmente). La bague de point compense ce déplacement.\n- **144 fois plus en serré.** Le déplacement de l'image varie comme le carré de la focale : (54 ÷ 4,5)² = 144. C'est pour cela qu'une erreur de point se voit en serré, et que le tirage se règle en large.",
  car: "Au stade, les caméras de tribune travaillent en long foyer : le cadreur suit le point sur un joueur qui court vers lui, à la manivelle. Les caméras épaule du bord du terrain font le point à la main. Une image floue à l'antenne, c'est d'abord le point du cadreur, pas un réglage de la vision.",
  quiz: [
    {
      q: 'Pourquoi fait-on le point en serré ?',
      a: [
        ['La profondeur de champ y est faible : la moindre erreur se voit.', 'Exact : en serré, on trouve le point exact ; il reste juste en élargissant.'],
        ['Parce que la bague de point n\'agit qu\'en serré.', 'Elle agit à toutes les focales ; en large, son effet est noyé dans la profondeur de champ.'],
        ['Pour que le viseur soit plus lumineux.', 'La lumière ne change pas avec le zoom, sauf au bout (ramping).'],
      ],
      ok: 0,
    },
    {
      q: 'Le présentateur est à 1,5 m du repère Φ. Que doit indiquer l\'échelle de la bague de point ?',
      a: [
        ['1,5 m moins la longueur de l\'objectif', 'Non : l\'échelle tient déjà compte de l\'objectif.'],
        ['3 m', 'Non : il n\'y a pas de facteur deux.'],
        ['1,5 m', 'Exact : l\'échelle compte depuis le plan des capteurs, repéré par Φ.'],
      ],
      ok: 2,
    },
    {
      q: 'Le cadreur monte le CONTRAST du viseur : l\'image lui paraît plus nette. L\'image envoyée à la régie l\'est-elle aussi ?',
      a: [
        ['Oui : le viseur et la sortie montrent la même image.', 'Ils montrent la même image, mais les réglages du viseur ne s\'appliquent qu\'au viseur.'],
        ['Non : les réglages du viseur ne changent que son affichage.', 'Exact : seul le point de l\'objectif rend l\'image nette.'],
        ['Oui, si la caméra est en BARS.', 'En BARS, la caméra envoie des barres de couleur : la question du point ne se pose pas.'],
      ],
      ok: 1,
    },
  ],
  see: ['pdc', 'zoom', 'tirage', 'macro', 'viseur', 'cadreur'],
  ref: 'Fujinon ZA12x4.5BERD : distance minimale de mise au point 0,3 m ; repère Φ du plan focal sur le corps ; mode d\'emploi HXC-FB80, menu OPERATION (VF DETAIL, FOCUS ASSIST)',
  competences: ['2.9'],
};

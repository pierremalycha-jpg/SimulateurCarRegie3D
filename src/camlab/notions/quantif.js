// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Conversion et quantification ». ITU-R BT.709-6, partie 2 : en 10 bits, D'Y = INT[(219 E'Y
// + 16) × 4], soit le noir au code 64 et le blanc au code 940 ; Cb et Cr de 64 à 960 autour de 512 ;
// codes 0 à 3 et 1020 à 1023 réservés à la référence de synchronisation, données vidéo de 4 à
// 1019, soit de −6,8 % ((4 − 64) / 876) à 109,0 % ((1019 − 64) / 876). En 8 bits : 16 et 235, 1 à
// 254. Un pas : 1/876 = 0,114 % en 10 bits, 1/219 = 0,457 % en 8 bits ; erreur d'arrondi au plus un
// demi-pas. SMPTE ST 292-1 (HD-SDI) et ST 424 (3G-SDI) : mots de 10 bits. 100 % = 700 mV (héritage
// analogique, comme la leçon signal-niveaux). EBU R 103 : environ 103 % en luminance. La
// manipulation (camlab/labs/ch4.js, « quantif ») lit le code des pavés de gris de la mire.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const QUANTIF = {
  t: 'Conversion et quantification', aka: 'Convertisseur analogique-numérique (CAN) ; codes 10 bits, plage vidéo 64–940', chap: 4, lot: 3, point: 'bloc',
  short: 'Le signal du capteur devient des nombres. En sortie, 10 bits : 64 pour le noir, 940 pour le blanc, et jamais plus de 1019.',
  fig: 'quantif',
  lab: 'quantif',
  cours: 'signal-bits',
  body: "**Du capteur aux nombres.** Chaque photosite donne une charge, donc une tension, proportionnelle à la lumière reçue. Le **convertisseur analogique-numérique** (CAN) mesure cette tension et la range sur une échelle de marches : c'est la **quantification**. Tout ce qui suit (balance, gamma, knee, détail) est un calcul sur ces nombres.\n\n**L'échelle de sortie : 10 bits.** 2 puissance 10 = 1 024 codes, de 0 à 1 023. La norme de la HD (ITU-R BT.709) ne les donne pas tous à l'image :\n- **64** : le noir, 0 % ;\n- **940** : le blanc, 100 % ;\n- entre les deux, 876 pas : un pas vaut 0,11 % du blanc ;\n- **4 à 63** : les sous-noirs, jusqu'à −7 % ; **941 à 1 019** : les super-blancs, jusqu'à 109 % ;\n- **0 à 3** et **1 020 à 1 023** : réservés aux mots de synchronisation du SDI. Une image ne doit jamais les contenir.\n\n**Le calcul.** Code = 64 + 876 × niveau. Un gris à 50 % est au code 502 ; un reflet à 105 %, au code 984. Pour la couleur (Cb et Cr), le zéro est au milieu de l'échelle, au code 512, et les extrêmes à 64 et 960.\n\n**En 8 bits.** Même principe, quatre fois moins de pas : le noir à 16, le blanc à 235, 219 pas de 0,46 %. Un code 8 bits vaut quatre codes 10 bits : 4 × 16 = 64, 4 × 235 = 940.\n\n**Pourquoi ne pas commencer à 0.** Les marges sous le noir et au-dessus du blanc laissent passer les dépassements (le bruit sous le noir, un reflet) sans les couper net, et les codes extrêmes restent libres pour la synchronisation.",
  vraie: "La FB80 ne montre pas ses codes : ses menus parlent en pourcentages et en valeurs relatives (−99 à +99). Les niveaux se lisent à la forme d'onde, branchée sur SDI OUT ou en régie après la CCU. Le format de sortie se choisit au menu MAINTENANCE, pages M09 OUTPUT FORMAT et M11 SDI OUT.\n\n**Le bon geste.** Lire une exposition en pourcentage, pas en codes : 100 %, c'est 940 sur n'importe quel appareil en 10 bits. Et vérifier qu'aucune source n'arrive au plafond de 109 % : au code 1 019, le détail des blancs est perdu.\n\n**L'erreur fréquente.** Confondre la plage vidéo (64 à 940) et la plage « pleine » des ordinateurs (0 à 1 023) : une image mal étiquetée arrive avec des noirs gris et des blancs ternes, ou bien des noirs bouchés et des blancs brûlés.",
  plus: "- **Le convertisseur de la caméra** travaille avec plus de bits que la sortie : le gamma et le knee étirent certaines zones de l'échelle, il leur faut de la marge. Le mode d'emploi de la FB80 n'en donne pas le nombre.\n- **L'erreur d'arrondi** vaut au plus un demi-pas : 0,06 % du blanc en 10 bits, invisible ; 0,23 % en 8 bits, assez pour faire des bandes dans un ciel dégradé (voir la leçon du Cours).\n- **Le SDI** transporte toujours des mots de 10 bits (SMPTE ST 292-1 pour le HD-SDI, ST 424 pour le 3G-SDI) ; une source 8 bits y voyage avec deux bits à zéro.\n- **Les super-blancs** passent sans dommage dans le câble, mais ils ne sont pas légaux : beaucoup de diffuseurs demandent de rester vers 103 % en luminance (EBU R 103). C'est le rôle du knee et du white clip.\n- **12 bits et plus** : les caméras de cinéma et les fichiers RAW gardent davantage de pas, pour l'étalonnage.",
  car: "Dans le car, tout circule en 10 bits : les CCU des HDC sortent en SDI vers la grille, le mélangeur et les EVS. À la baie de mesure, le PRISM lit l'identifiant de la charge utile (« 4:2:2 10 bits ») et montre la forme d'onde en pourcentages ou en millivolts : 100 % = 700 mV = code 940.",
  quiz: [
    {
      q: 'Quel est le code 10 bits du blanc à 100 % ?',
      a: [
        ['1 023.', 'C\'est le haut de l\'échelle : avec 1 020 à 1 022, il est réservé à la synchronisation du SDI.'],
        ['940.', 'Exact : 64 + 876 = 940. En 8 bits, c\'est 235.'],
        ['1 000.', 'Un arrondi trompeur : l\'échelle compte 1 024 codes, et le blanc est à 940.'],
      ],
      ok: 1,
    },
    {
      q: 'Iris fermé, la caméra sort le code 64 partout. Est-ce une panne ?',
      a: [
        ['Non : 64 est le noir de la norme BT.709, 0 %.', 'Exact : les codes 0 à 3 sont réservés à la synchronisation, et 4 à 63 laissent de la place aux sous-noirs.'],
        ['Oui : un noir doit être au code 0.', 'Le code 0 est réservé à la synchronisation du SDI ; le noir vidéo est à 64.'],
        ['Oui : le bruit du capteur empêche de descendre plus bas.', 'Le bruit fait varier le signal autour du noir ; le noir lui-même est fixé à 64 par la norme.'],
      ],
      ok: 0,
    },
    {
      q: 'Un reflet sort au code 1 019. Qu\'en penser ?',
      a: [
        ['Rien : il est dans l\'échelle, donc légal.', 'Il est transporté, mais à 109 % : au-dessus de ce qu\'accepte le diffuseur, vers 103 %.'],
        ['Le câble SDI va le couper.', 'Le SDI transporte jusqu\'à 1 019 sans dommage : ce n\'est pas une affaire de liaison.'],
        ['Il est au plafond, 109 % : il a perdu son détail et dépasse la limite du diffuseur. Le knee et le white clip sont là pour l\'éviter.', 'Exact : au code 1 019, tout ce qui était plus clair est devenu le même nombre.'],
      ],
      ok: 2,
    },
  ],
  see: ['capteur', 'sortie', 'waveform', 'knee', 'noir', 'formats'],
  ref: 'ITU-R BT.709-6, partie 2 : quantification 10 bits (noir 64, blanc 940 ; Cb et Cr de 64 à 960 autour de 512 ; codes 0 à 3 et 1020 à 1023 réservés à la synchronisation) et 8 bits (16 et 235) ; SMPTE ST 292-1 et ST 424 (mots de 10 bits) ; EBU R 103 (tolérances des niveaux) ; mode d\'emploi HXC-FB80 : pages M09 OUTPUT FORMAT et M11 SDI OUT',
  competences: ['1.4', '2.2'],
};

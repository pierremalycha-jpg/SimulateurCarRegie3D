// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Le signal de sortie ». ITU-R BT.709 : Y' = 0,2126 R' + 0,7152 G' + 0,0722 B',
// Cb = (B' − Y') ÷ 1,8556, Cr = (R' − Y') ÷ 1,5748 ; codage 10 bits : Y' = 64 + 876 × Y'
// (64 à 940), Cb et Cr = 512 + 896 × C (64 à 960) ; codes 0 à 3 et 1 020 à 1 023 réservés aux
// repères. Barres 75 % en 10 bits : blanc Y' 721 ; rouge Y' 204, Cb 435, Cr 848. SMPTE ST 274 :
// 1080 lignes actives sur 1 125, 2 640 échantillons par ligne totale en 50 Hz ; SMPTE ST 296 :
// 720p50, 1 980 × 750. Débit = échantillons par ligne × lignes × images/s × 2 mots (Y' et C) ×
// 10 bits : 1080i50 et 720p50 = 1,485 Gb/s, HD-SDI (ST 292-1) ; 1080p50 = 2,97 Gb/s, 3G-SDI
// (ST 424). Fiche Sony HXCU-FB80 : quatre sorties HD ou SD, quatre sorties 3G, 4K (quad 3G ou
// 12G-SDI) ou HD. La manipulation (labs/ch7.js, « sortie ») fait lire les codes d'un point de
// l'image et choisir la sortie qui porte le format demandé.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const SORTIE = {
  t: 'Le signal de sortie', aka: 'HD-SDI (SMPTE ST 292-1), 3G-SDI (ST 424) ; Y\'CbCr 4:2:2 sur 10 bits (ITU-R BT.709)', chap: 7, lot: 3, point: 'ccu',
  short: 'HD-SDI ou 3G-SDI, en Y\'CbCr 4:2:2 sur 10 bits : la CCU envoie à la grille chaque point de l\'image sous forme de nombres, une luminance et deux différences de couleur.',
  fig: 'sortie',
  lab: 'sortie',
  body: "**De R, V, B à Y', Cb, Cr.** Les trois capteurs donnent du rouge, du vert et du bleu. Après la courbe de gamma (on écrit alors R', G', B', avec une apostrophe), la caméra les recombine en trois signaux, selon la recommandation ITU-R BT.709 de la HD :\n- **Y'**, la **luminance** : 0,2126 R' + 0,7152 G' + 0,0722 B'. C'est l'image en noir et blanc, avec tout le détail ;\n- **Cb** et **Cr**, les **différences de couleur** : (B' − Y') ÷ 1,8556 et (R' − Y') ÷ 1,5748. Sur un gris, elles valent zéro.\n\nL'œil voit moins finement la couleur que la lumière : on garde un Cb et un Cr pour deux points de l'image, c'est le **4:2:2**. Une ligne de 1 920 points porte 1 920 Y', 960 Cb et 960 Cr.\n\n**En nombres de 10 bits.** Chaque valeur devient un nombre entier de 0 à 1 023 :\n- la luminance va de **64** (le noir, 0 %) à **940** (le blanc, 100 %) ;\n- Cb et Cr sont centrés sur **512** (pas de couleur) et vont de 64 à 960 ;\n- les codes 0 à 3 et 1 020 à 1 023 sont réservés aux repères du SDI. Entre 940 et 1 019, il reste de la place pour les reflets au-dessus du blanc, jusqu'à 109 %.\n\n**Dans le câble.** Le SDI (Serial Digital Interface) envoie ces nombres les uns après les autres sur un coaxial de 75 Ω : Cb, Y', Cr, Y', Cb, Y'… ligne après ligne, avec la suppression entre les lignes et entre les images, où se rangent le son et les données. Le débit dépend du format :\n- **1080i50** (25 images par seconde, chacune en deux trames) et **720p50** : **HD-SDI**, 1,485 Gb/s (SMPTE ST 292-1) ;\n- **1080p50** (50 images entières par seconde) : **3G-SDI**, 2,97 Gb/s (ST 424), deux fois plus.\n\nLe calcul, en 1080i50 : 2 640 points par ligne (suppression comprise) × 1 125 lignes × 25 images × 2 mots (Y' et C) × 10 bits = 1,485 milliard de bits par seconde.",
  vraie: "Reliée à sa CCU, la caméra ne sort pas directement vers la régie : c'est la CCU qui envoie le signal. La HXCU-FB80 a une carte de quatre sorties HD ou SD, et une carte de quatre sorties 3G-SDI, 4K ou HD. La caméra garde sa propre sortie SDI OUT, pour un moniteur sur le pied. Le format se choisit dans les menus (page M09 OUTPUT FORMAT du menu MAINTENANCE de la caméra).\n\n**Le bon geste.** Vérifier le format à l'arrivée : un instrument de mesure lit l'identifiant de format inscrit dans le signal (le VPID, SMPTE ST 352) et contrôle les erreurs (CRC). Et des câbles et des BNC 75 Ω prévus pour le 3G quand on travaille en 1080p50.\n\n**L'erreur fréquente.** Envoyer du 1080p50 (3G-SDI) vers une entrée qui n'accepte que le HD-SDI : pas d'image. Confondre la plage vidéo (64 à 940) et la pleine plage d'un ordinateur (0 à 1 023) : l'image paraît délavée ou bouchée.",
  plus: "- **Les barres en nombres.** Les barres à 75 % de la caméra donnent, en 10 bits : le blanc à Y' = 721 ; le rouge à Y' = 204, Cb = 435, Cr = 848. Un instrument de mesure vérifie des codes, pas un « à peu près ».\n- **Pourquoi pas 4:4:4.** Il faudrait trois valeurs par point au lieu de deux, une fois et demie plus de débit. Le 4:2:0 de la diffusion au public, lui, divise encore la couleur par deux, une ligne sur deux.\n- **Deux flux mêlés.** Le HD-SDI mêle deux flux mot à mot : les Y' d'un côté, les Cb et Cr alternés de l'autre, 74,25 millions de mots par seconde chacun en 1080i50.\n- **4K.** Avec la HXCU-FB80, l'image peut sortir agrandie en 4K, sur quatre câbles 3G-SDI (quad link) ou un câble 12G-SDI. C'est un agrandissement : la caméra reste une caméra HD.\n- **Pas de compression.** Le SDI transporte l'image entière, sans rien jeter d'autre que la couleur du 4:2:2. Un seul câble, un seul sens, un seul signal.",
  car: "Dans le car, les CCU des caméras HDC sortent en 3G-SDI (1080p50) vers la grille Videohub, ou en 12G-SDI pour l'UHD, avec une copie HD. À la baie de mesure, la tuile État SDI lit le format (VPID) et les CRC de chaque signal ; les codes 64 et 940 sont le 0 et le 100 % de la forme d'onde.",
  quiz: [
    {
      q: 'Sur un gris parfait, que valent Cb et Cr, codés sur 10 bits ?',
      a: [
        ['0 et 0.', 'Zéro, c\'est la valeur de la différence de couleur ; codée sur 10 bits, elle est décalée au milieu de la plage, à 512.'],
        ['512 et 512.', 'Exact : 512 veut dire « pas de couleur ». Un gris a donc Cb = Cr = 512, quel que soit son niveau.'],
        ['940 et 940.', '940 est le blanc de la luminance, pas une valeur de couleur.'],
      ],
      ok: 1,
    },
    {
      q: 'La production passe de 1080i50 à 1080p50. Que devient le signal de sortie ?',
      a: [
        ['Il passe en 3G-SDI : deux fois plus d\'images entières par seconde, 2,97 Gb/s au lieu de 1,485.', 'Exact : il faut alors la carte de sorties 3G de la CCU, et des entrées 3G en face.'],
        ['Rien ne change : le HD-SDI porte tous les formats 1080.', 'Le HD-SDI plafonne à 1,485 Gb/s : assez pour 25 images entrelacées, pas pour 50 images entières.'],
        ['Il passe en 12G-SDI.', 'Le 12G-SDI (11,88 Gb/s) sert à l\'UHD 2160p50, quatre fois plus de points.'],
      ],
      ok: 0,
    },
    {
      q: 'Pourquoi le 4:2:2 garde-t-il moins de Cb et de Cr que de Y\' ?',
      a: [
        ['Pour que le signal passe dans un câble plus fin.', 'Le câble reste un coaxial de 75 Ω ; c\'est le débit que l\'on économise, pas le câble.'],
        ['Parce que la couleur ne sert qu\'au vecteurscope.', 'La couleur fait évidemment partie de l\'image : on en garde moins, pas aucune.'],
        ['Parce que l\'œil voit moins finement la couleur que la lumière : un Cb et un Cr pour deux points ne se remarquent pas.', 'Exact : tout le détail est dans Y\', complet pour chaque point.'],
      ],
      ok: 2,
    },
  ],
  see: ['quantif', 'formats', 'genlock', 'ccu', 'waveform', 'vecto', 'prisme'],
  ref: 'ITU-R BT.709 (Y\' = 0,2126 R\' + 0,7152 G\' + 0,0722 B\' ; 10 bits : Y\' 64 à 940, Cb et Cr 64 à 960 autour de 512) ; SMPTE ST 274 (1080 lignes, 2 640 × 1 125 en 50 Hz) et ST 296 (720p) ; ST 292-1 (HD-SDI, 1,485 Gb/s) ; ST 424 (3G-SDI, 2,97 Gb/s) ; fiche Sony HXCU-FB80 (sorties SDI)',
  competences: ['2.2', '1.4', '2.9'],
  cours: 'sdi-cest-quoi',
};

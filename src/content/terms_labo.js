// @ts-check
// ----------------------------------------------------------------------------------
// Fiches « ? » des ateliers du Labo (v19.28) : optique, photométrie, sensitométrie, DMX et réseau
// lumière. Elles s'ajoutent au lexique commun (content/netterms.js) : même format, mêmes boutons
// « ? » (ui/term.js). Valeurs : hyperfocale H = f² ÷ (N × c) + f ; cercle de confusion par
// convention 0,011 mm (2/3" HD, deux photosites de 5 µm), 0,025 mm (Super 35), 0,03 mm (24 × 36) ;
// lux = lumen par m², candela = lumen par stéradian ; E = I cos i ÷ d² ; L = ρE ÷ π pour une surface
// mate ; mired = 10⁶ ÷ K ; CTB plein −137 mireds, CTO plein +159 (ordres de grandeur des nuanciers) ;
// N² ÷ t = E × S ÷ C, C = 250 pour une cellule plate (ISO 2720) ; BT.709 : le gris 18 % vers 41 % ;
// S-Log3 : le gris à 41 % (code 420 sur 1023) ; HLG : le gris à 38 %, le blanc de référence à 75 %
// (BT.2408) ; DMX512 (ANSI E1.11) : 250 kbit/s, 512 canaux, 32 charges unitaires, terminaison 120 Ω ;
// Art-Net 4 : UDP 6454, Port-Address de 15 bits ; sACN (ANSI E1.31) : UDP 5568, 239.255.x.y.
// ----------------------------------------------------------------------------------
import { TERMS, CATS } from './netterms.js';

const O = 'Optique', P = 'Photométrie', S = 'Sensitométrie', L = 'Lumière et DMX';
for (const c of [O, P, S, L]) if (!CATS.includes(c)) CATS.push(c);

/** @type {Record<string, import('./netterms.js').Term>} */
const ADD = {
  // ================= Optique =================
  hyperfocale: {
    t: 'Hyperfocale', aka: 'Distance hyperfocale', cat: O,
    short: 'La distance de mise au point qui donne la plus grande zone nette : de sa moitié jusqu\'à l\'infini.',
    body: "Pour une focale f, un nombre d'ouverture N et un cercle de confusion c, l'hyperfocale vaut **H = f² ÷ (N × c) + f** (longueurs en millimètres).\n\nSi l'on fait le point à H, tout est net d'environ H ÷ 2 jusqu'à l'infini. Elle diminue très vite quand on raccourcit la focale (elle suit son carré) et quand on ferme l'iris.\n\n- 4,5 mm à f/4 sur 2/3\" : H ≈ 0,46 m ;\n- 24 mm à f/8 en Super 35 : H ≈ 2,9 m ;\n- 54 mm à f/4 sur 2/3\" : H ≈ 66 m.",
    car: 'Dans l\'atelier Optique du Labo, l\'hyperfocale du réglage en cours est affichée et marquée « H » sur la vue de dessus.',
    see: ['cercle-confusion', 'angle-champ'], ref: 'Optique géométrique, lentille mince',
  },
  'cercle-confusion': {
    t: 'Cercle de confusion', aka: 'Circle of confusion', cat: O,
    short: 'La plus grande tache de flou qu\'on accepte encore comme un point net : une convention, liée au capteur et à la définition.',
    body: "Un point hors du plan de netteté forme sur le capteur une petite tache. Tant qu'elle reste plus petite que le **cercle de confusion**, on la voit nette.\n\nC'est une **convention**, pas une loi : elle dépend de la taille du capteur, de la définition de l'image et de la distance de vision. Valeurs courantes :\n- 2/3\" en HD : 0,011 mm (environ deux photosites) ;\n- Super 35 : 0,025 mm ;\n- plein format 24 × 36 : 0,03 mm.\n\nEn 4K ou sur un grand écran, on prend un cercle plus petit : la zone nette annoncée rétrécit.",
    car: 'L\'atelier Optique affiche la tache de chaque sujet et la compare au cercle de confusion du capteur choisi.',
    see: ['hyperfocale'], ref: 'Convention de la prise de vue',
  },
  'angle-champ': {
    t: 'Angle de champ', aka: 'Field of view', cat: O,
    short: 'L\'angle que voit la caméra : il dépend de la focale et de la taille du capteur.',
    body: "Angle horizontal = **2 × arctan(largeur du capteur ÷ (2 × focale))**. À la distance d, le champ couvert fait d × largeur ÷ focale.\n\nLa même focale cadre plus serré sur un petit capteur : un 25 mm sur 2/3\" (9,6 mm de large) voit 21,8° ; sur un plein format, 71,5°.",
    car: 'Dans l\'atelier Optique : l\'angle s\'affiche, le champ est tracé sur la vue de dessus et sa largeur donnée à la distance du sujet B.',
    see: ['facteur-recadrage'], ref: 'Optique géométrique',
  },
  'facteur-recadrage': {
    t: 'Facteur de recadrage', aka: 'Crop factor', cat: O,
    short: 'Combien un capteur voit plus serré qu\'un plein format à focale égale : environ 1,45 en Super 35, 3,75 en 2/3".',
    body: "On divise la focale du plein format par le facteur pour trouver celle qui donne le même cadre. Ici, à cadre 16:9 égal, on compare les largeurs : 36 mm pour le plein format, 24,9 mm en Super 35, 9,6 mm en 2/3\".\n\nÀ cadre égal, un petit capteur a une focale plus courte, donc une profondeur de champ bien plus grande : c'est pour cela que le direct sur 2/3\" garde facilement le point.",
    see: ['angle-champ', 'cercle-confusion'], ref: 'Convention de la prise de vue',
  },
  // ================= Photométrie =================
  'flux-lumineux': {
    t: 'Flux lumineux', aka: 'lumen (lm)', cat: P,
    short: 'Toute la lumière qu\'émet une source, pondérée par la sensibilité de l\'œil, en lumens.',
    body: "Le flux se compte en **lumens**. Une lampe halogène donne de l'ordre de 20 à 25 lm par watt, une HMI ou une LED de 70 à 120 lm/W (ordres de grandeur).\n\nLe flux dit combien de lumière sort, pas où elle va : c'est l'intensité qui dit dans quelle direction, et l'éclairement ce qui arrive sur le sujet.",
    see: ['intensite-lumineuse', 'eclairement'], ref: 'CIE, Système international (lumen = cd·sr)',
  },
  'intensite-lumineuse': {
    t: 'Intensité lumineuse', aka: 'candela (cd)', cat: P,
    short: 'La lumière envoyée dans une direction, en candelas : un projecteur serré a une forte intensité dans son axe.',
    body: "Une candela, c'est un lumen par stéradian. Le même flux, serré dans un faisceau étroit, donne une **intensité** bien plus forte dans l'axe : un Fresnel 1 kW passe d'environ 80 000 cd au serré (12°) à 5 500 cd au large (60°), ordres de grandeur.\n\nL'**angle de faisceau** est celui où l'intensité tombe à la moitié de celle de l'axe ; l'angle de champ, à 10 %.",
    car: 'L\'atelier Photométrie affiche l\'intensité dans l\'axe de chaque projecteur selon son faisceau, son gradateur et sa gélatine.',
    see: ['eclairement', 'inverse-carre'], ref: 'Unité de base du Système international',
  },
  eclairement: {
    t: 'Éclairement', aka: 'lux (lx)', cat: P,
    short: 'La lumière reçue par une surface, en lux : ce que lit le luxmètre.',
    body: "Un lux, c'est un lumen par mètre carré. Pour une source ponctuelle : **E = I × cos i ÷ d²** (I l'intensité vers la surface, i l'angle d'incidence, d la distance).\n\nOrdres de grandeur : un bureau 500 lx, un plateau de télévision 800 à 2 000 lx, un stade éclairé pour la télévision de l'ordre de 1 500 lx, le plein soleil 100 000 lx.\n\nLe luxmètre mesure la lumière **incidente** : il ne dépend pas de la couleur du sujet. C'est ce qui le rend juste pour exposer.",
    car: 'Dans l\'atelier Photométrie, la cellule est sur le visage du sujet, tournée vers la caméra.',
    see: ['inverse-carre', 'luminance', 'intensite-lumineuse'], ref: 'CIE, Système international',
  },
  luminance: {
    t: 'Luminance', aka: 'cd/m², nit', cat: P,
    short: 'La lumière renvoyée par une surface vers l\'œil ou la caméra, en candelas par mètre carré.',
    body: "La luminance, c'est ce que voit la caméra. Pour une surface mate de facteur de réflexion ρ : **L = ρ × E ÷ π**. Une carte grise à 18 % sous 1 000 lx a une luminance d'environ 57 cd/m².\n\nLa luminance dépend du sujet (un visage clair, une veste noire) : c'est pour cela qu'un posemètre à réflexion se trompe sur un sujet très clair ou très sombre. Les écrans s'annoncent aussi en cd/m² (nits) : 100 pour la SDR, 1 000 et plus en HDR.",
    see: ['eclairement', 'gris-18'], ref: 'CIE',
  },
  'inverse-carre': {
    t: 'Loi de l\'inverse du carré', aka: 'Inverse square law', cat: P,
    short: 'Deux fois plus loin, quatre fois moins de lumière : l\'éclairement baisse comme le carré de la distance.',
    body: "La lumière d'une source ponctuelle s'étale sur une surface qui grandit comme le carré de la distance : **E₂ = E₁ × (d₁ ÷ d₂)²**.\n\nReculer un projecteur de 2 à 4 m divise l'éclairement par 4, soit deux diaphs. La loi vaut bien loin de la source ; tout près d'un grand panneau LED ou d'une boîte à lumière, elle se vérifie moins (la source n'est plus « un point »).",
    car: 'Dans l\'atelier Photométrie, déplacez la principale et regardez le luxmètre.',
    see: ['eclairement'], ref: 'Photométrie',
  },
  'temperature-couleur': {
    t: 'Température de couleur', aka: 'kelvin (K)', cat: P,
    short: 'La couleur d\'une lumière blanche, comparée à celle d\'un corps chauffé : 3 200 K orangée, 5 600 K comme le jour.',
    body: "On la donne en **kelvins**. Halogène de studio : 3 200 K ; lumière du jour : 5 600 K environ ; ciel couvert : 6 500 K et plus. Plus le nombre est bas, plus la lumière est chaude (orangée).\n\nUne lampe halogène sur gradateur **rougit** : sa température suit à peu près la tension à la puissance 0,42 (à mi-tension, environ 2 400 K). Une LED garde sa couleur, une HMI se gradue peu.\n\nLa caméra se règle sur la lumière par la **balance des blancs** ; les corrections se comptent en mireds.",
    see: ['mired'], ref: 'CIE, lieu de Planck',
  },
  mired: {
    t: 'Mired', aka: 'Micro reciprocal degree', cat: P,
    short: '10⁶ ÷ K : l\'unité où les corrections de couleur s\'additionnent.',
    body: "Une gélatine décale toujours la lumière du **même nombre de mireds**, quelle que soit la source : CTB plein environ −137 mireds (3 200 K → 5 700 K), CTO plein environ +159 (5 600 K → 3 200 K), demi-CTB −78, demi-CTO +81 (ordres de grandeur des nuanciers).\n\nUn écart de moins d'une vingtaine de mireds avec la balance de la caméra passe presque inaperçu ; au-delà, l'image tire vers l'orange ou le bleu.",
    car: 'L\'atelier Photométrie affiche l\'écart en mireds entre la lumière et la balance de la caméra.',
    see: ['temperature-couleur'], ref: 'Nuanciers Lee et Rosco (ordres de grandeur)',
  },
  'rapport-contraste': {
    t: 'Rapport de contraste', aka: 'Lighting ratio', cat: P,
    short: 'Le côté éclairé comparé au côté ombre d\'un visage : (principale + débouchage) ÷ débouchage.',
    body: "Le côté éclairé reçoit la principale et le débouchage, le côté ombre le débouchage seul : **rapport = (E principale + E débouchage) ÷ E débouchage**. En diaphs : log₂ du rapport.\n\n2:1 (un diaph) donne un visage doux, la télévision d'information ; 4:1 (deux diaphs), un modelé marqué ; 8:1 et plus, un clair-obscur.",
    see: ['eclairement', 'diaphragme'], ref: 'Pratique de l\'éclairage',
  },
  // ================= Sensitométrie =================
  'gris-18': {
    t: 'Gris 18 %', aka: 'Gris moyen', cat: S,
    short: 'La carte qui renvoie 18 % de la lumière : la référence d\'exposition, à mi-chemin (en diaphs) entre le noir et le blanc.',
    body: "Une scène « moyenne » renvoie environ 18 % de la lumière. La carte grise sert à exposer et à comparer les caméras : on la place à une valeur connue de la courbe.\n\n- BT.709 : vers 41 % (la courbe donne 40,9 % à exposition juste) ;\n- S-Log3 : 41 % (code 420 sur 1023) ;\n- HLG : 38 % (BT.2408).\n\nLe blanc d'une charte (90 %) est 2,3 diaphs au-dessus.",
    see: ['oetf', 'diaphragme', 'luminance'], ref: 'ITU-R BT.709, BT.2408 ; Sony S-Log3',
  },
  diaphragme: {
    t: 'Diaphragme (diaph)', aka: 'Stop', cat: S,
    short: 'Un facteur 2 de lumière. La suite f/1,4, 2, 2,8, 4, 5,6, 8 : chaque cran divise la lumière par deux.',
    body: "Le nombre f est la focale divisée par le diamètre de la pupille. La lumière reçue suit **1 ÷ N²** : passer de f/4 à f/5,6, c'est un diaph de moins.\n\nOn compte aussi en diaphs l'exposition, le gain (6 dB ≈ un diaph), la plage dynamique d'une caméra et le contraste d'une scène : c'est un logarithme en base 2.",
    see: ['gris-18', 'plage-dynamique'], ref: 'Optique',
  },
  oetf: {
    t: 'Courbe de transfert (OETF)', aka: 'Opto-Electronic Transfer Function, gamma', cat: S,
    short: 'La courbe qui transforme la lumière captée en signal vidéo : BT.709, une courbe log, HLG.',
    body: "Le capteur mesure une lumière **linéaire** ; le signal vidéo la range sur une courbe pour donner plus de place aux ombres, comme l'œil.\n\n- **BT.709** : V = 1,099 L^0,45 − 0,099 (droite près du noir) ; écrête vers +2,7 diaphs au-dessus du gris ;\n- avec **knee**, les hautes lumières sont comprimées au-dessus d'environ 85 % ;\n- les courbes **log** (S-Log3, LogC…) donnent à peu près la même place à chaque diaph : image terne, à étalonner ;\n- **HLG** : racine carrée dans les ombres, logarithme dans les hautes lumières ; compatible avec un écran SDR.",
    car: 'L\'atelier Sensitométrie trace les quatre courbes et place le gris, le blanc et le ciel dessus.',
    see: ['gris-18', 'slog3', 'hdr-hlg', 'plage-dynamique'], ref: 'ITU-R BT.709, BT.2100',
  },
  'plage-dynamique': {
    t: 'Plage dynamique', aka: 'Dynamic range, latitude', cat: S,
    short: 'Le nombre de diaphs entre le plancher de bruit et l\'écrêtage : ce que la caméra peut garder d\'une scène.',
    body: "Un capteur actuel couvre 12 à 15 diaphs (ordre de grandeur). La courbe choisie décide combien arrivent dans le signal : en BT.709 sans knee, environ 2,7 diaphs au-dessus du gris ; avec un knee, 5 ; en S-Log3, tout ce que voit le capteur.\n\nL'exposition fait **glisser** la plage (ce qu'on gagne en haut se perd en bas) ; le **gain** ne l'agrandit pas : il monte tout, bruit compris, et fait écrêter plus tôt.",
    see: ['diaphragme', 'oetf'], ref: 'Sensitométrie',
  },
  slog3: {
    t: 'S-Log3', cat: S,
    short: 'La courbe logarithmique des caméras Sony : chaque diaph a presque la même place dans le signal.',
    body: "Formule (Sony) : V = (420 + 261,5 × log₁₀((x + 0,01) ÷ 0,19)) ÷ 1023 au-dessus de x = 0,01125. Le gris 18 % tombe à 41 %, le blanc 90 % vers 58 %.\n\nL'image paraît grise et sans contraste : elle est faite pour l'étalonnage, ou pour une LUT de visualisation. En direct, on l'emploie quand le signal est converti (HDR, LUT dans la CCU).",
    see: ['oetf', 'plage-dynamique'], ref: 'Sony, Technical Summary for S-Gamut3.Cine/S-Log3',
  },
  // ================= Lumière et DMX =================
  dmx512: {
    t: 'DMX512', aka: 'ANSI E1.11 (USITT DMX512-A)', cat: L,
    short: 'Le protocole des projecteurs : 512 canaux de 0 à 255 envoyés en boucle, en série, à 250 kbit/s.',
    body: "La console envoie sans cesse une **trame** : une coupure (break), une marque, un code de début, puis jusqu'à 512 octets, un par canal. Chaque octet prend 44 µs : 512 canaux font une trame de 22,8 ms, environ 44 par seconde.\n\nLe signal est différentiel (RS-485) sur une paire torsadée de 120 Ω, en **XLR 5 broches** (le 3 broches se rencontre aussi). Il va dans un seul sens, sans accusé de réception : un projecteur ne répond pas (sauf avec RDM).",
    car: 'L\'atelier DMX du Labo patche un univers, règle ses valeurs, tire sa ligne ; la console dot2 en sort quatre.',
    see: ['univers-dmx', 'adresse-dmx', 'terminaison-dmx', 'artnet'], ref: 'ANSI E1.11-2008 (R2018)',
  },
  'univers-dmx': {
    t: 'Univers DMX', cat: L,
    short: 'Une ligne de 512 canaux. Au-delà, on ajoute des univers : une sortie de console, ou un univers Art-Net ou sACN.',
    body: "Un univers = 512 canaux. Une adresse s'écrit souvent **univers.adresse** (« 3.017 ») ; en adresse absolue, (univers − 1) × 512 + adresse = 1 041.\n\nUne lyre de 24 canaux en prend 24 : vingt et une lyres remplissent un univers. Les grosses installations en ont des dizaines, transportés en réseau.",
    see: ['dmx512', 'adresse-dmx', 'artnet', 'sacn'], ref: 'ANSI E1.11',
  },
  'adresse-dmx': {
    t: 'Adresse DMX', aka: 'Adresse de départ', cat: L,
    short: 'Le premier canal qu\'écoute un appareil ; il prend ensuite autant de canaux que son empreinte.',
    body: "On règle l'adresse sur l'appareil (menu, afficheur, ou **commutateurs DIP** : 1, 2, 4… 256, on additionne ceux qui sont levés), et la même dans le **patch** de la console.\n\nLe suivant commence à **adresse + empreinte**. Deux appareils qui se chevauchent réagissent ensemble de façon désordonnée ; deux appareils identiques à la même adresse font exactement la même chose (c'est parfois voulu).",
    see: ['empreinte-dmx', 'univers-dmx'], ref: 'Pratique de l\'adressage',
  },
  'empreinte-dmx': {
    t: 'Empreinte', aka: 'Footprint, mode', cat: L,
    short: 'Le nombre de canaux qu\'occupe un appareil : il dépend du mode choisi dans son menu.',
    body: "Un PAR LED peut se régler en 4 canaux (rouge, vert, bleu, blanc) ou en 8 (avec intensité, stroboscope, macros). Une lyre en 16 ou en 24.\n\nUn paramètre sur **16 bits** (pan, tilt, intensité fine) prend deux canaux : le grossier (poids fort) puis le fin. Valeur = grossier × 256 + fin, de 0 à 65 535.\n\nLe mode réglé sur l'appareil et celui du patch doivent être les mêmes : sinon, les canaux sont décalés.",
    see: ['adresse-dmx'], ref: 'Fiches des constructeurs',
  },
  'terminaison-dmx': {
    t: 'Terminaison DMX', aka: 'Bouchon 120 Ω', cat: L,
    short: 'Une résistance de 120 Ω au bout de la ligne : elle absorbe le signal pour qu\'il ne se réfléchisse pas.',
    body: "Une ligne DMX va de la console au dernier appareil, d'appareil en appareil (DMX IN, DMX OUT). Au bout, un **bouchon de 120 Ω** (l'impédance du câble).\n\n- **32 récepteurs** au plus par segment (charges unitaires RS-485) ;\n- environ **300 m** de câble (ordre de grandeur, selon le câble) ;\n- **pas de Y** : pour faire plusieurs branches, un **splitter** (répartiteur isolé, qui régénère le signal), chaque branche terminée.\n\nSans terminaison, les appareils du bout clignotent ou décrochent, souvent de façon aléatoire.",
    see: ['dmx512'], ref: 'ANSI E1.11, TIA/EIA-485',
  },
  artnet: {
    t: 'Art-Net', aka: 'Art-Net 4 (Artistic Licence)', cat: L,
    short: 'Le DMX sur Ethernet : des univers dans des paquets UDP (port 6454), jusqu\'à 32 768 univers.',
    body: "La console envoie chaque univers dans un paquet **ArtDmx** (en-tête de 18 octets et 512 canaux) ; un **nœud** près des projecteurs refait une ligne DMX.\n\nL'univers est un **Port-Address** de 15 bits : **Net** (7 bits) × 256 + **Sub-Net** (4 bits) × 16 + **Universe** (4 bits). Attention : beaucoup de consoles numérotent leurs univers à partir de 1, Art-Net à partir de 0 : l'univers 1 de la console part en Port-Address 0.\n\nAdresses d'usine : 2.x.x.x ou 10.x.x.x en masque 255.0.0.0. Console et nœuds doivent être dans le même sous-réseau. Un univers à 44 trames par seconde : environ 210 kbit/s sur le câble.",
    car: 'L\'atelier DMX du Labo, vue « Le réseau lumière » : la console, le nœud, ce qui passe et pourquoi.',
    see: ['sacn', 'univers-dmx'], ref: 'Art-Net 4 Protocol Specification (Artistic Licence)',
  },
  sacn: {
    t: 'sACN', aka: 'Streaming ACN, ANSI E1.31', cat: L,
    short: 'L\'autre transport du DMX sur IP : chaque univers (1 à 63 999) a son adresse multicast 239.255.x.y, port UDP 5568.',
    body: "Un récepteur s'abonne au groupe **multicast** de l'univers qu'il veut : 239.255.(univers ÷ 256).(univers mod 256). L'univers 1 part en 239.255.0.1, l'univers 300 en 239.255.1.44.\n\nsACN porte une **priorité** par univers (deux consoles peuvent émettre, la plus prioritaire l'emporte) ; il demande un réseau qui gère le multicast (IGMP snooping), comme le car IP.",
    see: ['artnet', 'univers-dmx'], ref: 'ANSI E1.31-2018',
  },
  tracking: {
    t: 'Tracking', aka: 'Suivi des valeurs dans une séquence', cat: L,
    short: 'Une cue n\'enregistre que ce qui change ; les autres valeurs suivent la cue précédente.',
    body: "Dans une console à tracking (comme la dot2), une valeur reste jusqu'à ce qu'une cue la change. Modifier une cue se **propage** aux suivantes tant qu'elles ne changent pas ce paramètre.\n\nAvantage : une conduite facile à retoucher. Piège : en sautant directement à une cue, on retrouve les valeurs suivies, pas seulement celles qu'elle contient ; d'où les cues « bloquées » (block) en début de tableau.",
    see: ['dmx512'], ref: 'Manuels des consoles à tracking',
  },
};
for (const [k, v] of Object.entries(ADD)) if (!TERMS[k]) TERMS[k] = v;

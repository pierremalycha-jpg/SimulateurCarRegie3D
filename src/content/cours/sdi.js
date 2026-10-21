// @ts-check
// ----------------------------------------------------------------------------------
// Fiche de cours « SDI ». Valeurs : débits SMPTE ST 259 (270 Mb/s), ST 292-1 (1,485 Gb/s),
// ST 424 (2,97 Gb/s), ST 2082-1 (11,88 Gb/s) ; 800 mV crête à crête sur 75 Ω ; embrouillage
// x^9 + x^4 + 1 puis NRZI ; EAV / SAV, numéro de ligne et CRC en HD ; audio embeddé ST 299-1
// (16 canaux) et ST 299-2 (32 canaux en 3G) ; payload ID ST 352. Les portées sont celles du
// simulateur (data/cameras.js, LINKS.coax) pour que le cours et le car disent la même chose.
// Texte : paragraphes séparés par une ligne vide, listes « - », **gras**, `code` (ui/rich.js).
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').Fiche} */
export const SDI = {
  t: 'SDI', aka: 'Serial Digital Interface : interface numérique série', theme: 'video',
  short: 'Le câble vidéo de base du car : une image non compressée, le son qui l\'accompagne et le timecode, envoyés bit après bit sur un seul câble coaxial de 75 Ω.',
  fig: 'sdi',
  lab: 'sdi',
  body: "**Ce que transporte un câble SDI.** Le SDI envoie l'image en série : les bits passent l'un après l'autre sur un seul conducteur, ce qui demande un débit très élevé. L'image n'est pas compressée. Chaque pixel est décrit par sa luminance (Y) et ses différences de couleur (Cb, Cr), en 4:2:2 sur 10 bits.\n\nEntre deux lignes d'image, dans la suppression, le signal transporte des données annexes : le son embeddé (16 canaux en HD-SDI), le timecode et l'identifiant du format.\n\n**Un débit par format.**\n- SD-SDI : 270 Mb/s, la définition standard d'avant ;\n- HD-SDI : 1,485 Gb/s, le 1080i50 ;\n- 3G-SDI : 2,97 Gb/s, le 1080p50 ;\n- 12G-SDI : 11,88 Gb/s, l'UHD 2160p50 (ou quatre câbles 3G, le quad-link).\n\n**Pourquoi la longueur est limitée.** Un câble coaxial affaiblit davantage les fréquences hautes, et d'autant plus qu'il est long. Plus le débit est élevé, plus ces fréquences sont hautes : la portée diminue. À l'arrivée, un **égaliseur** remonte les aigus pour rouvrir l'œil, jusqu'à ce que le bruit l'emporte.\n\n**La falaise numérique.** Tant que le récepteur distingue les 0 des 1, l'image est parfaite. Juste avant la limite, des erreurs apparaissent sans se voir, puis des étincelles, puis plus rien, en quelques mètres. En analogique, l'image se dégradait peu à peu ; en numérique, c'est tout ou rien : on garde toujours de la marge.\n\n**Une liaison point à point.** Un câble SDI relie une sortie à une seule entrée, dans un seul sens. Pour envoyer une source à plusieurs endroits, on passe par un distributeur (DA) ou par la grille. Les connecteurs : BNC 75 Ω, ou HD-BNC et DIN 1.0/2.3 sur les appareils très denses.",
  plus: "- **Pas de fil d'horloge.** Le flux est embrouillé (polynôme x⁹ + x⁴ + 1) puis codé en NRZI. Il y a ainsi assez de transitions pour que le récepteur reconstitue l'horloge à partir du signal lui-même.\n- **Des repères dans chaque ligne.** Chaque ligne contient deux repères : l'EAV marque la fin de l'image active, le SAV le début de la suivante. Ce sont des mots réservés que l'image ne peut jamais contenir.\n- **Un contrôle par ligne.** En HD, chaque ligne porte son numéro et un CRC. L'analyseur (le PRISM du car) compte les lignes en erreur bien avant qu'on voie quoi que ce soit.\n- **Un format annoncé.** Le payload ID (SMPTE ST 352) dit au récepteur ce qu'il reçoit : 1080i50, 1080p50, 2160p50…\n- **Le niveau.** 800 mV crête à crête sur 75 Ω à la sortie. Un T BNC qui partage un câble casse l'impédance : réflexions, œil fermé.\n- **L'UHD en quad-link.** Quatre câbles 3G portent chacun un quart de l'image : quatre carrés (square division), ou quatre images entières en HD entrelacées point par point (2SI), lisibles sur un moniteur HD.\n- **La gigue.** Si la position des transitions varie trop, l'œil se ferme aussi sur les côtés : le récepteur ne sait plus quand lire le bit.",
  car: "Dans le car SDI, presque tout arrive à la grille par des câbles coaxiaux : sorties des CCU, serveurs EVS, habillage, duplex. À la baie de brassage, un cordon oublié ou croisé se voit tout de suite au multiview. Dans le plan caméras, une liaison coaxiale trop longue est refusée.",
  go: [
    { label: 'Emmène-moi à la baie de brassage', station: 'brassage' },
    { label: 'Parcours du chef : brasser le car vide', lesson: 'brassage-cordons' },
  ],
  quiz: [
    {
      q: 'Une caméra est reliée en 12G-SDI par 90 m de câble coaxial. Que voit-on au multiview ?',
      a: [
        ['Une image un peu plus sombre et moins nette.', 'C\'était le cas en analogique. En numérique, l\'image ne se dégrade pas peu à peu : elle est parfaite, ou elle casse.'],
        ['Rien, ou une image qui étincelle : on dépasse la portée du 12G-SDI (environ 70 m).', 'Exact : à 90 m, le récepteur ne distingue plus les 0 des 1. C\'est la falaise numérique.'],
        ['Une image parfaite : la longueur ne compte pas en numérique.', 'Le câble affaiblit les fréquences hautes. Plus le débit est élevé, plus la portée est courte, même en numérique.'],
      ],
      ok: 1,
    },
    {
      q: 'Pourquoi le 12G-SDI porte-t-il moins loin que le HD-SDI ?',
      a: [
        ['Parce que l\'image UHD est compressée.', 'Non : le SDI transporte l\'image non compressée, en UHD comme en HD.'],
        ['Parce que son débit est huit fois plus élevé : le câble affaiblit davantage les fréquences hautes qu\'il utilise.', 'Exact : 11,88 Gb/s contre 1,485 Gb/s. L\'atténuation à la moitié de la fréquence d\'horloge est environ trois fois plus forte.'],
        ['Parce que les connecteurs BNC 12G sont plus petits.', 'Le connecteur doit être prévu pour le 12G, mais c\'est l\'affaiblissement du câble qui limite la portée.'],
      ],
      ok: 1,
    },
    {
      q: 'Le réalisateur veut la même caméra au mélangeur et sur l\'écran géant du stade. Que faites-vous ?',
      a: [
        ['Je mets un T BNC pour partager le câble entre les deux.', 'Un T casse l\'impédance de 75 Ω : réflexions et œil fermé. Une sortie SDI alimente une seule entrée.'],
        ['J\'augmente le niveau de sortie pour alimenter deux entrées.', 'Le niveau SDI est fixe (800 mV). Il ne se règle pas pour alimenter plusieurs entrées.'],
        ['Je passe par la grille ou par un distributeur (DA), qui recopie le signal vers les deux destinations.', 'Exact : la grille ou le DA régénère le signal et le recopie. Le SDI reste point à point.'],
      ],
      ok: 2,
    },
  ],
  see: ['echantillonnage', 'genlock', 'fibre-smpte'],
  ref: 'SMPTE ST 259, ST 292-1, ST 424, ST 2082-1 ; audio embeddé ST 299 ; payload ID ST 352',
};

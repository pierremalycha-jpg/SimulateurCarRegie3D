// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Formats et cadences ». Fiche technique HXC-FB80 : HD 1080/59,94P, 59,94i, 50P, 50i,
// 29,97PsF, 25PsF, 23,98PsF ; 720/59,94P, 50P ; SD 480/59,94i, 576/50i. Mode d'emploi : page
// OUTPUT FORMAT du menu MAINTENANCE (M09) ; l'écran STATUS affiche le format (FORMAT:1080-50i).
// Normes : SMPTE ST 274 (1920 × 1080, raster 2640 × 1125 à 50 Hz), ST 296 (1280 × 720, raster
// 1980 × 750 à 50 Hz), RP 211 (images progressives segmentées, PsF), ITU-R BT.709 ; HD-SDI
// SMPTE ST 292-1 à 1,485 Gb/s, 3G-SDI ST 424 à 2,97 Gb/s. Débits : 2640 × 1125 × 25 × 20 bits =
// 1,485 Gb/s (1080/50i, 1080/25PsF) ; × 50 = 2,97 Gb/s (1080/50P) ; 1980 × 750 × 50 × 20 =
// 1,485 Gb/s (720/50P). Pixels par seconde : 51,8 M (1080/50i), 103,7 M (1080/50P), 46,1 M
// (720/50P). Les cadences 59,94 = 60 × 1000/1001. La manipulation (camlab/labs/ch23.js,
// « formats ») : le peigne de l'entrelacé, le PsF, la liaison de chaque format.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const FORMATS = {
  t: 'Formats et cadences', aka: 'Video formats, frame rates ; 1080i, 1080p, 720p, PsF', chap: 3, lot: 3, point: 'menu',
  short: '1080/50i, 1080/50P, 1080/25PsF, 720/50P : nombre de lignes, images par seconde, entrelacé, progressif ou segmenté. Le format choisit aussi la liaison : HD-SDI ou 3G-SDI.',
  fig: 'formats',
  lab: 'formats',
  cours: 'signal-formats',
  body: "**Trois choses dans un nom.** 1080/50i se lit : **1080** lignes actives (1920 × 1080 pixels), **50** trames par seconde, **i** pour entrelacé. Le même format s'écrit aussi 1080i25, d'après ses 25 images ; la FB80 et les menus Sony comptent les trames.\n\n**L'entrelacé (i).** Chaque image est faite de deux **trames** : les lignes d'une parité, puis celles de l'autre, prises à 20 ms d'écart. Sur ce qui bouge, les deux trames ne montrent pas le même instant : figée, l'image a des **dents de peigne**. C'est l'héritage de la télévision analogique : deux fois moins de données pour un mouvement aussi fluide.\n\n**Le progressif (P).** En **1080/50P**, 50 images entières par seconde, chacune prise d'un coup : pas de peigne, deux fois plus de données. Il faut le **3G-SDI** : 2640 × 1125 × 50 images × 20 bits = 2,97 Gb/s, raster complet compris (les échantillons de la suppression autour des 1920 × 1080 actifs).\n\n**Le segmenté (PsF).** En **1080/25PsF**, l'image est prise d'un coup, 25 fois par seconde, puis envoyée en deux segments, comme un entrelacé : elle passe dans les mêmes câbles et les mêmes appareils que le 1080/50i, en HD-SDI. Figée, pas de peigne ; mais 25 images seulement : le mouvement saute davantage, comme au cinéma.\n\n**Le 720P.** 1280 × 720 pixels, 50 images entières par seconde : 0,92 million de pixels par image au lieu de 2,07. Il tient en HD-SDI (1980 × 750 × 50 × 20 = 1,485 Gb/s).\n\n**Le format et le reste.** Le format fixe la cadence du shutter (OFF = 1/50 s en 50 Hz) et la sensibilité (F13 en 50 Hz, F12 en 59,94) ; toute la régie doit être au même format et à la même référence de synchro.",
  vraie: "Le format se choisit dans le menu MAINTENANCE, page **OUTPUT FORMAT** (M09). L'écran STATUS (commutateur STATUS/CANCEL vers STATUS) l'affiche en clair, par exemple FORMAT:1080-50i. On n'y touche pas pendant une émission : toute la chaîne derrière la caméra devrait suivre.\n\nEn système, le format est celui de toute la chaîne : la caméra, sa CCU, la grille et le mélangeur doivent être réglés pareil, et la CCU reçoit une référence de synchro du même format.\n\n**Le bon geste.** Lire la feuille de service du car (le format de la production) et vérifier le STATUS de chaque caméra avant le line-up.\n\n**L'erreur fréquente.** Une caméra restée en 59,94 Hz dans un car à 50 Hz : l'image ne se cale pas sur la référence. Ou une source PsF prise pour de l'entrelacé par un appareil : sur le câble, rien ne les distingue, sauf l'identifiant de format (SMPTE ST 352) que le récepteur doit lire.",
  plus: "- **59,94.** Les Amériques et le Japon travaillent en 60 × 1000/1001 = 59,94 Hz, un héritage de la couleur NTSC. La FB80 sait faire les deux familles ; on ne les mélange pas dans un même car.\n- **23,98PsF.** Pour la fiction tournée à 24 images par seconde, ralenties de 1000/1001 pour s'accorder au 59,94.\n- **La SD.** 576/50i (720 × 576, ITU-R BT.601) reste dans la liste pour les vieux équipements.\n- **L'UHD.** La FB80 est une caméra HD : ses capteurs ont 1920 × 1080 photosites. La CCU HXCU-FB80 sait sortir de l'UHD par conversion (fiche de la CCU) ; les HDC-5500 du car, elles, ont des capteurs 4K.\n- **Le super ralenti.** Les caméras HFR tournent à 150 ou 300 images par seconde et sortent sur plusieurs liaisons, une par phase, vers le serveur de ralentis.",
  car: "Le car du simulateur travaille d'office en 1080p50, en 3G-SDI dans la grille, le mélangeur et les serveurs ; il sait aussi le 1080i50 (HD-SDI) et l'UHD 2160p50 (12G-SDI), dans les conditions de captation. Les HDC-5500 savent faire 2160p, 1080p et 1080i, en 50 et 59,94 Hz : leurs CCU sont réglées sur le format de la production. Si un diffuseur demande du 1080i25, c'est la sortie du car qui le fabrique, pas les caméras.",
  quiz: [
    {
      q: 'En 1080/50i, combien d\'images complètes par seconde ?',
      a: [
        ['50.', 'Ce sont 50 trames : chaque image en compte deux.'],
        ['25, chacune en deux trames prises à 20 ms d\'écart.', 'Exact : d\'où l\'autre nom du même format, 1080i25.'],
        ['100.', 'Ce serait du 100 Hz : la FB80 ne le fait pas.'],
      ],
      ok: 1,
    },
    {
      q: 'Le 1080/25PsF figé n\'a pas de peigne, contrairement au 1080/50i. Pourquoi ?',
      a: [
        ['Parce que l\'image est prise d\'un coup, puis seulement découpée en deux segments pour le transport.', 'Exact : les deux segments montrent le même instant.'],
        ['Parce qu\'il a moins de lignes.', 'Il a les mêmes 1080 lignes que le 1080/50i.'],
        ['Parce que son shutter est plus court.', 'Le peigne vient de l\'écart entre les trames, pas du temps de pose.'],
      ],
      ok: 0,
    },
    {
      q: 'Quelle liaison pour du 1080/50P ?',
      a: [
        ['Le HD-SDI, comme le 1080/50i.', 'Le HD-SDI porte 1,485 Gb/s : la moitié de ce que demande le 1080/50P.'],
        ['Le 12G-SDI.', 'Le 12G est celui de l\'UHD 2160p50 : ici, c\'est beaucoup trop.'],
        ['Le 3G-SDI : 2640 × 1125 × 50 × 20 bits = 2,97 Gb/s.', 'Exact : deux fois plus d\'images que le 1080/50i, deux fois plus de débit.'],
      ],
      ok: 2,
    },
  ],
  see: ['shutter', 'sortie', 'ccu', 'genlock', 'hfr', 'menu'],
  ref: 'Fiche technique HXC-FB80 : 1080/59,94P, 59,94i, 50P, 50i, 29,97PsF, 25PsF, 23,98PsF ; 720/59,94P, 50P ; 480/59,94i, 576/50i ; mode d\'emploi HXC-FB80 : page OUTPUT FORMAT (M09), écran STATUS ; SMPTE ST 274 (1080), ST 296 (720), RP 211 (PsF), ST 292-1 (HD-SDI, 1,485 Gb/s), ST 424 (3G-SDI, 2,97 Gb/s), ST 352 (identifiant de format) ; ITU-R BT.709',
  competences: ['1.1', '1.4', '2.2'],
};

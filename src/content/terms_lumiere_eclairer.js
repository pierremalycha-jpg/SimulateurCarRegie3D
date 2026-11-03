// @ts-check
// ----------------------------------------------------------------------------------
// Fiches « ? » du chapitre « La lumière » (v19.29), partie « Éclairer pour la caméra ». Même format que
// content/netterms.js ; elles s'ajoutent au lexique commun (catégories de content/terms_labo.js). Valeurs :
// angle de faisceau à 50 % de l'intensité de l'axe, angle de champ à 10 % (≈ 1,82 × le faisceau avec le profil
// en cloche du Labo) ; diamètre éclairé 2 d tan(θ/2) ; le secteur à 50 Hz fait varier une source non lissée à
// 100 Hz ; U1 = Emin ÷ Emax, U2 = Emin ÷ Emoyen ; repères d'un stade télévisé de haut niveau, ordres de grandeur
// des guides UEFA et FIFA (labo/calc/lumiere.js, STADE_TV).
// ----------------------------------------------------------------------------------
import { TERMS } from './netterms.js';
import './terms_labo.js';

const P = 'Photométrie', L = 'Lumière et DMX';

/** @type {Record<string, import('./netterms.js').Term>} */
const ADD = {
  'angle-faisceau': {
    t: 'Angle de faisceau et angle de champ', aka: 'Beam angle, field angle', cat: P,
    short: 'L\'angle où l\'intensité d\'un projecteur tombe à 50 % de celle de l\'axe (faisceau), et à 10 % (champ).',
    body: "Un projecteur n'éclaire pas d'un coup jusqu'à un bord : son intensité baisse en s'éloignant de l'axe.\n\n- **Angle de faisceau** : là où l'intensité vaut **50 %** de celle de l'axe ;\n- **angle de champ** : là où elle vaut **10 %**. Avec un profil en cloche, il vaut environ **1,82 fois** l'angle de faisceau.\n\nÀ la distance d, le diamètre éclairé vaut **2 × d × tan(θ ÷ 2)** : 30° à 4 m, 2,1 m. Serrer le faisceau concentre la même lumière sur une tache plus petite : l'intensité dans l'axe monte.",
    car: 'Dans l\'atelier Photométrie du Labo et la leçon « Les projecteurs », le faisceau et le champ sont tracés à l\'échelle.',
    see: ['intensite-lumineuse', 'eclairement', 'projecteur-fresnel'], ref: 'Définitions des fiches photométriques (50 % et 10 % de l\'intensité maximale)',
  },
  'projecteur-fresnel': {
    t: 'Projecteur Fresnel', aka: 'Fresnel', cat: L,
    short: 'Le projecteur à lentille à échelons : faisceau réglable du serré au large, bord doux, volets coupe-flux.',
    body: "La lentille de Fresnel est une lentille convexe découpée en anneaux concentriques : mince et légère, elle vient des phares.\n\nEn avançant ou reculant la lampe et son réflecteur, on passe du **serré** (*spot*, une douzaine de degrés) au **large** (*flood*, une soixantaine), ordres de grandeur. Le bord de la tache est **doux** ; des **volets coupe-flux** en rognent les côtés.\n\nC'est le projecteur de base des plateaux : halogène de quelques centaines de watts à plusieurs kilowatts, HMI, LED.",
    see: ['angle-faisceau', 'projecteur-decoupe', 'lumiere-douce'], ref: 'Pratique de l\'éclairage',
  },
  'projecteur-decoupe': {
    t: 'Projecteur à découpe', aka: 'Projecteur à profil, ellipsoïdal, profile spot', cat: L,
    short: 'Le projecteur qui projette une forme nette : couteaux, iris, gobo, angle fixe ou zoom.',
    body: "Un réflecteur ellipsoïdal concentre la lumière sur une petite fenêtre, le **plan focal** ; un objectif la projette comme une image.\n\nDans la fenêtre, on place des **couteaux** (quatre lames), un **iris** ou un **gobo** (disque gravé : un logo, un motif). Le bord est **net**, ou adouci en déréglant l'objectif. L'angle est fixe (on change d'objectif) ou réglable par un zoom.",
    see: ['projecteur-fresnel', 'angle-faisceau'], ref: 'Pratique de l\'éclairage',
  },
  'lumiere-douce': {
    t: 'Lumière douce et lumière dure', aka: 'Soft light, hard light', cat: P,
    short: 'Une source vue petite fait des ombres nettes (dure) ; une source vue grande fait des ombres floues (douce).',
    body: "La dureté d'une ombre ne dépend pas de la puissance, mais de la **taille apparente** de la source vue du sujet : 2 × arctan(taille ÷ 2d).\n\n- une lentille de 15 cm à 3 m : environ 3°, ombre nette ;\n- une boîte à lumière de 90 cm à 1,5 m : plus de 30°, ombre fondue ;\n- le soleil : un demi-degré, ombres dures.\n\nLa **pénombre** (le bord flou de l'ombre) portée à b mètres derrière le sujet vaut à peu près taille × b ÷ d. Rapprocher une source large l'adoucit ; la reculer la durcit.",
    see: ['projecteur-fresnel', 'rapport-contraste'], ref: 'Optique géométrique',
  },
  scintillement: {
    t: 'Scintillement', aka: 'Flicker', cat: P,
    short: 'Sur le secteur à 50 Hz, une source non lissée varie à 100 Hz : invisible à l\'œil, visible sur un ralenti.',
    body: "Le courant alternatif passe par zéro **100 fois par seconde** : une lampe à décharge sur ballast magnétique, une LED mal alimentée, varient à **100 Hz**.\n\n- Une image exposée un **multiple de 1/100 s** (1/100, 1/50) contient des périodes entières : toutes les images reçoivent la même lumière.\n- Une pose plus courte (1/250, 1/500) en garde une partie : l'image pompe.\n- Un **super ralenti** à 150 ou 300 images/s pose au plus 1/150 ou 1/300 s : d'une image à l'autre la lumière change ; relu à 50 images/s, le pompage se voit à 16,7 Hz.\n\nRemèdes : projecteurs LED **sans scintillement**, HMI sur **ballast électronique**, sources réparties sur les trois phases, shutter à 1/100 s.",
    car: 'Au car, le shutter du RCP de chaque caméra (vision) ; les caméras super ralenti relues par le serveur de ralentis.',
    see: ['eclairement-vertical', 'uniformite'], ref: 'Guides d\'éclairage des stades (UEFA, FIFA) ; ordre de grandeur',
  },
  'eclairement-vertical': {
    t: 'Éclairement vertical', aka: 'Ev, vertical illuminance', cat: P,
    short: 'La lumière reçue par un plan vertical tourné vers une caméra : celle qui éclaire le visage des joueurs à l\'image.',
    body: "Le luxmètre posé à plat mesure l'**éclairement horizontal** (Eh) : ce qui tombe sur le gazon. La télévision filme des joueurs debout : on mesure aussi l'**éclairement vertical** (Ev), vers 1 m du sol, sur un plan tourné vers chaque caméra.\n\nUn stade éclairé surtout depuis la tribune d'en face a un gazon lumineux et des joueurs à contre-jour. Repère d'un stade de haut niveau : de l'ordre de **1 400 à 2 000 lx** vers les caméras fixes (ordre de grandeur des guides UEFA et FIFA).",
    see: ['eclairement', 'uniformite'], ref: 'Guides d\'éclairage des stades (UEFA, FIFA) ; ordre de grandeur',
  },
  uniformite: {
    t: 'Uniformité d\'éclairement', aka: 'U1, U2', cat: P,
    short: 'U1 = Emin ÷ Emax, U2 = Emin ÷ Emoyen, mesurés sur une grille de points : 1 pour un éclairage parfaitement régulier.',
    body: "On mesure l'éclairement sur une **grille** (un point tous les 10 m environ sur un terrain) puis :\n\n- **U1 = Emin ÷ Emax** : le point le plus sombre contre le plus clair ;\n- **U2 = Emin ÷ Emoyen** : le plus sombre contre la moyenne.\n\nUn stade télévisé de haut niveau vise de l'ordre de U1 ≥ 0,5 à 0,7 et U2 ≥ 0,7 à 0,8 (ordres de grandeur des guides). Sans uniformité, l'image s'assombrit quand la caméra suit le ballon, et la vision corrige l'iris sans cesse.",
    see: ['eclairement-vertical', 'eclairement'], ref: 'Guides d\'éclairage des stades (UEFA, FIFA)',
  },
};
for (const [k, v] of Object.entries(ADD)) if (!TERMS[k]) TERMS[k] = v;

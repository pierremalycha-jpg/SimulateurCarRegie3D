// @ts-check
// ----------------------------------------------------------------------------------
// Fiches « ? » du chapitre « La lumière » (v19.29), partie « mesure ». Même format que content/netterms.js ;
// elles s'ajoutent au lexique commun (catégories de content/terms_labo.js). Valeurs : IRC (Ra) selon la
// CIE 13.3 (huit échantillons pastel, R1 à R8) ; TLCI-2012 selon l'EBU Tech 3355 (seuils : ordres de
// grandeur) ; efficacités en lm/W des familles de labo/calc/lumiere.js (ordres de grandeur) ; angle
// solide Ω = 2π (1 − cos θ/2) ; angle de champ ≈ 1,82 × angle de faisceau avec le profil du Labo ;
// gélatines : décalages des nuanciers (CTB pleine ≈ −137 mireds, CTO pleine ≈ +159) ; posemètres :
// C = 250 (cellule plate), vers 330 (dôme), K = 12,5 (ISO 2720, constantes courantes des fabricants).
// ----------------------------------------------------------------------------------
import { TERMS } from './netterms.js';
import './terms_labo.js';

const P = 'Photométrie';

/** @type {Record<string, import('./netterms.js').Term>} */
const ADD = {
  irc: {
    t: 'Indice de rendu des couleurs (IRC, Ra) et TLCI', aka: 'Color Rendering Index (CRI), Television Lighting Consistency Index', cat: P,
    short: 'Ce que vaut une lumière pour rendre les couleurs : l\'IRC compare à l\'œil, le TLCI à une caméra. 100 = parfait.',
    body: "L'**IRC** (noté **Ra**, CIE 13.3) éclaire huit échantillons de couleurs pastel (R1 à R8) avec la source, puis avec une lumière de référence de même température de couleur, et note l'écart : 100, c'est identique.\n\n- halogène : 99 à 100 (spectre continu) ;\n- HMI : 90 à 95 ;\n- LED de qualité : 90 à 98 ; LED bas de gamme : 80 et moins (ordres de grandeur).\n\nLe Ra ne compte pas le **rouge saturé** (l'échantillon R9), là où pèchent beaucoup de LED : une peau peut paraître terne sous une source à Ra 90.\n\nLe **TLCI** (EBU Tech 3355, 2012) remplace l'œil par une **caméra type** et un étalonneur : il dit ce qu'il faudra corriger pour que l'image ressemble à celle d'une lumière de référence. Au-dessus de 85 environ, rien ou presque ; entre 50 et 85, une correction à l'étalonnage ; en dessous de 50, la source est déconseillée (ordres de grandeur de la grille de l'EBU). Pour la télévision, c'est le TLCI qu'on lit.",
    car: 'Le chapitre La lumière du Cours compare les familles de sources ; l\'atelier Photométrie du Labo en éclaire un sujet.',
    see: ['temperature-couleur', 'efficacite-lumineuse'], ref: 'CIE 13.3 (1995) ; EBU Tech 3355 (TLCI-2012)',
  },
  'efficacite-lumineuse': {
    t: 'Efficacité lumineuse', aka: 'lumen par watt (lm/W)', cat: P,
    short: 'Combien de lumière une source donne pour un watt : 20 lm/W pour un halogène, quatre à cinq fois plus pour une HMI ou une LED.',
    body: "Le flux d'une source vaut sa puissance multipliée par son efficacité : **Φ = P × η**. Ordres de grandeur :\n- halogène : 18 à 25 lm/W (plus de 90 % de la puissance part en chaleur) ;\n- HMI : 75 à 100 lm/W ;\n- LED : 60 à 130 lm/W, et cela progresse ;\n- tubes fluorescents : 60 à 80 lm/W.\n\nUn Fresnel halogène de 1 kW donne ainsi de l'ordre de 20 000 lm ; une LED de 200 à 250 W en donne autant. Moins de puissance, c'est moins de courant sur les lignes et moins de chaleur sur le plateau.",
    see: ['flux-lumineux', 'irc'], ref: 'Fiches des fabricants (ordres de grandeur)',
  },
  'angle-solide': {
    t: 'Angle solide', aka: 'stéradian (sr)', cat: P,
    short: 'La portion d\'espace d\'un cône : la surface qu\'il découpe sur une sphère de 1 m de rayon. La sphère entière fait 4π ≈ 12,57 sr.',
    body: "Un cône d'angle au sommet θ découpe un angle solide **Ω = 2π (1 − cos θ/2)** stéradians :\n- 10° : 0,024 sr ;\n- 30° : 0,214 sr ;\n- 60° : 0,842 sr ;\n- 180° (un demi-espace) : 2π ≈ 6,28 sr.\n\nC'est l'unité qui relie le flux à l'intensité : une candela est un lumen par stéradian, **I = Φ ÷ Ω**. Le même flux, serré dans un faisceau plus étroit, donne une intensité bien plus forte dans l'axe.",
    see: ['intensite-lumineuse', 'flux-lumineux', 'angle-faisceau'], ref: 'Système international (stéradian)',
  },
  'angle-faisceau': {
    t: 'Angle de faisceau, angle de champ', aka: 'Beam angle, field angle', cat: P,
    short: 'Le faisceau va jusqu\'où l\'intensité tombe à 50 % de l\'axe ; le champ, jusqu\'à 10 %, environ 1,8 fois plus large.',
    body: "Un projecteur éclaire plus fort dans son axe que sur les bords. Les fiches donnent deux angles :\n- l'**angle de faisceau** (beam) : l'intensité y vaut **50 %** de l'axe ;\n- l'**angle de champ** (field) : elle y vaut **10 %**.\n\nAvec le profil du Labo, l'angle de champ vaut environ 1,82 fois l'angle de faisceau (ordre de grandeur : le rapport change d'une optique à l'autre).\n\nUn sujet au bord du faisceau reçoit un diaph de moins qu'au centre. Le diamètre éclairé à la distance d vaut 2 d tan(θ/2).",
    car: 'Dans l\'atelier Photométrie du Labo, le faisceau du Fresnel se règle du serré au large, et le luxmètre suit.',
    see: ['intensite-lumineuse', 'angle-solide', 'inverse-carre'], ref: 'Photométrie des projecteurs',
  },
  gelatine: {
    t: 'Gélatine de correction', aka: 'CTB, CTO, filtre de couleur', cat: P,
    short: 'Un filtre posé devant un projecteur : il décale la couleur de la lumière d\'un nombre fixe de mireds, et en retient une part.',
    body: "Les gélatines de **conversion** accordent une source à une autre (ordres de grandeur des nuanciers) :\n- **CTB pleine** (bleue) : environ −137 mireds, un halogène à 3 200 K passe vers 5 700 K ; 36 % de la lumière passe ;\n- **CTO pleine** (orange) : environ +159 mireds, la lumière du jour à 5 600 K passe vers 3 200 K ; 55 % passe ;\n- les **demi** et **quart** pour les petits écarts.\n\nD'autres corrigent l'axe **vert / magenta** (« plus vert », « moins vert »), pour accorder des tubes fluorescents ou des LED. Les **neutres** (ND 0,3, 0,6…) baissent la lumière sans changer sa couleur : ND 0,3 = un diaph.\n\nUne gélatine chauffe devant un halogène : elle se décolore avec le temps et se remplace.",
    car: 'L\'atelier Photométrie du Labo propose CTB, CTO, leurs moitiés et deux neutres, et affiche la couleur obtenue et la lumière perdue.',
    see: ['mired', 'temperature-couleur', 'balance-blancs'], ref: 'Nuanciers Lee et Rosco (ordres de grandeur)',
  },
  'balance-blancs': {
    t: 'Balance des blancs', aka: 'White balance, AWB', cat: P,
    short: 'Le réglage qui fait sortir neutre un blanc éclairé par la lumière du moment : la caméra ajuste ses gains rouge et bleu.',
    body: "L'œil s'adapte seul à la couleur de la lumière ; la caméra, non. On lui montre une surface blanche (une charte, une feuille) éclairée par la lumière de la scène, et elle règle les gains de ses voies rouge et bleue pour que ce blanc sorte neutre (**AWB**, auto white balance). Les caméras de car ont aussi des préréglages (3 200 K, 5 600 K) et des filtres de conversion optiques.\n\nSi la lumière est plus chaude que la balance, l'image tire vers l'orange ; plus froide, vers le bleu. Un écart d'une vingtaine de mireds passe presque inaperçu (ordre de grandeur). En direct, toutes les caméras doivent avoir la même balance, sinon le plan change de couleur à chaque changement de caméra.",
    car: 'Au poste vision, chaque RCP a sa touche AWB et ses réglages de gains rouge et bleu.',
    see: ['temperature-couleur', 'mired', 'gelatine'], ref: 'Pratique de la prise de vue',
  },
  posemetre: {
    t: 'Posemètre, cellule incidente', aka: 'Light meter, incident meter', cat: P,
    short: 'L\'appareil qui mesure la lumière pour exposer. Posé au sujet, tourné vers la caméra, il mesure ce qui arrive : N² ÷ t = E × S ÷ C.',
    body: "La **mesure incidente** se fait au sujet. La cellule mesure l'éclairement E (lux) et donne le diaphragme par **N² ÷ t = E × S ÷ C** (t le temps de pose, S la sensibilité ISO) :\n- **cellule plate** (un luxmètre) : C = 250 ;\n- **dôme** (demi-sphère blanche, qui reçoit la lumière de tout un demi-espace, comme un visage en relief) : C vers 330, selon le fabricant (la norme ISO 2720 donne une plage).\n\nExemple : 1 000 lx, ISO 800, 1/50 s : f/8.\n\nLa mesure incidente **ne dépend pas du sujet** : une chemise blanche et une veste noire reçoivent la même lumière, chacune sort à sa place. C'est la plus sûre pour exposer.",
    car: 'L\'atelier Photométrie du Labo fait exposer la caméra d\'après le luxmètre posé sur le visage du sujet.',
    see: ['spotmetre', 'eclairement', 'diaphragme'], ref: 'ISO 2720 (étalonnage des posemètres)',
  },
  spotmetre: {
    t: 'Spotmètre, mesure réfléchie', aka: 'Spot meter, reflected light meter', cat: P,
    short: 'Il vise le sujet depuis la caméra et mesure sa luminance : N² ÷ t = L × S ÷ K. Il rend tout sujet gris moyen.',
    body: "Le **spotmètre** mesure dans un angle étroit (de l'ordre de 1°) la **luminance** L (cd/m²) de la surface visée, et donne le diaphragme par **N² ÷ t = L × S ÷ K**, avec **K = 12,5** chez la plupart des fabricants.\n\nIl ne sait pas ce qu'il regarde : il donne le réglage qui rend la surface **grise**, d'un gris moyen (π K ÷ C ≈ 16 % avec K = 12,5 et C = 250 ; on dit couramment 18 %).\n- sur une chemise blanche (90 %), l'image est **sous-exposée** d'environ 2,5 diaphs ;\n- sur une veste noire (4 %), **surexposée** d'environ 2 diaphs ;\n- sur une carte grise, il s'accorde avec la cellule incidente.\n\nOn s'en sert surtout pour lire un contraste : le ciel, une fenêtre, un visage.",
    see: ['posemetre', 'luminance', 'gris-18'], ref: 'ISO 2720 (étalonnage des posemètres)',
  },
};
for (const [k, v] of Object.entries(ADD)) if (!TERMS[k]) TERMS[k] = v;

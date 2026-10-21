// @ts-check
// ----------------------------------------------------------------------------------
// Module « La caméra » : les 51 notions, de la lentille frontale au moniteur, rangées en 9
// chapitres qui suivent le trajet de la lumière puis celui du signal. Matériel de référence :
// la caméra de plateau de l'établissement, type Sony HXC-FB80 (3 capteurs CMOS 2/3", fibre
// vers la CCU HXCU-FB80), avec un zoom Fujinon ZA12x4.5BERD (4,5–54 mm, doubleur ×2), sur
// tête fluide avec commandes de zoom et de point reportées sur les manches.
// Chaque notion suit le moule des fiches du Cours (content/cours/index.js, type Fiche) ; une
// notion pas encore écrite est « en préparation » (prevu) avec son essentiel en une phrase.
// `lot` : ordre d'écriture validé par Pierre (lot 1 = 12 notions). `point` : la pastille de la
// caméra 3D où la notion s'ouvre (camlab/points.js). `cours` : fiche du Cours déjà prévue, que
// la pastille ouvre au lieu d'en écrire une seconde.
// ----------------------------------------------------------------------------------
import { FOCALE } from './focale.js';
import { ZOOM } from './zoom.js';
import { POINT } from './point.js';
import { IRIS } from './iris.js';
import { PDC } from './pdc.js';
import { TIRAGE } from './tirage.js';
import { ND_FILTRES } from './nd.js';
import { PRISME } from './prisme.js';
import { CAPTEUR } from './capteur.js';
import { BALANCE } from './balance.js';
import { MENU } from './menu.js';
import { CONNECTIQUE } from './connectique.js';
import { CH1 } from './ch1.js';
import { CH23 } from './ch23.js';
import { CH4 } from './ch4.js';
import { CH56 } from './ch56.js';
import { CH7 } from './ch7.js';
import { CH89 } from './ch89.js';

/**
 * @typedef {object} Question
 * @property {string} q la question
 * @property {[string, string][]} a réponses : [texte, explication de ce choix]
 * @property {number} ok indice de la bonne réponse
 */
/**
 * @typedef {object} FicheCamera
 * @property {string} t titre
 * @property {string} [aka] nom complet, nom anglais
 * @property {number} chap chapitre (1 à 9)
 * @property {1 | 2 | 3} lot ordre d'écriture
 * @property {string} [point] pastille de la caméra 3D
 * @property {string} short l'essentiel en une phrase
 * @property {string} [fig] schéma (camlab/figs.js)
 * @property {string} [lab] manipulation (camlab/labs.js)
 * @property {string} [body] l'explication
 * @property {string} [vraie] sur la vraie caméra : où est la commande, le bon geste, l'erreur fréquente
 * @property {string} [plus] pour aller plus loin
 * @property {string} [car] ce qu'on en voit dans le car
 * @property {{ label: string, station?: string, lesson?: string }[]} [go] boutons Emmène-moi et parcours du chef
 * @property {Question[]} [quiz]
 * @property {string[]} [see] notions liées
 * @property {string} [ref] norme ou document de référence
 * @property {string[]} [competences] compétences du référentiel RNCP37022 (numéros 1.1 à 4.5)
 * @property {string} [cours] fiche du Cours reprise (content/cours)
 * @property {boolean} [prevu] fiche annoncée, pas encore écrite
 */

/** les 9 chapitres, dans l'ordre du trajet de la lumière puis du signal */
export const CHAPITRES = [
  { n: 1, nom: 'L\'objectif', court: 'Objectif' },
  { n: 2, nom: 'Les filtres et le prisme', court: 'Filtres et prisme' },
  { n: 3, nom: 'Les capteurs', court: 'Capteurs' },
  { n: 4, nom: 'Le traitement de l\'image', court: 'Traitement' },
  { n: 5, nom: 'Le corps de la caméra', court: 'Corps' },
  { n: 6, nom: 'Le viseur et le cadreur', court: 'Viseur' },
  { n: 7, nom: 'La voie caméra', court: 'Voie caméra' },
  { n: 8, nom: 'Jusqu\'au moniteur', court: 'Moniteur' },
  { n: 9, nom: 'Pour aller plus loin', court: 'Plus loin' },
];

/** @type {(t: string, chap: number, lot: 1 | 2 | 3, point: string | undefined, short: string, extra?: Partial<FicheCamera>) => FicheCamera} */
const prevu = (t, chap, lot, point, short, extra = {}) => ({ t, chap, lot, point, short, prevu: true, ...extra });

/** @type {Record<string, FicheCamera>} */
const ANNONCE = {
  // ---- 1. L'objectif ----
  frontale: prevu('La lentille frontale', 1, 2, 'frontale', 'La première lentille que traverse la lumière : son traitement anti-reflet, le pare-soleil qui la protège, et comment la nettoyer sans la rayer.'),
  focale: FOCALE,
  zoom: ZOOM,
  point: POINT,
  iris: IRIS,
  pdc: PDC,
  ramping: prevu('Le ramping', 1, 2, 'zoom', 'Au bout du zoom, l\'objectif perd de la lumière : f/1,8 jusqu\'à 41 mm, puis f/2,4 à 54 mm. L\'image s\'assombrit si l\'iris est déjà grand ouvert.'),
  doubleur: prevu('Le doubleur de focale', 1, 2, 'doubleur', 'Le levier ×2 double la focale (9–108 mm) mais divise la lumière par quatre : deux diaphragmes perdus.'),
  macro: prevu('La macro', 1, 2, 'macro', 'La bague macro permet de filmer plus près que la distance minimale. Pendant ce temps, le zoom n\'est plus parfocal.'),
  tirage: TIRAGE,
  defauts: prevu('Les défauts optiques', 1, 3, 'frontale', 'Aberrations chromatiques, distorsion, vignetage, flare et respiration : les défauts de tout objectif, et ce que la caméra sait en corriger (ALAC).'),
  monture: prevu('La monture B4 et le câble de l\'objectif', 1, 2, 'monture', 'La baïonnette 2/3" verrouille l\'objectif sur la caméra ; le câble 12 broches l\'alimente et transmet l\'iris, le zoom et les données de l\'objectif.'),
  'box-portable': prevu('Objectif portable ou box', 1, 3, 'manches', 'Un objectif portable se tient à la main ; un objectif box de stade se pilote seulement par les commandes reportées sur les manches.'),
  // ---- 2. Les filtres et le prisme ----
  nd: ND_FILTRES,
  cc: prevu('Température de couleur et filtres CC', 2, 2, 'filtres', 'La lumière d\'une lampe tungstène (3200 K) est plus orange que celle du jour (5600 K). Le bouton COLOR TEMP. compense électroniquement.'),
  prisme: PRISME,
  olpf: prevu('Filtre passe-bas optique et filtre infrarouge', 2, 3, 'bloc', 'Devant les capteurs, un filtre adoucit très légèrement l\'image pour éviter le moiré, un autre arrête l\'infrarouge invisible à l\'œil.'),
  // ---- 3. Les capteurs ----
  capteur: CAPTEUR,
  gain: prevu('Sensibilité, gain et bruit', 3, 2, 'commandes', 'Le gain amplifie le signal du capteur : +6 dB vaut un diaphragme de plus, mais aussi plus de bruit. La FB80 donne f/13 à 2000 lux en 50 Hz.'),
  shutter: prevu('L\'obturateur électronique', 3, 2, 'menu', 'La durée d\'exposition de chaque image. 1/50 s par défaut ; plus court, le mouvement devient saccadé. Le clear scan supprime le scintillement d\'un écran LED.'),
  exposition: prevu('L\'exposition : qui fait quoi', 3, 2, 'iris', 'Iris, ND, gain et shutter changent tous la luminosité, mais chacun a un prix : profondeur de champ, bruit ou mouvement. L\'ordre des réglages compte.'),
  formats: prevu('Formats et cadences', 3, 3, 'menu', '1080i50, 1080p50, 720p50 : nombre de lignes, images par seconde, entrelacé ou progressif.', { cours: 'formats' }),
  // ---- 4. Le traitement de l'image ----
  quantif: prevu('Conversion et quantification', 4, 3, 'bloc', 'Le signal du capteur devient des nombres. 10 bits en sortie : 64 pour le noir, 940 pour le blanc.', { cours: 'quantification' }),
  balance: BALANCE,
  noir: prevu('Le niveau du noir', 4, 3, 'rcp', 'Le master black règle le noir de l\'image. Trop haut, l\'image se délave ; trop bas, les ombres se bouchent.'),
  gamma: prevu('Gamma et black gamma', 4, 3, 'menu', 'La courbe qui répartit les tons entre le noir et le blanc, et le réglage qui ouvre ou referme les ombres.'),
  knee: prevu('Knee et white clip', 4, 3, 'menu', 'Le coude qui comprime les hautes lumières pour garder du détail dans une fenêtre, et le plafond au-dessus duquel le blanc est écrêté.'),
  detail: prevu('Le détail', 4, 3, 'menu', 'Un contour ajouté pour que l\'image paraisse plus piquée ; le détail des carnations l\'adoucit sur les visages seulement.'),
  matrice: prevu('Matrice de couleurs et saturation', 4, 3, 'menu', 'Le réglage qui rend les couleurs justes en BT.709, et qui permet de raccorder deux caméras qui ne rendent pas le même rouge.'),
  fichiers: prevu('Les fichiers de réglage', 4, 3, 'menu', 'Scène, référence, objectif, opérateur : sauvegarder un réglage pour le retrouver demain ou le copier sur une autre caméra.'),
  // ---- 5. Le corps de la caméra ----
  commandes: prevu('Les commandes du corps', 5, 2, 'commandes', 'FILTER, COLOR TEMP., ASSIGN 1 à 3, gain, sortie, balance : ce que l\'on règle sur le côté de la caméra, et ce que la vision règle à distance.'),
  menu: MENU,
  connectique: CONNECTIQUE,
  alimentation: prevu('L\'alimentation', 5, 2, 'connectique', 'La CCU alimente la caméra par la fibre hybride jusqu\'à 600 m ; au-delà, sur fibre monomode (10 km), la caméra s\'alimente sur place par DC IN.'),
  tally: prevu('Tally, call et intercom', 5, 2, 'intercom', 'Le rouge dit « tu es à l\'antenne », le vert « tu es prêt ». CALL appelle la vision ; l\'intercom PROD ou ENG relie le cadreur à la régie.'),
  retours: prevu('Retours vidéo et prompteur', 5, 2, 'intercom', 'RET 1 et RET 2 SEL montrent au cadreur le programme ou une autre source dans le viseur ; la prise PROMPTER envoie le texte au prompteur.'),
  // ---- 6. Le viseur et le cadreur ----
  viseur: prevu('Le viseur et ses aides', 6, 2, 'viseur', 'Le viseur 7" : luminosité et contraste du viseur (qui ne changent pas l\'image), peaking pour le point, zebra pour l\'exposition, MAG pour grossir le centre.'),
  cadreur: prevu('Le poste du cadreur', 6, 3, 'manches', 'Les manches de la tête fluide, la commande de zoom sous le pouce, la commande de point sous l\'autre main, et l\'équilibrage de la caméra sur la tête.'),
  // ---- 7. La voie caméra ----
  fibre: prevu('La fibre hybride et ses connecteurs', 7, 2, 'fibre', 'Un câble qui porte l\'image, les retours, l\'intercom, le tally et l\'alimentation ; un connecteur à nettoyer avant chaque branchement.', { cours: 'fibre-smpte' }),
  ccu: prevu('La CCU', 7, 2, 'ccu', 'La voie caméra du car ou de la régie : elle alimente la caméra, reçoit son image et la sort en SDI, calée sur la référence.'),
  rcp: prevu('Le RCP et l\'ingénieur de la vision', 7, 2, 'rcp', 'Le pupitre de la vision : iris et noir au manche, balance, gain, filtres et menus de peinture, à distance de la caméra.'),
  genlock: prevu('Genlock et référence', 7, 3, 'ccu', 'La CCU reçoit la référence de la régie (tri-level ou black burst) pour que l\'image de la caméra commence en même temps que les autres.', { cours: 'genlock' }),
  sortie: prevu('Le signal de sortie', 7, 3, 'ccu', 'HD-SDI ou 3G-SDI, en Y\'CbCr 4:2:2 sur 10 bits : ce que la CCU envoie à la grille et au mélangeur.', { cours: 'sdi' }),
  lineup: prevu('Le line-up', 7, 3, 'rcp', 'Régler toutes les caméras pour qu\'elles se raccordent entre elles : même noir, même blanc, mêmes couleurs.'),
  // ---- 8. Jusqu'au moniteur ----
  waveform: prevu('Le moniteur forme d\'onde', 8, 2, 'mesure', 'Lire une exposition en pourcentage : le noir à 0 %, les visages vers 60 à 70 %, le blanc à 100 %, rien au-dessus de 103 %.'),
  vecto: prevu('Le vectorscope', 8, 3, 'mesure', 'Lire les couleurs : teinte et saturation, les barres dans leurs cibles, la ligne des carnations.'),
  moniteur: prevu('Le moniteur de référence', 8, 3, 'moniteur', 'Un écran réglé selon la norme (BT.709, gamma 2,4, 100 cd/m²) pour juger l\'image ; son réglage avec la mire PLUGE et le bleu seul.'),
  mires: prevu('Les mires', 8, 2, 'mire', 'Barres de couleur, étoile de Siemens, charte grise : quelle mire pour quel réglage.'),
  // ---- 9. Pour aller plus loin ----
  grandcapteur: prevu('Grand capteur ou tri-capteur', 9, 3, undefined, 'Les caméras Super 35 à un seul capteur : moins de profondeur de champ, d\'autres objectifs, et pourquoi le direct garde souvent le tri-capteur 2/3".'),
  hdr: prevu('UHD et HDR', 9, 3, undefined, 'Quatre fois plus de pixels et une plus grande plage de luminosité (HLG, BT.2020) : ce que fait la HDC-5500 du car et pas la FB80.'),
  hfr: prevu('Le super ralenti', 9, 3, undefined, 'Filmer à 150 ou 300 images par seconde pour ralentir sans saccade : les caméras HFR du car et le serveur EVS.'),
};

/** les fiches écrites des lots 2 et 3, chapitre par chapitre (notions/ch*.js) */
const ECRITES = { ...CH1, ...CH23, ...CH4, ...CH56, ...CH7, ...CH89 };
/** toutes les notions, dans l'ordre : la fiche écrite quand elle existe, sinon la fiche annoncée */
/** @type {Record<string, FicheCamera>} */
export const NOTIONS = Object.fromEntries(Object.entries(ANNONCE).map(([id, f]) => [id, ECRITES[id] || f]));

/** identifiants des notions, dans l'ordre du trajet de la lumière */
export const ORDRE = Object.keys(NOTIONS);
/** les notions d'un chapitre */
export const notionsDu = (n) => ORDRE.filter((id) => NOTIONS[id].chap === n);

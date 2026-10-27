// @ts-check
// ----------------------------------------------------------------------------------
// Fiches « ? » de la synchronisation : black burst, tri-level, terminaison 75 Ω, word clock, DARS, Stay
// GenLock. Elles s'ajoutent au lexique commun (content/netterms.js), même format. Valeurs : ITU-R BT.1700
// (black burst 625 lignes), SMPTE ST 274 et ST 296 (tri-level), AES11 (DARS, annexe B : word clock),
// calculs de cours/synchro_calc.js ; le SPG700 de Tektronix d'après sa documentation commerciale (à relire).
// ----------------------------------------------------------------------------------
import { TERMS, CATS } from './netterms.js';

export const SYNCHRO_CAT = 'Synchronisation';
if (!CATS.includes(SYNCHRO_CAT)) CATS.push(SYNCHRO_CAT);

/** @type {Record<string, import('./netterms.js').Term>} */
const ADD = {
  'black-burst': {
    t: 'Black burst', aka: 'noir codé, référence SD, color black', cat: SYNCHRO_CAT,
    short: 'La référence héritée de la SD : un noir composite réduit à ses tops de synchronisation (−300 mV, 4,7 µs) et à la salve de sous-porteuse.',
    body: "Un **black burst** est une image noire en vidéo composite : il ne reste que les **tops de synchronisation** (−300 mV pendant 4,7 µs au début de chaque ligne de 64 µs, en PAL) et la **salve** de sous-porteuse couleur (10 cycles à 4,43 MHz, 300 mV crête à crête). Les tops de trame marquent le début de chaque image.\n\nLe repère de temps (**0H**) est le milieu (50 %) du front descendant du top. Il porte le rythme des images de 40 ms commun au 625 lignes et au 1080i50 : beaucoup d'appareils HD acceptent encore un black burst comme référence.",
    car: 'Au poste Synchro : « Sorties BB, black burst 625 lignes 50 Hz ». Le mélangeur reçoit le sien sur son entrée REF IN bouclée.',
    see: ['tri-level', 'terminaison-75', 'timing-ref'], ref: 'ITU-R BT.1700 (625 lignes) ; SMPTE ST 170 et ST 318 (525 lignes)',
  },
  'tri-level': {
    t: 'Tri-level', aka: 'synchro à trois niveaux, référence HD', cat: SYNCHRO_CAT,
    short: 'La référence de la HD : une impulsion à −300 mV puis +300 mV au début de chaque ligne ; le repère est le passage à 0 V, au milieu.',
    body: "Le **tri-level** a été créé pour la HD : chaque ligne commence par une impulsion **−300 mV puis +300 mV**, de 44 périodes d'horloge chacune en 1080 (0,59 µs à 74,25 MHz), 40 en 720p. Le repère de temps (**0H**) est le **passage à 0 V** du front montant, au milieu.\n\nTrois avantages sur le black burst : l'impulsion est **symétrique** (pas de composante continue), le repère ne bouge pas si l'amplitude varie, et ses fronts sont rapides (≈ 54 ns contre ≈ 200 ns) : le calage est plus précis. Un tri-level a un format : un 1080i50 ne vaut pas un 720p50.",
    car: 'Au poste Synchro : « Sorties tri-level ». Les CCU le reçoivent par le distributeur de référence.',
    see: ['black-burst', 'terminaison-75', 'timing-ref'], ref: 'SMPTE ST 274 (1080), ST 296 (720)',
  },
  'terminaison-75': {
    t: 'Terminaison 75 Ω', aka: 'bouchon, charge, entrée bouclée (loop-through)', cat: SYNCHRO_CAT,
    short: 'Une ligne de référence se ferme sur 75 Ω, une seule fois, au bout : sans bouchon le niveau double et des échos reviennent ; avec deux, il tombe aux deux tiers.',
    body: "Un générateur adapté (75 Ω interne) est réglé pour donner le niveau nominal sur **une** charge de 75 Ω. C'est un pont diviseur :\n- ligne **ouverte** (pas de bouchon) : niveau **doublé** (+6 dB) et Γ = +1, toute l'impulsion revient en écho ;\n- **une** charge : le nominal, pas de réflexion ;\n- **deux** charges (37,5 Ω) : les **deux tiers** du nominal (−3,5 dB), Γ = −1/3.\n\nUne **entrée bouclée** (deux BNC en T) ne termine pas : on met le bouchon sur la dernière. Une entrée **terminée en interne** charge déjà la ligne : on ne la met pas en milieu de chaîne. L'étoile par un DA, une sortie par appareil, évite ces pièges.",
    car: 'Le mélangeur reçoit son black burst sur une REF IN bouclée : le bouchon est sur la seconde BNC.',
    see: ['black-burst', 'tri-level', 'word-clock'], ref: 'Ligne 75 Ω : Γ = (Z − 75) / (Z + 75) ; calcul : cours/synchro_calc.js',
  },
  'word-clock': {
    t: 'Word clock', aka: 'horloge d\'échantillonnage, WCLK', cat: SYNCHRO_CAT,
    short: 'Un signal carré à la fréquence d\'échantillonnage (48 kHz) qui fait échantillonner tous les appareils audio au même rythme ; BNC 75 Ω, niveaux TTL.',
    body: "Un appareil audio numérique échantillonne au rythme de son horloge. Deux horloges libres ne battent jamais exactement au même rythme : il manque ou il reste des échantillons, d'où des **clics** et des craquements. Le **word clock** est l'horloge commune : un carré à **48 kHz** (un front par échantillon), sur BNC 75 Ω.\n\nLes entrées attendent en général des **niveaux TTL** (AES11, annexe B) : un haut au-dessus de 2,4 V, un bas sous 0,4 V. Selon les appareils, de 1 à 5 V crête à crête ; un pilote **5 V** capable de 75 Ω est ce qui marche presque partout. Une seule terminaison 75 Ω, au bout de la chaîne.\n\nÀ 48 kHz et 25 images/s, une image dure exactement **1 920** échantillons.",
    car: 'La console son du car reçoit le word clock 48 kHz du SPG sur son entrée WORD CLOCK IN.',
    see: ['dars', 'terminaison-75', 'black-burst'], ref: 'AES11 (annexe B : word clock) ; SMPTE ST 272 (séquence en 29,97)',
  },
  dars: {
    t: 'DARS (AES11)', aka: 'Digital Audio Reference Signal', cat: SYNCHRO_CAT,
    short: 'La référence audio de l\'AES11 : un signal AES3 (souvent silencieux) dont le début de chaque trame donne l\'horloge, en BNC 75 Ω ou en XLR 110 Ω.',
    body: "Le **DARS** est un signal **AES3** utilisé comme référence : peu importe ce qu'il transporte (souvent du silence), le **début de chaque trame AES** (le préambule) marque l'instant d'échantillonnage. On le distribue comme l'audio AES : **XLR 110 Ω** symétrique, ou **BNC 75 Ω** (AES-3id, 1 V crête à crête).\n\nL'AES11 range les références en deux classes : **Grade 1** (± 1 ppm, pour une installation qui en cale d'autres) et **Grade 2** (± 10 ppm). Une entrée prend soit un word clock, soit un DARS : la notice dit lequel.",
    car: 'Le générateur de synchro sort un word clock et un DARS, tous deux à 48 kHz, calés sur la référence vidéo.',
    see: ['word-clock', 'black-burst'], ref: 'AES11 ; AES3 ; AES-3id',
  },
  'stay-genlock': {
    t: 'Stay GenLock', aka: 'maintien du verrouillage (Tektronix)', cat: SYNCHRO_CAT,
    short: 'Si la référence d\'entrée d\'un générateur disparaît, ses sorties gardent fréquence et phase ; à son retour, il rattrape l\'écart lentement, sans saut.',
    body: "Un générateur verrouillé (genlock) sur une référence extérieure la suit. Si elle disparaît, deux comportements possibles :\n- **sans** maintien : il repasse sur son oscillateur ; au retour de la référence, il se **recale d'un coup** et toutes ses sorties sautent : tout le site décroche un instant ;\n- avec **Stay GenLock** (nom donné par Tektronix) : les sorties gardent leur fréquence et leur phase ; au retour, l'écart accumulé est rattrapé **lentement**, en ajustant l'horloge, sans saut visible.\n\nC'est la même idée que le holdover d'un générateur calé sur le GPS.",
    car: 'Sur le poste Synchro, la perte du GPS met le SPG en holdover : l\'antenne n\'en voit rien.',
    see: ['holdover', 'black-burst'], ref: 'Documentation Tektronix SPG700 / SPG8000A (Stay GenLock)',
  },
};
Object.assign(TERMS, ADD);

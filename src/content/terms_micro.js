// @ts-check
// ----------------------------------------------------------------------------------
// Fiches « ? » du son capté : le niveau de pression (dB SPL), les tensions (dBu, dBV), le micro dynamique, le
// micro statique, la directivité, l'effet de proximité, l'alimentation fantôme P48, la liaison symétrique.
// Elles s'ajoutent au lexique commun (content/netterms.js), même format. Valeurs : celles du modèle des
// leçons (cours/son_micro_calc.js) : 20 µPa, 94 dB SPL = 1 Pa ; 0 dBu = 0,775 V, dBu = dBV + 2,2 ; fiches
// Shure des types SM58 (−54,5 dBV/Pa) et SM48 (−57,5 dBV/Pa) ; P48 IEC 61938 (2 × 6,81 kΩ, 10 mA au plus) ;
// XLR IEC 60268-12 (1 masse, 2 point chaud, 3 point froid).
// ----------------------------------------------------------------------------------
import { TERMS, CATS } from './netterms.js';

export const MICRO_CAT = 'Son : micros et liaisons';
if (!CATS.includes(MICRO_CAT)) CATS.push(MICRO_CAT);

/** @type {Record<string, import('./netterms.js').Term>} */
const ADD = {
  'db-spl': {
    t: 'dB SPL (niveau de pression acoustique)', aka: 'sound pressure level', cat: MICRO_CAT,
    short: 'Le niveau d\'un son au point d\'écoute : 20 × log₁₀ de la pression efficace sur 20 µPa ; 94 dB SPL valent 1 Pa.',
    body: "Le son fait varier la pression de l'air de quelques **micropascals** à quelques dizaines de **pascals**. Pour ranger ce rapport d'un million, on compte en décibels : **dB SPL = 20 × log₁₀(p ÷ 20 µPa)**.\n\n- 0 dB SPL : 20 µPa, le seuil d'audition ;\n- 94 dB SPL : 1 Pa, le niveau d'un calibreur, et celui auquel on donne la sensibilité d'un micro ;\n- 120 dB SPL : 20 Pa ; 130 dB SPL : le seuil de douleur.\n\nUne pression doublée ajoute 6 dB ; deux sources indépendantes de même niveau ajoutent 3 dB. En champ libre, doubler la distance retire 6 dB.",
    car: 'Les canons du bord terrain reçoivent la frappe de balle d\'autant plus fort qu\'ils sont près du ballon : 6 dB par doublement de la distance.',
    see: ['dbu-dbv', 'micro-dynamique'], ref: 'Pression de référence 20 µPa (ISO 1683)',
  },
  'dbu-dbv': {
    t: 'dBu et dBV', aka: 'niveaux de tension', cat: MICRO_CAT,
    short: 'Une tension en décibels : le dBV par rapport à 1 V, le dBu par rapport à 0,775 V ; dBu = dBV + 2,2.',
    body: "On compte les tensions audio en décibels : **20 × log₁₀(U ÷ référence)**.\n\n- **dBV** : référence 1 V ;\n- **dBu** : référence 0,775 V (la tension qui dissipe 1 mW dans 600 Ω, héritée des lignes téléphoniques) ; dBu = dBV + 2,2.\n\nRepères : un micro donne de −60 à −30 dBu ; la ligne professionnelle est nominale à **+4 dBu** (1,23 V), la ligne grand public à **−10 dBV** (0,32 V, soit −7,8 dBu) : 12 dB d'écart. En numérique, 0 dBu correspond à −18 dBFS (alignement EBU R68).",
    car: 'Le 1 kHz de line-up du car part à −18 dBFS, soit 0 dBu sur les sorties analogiques.',
    see: ['db-spl', 'liaison-symetrique'], ref: 'EBU R68 (alignement −18 dBFS = 0 dBu)',
  },
  'micro-dynamique': {
    t: 'Micro dynamique', aka: 'à bobine mobile, type SM58', cat: MICRO_CAT,
    short: 'Une bobine collée à la membrane se déplace dans le champ d\'un aimant et produit seule sa tension : robuste, sans alimentation, peu sensible.',
    body: "La membrane du micro dynamique porte une **bobine** de fil fin, plongée dans l'**entrefer** d'un **aimant**. Quand la pression la fait bouger, la bobine produit une tension par **induction** (e = B·l·v) : la tension suit la vitesse de la membrane.\n\nIl n'a besoin d'**aucune alimentation**, encaisse de très fortes pressions et les chocs, mais il est **peu sensible** : un micro type SM58 donne −54,5 dBV/Pa (≈ 1,9 mV sous 1 Pa), un type SM48 −57,5 dBV/Pa (1,3 mV). D'où beaucoup de gain à la console (une cinquantaine de dB) et un micro tenu tout près de la bouche.",
    car: 'Les micros-casques des commentateurs, en cabine, sont souvent des dynamiques, tout près de la bouche.',
    see: ['micro-statique', 'p48', 'directivite'], ref: 'Fiches Shure SM58 et SM48',
  },
  'micro-statique': {
    t: 'Micro statique', aka: 'à condensateur, électret, canon', cat: MICRO_CAT,
    short: 'Une membrane métallisée forme un condensateur avec une plaque arrière : sensible et précis, il lui faut une électronique, donc le 48 V.',
    body: "La capsule du micro statique est un **condensateur** : une membrane de quelques micromètres face à une **plaque arrière** percée. Polarisée, elle garde sa charge ; la tension suit le **déplacement** de la membrane. Un convertisseur d'impédance (transistor) la rend utilisable : il doit être **alimenté**, en général par l'**alimentation fantôme 48 V**.\n\nPlus léger qu'un dynamique, il suit mieux les aigus et les sons faibles, et il est plus **sensible** (ordre de grandeur 10 à 40 mV/Pa). Il a un bruit propre et une pression maximale (de l'ordre de 130 à 140 dB SPL). L'**électret** garde sa charge à vie mais son transistor demande une pile ou le 48 V. Le **canon** est un statique au fond d'un tube d'interférence, très directif.",
    car: 'Les couples d\'ambiance et les canons du bord terrain sont des statiques : touche 48V allumée sur leurs tranches.',
    see: ['p48', 'micro-dynamique', 'directivite'], ref: 'Fiches des fabricants (sensibilité, bruit propre, pression maximale)',
  },
  directivite: {
    t: 'Directivité d\'un micro', aka: 'diagramme polaire : omni, cardioïde, hypercardioïde, figure en 8', cat: MICRO_CAT,
    short: 'Comment la sensibilité d\'un micro change selon l\'angle d\'arrivée du son : A + B·cos θ pour les micros courants.',
    body: "Les micros du premier ordre répondent comme **A + B × cos θ** (A + B = 1) :\n\n- **omni** (1 ; 0) : le même niveau partout ;\n- **cardioïde** (0,5 ; 0,5) : −6 dB à 90°, rien à l'arrière ;\n- **supercardioïde** (0,37 ; 0,63) et **hypercardioïde** (0,25 ; 0,75) : plus serrés, un lobe arrière, des trous vers 126° et 110° ;\n- **figure en 8** (0 ; 1) : rien sur les côtés.\n\nLe **facteur de directivité** Q (3 pour un cardioïde, 4 pour un hypercardioïde) dit combien le micro rejette le son diffus de la salle. On place les retours de scène dans le trou de la courbe.",
    car: 'Les couples d\'ambiance du stade sont faits de deux cardioïdes ; les canons du bord terrain sont très directifs.',
    see: ['effet-proximite', 'micro-statique'], ref: 'Micros du premier ordre : A + B cos θ',
  },
  'effet-proximite': {
    t: 'Effet de proximité', aka: 'proximity effect', cat: MICRO_CAT,
    short: 'Un micro directif tout près de la source renforce les graves : de quelques dB à plus de 10 dB selon la distance.',
    body: "Un micro directif mesure en partie le **gradient** de pression (la différence entre l'avant et l'arrière de sa membrane). Près d'une source, l'onde est encore sphérique : ce gradient grandit aux **basses fréquences**. Plus la source est proche, plus les **graves** montent ; un omni, qui ne mesure que la pression, n'a pas d'effet de proximité.\n\nLe modèle idéal donne plus de 15 dB à 100 Hz à 5 cm pour un cardioïde ; un vrai micro en compense une partie (ordre de grandeur). On s'en sert (la voix « chaude » du speaker) ou on le corrige au **passe-haut** de la tranche, et on garde une distance constante.",
    car: 'En cabine son, le passe-haut de chaque tranche (80 à 150 Hz) retire le grondement d\'un commentateur qui colle son micro.',
    see: ['directivite', 'micro-dynamique'], ref: 'Gradient de pression : |1 + 1/(jkr)|',
  },
  p48: {
    t: 'Alimentation fantôme 48 V (P48)', aka: 'phantom power, IEC 61938', cat: MICRO_CAT,
    short: 'La console envoie +48 V sur les broches 2 et 3 du câble micro par deux résistances de 6,81 kΩ : elle alimente les statiques sans gêner le signal.',
    body: "Dans la console, une source de **+48 V** alimente les broches **2 et 3** du XLR à travers deux résistances de **6,81 kΩ** ; le courant revient par la broche **1** (masse). Les deux conducteurs portent la même tension : le signal, leur **différence**, n'est pas touché.\n\nVu du micro, les deux résistances font 3,405 kΩ : la tension qui lui reste vaut **48 − I × 3,4 kΩ** (≈ 38 V pour 3 mA) ; la norme prévoit **10 mA au plus**. Un dynamique en liaison symétrique ne voit aucune différence entre 2 et 3 : rien ne traverse sa bobine. On allume le 48 V **fader baissé** ; jamais sur un câble défectueux, une liaison asymétrique ou un ruban ancien.",
    car: 'La panne « 48 V coupée sur un couple d\'ambiance » rend l\'ambiance muette : on la rallume dans la vue ENTRÉE de la console.',
    see: ['micro-statique', 'liaison-symetrique', 'micro-dynamique'], ref: 'IEC 61938 (P48)',
  },
  'liaison-symetrique': {
    t: 'Liaison symétrique', aka: 'XLR, point chaud et point froid, réjection du mode commun', cat: MICRO_CAT,
    short: 'Le signal part en opposition sur deux conducteurs ; un parasite capté pareil sur les deux s\'annule à l\'arrivée, qui ne garde que la différence.',
    body: "Le câble a deux conducteurs torsadés sous un blindage. Le signal part en **opposition** (+s sur le point chaud, −s sur le point froid) ; un parasite est capté **pareil** sur les deux. L'entrée garde la **différence** : 2s, et le parasite disparaît (**réjection du mode commun**), au déséquilibre près.\n\nXLR (IEC 60268-12) : **1 masse, 2 point chaud, 3 point froid**. Le jack TRS peut être symétrique ; le jack TS et le RCA ne le sont jamais. Une source asymétrique qui doit aller loin passe par une **boîte de direct** (DI).",
    car: 'Les micros du stade descendent au car en liaisons symétriques, jusqu\'aux entrées MIC de la console.',
    see: ['p48', 'dbu-dbv'], ref: 'IEC 60268-12 (brochage des connecteurs)',
  },
};
Object.assign(TERMS, ADD);

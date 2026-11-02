// @ts-check
// ----------------------------------------------------------------------------------
// Fiches « ? » du chapitre « Le son » (v19.24) : le décibel et ses références, les micros et leur
// directivité, les couples stéréo, la liaison symétrique, la dynamique, le loudness et la crête vraie,
// les liaisons numériques (AES3, MADI, Dante). Même format que content/netterms.js ; références : EBU R68
// (alignement), EBU R128 et ITU-R BS.1770 (loudness), AES3, AES10 (MADI), AES67, IEC 61938 (48 V),
// Williams 1987 (angle d'enregistrement). Les chiffres sont ceux de cours/son_calc.js.
// ----------------------------------------------------------------------------------
import { TERMS, CATS } from './netterms.js';

export const SON_CAT = 'Son';
if (!CATS.includes(SON_CAT)) CATS.push(SON_CAT);

/** @type {Record<string, import('./netterms.js').Term>} */
const ADD = {
  decibel: {
    t: 'Décibel (dB)', aka: '20 log, 10 log', cat: SON_CAT,
    short: 'Un rapport entre deux grandeurs, écrit en logarithme : 20 log pour des tensions ou des pressions, 10 log pour des puissances.',
    body: "Le décibel n'est pas une unité mais un **rapport** : 20 × log₁₀ (V₁ ÷ V₂) entre deux tensions ou deux pressions, 10 × log₁₀ (P₁ ÷ P₂) entre deux puissances (une puissance est le carré d'une tension : les deux formules disent la même chose).\n\n- **+6 dB** : tension doublée (puissance × 4) ;\n- **+3 dB** : puissance doublée : deux sources indépendantes de même niveau ;\n- **+20 dB** : tension × 10 ; **+10 dB** : perçu « deux fois plus fort ».\n\nUn niveau en dB a besoin d'une référence : dBu, dBV, dBFS, dB SPL, dBm.",
    car: 'Les crête-mètres de la console sont en dBFS, les bilans de liaison HF en dBm, la foule du stade en dB SPL.',
    see: ['dbu', 'dbfs'], ref: 'IEC 60027-3',
  },
  dbu: {
    t: 'dBu, dBV', aka: 'niveau ligne +4 dBu, −10 dBV', cat: SON_CAT,
    short: 'Les décibels d\'une tension sur un câble : 0 dBu = 0,775 V, 0 dBV = 1 V ; le niveau ligne professionnel est +4 dBu (1,23 V), le grand public −10 dBV (0,32 V).',
    body: "**0 dBu = 0,775 V** : la tension qui dissipe 1 mW dans 600 Ω, héritage du téléphone (le u signifie « unloaded », sans égard à la charge). **0 dBV = 1 V**. Les deux échelles sont décalées de 2,2 dB.\n\n- niveau **micro** : −60 à −40 dBu (quelques millivolts) ;\n- niveau **ligne professionnel** : **+4 dBu** (1,23 V), jusqu'à +24 dBu en crête ;\n- niveau **ligne grand public** : **−10 dBV** (0,316 V = −7,8 dBu), 11,8 dB plus bas.\n\nL'alignement EBU R68 fait correspondre 0 dBu à −18 dBFS ; la SMPTE RP 155, +4 dBu à −20 dBFS.",
    car: 'Les pages E/S de la console disent si une entrée attend du micro ou de la ligne ; un lecteur grand public arrive 11,8 dB trop bas sur une entrée +4 dBu.',
    see: ['decibel', 'dbfs', 'symetrique'], ref: 'EBU R68 ; SMPTE RP 155',
  },
  dbfs: {
    t: 'dBFS', aka: 'pleine échelle, alignement −18 dBFS, OVL', cat: SON_CAT,
    short: 'Les décibels sous la pleine échelle du numérique : 0 dBFS est le plus grand nombre que le convertisseur sait écrire ; au-delà, le signal est écrêté.',
    body: "Dans une console numérique, le niveau se compte **vers le bas** depuis **0 dBFS** (full scale), la valeur maximale du convertisseur. Il n'y a rien au-dessus : les crêtes sont coupées à plat (**écrêtage**, voyant OVL), un défaut définitif qu'aucun fader ne répare.\n\n- **alignement** : 1 kHz à **−18 dBFS** (= 0 dBu, EBU R68) ; −20 dBFS aux États-Unis ;\n- crêtes visées sur une tranche : **−18 à −10 dBFS** ; la marge jusqu'à 0 absorbe un cri ;\n- **dBTP** : la crête vraie, lue entre les échantillons (plafond −1 dBTP).",
    car: 'Les crête-mètres des tranches et des bus, le 1 kHz d\'alignement envoyé au test de ligne, le voyant OVL.',
    see: ['decibel', 'dbu', 'dbtp', 'lufs'], ref: 'EBU R68 ; AES17',
  },
  directivite: {
    t: 'Directivité d\'un micro', aka: 'omni, cardioïde, hypercardioïde, en 8, canon', cat: SON_CAT,
    short: 'Le diagramme de ce qu\'un micro capte selon l\'angle : l\'omni tout autour, le cardioïde devant (−6 dB à 90°, rien derrière), le canon dans un cône étroit, dans l\'aigu seulement.',
    body: "Les diagrammes du premier ordre s'écrivent **a + (1 − a) cos θ** :\n- **omnidirectionnel** (a = 1) : tout autour, insensible au vent et à la proximité ;\n- **cardioïde** (a = 0,5) : −6 dB à 90°, presque rien à 180° ;\n- **supercardioïde** (0,37) et **hypercardioïde** (0,25) : plus étroits devant, un petit lobe arrière, angles morts vers 110 à 125° ;\n- **bidirectionnel** en 8 (a = 0) : devant et derrière, rien sur les côtés.\n\nUn micro directif prend moins de salle : le cardioïde capte un tiers du champ diffus d'un omni (facteur de distance 1,7). Le **canon** ajoute un tube à fentes qui resserre le diagramme, mais seulement pour les longueurs d'onde courtes devant le tube : dans le grave, il reste un hypercardioïde.",
    car: 'Les canons du bord terrain (statiques, bonnettes à poils), les couples d\'ambiance en tribune, le micro-casque cardioïde des commentateurs.',
    see: ['micro-statique', 'couple-stereo'], ref: 'AES, « Microphone directional patterns » ; IEC 60268-4',
  },
  'micro-statique': {
    t: 'Micro statique, micro dynamique', aka: 'condensateur, bobine mobile, 48 V', cat: SON_CAT,
    short: 'Le statique (à condensateur) a besoin de l\'alimentation fantôme 48 V et capte le détail ; le dynamique (bobine mobile) produit son signal seul et encaisse tout.',
    body: "**Dynamique** : une membrane entraîne une bobine dans le champ d'un aimant ; le signal naît par induction. Aucune alimentation, 1 à 3 mV/Pa, robuste, moins fin dans l'aigu : micro main du reporter, micro-casques.\n\n**Statique** (à condensateur) : la membrane est une armature d'un condensateur polarisé ; une électronique interne convertit la variation de capacité en tension. Il faut l'**alimentation fantôme 48 V** (IEC 61938, envoyée par la console sur les deux conducteurs de la liaison symétrique) ; 10 à 40 mV/Pa, réponse jusqu'à 20 kHz ; craint l'humidité et les chocs : canons, couples d'ambiance, studio.\n\nLe micro à **ruban** (dynamique à ruban d'aluminium, en 8) reste rare en extérieur.",
    car: 'Sans 48 V, un canon ou un couple d\'ambiance statique reste muet : la touche 48V de la tranche (leçon La tranche).',
    see: ['directivite', 'symetrique'], ref: 'IEC 61938 (alimentation fantôme)',
  },
  'couple-stereo': {
    t: 'Couple stéréo', aka: 'XY, ORTF, NOS, DIN, AB, Blumlein, angle d\'enregistrement', cat: SON_CAT,
    short: 'Deux micros qui fabriquent l\'image stéréo par des écarts de niveau (coïncidents), de temps (espacés) ou les deux ; chaque couple a son angle d\'enregistrement.',
    body: "Une source se place entre les haut-parleurs par l'**écart de niveau** et l'**écart de temps** entre les deux voies : vers **15 dB** ou **1,1 ms**, elle est sur un seul haut-parleur (Williams, 1987).\n\n- **XY** : deux cardioïdes coïncidents à 90° (ou 120°) : niveau seul, parfait en mono, angle d'enregistrement ≈ 180° ;\n- **Blumlein** : deux micros en 8 à 90°, précis, capte autant l'arrière ;\n- **ORTF** : deux cardioïdes écartés de 17 cm, ouverts à 110° : niveau et temps, image naturelle, angle ≈ 100° ; **NOS** (30 cm, 90°), **DIN** (20 cm, 90°) ;\n- **AB** : deux omnis parallèles écartés de 40 à 60 cm : temps seul, ample, mais filtre en peigne en mono.\n\nPlus un couple est espacé ou ouvert, plus son angle d'enregistrement se resserre et plus la scène s'étale entre les enceintes.",
    car: 'Les couples d\'ambiance en tribune (tranches AMB G et D) ; le corrélateur suit leur cohérence, la touche MONO fait entendre leur somme.',
    see: ['ms', 'ortf', 'directivite'], ref: 'M. Williams, « Unified theory of microphone systems for stereophonic sound recording », AES 1987',
  },
  ortf: {
    t: 'ORTF', aka: 'couple 17 cm, 110°', cat: SON_CAT,
    short: 'Le couple d\'ambiance le plus courant : deux cardioïdes écartés de 17 cm (deux oreilles) et ouverts à 110°, pour une image stable par le niveau et le temps.',
    body: "Défini par l'Office de radiodiffusion-télévision française dans les années 1960 : deux cardioïdes, capsules écartées de **17 cm**, axes ouverts à **110°**. L'écartement donne jusqu'à 0,5 ms d'écart de temps, l'angle des écarts de niveau : l'image est stable et naturelle, proche de l'écoute au casque. Angle d'enregistrement d'une centaine de degrés. La somme mono se creuse un peu (17 cm, pas plus) ; on le monte sur une barre, sous une bonnette double.",
    car: 'Un couple d\'ambiance en tribune, face au terrain : la scène du stade s\'étale entre les enceintes sans se tasser au centre.',
    see: ['couple-stereo', 'ms'], ref: 'ORTF, années 1960 ; AES',
  },
  ms: {
    t: 'MS (mid-side)', aka: 'M + S, M − S, matrice MS', cat: SON_CAT,
    short: 'Un micro M vers la scène et un micro en 8 S vers les côtés ; la matrice fait L = M + S et R = M − S, et le niveau du S règle la largeur après coup.',
    body: "Le **M** (mid) est un cardioïde (ou un omni) tourné vers la scène ; le **S** (side) un bidirectionnel tourné vers les côtés, le lobe positif à gauche. La **matrice** décode :\n- **L = M + S**, **R = M − S** ;\n- le mono (L + R) redonne 2 M : le S s'annule, compatibilité parfaite ;\n- le niveau du S règle la **largeur** : S coupé, c'est du mono ; S au niveau du M, l'équivalent de deux supercardioïdes virtuels à 127°.\n\nAvantages : le mono est le M tel quel, la largeur se décide en régie ou au montage, et un seul support (un micro MS intégré) suffit.",
    car: 'Un micro MS sur une perche ou un couple d\'ambiance décodé dans la console ; la largeur se corrige sans remonter en tribune.',
    see: ['couple-stereo', 'directivite'], ref: 'A. Blumlein, brevet 1931 ; AES',
  },
  symetrique: {
    t: 'Liaison symétrique', aka: 'XLR, point chaud, point froid, réjection de mode commun', cat: SON_CAT,
    short: 'Le signal part en opposition sur deux conducteurs (chaud, froid) dans un blindage ; un parasite, identique sur les deux, est soustrait à l\'entrée différentielle.',
    body: "Le **point chaud** porte +s, le **point froid** −s ; un parasite capté en route (50 Hz, gradateurs, émetteurs) est le même sur les deux fils (+p). L'entrée **différentielle** fait chaud − froid : (s + p) − (−s + p) = 2s. La qualité de cette annulation est la **réjection de mode commun** (CMRR), 60 à 80 dB.\n\n- **XLR** : broche 1 masse (blindage), **2 point chaud**, **3 point froid** ; **jack TRS** : pointe chaud, anneau froid, corps masse ;\n- 2 et 3 inversés : polarité inversée, pas d'atténuation ;\n- l'**asymétrique** (RCA, jack mono) n'a qu'un conducteur et un blindage : quelques mètres au plus ;\n- le 48 V ne passe qu'en symétrique ; une **boucle de masse** (deux appareils à la terre) ronfle : ground lift ou transformateur.\n\nImpédances : on **ponte** (charge ≥ 10 × la source) ; 600 Ω sur 600 Ω perd 6 dB.",
    car: 'Tous les micros et les lignes du car sont en XLR symétrique ; la face arrière de la stagebox, la liste de câblage avec le niveau (micro ou ligne) et le 48 V.',
    see: ['dbu', 'micro-statique'], ref: 'IEC 61938 ; AES48 (masse et blindage)',
  },
  compresseur: {
    t: 'Compresseur, limiteur, gate', aka: 'seuil, ratio, genou, attaque, relâchement, réduction de gain', cat: SON_CAT,
    short: 'Le compresseur réduit le gain au-dessus d\'un seuil selon un ratio ; le limiteur est un plafond (ratio infini) ; le gate coupe sous un seuil.',
    body: "- **Seuil** : le niveau à partir duquel le compresseur agit ;\n- **ratio** : au-dessus du seuil, 1 dB d'entrée en plus donne 1/ratio dB de sortie (4:1 → 4 dB entrent, 1 sort) ; ∞:1 = **limiteur** ;\n- **genou** : dur (bascule nette) ou doux (transition arrondie) ;\n- **attaque** : le temps que met la réduction à s'installer (court : rattrape les transitoires, ternit l'impact) ; **relâchement** : le temps pour revenir (trop court : pompage) ;\n- **gain de rattrapage** : remonte la sortie ; les passages faibles (et le fond) montent avec ;\n- **gate** : coupe (ou atténue d'une plage) sous son seuil ; **expandeur** : gate progressif.\n\nAu départ du car, le limiteur garantit la crête vraie sous −1 dBTP.",
    car: 'La molette verte (dynamique) des écrans Vistonics : gate et compresseur de chaque tranche ; le limiteur du départ.',
    see: ['dbfs', 'lufs', 'dbtp'], ref: 'AES ; EBU R128 (plafond −1 dBTP)',
  },
  lufs: {
    t: 'Loudness (LUFS, LU, LRA)', aka: 'EBU R128, ITU-R BS.1770, −23 LUFS', cat: SON_CAT,
    short: 'La sonie perçue d\'un programme, mesurée avec une pondération proche de l\'oreille : cible −23 LUFS intégré, mesurée avec des portes ; 1 LU = 1 dB d\'écart.',
    body: "L'EBU R128 norme la **sonie** et non plus les crêtes. La mesure (ITU-R BS.1770) pondère le signal par le filtre **K**, additionne les canaux et intègre dans le temps :\n- **momentané** (400 ms), **court terme** (3 s), **intégré** (tout le programme) ;\n- l'intégré passe par deux **portes** : absolue à −70 LUFS (le silence ne compte pas), relative 10 LU sous la moyenne (le fond discret non plus) ; la moyenne se fait en puissance ;\n- cible **−23 LUFS** intégré, ±0,5 LU au PAD, ±1 LU en direct ;\n- **LRA** (plage de loudness, en LU) : l'étendue entre les centiles 10 et 95 du court terme ; sport : 10 à 15 LU.\n\nLa crête vraie, à part, reste sous −1 dBTP.",
    car: 'Le loudness-mètre du Control Bay (M, S, I, LRA, TP) ; le PAD est refusé hors tolérance (leçon Le PAD).',
    see: ['dbtp', 'dbfs', 'compresseur'], ref: 'EBU R128 ; EBU Tech 3341, 3342 ; ITU-R BS.1770',
  },
  dbtp: {
    t: 'Crête vraie (dBTP)', aka: 'true peak, suréchantillonnage ×4, −1 dBTP', cat: SON_CAT,
    short: 'La crête du signal reconstruit entre les échantillons, lue par suréchantillonnage ×4 : elle peut dépasser de 3 dB la crête des échantillons ; plafond −1 dBTP.',
    body: "Une sinusoïde aiguë peut passer entre deux échantillons sans qu'aucun ne touche sa crête : le crête-mètre à échantillons lit moins que le vrai signal analogique reconstruit (jusqu'à **3 dB** de moins, pour une sinusoïde à fs/4). Le mètre de crête vraie **suréchantillonne** ×4 (ITU-R BS.1770 annexe 2) et lit la crête ainsi retrouvée, en **dBTP**.\n\nL'EBU R128 fixe le plafond à **−1 dBTP** : la marge pour les convertisseurs, les codeurs et les limiteurs de la chaîne. Un programme à −23 LUFS a en général ses crêtes vraies entre −8 et −3 dBTP.",
    car: 'La lecture TP du loudness-mètre, et le limiteur du départ qui la tient sous −1 dBTP.',
    see: ['lufs', 'dbfs', 'compresseur'], ref: 'ITU-R BS.1770-4, annexe 2 ; EBU R128',
  },
  aes3: {
    t: 'AES3 (AES/EBU)', aka: 'AES3id, 110 Ω, 75 Ω, 3,072 Mb/s', cat: SON_CAT,
    short: 'La liaison audio numérique de base : deux canaux dans un câble, symétrique XLR 110 Ω ou asymétrique BNC 75 Ω, 64 bits par trame, 3,072 Mb/s à 48 kHz.',
    body: "Chaque **trame** AES3 porte deux **sous-trames** (canaux A et B) de 32 bits : jusqu'à 24 bits d'audio, des bits de validité, d'utilisateur, d'état de canal (fréquence d'échantillonnage, emphase, professionnel ou grand public) et de parité ; 64 bits par trame, soit **64 × fs** = 3,072 Mb/s à 48 kHz, codés en biphase-mark (l'horloge est dans le signal).\n\n- **symétrique** : XLR, câble 110 Ω (un câble micro ordinaire marche « souvent » et casse un jour) ;\n- **AES3id** : asymétrique, BNC 75 Ω, 1 V : le format des grilles et des patchs vidéo ;\n- grand public : **S/PDIF** (RCA 75 Ω, optique TOSLINK), même structure, bits d'état différents.",
    car: 'Les liaisons AES entre la console, les embedders et la grille ; le 1 kHz d\'alignement envoyé en AES au test de ligne.',
    see: ['madi', 'dante', 'st2110-30'], ref: 'AES3 ; AES3id ; IEC 60958',
  },
  madi: {
    t: 'MADI (AES10)', aka: '64 canaux, 125 Mb/s, stagebox', cat: SON_CAT,
    short: 'Le multiplex audio numérique à 64 canaux (48 kHz) dans un seul coaxial 75 Ω ou une fibre, entre la stagebox et la console.',
    body: "**MADI** (multichannel audio digital interface, AES10) transporte **64 canaux** à 48 kHz (56 en mode d'origine), **32 à 96 kHz**, 16 à 192 kHz, à débit fixe (125 Mb/s, codage 4B5B) sur :\n- **coaxial 75 Ω** BNC, une centaine de mètres ;\n- **fibre** multimode (SC, LC), jusqu'à 2 km, ou monomode plus loin.\n\nIl ne porte pas d'horloge utilisable : les deux bouts partagent un **word clock** (ou un AES de référence). C'est le lien classique entre les **stageboxes** (préamplis et convertisseurs au plus près des micros) et la console, et entre consoles et enregistreurs.",
    car: 'Les cartes D21m de la stagebox renvoient leurs entrées en MADI vers la console son ; la page E/S montre chaque canal.',
    see: ['aes3', 'dante', 'st2110-30'], ref: 'AES10',
  },
  dante: {
    t: 'Dante, AES67', aka: 'audio sur IP, flux de 4 canaux, Dante Controller', cat: SON_CAT,
    short: 'L\'audio numérique en paquets IP sur un réseau Gigabit ordinaire : Dante (Audinate) relie les canaux par logiciel ; AES67 est la norme d\'interopérabilité que ST 2110-30 reprend.',
    body: "**Dante** (Audinate) : chaque appareil annonce ses canaux ; un contrôleur logiciel relie émetteurs et récepteurs. Un **flux** porte jusqu'à 4 canaux (unicast) ou 8 (multicast), ordre de grandeur de 1,5 Mb/s par canal avec les en-têtes ; l'horloge est le **PTP** (IEEE 1588) ; latence réglable de 1 à 5 ms. Réseau Gigabit commuté, QoS pour le PTP et l'audio, pas de Wi-Fi.\n\n**AES67** : la norme commune (RTP, 48 kHz, 24 bits, paquets de 1 ms, PTP) que Dante, Ravenna, Livewire et les consoles savent parler entre eux ; **ST 2110-30** l'adopte pour le car IP, où chaque départ audio est un flux séparé de l'image.",
    car: 'En car IP, les départs son sont des flux ST 2110-30 ; un plateau ou une salle en Dante entre par une passerelle AES67.',
    see: ['st2110-30', 'aes3', 'madi', 'ptp'], ref: 'AES67 ; SMPTE ST 2110-30 ; Audinate',
  },
};
Object.assign(TERMS, ADD);

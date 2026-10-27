// @ts-check
// ----------------------------------------------------------------------------------
// Fiches « ? » du son : la console (gain staging, niveaux ligne, envois pré et post-fader), l'audio numérique
// (échantillonnage, AES3, MADI), la mesure (loudness, crête vraie) et l'audio en réseau (Dante, AES67). Elles
// s'ajoutent au lexique commun (content/netterms.js), même format. Valeurs : 0 dBu = 0,775 V, 0 dBV = 1 V ;
// AES3 (deux canaux, 110 Ω en XLR, AES-3id 75 Ω) ; AES10 MADI (64 canaux à 48 kHz, 125 Mb/s sur la ligne) ;
// ITU-R BS.1770-4 et EBU R128 (−23 LUFS, −1 dBTP) ; Dante d'Audinate (QoS DSCP 56 et 46) ; AES67 (PTP v2).
// ----------------------------------------------------------------------------------
import { TERMS, CATS } from './netterms.js';

export const SON_CAT = 'Son';
if (!CATS.includes(SON_CAT)) CATS.push(SON_CAT);

/** @type {Record<string, import('./netterms.js').Term>} */
const ADD = {
  'gain-staging': {
    t: 'Gain staging', aka: 'la structure des gains, d\'un étage à l\'autre', cat: SON_CAT,
    short: 'Régler chaque étage d\'une console pour que le signal reste loin du souffle et loin de l\'écrêtage : GAIN en PFL vers le « 0 », fader et master vers 0 dB.',
    body: "Le signal traverse plusieurs étages : le **préampli** (GAIN), l'**égaliseur**, le **fader**, le **bus** de mélange, le **master**, la **sortie**. Chacun a un **plafond** (l'écrêtage, vers +20 dBu dans une console analogique) et un **plancher** (son souffle). Les décibels s'**additionnent** d'un étage au suivant.\n\nLa règle : on règle le **GAIN** en **PFL**, la source au plus fort, pour un vumètre autour du **« 0 »** sans LED PEAK ; puis le **fader** et le **master** vers **0 dB** (le gain unité). Trop de GAIN, et le préampli écrête avant le fader ; trop peu, et il faut tout pousser ensuite, le souffle avec.",
    car: 'Au poste son du car, le gain de chaque tranche se règle de la même façon, en dBFS : crêtes entre −18 et −10 dBFS.',
    see: ['niveau-ligne', 'pre-post'], ref: 'Pratique d\'exploitation ; EBU R68 pour l\'alignement numérique',
  },
  'niveau-ligne': {
    t: 'Niveau ligne : +4 dBu et −10 dBV', aka: 'dBu, dBV, niveau micro, niveau ligne', cat: SON_CAT,
    short: 'Les appareils professionnels échangent à +4 dBu (1,23 V), les appareils grand public à −10 dBV (0,316 V) : environ 12 dB d\'écart. Un micro donne quelques millivolts.',
    body: "Deux références de tension : le **dBu** (0 dBu = **0,775 V** efficaces) et le **dBV** (0 dBV = **1 V**). Le **niveau ligne professionnel** est **+4 dBu** (1,23 V), le **niveau grand public** **−10 dBV** (0,316 V, soit −7,8 dBu) : **11,8 dB** d'écart. Un appareil grand public branché sur une sortie pro sature ; l'inverse manque de niveau.\n\nUn **micro** donne bien moins : de l'ordre du millivolt à quelques dizaines de millivolts (−60 à −30 dBu), d'où le préampli et son GAIN. Les liaisons professionnelles sont **symétriques** (XLR, jack TRS) : le bruit capté par le câble s'annule à l'arrivée.",
    car: 'Les sorties analogiques des appareils du car sont au niveau pro ; l\'alignement numérique du car suit l\'EBU R68 (0 dBu = −18 dBFS).',
    see: ['gain-staging', 'aes3'], ref: 'IEC 60268 ; usage professionnel +4 dBu, grand public −10 dBV',
  },
  'pre-post': {
    t: 'Envoi pré ou post-fader', aka: 'AUX pre / post', cat: SON_CAT,
    short: 'Un envoi pré-fader est pris avant le fader (les retours de scène ne bougent pas avec la façade) ; post-fader, il suit le fader (la réverbération part avec la voix).',
    body: "Les boutons **AUX** et **FX** d'une tranche envoient une copie du signal vers un autre mélange. Pris **avant le fader** (pré), l'envoi ignore le fader : c'est le choix des **retours** de scène, que le musicien règle avec l'ingénieur sans subir les mouvements de la façade. Pris **après le fader** (post), il le suit : c'est le choix des **effets**, pour que la réverbération baisse avec la voix au lieu de rester seule.\n\nCertaines consoles ont un sélecteur PRE/POST par AUX ; sur d'autres, le choix est fixé. Un « mélange diffusion » pour la vidéo se fait souvent sur un AUX post-fader.",
    car: 'Au poste son du car, les N-1 et le son international sont des bus à part, chacun avec sa matrice.',
    see: ['gain-staging'], ref: 'Pratique d\'exploitation',
  },
  echantillonnage: {
    t: 'Échantillonnage et repliement', aka: 'fréquence d\'échantillonnage, Nyquist, aliasing', cat: SON_CAT,
    short: 'Le convertisseur mesure le son 48 000 fois par seconde : il ne rend que ce qui est sous 24 kHz ; au-dessus, une fréquence se replie et revient plus bas.',
    body: "La **fréquence d'échantillonnage** (fs) est le nombre de mesures par seconde : **48 kHz** en broadcast, 44,1 kHz pour le disque compact, 96 kHz en production musicale. Le **théorème de Nyquist** : on ne rend que les fréquences **sous fs ÷ 2** (24 kHz à 48 kHz).\n\nAu-dessus, une fréquence ne disparaît pas : elle se **replie** (aliasing) et revient à |f − k × fs|, un son qui n'existait pas (30 kHz échantillonnés à 48 kHz donnent 18 kHz). Un **filtre anti-repliement** coupe donc au-dessus de 20 kHz environ, avant le convertisseur. La **quantification** arrondit ensuite chaque mesure sur n bits : dynamique théorique 6,02 × n + 1,76 dB (≈ 146 dB en 24 bits).",
    car: 'Tout l\'audio du car est à 48 kHz, 24 bits : 1 920 échantillons par image à 25 images/s.',
    see: ['aes3', 'madi'], ref: 'Théorème de Nyquist-Shannon ; AES5 (fréquences d\'échantillonnage)',
  },
  aes3: {
    t: 'AES3 (AES/EBU)', aka: 'audio numérique deux canaux, AES-3id', cat: SON_CAT,
    short: 'La liaison audio numérique de base : deux canaux par câble, en XLR 110 Ω ou en BNC 75 Ω (AES-3id).',
    body: "L'**AES3** transporte **deux canaux** (une paire stéréo, ou deux voix séparées). À chaque période d'échantillon, deux sous-trames de **32 bits** : l'audio (jusqu'à 24 bits), puis des bits de validité, d'utilisateur, d'état et de parité. À 48 kHz : 64 × 48 000 = **3,072 Mb/s**, en codage biphase (il porte son horloge et se moque de la polarité).\n\nEn **XLR**, sur un câble **110 Ω** symétrique (un câble micro passe sur quelques mètres, mal au-delà). En **BNC**, sur du coaxial **75 Ω** (AES-3id), le câble de la vidéo, sur de plus grandes distances. Une **référence AES** sans audio (DARS, AES11) sert aussi d'horloge.",
    car: 'Le poste son reçoit et renvoie des paires AES3 par ses cartes d\'entrées-sorties ; les 16 canaux d\'un HD-SDI sont rangés en 8 paires AES.',
    see: ['madi', 'echantillonnage'], ref: 'AES3 ; AES-3id (75 Ω) ; AES11 (référence)',
  },
  madi: {
    t: 'MADI', aka: 'AES10, Multichannel Audio Digital Interface', cat: SON_CAT,
    short: 'Une liaison qui transporte 64 canaux à 48 kHz sur un seul coaxial 75 Ω ou une fibre : le lien classique entre une console et ses boîtiers de scène.',
    body: "Le **MADI** (AES10) met **64 canaux** à 48 kHz (56 en mode varispeed, **32 à 96 kHz**) sur un seul câble : un **coaxial 75 Ω** (une centaine de mètres) ou une **fibre** (bien plus loin). Chaque canal occupe 32 bits par période d'échantillon : 64 × 32 × 48 000 = 98,3 Mb/s, sur une ligne à **125 Mb/s** (codage 4B5B).\n\nPoint à point, unidirectionnel : un câble par sens. Il garde sa place dans les cars et les salles, face aux réseaux audio (Dante, AES67) qui permettent, eux, de router chaque canal n'importe où.",
    car: 'La console du poste son reçoit ses boîtiers de scène par des cartes MADI (page E/S et patch).',
    see: ['aes3', 'dante'], ref: 'AES10',
  },
  loudness: {
    t: 'Loudness (LUFS)', aka: 'ITU-R BS.1770, EBU R128', cat: SON_CAT,
    short: 'Le volume perçu d\'un programme, mesuré en LUFS ; la chaîne demande −23 LUFS intégrés (EBU R128), à ±0,5 LU (±1 LU en direct).',
    body: "La **loudness** (ITU-R BS.1770) mesure le volume **perçu** : un **filtre K** (moins de graves, un peu plus d'aigus, comme l'oreille), une moyenne en **énergie** des canaux, un résultat en **LUFS** ; 1 **LU** vaut 1 dB. Trois fenêtres : **momentanée** (400 ms), **court terme** (3 s), **intégrée** (tout le programme).\n\nL'intégrée écarte les blocs de 400 ms sous **−70 LUFS** (porte absolue : les silences) puis ceux qui sont plus de **10 LU** sous la moyenne (porte relative). La recommandation **EBU R128** : **−23 LUFS** intégrés, **crête vraie** sous **−1 dBTP**, et la **LRA** (plage de loudness) pour décrire la dynamique.",
    car: 'La Control Bay du poste son affiche la loudness du programme ; la chaîne la contrôle au test de ligne et pendant le direct.',
    see: ['crete-vraie'], ref: 'ITU-R BS.1770-4 ; EBU R128 ; EBU Tech 3341, 3342',
  },
  'crete-vraie': {
    t: 'Crête vraie (dBTP)', aka: 'true peak', cat: SON_CAT,
    short: 'La crête de la vraie forme d\'onde, entre les échantillons : elle peut dépasser la plus grande valeur échantillonnée. Limite EBU R128 : −1 dBTP.',
    body: "Un crête-mètre ordinaire lit la plus grande **valeur échantillonnée**. Mais la forme d'onde reconstruite passe **entre** les échantillons, et peut monter au-dessus d'eux : de quelques dixièmes de dB, parfois plus. Une fois reconvertie ou codée (pour la diffusion, en AAC ou en Dolby), elle peut écrêter alors qu'aucun échantillon ne touchait 0 dBFS.\n\nLa **crête vraie** se mesure en **suréchantillonnant** (quatre fois au moins) ; on l'écrit en **dBTP**. La R128 la limite à **−1 dBTP** : un limiteur de crête vraie protège le départ.",
    car: 'Au départ du car, un limiteur de crête vraie garde le programme sous −1 dBTP.',
    see: ['loudness'], ref: 'ITU-R BS.1770-4 (annexe 2) ; EBU R128',
  },
  dante: {
    t: 'Dante', aka: 'audio sur IP d\'Audinate', cat: SON_CAT,
    short: 'Un système d\'Audinate qui transporte des dizaines de canaux audio en IP sur un réseau Ethernet ordinaire ; Dante Controller fait les abonnements.',
    body: "Les appareils Dante (consoles, boîtiers de scène, amplificateurs, ordinateurs) se branchent sur un **commutateur** : un câble remplace le multipaire. Ils prennent une adresse (DHCP, sinon une adresse locale **169.254**), s'annoncent par **mDNS** et apparaissent dans **Dante Controller**, dont la grille **abonne** un canal de réception à un canal d'émission.\n\nLes canaux voyagent par **flux** de quelques canaux, **unicast** (une copie par récepteur) ou **multicast** (une seule copie, il faut l'**IGMP snooping**). Une horloge **PTP** commune (un **leader** élu, qui peut prendre le word clock du car), une **latence** fixe choisie de 0,25 à 5 ms, la **QoS** (DSCP 56 pour le PTP, 46 pour l'audio), l'**EEE coupé** sur les ports, un réseau **secondaire** en secours. Un mode **AES67** ouvre vers le ST 2110-30.",
    car: 'Le car du simulateur transporte l\'audio en SDI ou en ST 2110-30 ; Dante arrive avec la section son, et passe vers le car IP en AES67.',
    see: ['aes67', 'madi'], ref: 'Audinate (Dante Controller, recommandations réseau) ; IEEE 1588',
  },
  aes67: {
    t: 'AES67', aka: 'interopérabilité de l\'audio sur IP', cat: SON_CAT,
    short: 'La norme qui permet aux réseaux audio (Dante, Ravenna…) de s\'échanger des flux : RTP en multicast, horloge PTP v2 ; ST 2110-30 la reprend.',
    body: "Chaque fabricant avait son réseau audio. L'**AES67** fixe un terrain commun : de l'audio **PCM** (24 bits, 48 kHz) dans des paquets **RTP**, une horloge **PTP v2** (IEEE 1588-2008), une description des flux par **SDP**, des paquets d'**1 ms** par défaut. Dante a un mode AES67 ; le **ST 2110-30**, l'audio du car IP, est un profil d'AES67.\n\nCe qu'elle ne fixe pas : la découverte des appareils et la gestion des abonnements, laissées à chaque système (NMOS dans le car IP).",
    car: 'Dans le car IP, l\'audio est en ST 2110-30, compatible AES67 : un flux Dante passé en AES67 s\'y reçoit.',
    see: ['dante', 'st2110-30'], ref: 'AES67 ; SMPTE ST 2110-30',
  },
};
Object.assign(TERMS, ADD);

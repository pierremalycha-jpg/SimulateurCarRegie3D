// @ts-check
// ----------------------------------------------------------------------------------
// Fiches des termes techniques du poste Réseau IP (bouton « ? » à côté de chaque terme).
// Niveau visé : BTS audiovisuel / systèmes numériques. Chaque fiche : une phrase courte, une
// explication, ce que l'on voit dans le car (simulateur), des renvois et la norme de référence.
// Valeurs vérifiées : profil ST 2059-2 (domaine 127, Announce toutes les 250 ms, Sync toutes les
// 125 ms, timeout 3), ordre du BMCA (IEEE 1588, implémentation linuxptp), classes d'horloge,
// IGMPv3 (RFC 3376 : requête toutes les 125 s, expiration 260 s), NMOS IS-04 (battement 5 s,
// effacement après 12 s), IS-05 (paramètres de transport, activation immédiate ou programmée),
// ST 2110-21 (émetteur étroit : CMAX = max(4, ⌊NPACKETS / (43 200 × RACTIVE × TFRAME)⌋),
// VRX_FULL = max(8, ⌊NPACKETS / (27 000 × TFRAME)⌋), formules de l'analyseur EBU LIST ; en 1080p50
// avec 4 320 paquets par image : 5 et 8 ; émetteur large : 16 et 720),
// ST 2110-30 (niveaux A, B, C), AES67 (DSCP EF 46 pour PTP, AF41 34 pour les médias),
// ST 2110-10 (datagramme UDP de 1 460 octets, option jumbo 8 960).
// Texte : paragraphes séparés par une ligne vide, listes « - », **gras**, `code`.
// ----------------------------------------------------------------------------------

/**
 * @typedef {object} Term
 * @property {string} t titre
 * @property {string} [aka] nom complet, traduction
 * @property {string} cat famille
 * @property {string} short l'essentiel en une phrase
 * @property {string} body explication
 * @property {string} [car] ce que l'on en voit dans le car (simulateur)
 * @property {string} [fig] schéma (ui/term_figs.js)
 * @property {string[]} [see] fiches liées
 * @property {string} [ref] norme ou document de référence
 */
export const CATS = ['ST 2110', 'Transport et multicast', 'Réseau', 'PTP', 'NMOS', 'Mesures', 'Exploitation'];

/** @type {Record<string, Term>} */
export const TERMS = {
  // ================= ST 2110 =================
  st2110: {
    t: 'SMPTE ST 2110', aka: 'Professional Media Over Managed IP Networks', cat: 'ST 2110',
    short: 'La famille de normes qui remplace le câble SDI par un réseau Ethernet : chaque signal (image, son, données) voyage en flux IP séparé.',
    body: "Dans un car SDI, un câble coaxial transporte tout ensemble : l'image, le son embeddé et les données. ST 2110 sépare ces **essences** et envoie chacune dans son propre flux IP. Chaque flux est diffusé en multicast, et chaque récepteur s'abonne seulement à ce dont il a besoin.\n\nLes principales parties :\n- **ST 2110-10** : le socle commun (RTP, synchronisation PTP, description SDP, taille des paquets) ;\n- **ST 2110-20** : vidéo non compressée (seulement l'image active, sans les suppressions) ;\n- **ST 2110-21** : régularité d'émission des paquets vidéo ;\n- **ST 2110-22** : vidéo compressée à débit constant (par exemple JPEG XS) ;\n- **ST 2110-30** : audio PCM, compatible AES67 ;\n- **ST 2110-31** : transport transparent de l'AES3 ;\n- **ST 2110-40** : données annexes (timecode, sous-titres…).\n\nToutes les essences sont horodatées avec la même horloge (PTP) : le récepteur peut les réaligner, par exemple pour la synchro labiale.",
    car: "Le car IP a deux réseaux ST 2110 identiques, rouge et bleu. Chaque caméra envoie au moins trois flux : vidéo (-20), audio (-30) et données (-40).",
    fig: 'essences', see: ['essence', 'st2110-20', 'st2110-30', 'ptp', 'st2022-7'], ref: 'SMPTE ST 2110-10, -20, -21, -22, -30, -31, -40',
  },
  essence: {
    t: 'Essence', cat: 'ST 2110',
    short: 'Un type de contenu transporté séparément : la vidéo, l\'audio ou les données annexes.',
    body: "En SDI, l'audio et les données sont **embeddés** dans le signal vidéo. En ST 2110, chaque essence a son propre flux, avec sa propre adresse multicast. Cela permet par exemple :\n- d'envoyer le son d'une caméra à la console sans le désembedder ;\n- de remplacer l'audio d'un programme sans toucher à l'image ;\n- de ne transporter que ce qui sert à chaque appareil.\n\nLes essences restent synchronisées parce qu'elles sont toutes horodatées à partir de la même heure PTP.",
    car: 'Dans le plan multicast (onglet Technique → Plan d\'adressage), chaque caméra a un flux vidéo, un flux audio et un flux de données.',
    fig: 'essences', see: ['st2110', 'groupe', 'ptp'], ref: 'SMPTE ST 2110-10',
  },
  'st2110-20': {
    t: 'ST 2110-20', aka: 'vidéo non compressée', cat: 'ST 2110',
    short: 'La vidéo active, sans compression, découpée en paquets RTP.',
    body: "Seule l'**image active** est transmise : pas de suppression de ligne ni de trame comme en SDI. Chaque paquet porte un morceau de ligne. Un petit en-tête précise le numéro de ligne et la position du premier pixel, ce qui permet de reconstituer l'image.\n\nOrdres de grandeur en 4:2:2 10 bits (20 bits par pixel) :\n- **1080p50** : 1 920 × 1 080 × 50 × 20 bits ≈ **2,07 Gb/s** d'image, environ 2,2 Gb/s avec les en-têtes ;\n- **2160p50 (UHD)** : environ **8,3 Gb/s** d'image, environ 8,6 Gb/s sur le réseau ;\n- **1080i50** : la moitié du 1080p50.\n\nLes horodatages RTP utilisent une horloge à **90 kHz** dérivée de PTP. Tous les paquets d'une même image portent le même horodatage, et le dernier est marqué (bit M).",
    car: 'Dans l\'analyseur (Mesures), la ligne « Format » donne la taille des paquets et le nombre de paquets par ligne et par image.',
    fig: 'packet', see: ['st2110-21', 'rtp', 'mtu', 'debit'], ref: 'SMPTE ST 2110-20 (format de charge utile issu de la RFC 4175)',
  },
  'st2110-21': {
    t: 'ST 2110-21', aka: 'lissage du trafic vidéo', cat: 'ST 2110',
    short: 'Règle la régularité avec laquelle un émetteur vidéo envoie ses paquets, pour ne pas saturer les commutateurs ni le récepteur.',
    body: "Une image fait des milliers de paquets. Un émetteur peut les envoyer bien espacés ou en rafales. Trop de rafales, et les files d'attente des commutateurs comme le tampon du récepteur débordent.\n\nLa norme définit trois types d'émetteurs, annoncés dans le SDP (paramètre `TP`) :\n- **N, étroit** (`TP=2110TPN`) : paquets réguliers pendant les lignes actives, pause pendant la suppression verticale. C'est le cas des appareils matériels.\n- **NL, étroit linéaire** (`TP=2110TPNL`) : paquets réguliers sur toute la durée de l'image.\n- **W, large** (`TP=2110TPW`) : rafales plus importantes tolérées, souvent pour les émetteurs logiciels.\n\nDeux grandeurs se mesurent : **CINST**, à comparer à **CMAX**, et le remplissage du tampon du récepteur virtuel, à comparer à **VRX_FULL**.",
    car: 'Les émetteurs du car sont de type N. En 1080p50 (4 320 paquets par image) : CMAX = 5 et VRX_FULL = 8 ; un émetteur W aurait 16 et 720. L\'analyseur recalcule ces limites selon le format du car.',
    fig: 'shaping', see: ['cmax', 'vrx', 'gigue', 'sdp'], ref: 'SMPTE ST 2110-21',
  },
  cmax: {
    t: 'CINST et CMAX', cat: 'Mesures',
    short: 'CINST compte les paquets arrivés en avance sur un rythme parfaitement régulier ; il ne doit pas dépasser CMAX.',
    body: "La norme imagine un « seau » qui se vide au rythme idéal du flux. Chaque paquet arrivé plus tôt que prévu s'y accumule. **CINST** est le nombre de paquets dans ce seau : c'est la taille d'une rafale.\n\n**CMAX** est la limite autorisée. La norme la calcule à partir du nombre de paquets par image et de la cadence, avec un minimum de **4** pour un émetteur étroit (16 pour un large). Plus l'image compte de paquets, plus CMAX est grand : dans le car, en 1080p50 (4 320 paquets par image), CMAX = 5 ; en UHD, il est bien plus élevé.\n\nAu-delà de CMAX, les rafales risquent de déborder les files d'attente des commutateurs, surtout quand plusieurs flux se rejoignent sur le même lien. Un CINST qui monte révèle souvent un lien trop chargé ou un émetteur mal réglé.",
    car: 'Analyseur de flux : ligne « CINST max / CMAX » sur chaque réseau. Une valeur au-dessus de CMAX passe en rouge et le flux devient non conforme.',
    fig: 'cmax', see: ['st2110-21', 'vrx', 'gigue', 'charge'], ref: 'SMPTE ST 2110-21 (modèle de compatibilité réseau)',
  },
  vrx: {
    t: 'VRX et VRX_FULL', aka: 'tampon du récepteur virtuel', cat: 'Mesures',
    short: 'Le remplissage d\'un récepteur « modèle » qui lit les paquets au rythme de l\'image ; s\'il dépasse VRX_FULL, un récepteur réel peut perdre des paquets.',
    body: "Le récepteur doit absorber les petites irrégularités d'arrivée avant de reconstituer l'image. La norme définit un **récepteur virtuel** avec un tampon de taille **VRX_FULL**, exprimée en paquets.\n\nOn simule ce récepteur et l'on mesure son remplissage maximal, **VRX** :\n- s'il reste sous VRX_FULL, un récepteur conforme reçoit tout ;\n- s'il le dépasse, des paquets sont perdus chez le récepteur, même si le réseau n'en a perdu aucun.\n\nPour un émetteur étroit, VRX_FULL vaut au moins **8** paquets (720 pour un émetteur large) ; dans le car, en 1080p50, VRX_FULL = 8.",
    car: 'Analyseur de flux : ligne « VRX max / VRX_FULL ».',
    fig: 'cmax', see: ['cmax', 'st2110-21', 'gigue'], ref: 'SMPTE ST 2110-21 (modèle du récepteur virtuel)',
  },
  'st2110-22': {
    t: 'ST 2110-22', aka: 'vidéo compressée à débit constant', cat: 'ST 2110',
    short: 'Transport d\'une vidéo légèrement compressée (par exemple JPEG XS) à débit constant.',
    body: "Quand la bande passante manque, par exemple pour envoyer des caméras vers une régie distante (production à distance), on compresse un peu la vidéo. **JPEG XS** divise le débit par 4 à 10 avec une perte invisible à l'œil et un retard de quelques lignes seulement. ST 2110-22 en définit le transport sur RTP, à débit constant.",
    car: 'L\'encodeur TX1 du car fait du JPEG XS pour la contribution.',
    see: ['st2110-20', 'debit'], ref: 'SMPTE ST 2110-22 ; RFC 9134 (JPEG XS sur RTP)',
  },
  'st2110-30': {
    t: 'ST 2110-30', aka: 'audio PCM, compatible AES67', cat: 'ST 2110',
    short: 'L\'audio non compressé (PCM 24 bits, 48 kHz) en paquets RTP très courts.',
    body: "Chaque paquet contient une courte durée de son pour plusieurs canaux. Trois niveaux de conformité :\n- **A** (obligatoire) : 48 kHz, 1 à 8 canaux, paquets de **1 ms** (48 échantillons) ;\n- **B** : en plus, 1 à 8 canaux en paquets de **125 µs** ;\n- **C** : en plus, jusqu'à **64 canaux** en paquets de 125 µs.\n\nLes niveaux AX, BX et CX ajoutent le 96 kHz. Un paquet plus court réduit la latence, mais multiplie le nombre de paquets par seconde.\n\nST 2110-30 reprend **AES67** : un récepteur AES67 peut lire ces flux, ce qui ouvre l'interopérabilité avec les consoles et les interfaces audio sur IP. L'horloge RTP est la fréquence d'échantillonnage, 48 kHz.",
    car: 'Les flux audio du car sont en L24, 48 kHz, paquets de 1 ms (niveau A).',
    see: ['st2110', 'rtp', 'qos'], ref: 'SMPTE ST 2110-30 ; AES67',
  },
  'st2110-40': {
    t: 'ST 2110-40', aka: 'données annexes (ANC)', cat: 'ST 2110',
    short: 'Les données qui accompagnent l\'image en SDI (timecode, sous-titres…), transportées dans leur propre flux.',
    body: "En SDI, des données annexes voyagent dans les zones de suppression : timecode (ATC), sous-titres, AFD (format d'image), métadonnées HDR… ST 2110-40 les extrait et les transporte dans un flux RTP séparé, avec le même horodatage que l'image. Le format suit la RFC 8331.",
    car: 'Chaque caméra du car émet un petit flux « données (ANC) ».',
    see: ['essence', 'st2110'], ref: 'SMPTE ST 2110-40 ; RFC 8331',
  },
  'st2022-7': {
    t: 'ST 2022-7', aka: 'commutation de protection sans coupure', cat: 'ST 2110',
    short: 'Chaque flux est envoyé deux fois, par deux réseaux indépendants. Le récepteur garde, paquet par paquet, la copie qui arrive.',
    body: "L'émetteur envoie deux copies identiques de chaque paquet RTP, l'une sur le réseau **rouge (A)**, l'autre sur le réseau **bleu (B)**. Le récepteur remet les paquets dans l'ordre grâce à leur **numéro de séquence RTP** et garde la première copie valide de chacun.\n\nSi un paquet manque sur un réseau, l'autre le fournit : l'image ne bouge pas. On parle de protection **sans coupure** (hitless). Une panne complète d'un réseau ne se voit pas non plus à l'image.\n\nLe récepteur doit attendre la copie la plus en retard. Son tampon doit donc couvrir l'**écart de temps** entre les deux chemins. La norme classe les récepteurs selon l'écart maximal qu'ils tolèrent.\n\nDans le SDP, les deux jambes sont regroupées par `a=group:DUP primary secondary`.",
    car: "Tous les flux du car sont doublés. « Sans 2022-7 » signifie que la réception ne passe plus que par un réseau : aucun effet à l'image, mais plus de secours.",
    fig: 'dup', see: ['reseaux-ab', 'rtp', 'ecart', 'sdp'], ref: 'SMPTE ST 2022-7 ; RFC 7104 (groupement DUP dans SDP)',
  },
  'reseaux-ab': {
    t: 'Réseaux rouge et bleu (A / B)', cat: 'ST 2110',
    short: 'Deux réseaux physiquement séparés et identiques, qui portent chacun une copie de chaque flux.',
    body: "Les deux réseaux n'ont **aucun lien entre eux** : commutateurs, câbles et alimentations sont séparés. Une erreur de configuration ou une panne sur l'un n'atteint pas l'autre.\n\nChaque appareil a deux cartes réseau, une par réseau, et donc deux adresses IP. Par convention, il a la même fin d'adresse sur les deux : par exemple 10.1.1.21 en rouge et 10.2.1.21 en bleu. On parle aussi de réseau **primaire** et **secondaire**.",
    car: 'Le chiffre après « 10. » indique le réseau : 1 pour le rouge, 2 pour le bleu. Les VLAN suivent la même logique : 101 à 106 en rouge, 201 à 206 en bleu.',
    fig: 'dup', see: ['st2022-7', 'spine-leaf', 'sous-reseau'],
  },
  rtp: {
    t: 'RTP', aka: 'Real-time Transport Protocol', cat: 'Transport et multicast',
    short: 'Le protocole qui transporte les médias : il numérote et horodate chaque paquet.',
    body: "RTP se place au-dessus d'UDP. Son en-tête de 12 octets contient notamment :\n- le **numéro de séquence** (16 bits) : il augmente de 1 à chaque paquet. Un trou signale une perte, et il sert à fusionner les deux copies en ST 2022-7. ST 2110-20 l'étend à 32 bits ;\n- l'**horodatage** (32 bits) : le moment de l'image ou de l'échantillon, compté à 90 kHz pour la vidéo et 48 kHz pour l'audio, à partir de l'heure PTP ;\n- le **type de charge utile** (PT) : le format, décrit dans le SDP ;\n- le **SSRC** : l'identifiant de la source du flux ;\n- le bit **M** (marqueur) : il signale le dernier paquet d'une image en vidéo.\n\nUDP ne corrige rien et ne retransmet rien. C'est voulu : en direct, un paquet en retard ne sert plus à rien.",
    car: 'Capture sur port miroir (Mesures) : cliquez un paquet RTP pour voir ses champs décodés. Un « ÉCART » dans les numéros signale des pertes.',
    fig: 'rtp', see: ['udp', 'pt', 'st2022-7', 'packet-enc'], ref: 'RFC 3550',
  },
  pt: {
    t: 'Type de charge utile (PT)', aka: 'Payload Type', cat: 'Transport et multicast',
    short: 'Un numéro dans l\'en-tête RTP qui renvoie au format décrit dans le SDP.',
    body: "Les numéros 96 à 127 sont **dynamiques** : leur sens est donné par le SDP du flux. Par exemple, `a=rtpmap:96 raw/90000` indique que le PT 96 est de la vidéo non compressée avec une horloge à 90 kHz. Le récepteur vérifie que le PT reçu correspond à ce qu'annonce le SDP.",
    car: 'Le car utilise 96 pour la vidéo, 97 pour l\'audio, 100 pour les données et 98 pour le JPEG XS. Ces valeurs sont des choix d\'installation, pas des valeurs imposées.',
    see: ['rtp', 'sdp'], ref: 'RFC 3550, RFC 3551',
  },
  udp: {
    t: 'UDP et port UDP', aka: 'User Datagram Protocol', cat: 'Transport et multicast',
    short: 'Le transport simple sous RTP ; le port indique au récepteur à quel programme livrer les paquets.',
    body: "UDP envoie des datagrammes **sans accusé de réception** ni retransmission : c'est rapide et prévisible, parfait pour le direct. Le **port de destination** (souvent 5004 pour RTP) dit au récepteur quelle application doit traiter les paquets.\n\nSi le récepteur écoute un autre port que celui de l'émetteur, les paquets arrivent bien jusqu'à la carte réseau, mais sont ignorés.",
    car: "En saisie manuelle (Exploitation → Connexions), un port faux donne exactement ce cas : le réseau achemine le flux, le récepteur n'affiche rien.",
    see: ['rtp', 'transport-params'], ref: 'RFC 768',
  },
  sdp: {
    t: 'SDP', aka: 'Session Description Protocol', cat: 'Transport et multicast',
    short: 'La « carte d\'identité » d\'un flux : adresses, format, horloge. Le récepteur s\'y abonne grâce à elle.',
    body: "Un SDP est un petit fichier texte, une ligne par information :\n- `m=video 5004 RTP/AVP 96` : type de média, port et type de charge utile ;\n- `c=IN IP4 239.1.1.4/64` : groupe multicast de destination ;\n- `a=source-filter: incl IN IP4 239.1.1.4 10.1.1.21` : la seule source acceptée (SSM) ;\n- `a=fmtp:96 sampling=YCbCr-4:2:2; width=1920; height=1080; exactframerate=50; depth=10; …` : le format exact, dont le type d'émetteur `TP` ;\n- `a=ts-refclk` et `a=mediaclk` : l'horloge PTP de référence ;\n- `a=group:DUP` et `a=mid` : les deux jambes ST 2022-7.\n\nAvec NMOS, le contrôleur lit le SDP de l'émetteur et le transmet au récepteur (IS-05).",
    car: 'Onglet Technique → Flux NMOS · SDP, ou bouton « SDP » d\'un émetteur : le SDP complet du flux.',
    see: ['ts-refclk', 'ssm', 'is-05', 'st2022-7', 'st2110-21'], ref: 'RFC 8866 (ex-RFC 4566), RFC 4570, SMPTE ST 2110-10',
  },
  'ts-refclk': {
    t: 'ts-refclk et mediaclk', cat: 'Transport et multicast',
    short: 'Deux lignes du SDP qui disent sur quelle horloge PTP sont calculés les horodatages RTP.',
    body: "`a=ts-refclk:ptp=IEEE1588-2008:EC-46-70-FF-FE-00-00-01:127` donne l'identité du grand maître PTP et le domaine utilisés par l'émetteur.\n\n`a=mediaclk:direct=0` indique que l'horloge du média découle directement de l'heure PTP, sans décalage. ST 2110 impose ce 0.\n\nUn récepteur peut ainsi vérifier qu'il est calé sur la même horloge que l'émetteur avant d'aligner les flux.",
    see: ['sdp', 'ptp', 'clockidentity', 'domaine'], ref: 'RFC 7273 ; SMPTE ST 2110-10',
  },
  'packet-enc': {
    t: 'Encapsulation d\'un paquet ST 2110', cat: 'Transport et multicast',
    short: 'Un paquet vidéo est une suite d\'en-têtes emboîtés : Ethernet, IP, UDP, RTP, puis le morceau d\'image.',
    body: "De l'extérieur vers l'intérieur :\n- **Ethernet** (14 octets) : adresses MAC, dont l'adresse MAC multicast du groupe ;\n- **IP** (20 octets) : adresses IP source et destination (le groupe), et le DSCP pour la priorité ;\n- **UDP** (8 octets) : port de destination ;\n- **RTP** (12 octets) : numéro de séquence et horodatage ;\n- **en-tête ST 2110-20** (8 octets ou plus) : numéro de ligne et position du premier pixel ;\n- **charge utile** : environ 1 200 octets de pixels.\n\nST 2110-10 limite par défaut le datagramme UDP à **1 460 octets**, en-têtes UDP et RTP compris, pour tenir dans une trame de **1 500 octets** (MTU standard). Les trames « jumbo », jusqu'à 8 960 octets, sont une option.",
    fig: 'packet', see: ['mtu', 'rtp', 'mac-mcast', 'qos'], ref: 'SMPTE ST 2110-10',
  },
  groupe: {
    t: 'Groupe multicast', cat: 'Transport et multicast',
    short: 'Une adresse IP de destination qui ne désigne pas un appareil, mais un « canal » auquel les récepteurs s\'abonnent.',
    body: "En **unicast**, un paquet va à un seul destinataire. En **multicast**, l'émetteur envoie une seule fois vers une adresse de groupe, et le réseau duplique les paquets vers tous les abonnés, seulement là où il y en a.\n\nLes adresses multicast IPv4 vont de **224.0.0.0 à 239.255.255.255** :\n- 224.0.0.x : réservées aux protocoles du lien local (OSPF, PIM, IGMP), jamais routées ;\n- **232.0.0.0/8** : plage SSM par défaut ;\n- **239.0.0.0/8** : plage « privée » (à portée administrative), très utilisée dans les installations broadcast.",
    car: 'Le car utilise 239.1.x.y pour le réseau rouge et 239.2.x.y pour le bleu : x = numéro de la leaf de l\'émetteur, y = numéro du flux.',
    fig: 'ssm', see: ['ssm', 'igmp', 'mac-mcast', 'pim'], ref: 'RFC 5771 (attribution), RFC 2365 (portée administrative), RFC 4607 (SSM)',
  },
  ssm: {
    t: 'SSM', aka: 'Source-Specific Multicast', cat: 'Transport et multicast',
    short: 'Le récepteur ne demande pas « le groupe G », mais « le groupe G envoyé par la source S » : le couple (S, G).',
    body: "Avec SSM, chaque abonnement précise la source. Avantages :\n- **pas de point de rendez-vous** (RP) à configurer : le réseau construit directement le chemin vers la source ;\n- **sécurité** : un appareil qui enverrait par erreur sur le même groupe n'est pas reçu ;\n- deux émetteurs peuvent même utiliser le même groupe sans se mélanger.\n\nIl faut **IGMPv3** côté récepteurs (IGMPv2 ne sait pas désigner une source) et **PIM-SSM** entre les routeurs. Les commutateurs ne traitent en SSM que les groupes compris dans leur **plage SSM** configurée.",
    car: 'La plage SSM du car est 239.0.0.0/8. En saisie manuelle, une source fausse donne « le filtre de source SSM ne laisse rien passer ».',
    fig: 'ssm', see: ['igmp', 'pim', 'groupe', 'rpf'], ref: 'RFC 4607',
  },
  igmp: {
    t: 'IGMP (v3)', aka: 'Internet Group Management Protocol', cat: 'Transport et multicast',
    short: 'Le protocole par lequel un appareil dit à son commutateur : « je veux recevoir tel flux ».',
    body: "Le récepteur envoie un **rapport d'appartenance** (Membership Report) quand il veut un flux, puis en réponse aux requêtes régulières du **querier**. En **IGMPv3**, ce rapport indique le groupe et la ou les sources acceptées : c'est ce qui permet le SSM.\n\nQuand le récepteur ne veut plus le flux, il le signale, et le réseau arrête de le lui envoyer.\n\nValeurs par défaut (RFC 3376) :\n- une requête générale toutes les **125 s** ;\n- un délai de réponse de 10 s ;\n- un abonnement qui expire après **260 s** sans réponse (2 × 125 + 10).",
    car: 'Commande `show ip igmp snooping groups` sur une leaf : les abonnements de chaque port.',
    fig: 'ssm', see: ['snooping', 'querier', 'ssm'], ref: 'RFC 3376 (IGMPv3)',
  },
  snooping: {
    t: 'IGMP snooping', cat: 'Transport et multicast',
    short: 'Le commutateur « écoute » les messages IGMP pour n\'envoyer chaque flux multicast qu\'aux ports qui l\'ont demandé.',
    body: "Sans snooping, un commutateur traite le multicast comme du broadcast : il envoie **chaque flux sur tous les ports du VLAN**. Avec quelques flux de 2 à 8 Gb/s, les ports à 10 ou 25 Gb/s débordent immédiatement : c'est l'**inondation**.\n\nAvec le snooping, le commutateur tient une table « tel groupe → tels ports », alimentée par les rapports IGMP, et ne recopie chaque flux que là où il est demandé. Cette table s'efface si aucun querier ne relance régulièrement les abonnements.",
    car: 'Panne « snooping désactivé » : la leaf inonde tous ses ports et les appareils les plus lents perdent des paquets.',
    fig: 'snooping', see: ['igmp', 'querier', 'vlan'], ref: 'RFC 4541',
  },
  querier: {
    t: 'Querier IGMP', cat: 'Transport et multicast',
    short: 'L\'équipement qui demande régulièrement « qui veut quoi ? ». Sans lui, les abonnements finissent par expirer.',
    body: "Sur chaque VLAN, un seul équipement joue le rôle de **querier** : il envoie une requête générale, par défaut toutes les 125 s. Les récepteurs y répondent par un rapport, ce qui rafraîchit la table du snooping.\n\nS'il n'y a pas de querier, plus personne ne relance les récepteurs, les entrées vieillissent et sont supprimées au bout du délai d'appartenance (260 s par défaut) : **les flux s'arrêtent** alors que tout semblait correct.\n\nLe querier est en général la SVI de la leaf, qui fait aussi le routage PIM. Sinon, on active un querier de niveau 2.",
    car: 'Le simulateur raccourcit le délai à 45 s pour l\'exercice. L\'alarme « pas de querier » annonce l\'expiration à venir.',
    see: ['igmp', 'snooping', 'svi'], ref: 'RFC 3376',
  },
  pim: {
    t: 'PIM', aka: 'Protocol Independent Multicast', cat: 'Transport et multicast',
    short: 'Le protocole qui fait circuler les abonnements multicast entre routeurs, jusqu\'à la source.',
    body: "IGMP s'arrête au premier commutateur (la leaf du récepteur). Pour aller chercher un flux sur une autre leaf, la leaf du récepteur envoie un **PIM Join (S, G)** vers la source. Chaque routeur le transmet au suivant en direction de la source, jusqu'à la leaf de l'émetteur. Le flux redescend ensuite le long de ce chemin : c'est l'**arbre de distribution**.\n\nPIM est dit « indépendant du protocole » parce qu'il utilise la table de routage unicast existante (ici OSPF) pour trouver la direction de la source.\n\nIl faut PIM sur les liens entre leaves et spines et sur les SVI.",
    car: 'Commande `show ip mroute` : les entrées (S, G) avec leur interface d\'entrée et leurs interfaces de sortie.',
    fig: 'ssm', see: ['ssm', 'rpf', 'mroute', 'ospf'], ref: 'RFC 7761 (PIM-SM), RFC 4607 (SSM)',
  },
  rpf: {
    t: 'RPF', aka: 'Reverse Path Forwarding', cat: 'Transport et multicast',
    short: 'Un routeur n\'accepte un paquet multicast que s\'il arrive par l\'interface qui mène vers la source.',
    body: "Pour éviter les boucles, chaque routeur vérifie : « si je voulais joindre cette source, par quelle interface passerais-je ? » Le paquet n'est accepté que s'il arrive par cette interface.\n\nConséquences pratiques :\n- il faut une **route unicast vers la source** : le sous-réseau de l'émetteur doit être annoncé en OSPF ;\n- un émetteur avec une adresse **hors de son sous-réseau** échoue au contrôle RPF, et ses flux sont rejetés.",
    car: "Mettre une adresse hors du sous-réseau sur une carte (Exploitation → Appareils) coupe les flux : c'est l'échec RPF.",
    see: ['pim', 'ospf', 'sous-reseau'], ref: 'RFC 7761',
  },
  mroute: {
    t: 'Entrée (S, G) – mroute', cat: 'Transport et multicast',
    short: 'Une ligne de la table de routage multicast : pour ce flux, d\'où il arrive et vers où le recopier.',
    body: "Chaque entrée **(S, G)** contient :\n- l'**interface d'entrée** (IIF), celle qui mène à la source, validée par le RPF ;\n- la **liste des interfaces de sortie** (OIL), là où il y a des abonnés.\n\nUn routeur recopie le flux sur chaque interface de sortie : c'est la duplication multicast. Si un flux manque, il faut suivre ces entrées de la leaf du récepteur jusqu'à la leaf de la source.",
    see: ['pim', 'rpf', 'ssm'], ref: 'RFC 7761',
  },
  'mac-mcast': {
    t: 'Adresse MAC multicast', cat: 'Transport et multicast',
    short: 'L\'adresse Ethernet de destination d\'un flux multicast, calculée à partir du groupe IP.',
    body: "Une trame Ethernet a besoin d'une adresse MAC de destination. Pour un groupe IPv4, on prend le préfixe **01:00:5E** et on recopie les **23 derniers bits** de l'adresse du groupe. Exemple : 239.1.1.4 donne 01:00:5E:01:01:04.\n\nComme 5 bits sont perdus, **32 groupes IP** partagent la même adresse MAC. Un commutateur qui ne filtre qu'en niveau 2 ne les distingue pas. C'est une raison de plus de choisir un plan d'adressage multicast soigné.",
    fig: 'macmcast', see: ['groupe', 'snooping'], ref: 'RFC 1112',
  },
  sdn: {
    t: 'SDN et mode de commutation', aka: 'Software-Defined Networking', cat: 'Transport et multicast',
    short: 'Au lieu de laisser PIM choisir les chemins, un contrôleur central décide où passe chaque flux et vérifie la bande passante.',
    body: "En mode **PIM**, chaque flux suit le chemin choisi par le routage (hachage ECMP) et **aucune vérification de bande passante** n'est faite. Si un lien sature, tous ses flux perdent des paquets.\n\nEn mode **SDN**, un contrôleur connaît toute la topologie et la charge de chaque lien. Il place chaque flux sur un chemin qui a la place, et **refuse** une connexion plutôt que de saturer un lien.",
    car: 'Onglet Technique → Flux NMOS · SDP : liste « Mode de commutation ». En SDN, une connexion refusée s\'affiche « FLUX REFUSÉ ».',
    see: ['pim', 'ecmp', 'charge'],
  },

  // ================= Réseau =================
  'spine-leaf': {
    t: 'Spine-leaf', aka: 'architecture de Clos à deux étages', cat: 'Réseau',
    short: 'Chaque commutateur d\'accès (leaf) est relié à chaque commutateur central (spine) : deux appareils sont toujours à deux sauts l\'un de l\'autre.',
    body: "Les **leaves** reçoivent les appareils, souvent en haut de chaque baie (ToR, *Top of Rack*). Les **spines** ne reçoivent que des leaves. Chaque leaf est reliée à chaque spine.\n\nAvantages :\n- **trajets courts et prévisibles** : leaf → spine → leaf ;\n- **grandir facilement** : plus de ports, on ajoute une leaf ; plus de bande passante, on ajoute des uplinks ou une spine ;\n- **pas de point unique de panne** : si une spine tombe, l'autre porte le trafic.\n\nLa capacité des uplinks d'une leaf doit couvrir ce que ses appareils envoient et reçoivent.",
    car: 'Chaque réseau du car a 2 spines et 6 leaves, une par zone : caméras, production, ralentis, monitoring, audio et passerelles.',
    fig: 'spineleaf', see: ['leaf', 'spine', 'uplink', 'ecmp'],
  },
  leaf: {
    t: 'Leaf', aka: 'commutateur d\'accès', cat: 'Réseau',
    short: 'Le commutateur sur lequel se branchent les appareils. Il fait aussi routeur pour leur sous-réseau.',
    body: "Une leaf a beaucoup de ports « appareils » (ici 48 × 25 GbE) et quelques ports rapides vers les spines (ici 100 GbE). Dans le car, chaque leaf porte un VLAN et un sous-réseau, et joue le rôle de **passerelle** (SVI) et de **querier** pour ses appareils.",
    see: ['spine-leaf', 'spine', 'svi', 'vlan'],
  },
  spine: {
    t: 'Spine', aka: 'commutateur de cœur', cat: 'Réseau',
    short: 'Un commutateur central qui ne relie que des leaves entre elles.',
    body: "Les spines transportent le trafic d'une leaf à l'autre. Elles n'ont pas d'appareils raccordés, sauf ici les **grands maîtres PTP**, branchés sur les spines pour être au centre du réseau.",
    see: ['spine-leaf', 'leaf', 'grand-maitre'],
  },
  uplink: {
    t: 'Uplink', aka: 'lien montant', cat: 'Réseau',
    short: 'Un lien entre une leaf et une spine.',
    body: "Chaque leaf du car a 4 uplinks à 100 GbE : 2 vers chaque spine. Ce sont des liens **routés** (pas de VLAN), chacun dans son propre petit sous-réseau /31, avec OSPF et PIM. Leur charge est à surveiller : tous les flux qui changent de leaf y passent.",
    see: ['spine-leaf', 'ecmp', 'sous-reseau', 'charge'],
  },
  vlan: {
    t: 'VLAN', aka: 'Virtual LAN, IEEE 802.1Q', cat: 'Réseau',
    short: 'Un réseau local « virtuel » : des ports d\'un même commutateur rangés dans des groupes isolés les uns des autres.',
    body: "Un VLAN est un **domaine de diffusion** séparé, repéré par un numéro de 1 à 4094. Deux appareils dans des VLAN différents ne se voient pas directement : il faut un routeur entre eux.\n\nDeux modes de port :\n- **accès** : le port appartient à un seul VLAN, et l'appareil ne s'en rend pas compte ;\n- **trunk** : le port transporte plusieurs VLAN, chaque trame portant une étiquette 802.1Q.\n\nUn appareil branché dans le mauvais VLAN est isolé de sa passerelle : il ne peut plus rien envoyer ni recevoir.",
    car: 'Le car a un VLAN par leaf et par réseau : 101 (caméras rouges) à 106, et 201 à 206 en bleu.',
    fig: 'vlan', see: ['svi', 'sous-reseau', 'passerelle'], ref: 'IEEE 802.1Q',
  },
  svi: {
    t: 'SVI', aka: 'Switched Virtual Interface, « interface Vlan »', cat: 'Réseau',
    short: 'L\'interface de routeur d\'un VLAN, à l\'intérieur du commutateur : c\'est la passerelle des appareils.',
    body: "Un commutateur de niveau 3 crée pour un VLAN une interface virtuelle, `interface Vlan101`, avec une adresse IP, par exemple 10.1.1.1/24. Cette adresse est la **passerelle** des appareils du VLAN.\n\nLa SVI porte aussi les fonctions multicast du sous-réseau : **IGMP** (querier) et **PIM**. Elle est annoncée en OSPF pour que le reste du réseau sache joindre ce sous-réseau.",
    car: 'Onglet Technique → Commutateurs → VLAN · SVI. Une SVI éteinte coupe tous les appareils de la leaf.',
    fig: 'vlan', see: ['vlan', 'passerelle', 'querier', 'pim'],
  },
  'sous-reseau': {
    t: 'Adresse IP, sous-réseau et masque', aka: 'notation CIDR /24, /31…', cat: 'Réseau',
    short: 'Une adresse IPv4 se découpe en une partie « réseau » et une partie « appareil ». Le masque, ou /n, dit où passe la frontière.',
    body: "Une adresse IPv4 fait **32 bits**, écrits en 4 nombres de 0 à 255. Le **/24** signifie que les 24 premiers bits désignent le réseau (masque 255.255.255.0) : 10.1.1.0/24 contient les adresses 10.1.1.0 à 10.1.1.255.\n\nQuelques tailles :\n- **/24** : 256 adresses, dont 254 utilisables ;\n- **/22** : 1 024 adresses (le réseau de contrôle 10.20.0.0 à 10.20.3.255) ;\n- **/31** : 2 adresses, pour un lien point à point entre deux routeurs (RFC 3021) ;\n- **/32** : une seule adresse (loopback).\n\nDeux appareils du même sous-réseau se parlent directement. Pour sortir du sous-réseau, il faut passer par la passerelle.",
    car: 'Plan du car : 10.<réseau>.<leaf>.0/24, passerelle en .1, appareils à partir de .20, même fin d\'adresse sur les deux réseaux.',
    fig: 'subnet', see: ['passerelle', 'vlan', 'conflit-ip'], ref: 'RFC 4632 (CIDR), RFC 3021 (/31)',
  },
  passerelle: {
    t: 'Passerelle', aka: 'passerelle par défaut, default gateway', cat: 'Réseau',
    short: 'Le routeur auquel un appareil confie tout ce qui doit sortir de son sous-réseau.',
    body: "Pour joindre une adresse hors de son sous-réseau en **unicast**, un appareil envoie le paquet à sa passerelle, ici la SVI de la leaf.\n\nÀ retenir pour le ST 2110 : la passerelle **ne sert pas** au multicast. L'émission d'un flux, les abonnements IGMP et PTP restent sur le lien local. Une passerelle fausse ne coupe donc pas les flux, mais empêche la supervision, le ping ou une mise à jour depuis un autre réseau.",
    car: 'Exploitation → Appareils : une passerelle fausse donne un simple avertissement, une adresse hors du sous-réseau coupe les flux.',
    see: ['svi', 'sous-reseau', 'rpf'],
  },
  'conflit-ip': {
    t: 'Conflit d\'adresse IP', cat: 'Réseau',
    short: 'Deux appareils avec la même adresse : le réseau ne sait plus à qui envoyer, et les deux perdent des paquets.',
    body: "Le réseau associe chaque adresse IP à une adresse MAC (protocole **ARP**). Avec deux appareils sur la même adresse, cette association bascule de l'un à l'autre : chacun reçoit une partie de ce qui était destiné à l'autre, et ses propres flux sont perturbés.\n\nCela arrive typiquement quand on remplace un appareil en recopiant la configuration d'un autre.",
    car: 'Panne « conflit d\'adresse IP entre deux CCU » ; diagnostic par `show ip arp` sur la leaf ou par le plan d\'adressage.',
    see: ['sous-reseau'], ref: 'RFC 826 (ARP)',
  },
  routage: {
    t: 'Routage IP', cat: 'Réseau',
    short: 'Faire passer les paquets d\'un sous-réseau à un autre grâce à une table de routes.',
    body: "Un commutateur de niveau 3 (`ip routing`) consulte une **table de routage** : pour chaque destination, par quelle interface et vers quel voisin envoyer. Ces routes sont soit directement connectées (les SVI), soit apprises par un protocole comme **OSPF**.\n\nPour le multicast, il faut en plus `ip multicast-routing` et PIM.",
    car: 'Commande `show ip route` : les sous-réseaux des autres leaves, appris par OSPF, avec plusieurs chemins égaux (ECMP).',
    see: ['ospf', 'ecmp', 'pim'],
  },
  ospf: {
    t: 'OSPF', aka: 'Open Shortest Path First', cat: 'Réseau',
    short: 'Le protocole de routage qui permet à chaque commutateur de connaître tout le réseau et d\'en déduire les meilleurs chemins.',
    body: "Chaque routeur décrit ses liens à ses voisins. Tous construisent la même carte du réseau, et chacun calcule ses plus courts chemins avec l'algorithme de **Dijkstra**.\n\nDeux voisins passent par plusieurs états avant d'échanger leurs routes : Down → Init → 2-Way → ExStart → Exchange → Loading → **Full**. « Full » veut dire que tout va bien.\n\nCauses classiques de blocage :\n- **MTU différente** des deux côtés : blocage en ExStart ou Exchange ;\n- zone (area) différente ;\n- temporisateurs ou authentification différents.\n\nChaque routeur est identifié par un **router-ID**, souvent l'adresse de sa loopback.",
    car: 'Commande `show ip ospf neighbor` : chaque uplink doit être en FULL.',
    fig: 'ospf', see: ['routage', 'ecmp', 'mtu', 'loopback'], ref: 'RFC 2328 (OSPFv2)',
  },
  ecmp: {
    t: 'ECMP', aka: 'Equal-Cost Multi-Path', cat: 'Réseau',
    short: 'Quand plusieurs chemins sont aussi bons, le trafic est réparti entre eux, flux par flux.',
    body: "Une leaf a 4 uplinks vers 2 spines : 4 chemins de même coût. Le commutateur calcule un **hachage** à partir des adresses de chaque flux et le place sur l'un des chemins. Un même flux reste toujours sur le même chemin, pour éviter que ses paquets n'arrivent dans le désordre.\n\nAvec des flux énormes (2 à 8 Gb/s chacun) et peu nombreux, le hasard du hachage peut charger un lien bien plus que les autres. C'est une des raisons d'utiliser un contrôleur SDN dans les grosses installations.",
    fig: 'ecmp', see: ['uplink', 'ospf', 'sdn', 'charge'],
  },
  loopback: {
    t: 'Loopback et router-ID', cat: 'Réseau',
    short: 'Une interface virtuelle toujours active, qui donne au commutateur une adresse stable.',
    body: "Une interface loopback ne dépend d'aucun câble : elle reste joignable tant que le commutateur a au moins un chemin vers le reste du réseau. On s'en sert comme **identifiant OSPF** (router-ID) et comme adresse de gestion stable. Son masque est /32.",
    see: ['ospf', 'sous-reseau'],
  },
  mtu: {
    t: 'MTU', aka: 'Maximum Transmission Unit', cat: 'Réseau',
    short: 'La taille maximale d\'un paquet sur un lien. La norme Ethernet est de 1 500 octets ; les trames « jumbo » vont jusqu\'à 9 000 octets environ.',
    body: "Un port n'accepte pas un paquet plus grand que sa MTU. Les paquets ST 2110 standard font **jusqu'à environ 1 500 octets**. Un port réglé plus bas les jette tous.\n\nLes commutateurs broadcast sont souvent réglés en **jumbo** (9 214 octets ici) : cela laisse de la marge pour les encapsulations et pour les flux qui utilisent les grands paquets.\n\nDeux routeurs voisins doivent avoir la **même MTU**, sinon OSPF reste bloqué.",
    car: 'Panne « MTU » : un port à 1 400 octets jette les paquets RTP de son appareil.',
    fig: 'packet', see: ['packet-enc', 'ospf'], ref: 'SMPTE ST 2110-10 (taille des paquets)',
  },
  fec: {
    t: 'FEC', aka: 'Forward Error Correction', cat: 'Réseau',
    short: 'Un code correcteur ajouté sur la liaison, qui corrige les erreurs de bits sans retransmission.',
    body: "Aux très hauts débits (25 et 100 Gb/s), la fibre et les optiques font quelques erreurs de bits. Le **RS-FEC** (Reed-Solomon) ajoute de la redondance qui permet de les corriger à la réception. Il est défini dans les clauses 108 (25G) et 91 (100G) d'IEEE 802.3.\n\nLes deux extrémités doivent utiliser **le même mode FEC**. Sinon, le lien ne monte pas, ou il passe des erreurs.\n\nÀ ne pas confondre avec la FEC de niveau paquets (SMPTE ST 2022-5), qui ajoute des paquets de parité au flux.",
    car: 'Commutateurs → Interfaces : champ FEC. Une FEC différente du réglage attendu fait tomber le lien.',
    see: ['vitesse'], ref: 'IEEE 802.3 (clauses 91 et 108)',
  },
  vitesse: {
    t: 'Vitesse de port et optiques', cat: 'Réseau',
    short: 'Le débit du lien (10, 25, 40, 100 GbE…) et le module optique qui va avec (SFP28, QSFP28).',
    body: "Les deux extrémités doivent tourner à la **même vitesse**, et la carte de l'appareil doit la supporter. Les modules :\n- **SFP28** : 25 GbE, ou 10 GbE ;\n- **QSFP28** : 100 GbE (4 voies à 25 Gb/s), ou 40 GbE.\n\nOrdre de grandeur : un port à 25 GbE porte une dizaine de flux 1080p50, ou deux flux UHD.",
    see: ['fec', 'charge', 'uplink'], ref: 'IEEE 802.3',
  },
  charge: {
    t: 'Charge d\'un lien', aka: 'taux d\'utilisation', cat: 'Réseau',
    short: 'Le débit qui passe sur un lien, rapporté à sa capacité.',
    body: "- **Moins de 80 %** : confortable ;\n- **au-delà de 80 %** : les files d'attente des commutateurs se remplissent, la **gigue** augmente et PTP devient bruité s'il n'est pas prioritaire ;\n- **au-delà de 100 %** : le surplus est **jeté**, pour tous les flux du lien.\n\nEn mode PIM, rien n'empêche de dépasser 100 %. C'est au plan de câblage, ou au contrôleur SDN, de l'éviter.",
    car: 'Mesures → Charge des liens : les liens les plus chargés, avec leur historique.',
    see: ['gigue', 'sdn', 'qos', 'ecmp'],
  },
  qos: {
    t: 'QoS et DSCP', aka: 'qualité de service, Differentiated Services Code Point', cat: 'Réseau',
    short: 'Un marquage dans chaque paquet (le DSCP) indique sa priorité ; le commutateur fait passer les plus prioritaires en premier.',
    body: "Le **DSCP** est un champ de 6 bits de l'en-tête IP (valeurs 0 à 63). Le commutateur range chaque paquet dans une file d'attente selon ce marquage, à condition de lui faire confiance (`qos trust dscp`).\n\nRecommandations d'**AES67**, très suivies en ST 2110 :\n- **PTP** : EF (**46**), en file prioritaire stricte ;\n- **médias** (audio RTP) : AF41 (**34**) ;\n- le reste (contrôle, découverte) : au mieux (0).\n\nST 2110 n'impose pas de valeur pour la vidéo : chaque installation fixe la sienne.\n\nPourquoi c'est vital pour PTP : un message de synchronisation retardé dans une file pleine fausse la mesure du délai, et l'horloge devient bruitée.",
    car: 'Le car marque PTP en 46, l\'audio en 34, la vidéo en 26 et les données en 18 ; option « PTP (DSCP 46) en file prioritaire ».',
    fig: 'qos', see: ['ptp', 'gigue', 'charge'], ref: 'RFC 2474 ; AES67 (classes de service)',
  },
  span: {
    t: 'Port miroir (SPAN)', cat: 'Réseau',
    short: 'Le commutateur recopie le trafic d\'un port vers un autre, où est branché un PC de mesure.',
    body: "Une **session miroir** prend comme source un port (en réception, en émission ou les deux) et comme destination le port de l'analyseur. Deux pièges :\n- le port de destination doit avoir la **capacité** de tout recevoir, sinon la capture est incomplète ;\n- le port de destination ne sert **plus qu'à la copie** : l'appareil qui y était branché est coupé.",
    car: 'Mesures → Capture : `monitor session 1 source …` puis `monitor session 1 destination Ethernet48`.',
    fig: 'span', see: ['charge'],
  },
  config: {
    t: 'Running-config, startup-config, write memory', cat: 'Réseau',
    short: 'La configuration en cours d\'utilisation n\'est pas forcément celle qui sera rechargée au démarrage.',
    body: "- **running-config** : la configuration active, en mémoire vive. Chaque commande la modifie immédiatement.\n- **startup-config** : la configuration enregistrée, rechargée au redémarrage.\n- **write memory** (ou `copy running-config startup-config`) : enregistre l'une dans l'autre.\n\nUne correction non enregistrée **disparaît** au prochain redémarrage : la panne revient.",
    car: 'Commutateurs → Configuration : les différences entre running et startup. Bouton « Enregistrer (write memory) ».',
    see: ['shutdown'],
  },
  shutdown: {
    t: 'Shutdown (port désactivé)', cat: 'Réseau',
    short: 'Un port « shutdown » est éteint administrativement : plus rien ne passe, même si le câble est branché.',
    body: "`shutdown` coupe un port, `no shutdown` le rallume. C'est la première chose à vérifier quand un lien ne monte pas, avant même la vitesse et la FEC.",
    see: ['vitesse', 'config'],
  },
  lldp: {
    t: 'LLDP', aka: 'Link Layer Discovery Protocol', cat: 'Réseau',
    short: 'Chaque équipement annonce son nom et son port à son voisin : on vérifie le câblage sans ouvrir la baie.',
    body: "Toutes les 30 s environ, chaque équipement LLDP envoie sur chaque port son nom, son port et quelques caractéristiques. `show lldp neighbors` donne donc la liste de ce qui est branché où : c'est la vérification du câblage par excellence.",
    see: ['spine-leaf'], ref: 'IEEE 802.1AB',
  },
  'reseau-ctl': {
    t: 'Réseau de contrôle et de gestion', cat: 'Réseau',
    short: 'Un réseau séparé, sans médias, pour piloter les appareils (NMOS, RCP, tally) et administrer les commutateurs.',
    body: "Les médias circulent sur les réseaux rouge et bleu. Le pilotage passe ailleurs :\n- le **réseau de contrôle** (ici VLAN 20, 10.20.0.0/22) : registre NMOS, contrôleur, panneaux, tally ;\n- le **réseau de gestion** (ici VLAN 10) : administration des commutateurs et des grands maîtres.\n\nSéparer ces réseaux protège les médias d'une tempête de trafic de contrôle et limite les accès.",
    car: 'Le registre NMOS est en 10.20.0.10, la passerelle du réseau de contrôle en 10.20.0.1.',
    see: ['nmos', 'registre'],
  },

  // ================= PTP =================
  ptp: {
    t: 'PTP', aka: 'Precision Time Protocol, IEEE 1588', cat: 'PTP',
    short: 'Le protocole qui donne la même heure, à quelques dizaines de nanosecondes près, à tous les appareils du réseau.',
    body: "En SDI, chaque appareil reçoit une **référence** (black burst ou tri-level) par un câble. En IP, il n'y a plus de câble de synchro : tout le monde se cale sur une **heure commune** distribuée par le réseau.\n\nUn **grand maître**, en général calé sur le GPS, envoie l'heure. Chaque esclave mesure le temps de trajet des messages et corrige son horloge. L'**horodatage matériel** des paquets dans les cartes réseau permet une précision bien meilleure que la microseconde.\n\nMessages principaux :\n- **Announce** : la qualité du maître ;\n- **Sync** et **Follow_Up** : l'heure envoyée ;\n- **Delay_Req** et **Delay_Resp** : la mesure du trajet retour.",
    car: 'En broadcast, on utilise le profil SMPTE ST 2059-2 de PTP version 2 (IEEE 1588-2008).',
    fig: 'ptp', see: ['st2059', 'grand-maitre', 'bmca', 'offset', 'bc'], ref: 'IEEE 1588-2008 ; SMPTE ST 2059-2',
  },
  st2059: {
    t: 'SMPTE ST 2059-1 et 2059-2', cat: 'PTP',
    short: 'Le profil PTP du broadcast (-2), et la règle qui transforme l\'heure PTP en phase vidéo et audio (-1).',
    body: "**ST 2059-1** fixe une origine des temps, l'**époque SMPTE**, au 1er janvier 1970 à 0 h TAI. Tous les signaux sont censés démarrer ensemble à cet instant. Pour connaître la phase de son signal, un appareil calcule simplement le temps écoulé depuis l'époque, modulo la durée d'une image. Tous les appareils trouvent ainsi le même début d'image, sans câble de synchro.\n\n**ST 2059-2** est le **profil** PTP (les réglages communs) :\n- domaine par défaut **127** (plage 0 à 127) ;\n- un Announce toutes les **250 ms** (4 par seconde) ;\n- un Sync toutes les **125 ms** (8 par seconde) ;\n- maître déclaré perdu après **3** Announce manqués (0,75 s).",
    car: 'Onglet Technique → PTP et Exploitation → PTP : domaine 127 partout.',
    see: ['ptp', 'domaine', 'announce'], ref: 'SMPTE ST 2059-1, SMPTE ST 2059-2',
  },
  'grand-maitre': {
    t: 'Grand maître (GM)', aka: 'grandmaster', cat: 'PTP',
    short: 'L\'horloge de référence de tout le réseau PTP, en général calée sur le GPS.',
    body: "Un seul grand maître est élu à la fois par domaine, grâce au **BMCA**. On en installe deux pour la redondance :\n- le premier a la meilleure priorité ;\n- le second prend le relais automatiquement si le premier se tait.\n\nUn grand maître calé GPS annonce la **classe 6**. S'il perd le GPS, il passe en **maintien** (holdover, classe 7) : son heure reste très bonne quelque temps, puis dérive lentement.",
    car: 'GM1 (priority1 100) et GM2 (priority1 110) sont raccordés aux spines.',
    fig: 'ptptree', see: ['bmca', 'clockclass', 'holdover', 'priority'],
  },
  bmca: {
    t: 'BMCA', aka: 'Best Master Clock Algorithm', cat: 'PTP',
    short: 'L\'algorithme par lequel toutes les horloges élisent, sans chef, le meilleur maître.',
    body: "Chaque horloge compare les messages **Announce** qu'elle reçoit, critère par critère, dans cet ordre. Le **plus petit** gagne, et l'on ne passe au critère suivant qu'en cas d'égalité :\n1. **priority1** (réglage de l'administrateur) ;\n2. **clockClass** (traçabilité : GPS, maintien…) ;\n3. **clockAccuracy** (précision annoncée) ;\n4. **offsetScaledLogVariance** (stabilité) ;\n5. **priority2** (départage entre horloges équivalentes) ;\n6. **clockIdentity** (départage final, toujours unique).\n\nPiège classique : priority1 passe **avant** la qualité. Un appareil mal réglé, avec un priority1 plus petit que celui des GPS, est élu même s'il n'a aucune référence.",
    car: 'Couper le GM1 : après 3 Announce manqués, le BMCA élit le GM2. Une « horloge pirate » montre le piège de priority1.',
    fig: 'bmca', see: ['priority', 'clockclass', 'clockidentity', 'pirate'], ref: 'IEEE 1588-2008, § 9.3',
  },
  priority: {
    t: 'priority1 et priority2', cat: 'PTP',
    short: 'Deux réglages de 0 à 255 qui permettent à l\'administrateur d\'imposer son choix de maître (plus petit = préféré).',
    body: "- **priority1** est le **premier** critère du BMCA, avant même la qualité de l'horloge. On le règle pour désigner le grand maître principal et le secours.\n- **priority2** ne sert qu'à départager deux horloges de même qualité.\n\nLa valeur par défaut est 128. Les appareils ordinaires ne doivent jamais pouvoir passer devant les grands maîtres.",
    see: ['bmca', 'slave-only', 'pirate'], ref: 'IEEE 1588-2008',
  },
  clockclass: {
    t: 'clockClass', aka: 'classe d\'horloge', cat: 'PTP',
    short: 'Le niveau de traçabilité annoncé par une horloge.',
    body: "Valeurs courantes :\n- **6** : calée sur une référence primaire (GPS) ;\n- **7** : ancienne classe 6 qui a perdu sa référence et tient en **maintien**, dans ses spécifications ;\n- **52** ou **187** : maintien hors spécifications (dégradé) ;\n- **248** : valeur par défaut, horloge libre ;\n- **255** : horloge « esclave seulement ».\n\nÀ priority1 égal, une horloge de classe 6 l'emporte sur une horloge de classe 7.",
    see: ['bmca', 'holdover', 'grand-maitre'], ref: 'IEEE 1588-2008, § 7.6.2.4',
  },
  clockidentity: {
    t: 'Identité d\'horloge (clockIdentity)', cat: 'PTP',
    short: 'L\'identifiant unique de 64 bits d\'une horloge PTP, souvent dérivé de son adresse MAC.',
    body: "On l'obtient en général en insérant **FF:FE** au milieu de l'adresse MAC de 48 bits, par exemple `EC:46:70:FF:FE:00:00:01`. Elle sert de départage final au BMCA et figure dans le SDP des flux (`ts-refclk`), pour que les récepteurs sachent sur quel grand maître l'émetteur est calé.",
    see: ['bmca', 'ts-refclk'], ref: 'IEEE 1588-2008',
  },
  domaine: {
    t: 'Domaine PTP', cat: 'PTP',
    short: 'Un numéro qui sépare plusieurs « mondes » PTP indépendants sur le même réseau.',
    body: "Une horloge n'écoute que les messages de **son** domaine. Le profil broadcast ST 2059-2 utilise par défaut le domaine **127** (plage 0 à 127). Le profil par défaut d'IEEE 1588, lui, est en domaine 0.\n\nUn appareil ou un commutateur réglé sur un autre domaine **n'entend plus le grand maître** : il passe en horloge libre, et ses images ne sont plus en phase.",
    car: 'Panne « mauvais domaine PTP » ; sortie d\'usine d\'une passerelle (domaine 0).',
    see: ['st2059', 'ptp'], ref: 'IEEE 1588-2008 ; SMPTE ST 2059-2',
  },
  bc: {
    t: 'Horloge frontière (BC)', aka: 'Boundary Clock', cat: 'PTP',
    short: 'Un commutateur qui se cale sur son maître par un port, puis redevient maître sur tous les autres.',
    body: "Sans horloge frontière, les messages PTP traversent les files d'attente des commutateurs avec un retard variable, et la mesure du délai devient fausse. Une **horloge frontière** termine PTP sur chaque port :\n- elle est **esclave** sur le port qui mène au meilleur maître ;\n- elle est **maître** sur les autres ports ;\n- elle régénère l'heure à chaque saut.\n\nAutre solution : l'**horloge transparente** (TC). Elle laisse passer les messages en y ajoutant le temps passé dans le commutateur (champ de correction).",
    car: 'Tous les commutateurs du car sont des horloges frontières. Commande `show ptp interface brief` : un port Slave, les autres Master.',
    fig: 'ptptree', see: ['ptp', 'port-ptp', 'sauts'], ref: 'IEEE 1588-2008',
  },
  'port-ptp': {
    t: 'Rôle et état d\'un port PTP', cat: 'PTP',
    short: 'Chaque port PTP est maître (il donne l\'heure), esclave (il la reçoit) ou passif.',
    body: "Le BMCA décide de l'état de chaque port : **SLAVE** vers le meilleur maître, **MASTER** vers les horloges moins bonnes, **PASSIVE** pour un second chemin vers le même maître.\n\nOn peut **forcer** un port en maître (`ptp role master`) : le commutateur ignore alors les Announce qui arrivent par ce port. Sur les ports d'accès des appareils, c'est la meilleure protection contre une horloge pirate.",
    car: 'Les ports d\'accès des leaves sont forcés en « master ». Un port de grand maître forcé en master est une erreur : la spine ignore le GPS.',
    see: ['bc', 'pirate', 'slave-only'],
  },
  'slave-only': {
    t: 'Esclave seulement (slave only)', cat: 'PTP',
    short: 'Un appareil réglé pour ne jamais pouvoir devenir maître PTP.',
    body: "C'est le réglage attendu de tous les appareils terminaux (caméras, passerelles, mélangeurs…). Ils reçoivent l'heure et ne participent jamais à l'élection du maître.",
    car: 'Décocher « slave only » sur un appareil, avec un priority1 trop petit, crée une horloge pirate.',
    see: ['pirate', 'priority', 'port-ptp'],
  },
  pirate: {
    t: 'Horloge pirate', aka: 'rogue master', cat: 'PTP',
    short: 'Un appareil mal réglé qui gagne l\'élection PTP : tout le réseau se cale sur une horloge sans référence.',
    body: "Exemple : un appareil n'est pas en « slave only » et son priority1 est plus petit que celui des grands maîtres. Le BMCA l'élit, car priority1 passe avant la qualité, et tout le monde se cale sur lui. L'heure n'est plus traçable, et les images dérivent par rapport au monde extérieur.\n\nProtections :\n- appareils en slave only ;\n- ports d'accès forcés en `ptp role master` ;\n- surveillance du grand maître élu.",
    see: ['bmca', 'slave-only', 'port-ptp'],
  },
  offset: {
    t: 'Décalage au maître (offset)', aka: 'offsetFromMaster', cat: 'PTP',
    short: 'L\'écart entre l\'horloge d\'un appareil et celle de son maître, recalculé à chaque message Sync.',
    body: "Le maître note l'heure d'envoi du Sync (**t1**) ; l'esclave note son arrivée (**t2**). L'esclave envoie un Delay_Req (**t3**), que le maître reçoit à **t4**. Alors :\n- délai moyen = ((t2 − t1) + (t4 − t3)) / 2 ;\n- décalage = (t2 − t1) − délai moyen.\n\nUn appareil bien verrouillé reste à **quelques dizaines de nanosecondes**. Au-delà d'une microseconde, les images ne sont plus alignées. Un saut de l'offset trahit un changement de grand maître.\n\nLe calcul suppose un trajet **symétrique** (même temps à l'aller et au retour). Toute asymétrie devient une erreur de décalage.",
    car: 'Exploitation → PTP et Mesures → Suivi PTP : courbe de l\'offset en direct.',
    fig: 'ptp', see: ['delai-moyen', 'gigue', 'bc'], ref: 'IEEE 1588-2008',
  },
  'delai-moyen': {
    t: 'Délai moyen (mean path delay)', cat: 'PTP',
    short: 'Le temps moyen de trajet d\'un message PTP entre le maître et l\'esclave.',
    body: "Calculé à partir des quatre instants t1 à t4 : ((t2 − t1) + (t4 − t3)) / 2. Il augmente avec la longueur de câble et le nombre d'équipements traversés.\n\nUn délai **stable** n'est pas un problème : il est compensé. Ce qui gêne, c'est un délai qui **varie** (gigue PTP), à cause des files d'attente.",
    fig: 'ptp', see: ['offset', 'gigue', 'qos'],
  },
  sauts: {
    t: 'Sauts (steps removed)', cat: 'PTP',
    short: 'Le nombre d\'horloges frontières entre le grand maître et l\'appareil.',
    body: "Chaque horloge frontière ajoute un peu d'imprécision. Dans le car, un appareil est à 2 sauts du grand maître (spine puis leaf). Le BMCA utilise aussi ce nombre pour choisir le chemin le plus court vers un même maître.",
    see: ['bc', 'offset'],
  },
  announce: {
    t: 'Announce et timeout', cat: 'PTP',
    short: 'Les messages par lesquels un maître annonce sa qualité ; s\'ils cessent, on élit un autre maître.',
    body: "En ST 2059-2, un Announce part toutes les **250 ms**. Si un esclave n'en reçoit plus pendant **3** intervalles, soit 0,75 s, il considère que le maître est perdu et relance le BMCA. C'est ce qui permet au grand maître de secours de prendre le relais.",
    see: ['bmca', 'grand-maitre', 'st2059'], ref: 'SMPTE ST 2059-2',
  },
  holdover: {
    t: 'Maintien (holdover)', cat: 'PTP',
    short: 'Une horloge qui a perdu sa référence continue sur son propre oscillateur, de plus en plus imprécise.',
    body: "Un grand maître qui perd le GPS passe en maintien (classe 7). Grâce à un bon oscillateur (quartz thermostaté, rubidium), il reste précis plusieurs minutes, voire plusieurs heures. Puis il **dérive** et finit par se déclasser (classe 52 ou 187).",
    see: ['clockclass', 'derive', 'grand-maitre'],
  },
  derive: {
    t: 'Dérive', cat: 'PTP',
    short: 'L\'écart de temps qui s\'accumule quand une horloge n\'est plus corrigée.',
    body: "Un oscillateur n'est jamais parfaitement juste. Une erreur de fréquence de **1 ppm** (une partie par million) fait dériver l'heure de 1 µs par seconde, soit 3,6 ms par heure. C'est pourquoi un appareil non verrouillé finit par montrer des images décalées.",
    car: 'Mesures → Suivi PTP : courbe « dérive cumulée par rapport au GPS ».',
    see: ['holdover', 'offset'],
  },

  // ================= Mesures =================
  gigue: {
    t: 'Gigue', aka: 'jitter', cat: 'Mesures',
    short: 'La variation d\'un instant autour de sa valeur idéale : des paquets qui arrivent tantôt un peu trop tôt, tantôt un peu trop tard.',
    body: "Un flux idéal arrive avec un espacement parfaitement régulier. En réalité, les paquets attendent plus ou moins longtemps dans les **files d'attente** des commutateurs, selon la charge. Leur espacement varie : c'est la gigue.\n\nOn la mesure souvent par l'**écart-type de l'IAT** (le temps entre deux paquets successifs). Le récepteur l'absorbe grâce à son tampon, mais une gigue trop forte fait déborder ce tampon (VRX), et des paquets sont perdus.\n\nPour **PTP**, la gigue désigne la variation du délai des messages de synchro. Elle rend l'offset « bruité ». Le remède : PTP en file prioritaire (QoS) et des horloges frontières.\n\nCauses courantes :\n- liens chargés à plus de 80 % ;\n- rafales d'émetteurs larges ;\n- trop de commutateurs traversés.",
    car: 'Mesures → Analyseur de flux : ligne « Gigue (écart-type IAT) » et courbe. En PTP, l\'état « instable » ou « bruité ».',
    fig: 'jitter', see: ['iat', 'vrx', 'charge', 'qos', 'offset'], ref: 'SMPTE ST 2110-21 ; IEEE 1588',
  },
  iat: {
    t: 'IAT', aka: 'Inter-Arrival Time, temps entre arrivées', cat: 'Mesures',
    short: 'Le temps qui sépare l\'arrivée de deux paquets successifs d\'un même flux.',
    body: "En 1080p50, avec environ 4 paquets par ligne, un flux fait plus de 200 000 paquets par seconde : l'IAT idéal est de l'ordre de **4 à 5 µs**. La dispersion de l'IAT mesure la **gigue**.",
    fig: 'jitter', see: ['gigue', 'debit'],
  },
  debit: {
    t: 'Débit et paquets par seconde', cat: 'Mesures',
    short: 'Le volume de données d\'un flux par seconde, en-têtes compris, et le nombre de paquets correspondant.',
    body: "Le débit « couche IP » compte l'image et tous les en-têtes (IP, UDP, RTP, ST 2110-20). Ordres de grandeur :\n- **1080p50** : environ 2,2 Gb/s ;\n- **2160p50** : environ 8,6 Gb/s ;\n- un flux audio de 8 canaux : environ 10 Mb/s.\n\nUn débit plus faible que prévu signale des **pertes**. Un débit nul sur un réseau signale une jambe 2022-7 tombée.",
    see: ['st2110-20', 'charge', 'pertes'],
  },
  pertes: {
    t: 'Pertes de paquets', cat: 'Mesures',
    short: 'Les paquets qui n\'arrivent jamais : lien saturé, erreurs, mauvais réglage.',
    body: "En vidéo non compressée, chaque paquet perdu fait un morceau de ligne manquant à l'image. Avec ST 2022-7, une perte sur un seul réseau est **réparée** par l'autre. Seules comptent les pertes simultanées sur les deux réseaux (« perdus définitivement »).\n\nOn repère les pertes par les **trous dans les numéros de séquence RTP**.",
    car: 'Analyseur : « Paquets réparés par l\'autre réseau » et « Paquets perdus définitivement ».',
    see: ['st2022-7', 'rtp', 'charge'],
  },
  latence: {
    t: 'Latence réseau', cat: 'Mesures',
    short: 'Le temps de traversée du réseau, de l\'émetteur au récepteur.',
    body: "Dans un réseau local, elle est faible : quelques microsecondes par commutateur, plus le temps de propagation dans la fibre (environ 5 µs par kilomètre). Elle augmente quand les files d'attente se remplissent.\n\nCe qui compte en vidéo, c'est surtout qu'elle soit **stable** : ses variations, c'est la gigue.",
    see: ['gigue', 'ecart'],
  },
  ecart: {
    t: 'Écart rouge / bleu', aka: 'différentiel de chemin, skew', cat: 'Mesures',
    short: 'La différence de temps d\'arrivée d\'un même paquet par le réseau rouge et par le réseau bleu.',
    body: "Le récepteur ST 2022-7 doit **attendre la copie la plus en retard** avant de décider qu'un paquet est perdu. Son tampon doit donc être au moins aussi long que cet écart. La norme classe les récepteurs selon l'écart qu'ils tolèrent : on choisit la classe selon la distance et le trajet des deux chemins.\n\nDans un car, les deux réseaux sont identiques et voisins : l'écart se compte en microsecondes. Il devient important quand les deux chemins passent par des liaisons différentes, par exemple entre deux sites.",
    car: 'Analyseur : ligne « Écart rouge / bleu ».',
    see: ['st2022-7', 'latence'], ref: 'SMPTE ST 2022-7',
  },
  'rtp-offset': {
    t: 'Décalage RTP → arrivée', cat: 'Mesures',
    short: 'Le temps entre l\'horodatage RTP d\'un paquet (l\'heure PTP de son image) et son arrivée réelle.',
    body: "Il comprend le moment où l'émetteur commence à envoyer l'image (son décalage d'émission) et la traversée du réseau. Il doit être **stable**.\n\nS'il **dérive** régulièrement, l'émetteur n'est plus verrouillé en PTP : ses horodatages s'écartent de l'heure du réseau, et ses images finiront par ne plus être en phase avec les autres sources.",
    see: ['rtp', 'ptp', 'derive'], ref: 'SMPTE ST 2110-10, -21',
  },
  conformite: {
    t: 'Conformité ST 2110-21', cat: 'Mesures',
    short: 'Un flux est conforme si ses rafales restent sous CMAX et si le récepteur virtuel ne déborde pas (VRX ≤ VRX_FULL).',
    body: "Un flux non conforme peut fonctionner sur un réseau peu chargé, puis perdre des paquets le jour où le réseau se remplit. On vérifie donc la conformité à la mise en service, et à nouveau après chaque changement important.",
    see: ['cmax', 'vrx', 'st2110-21'],
  },

  // ================= NMOS =================
  nmos: {
    t: 'NMOS', aka: 'Networked Media Open Specifications (AMWA)', cat: 'NMOS',
    short: 'Les spécifications ouvertes qui permettent aux appareils de se déclarer et à un contrôleur de les connecter, quel que soit le constructeur.',
    body: "ST 2110 dit comment transporter les flux, mais pas comment les **trouver** ni les **connecter**. NMOS comble ce manque, avec des API web (HTTP, JSON) :\n- **IS-04** : découverte et enregistrement ;\n- **IS-05** : gestion des connexions ;\n- d'autres pour le routage des canaux audio, les événements et le tally, la sécurité…\n\nGrâce à NMOS, un contrôleur d'un constructeur pilote les appareils d'un autre.",
    car: 'Exploitation → NMOS : le registre, les nœuds enregistrés et les connexions.',
    fig: 'nmos', see: ['is-04', 'is-05', 'registre', 'controleur'], ref: 'AMWA IS-04, IS-05 (specs.amwa.tv)',
  },
  'is-04': {
    t: 'NMOS IS-04', aka: 'découverte et enregistrement', cat: 'NMOS',
    short: 'Chaque appareil se déclare dans un registre central, avec tout ce qu\'il sait émettre et recevoir.',
    body: "Au démarrage, l'appareil (le **nœud**) trouve le registre, par adresse configurée ou par DNS-SD. Il y déclare ses ressources :\n- le **nœud** et ses **devices** ;\n- les **sources** et les **flux** ;\n- les **émetteurs** (senders) et les **récepteurs** (receivers).\n\nIl envoie ensuite un **battement** (heartbeat) toutes les **5 s** par défaut. Sans battement pendant **12 s**, le registre l'efface avec toutes ses ressources. Le contrôleur interroge le registre (Query API) pour afficher ce qui existe.",
    car: 'Un appareil « non enregistré » n\'apparaît pas au contrôleur : on ne peut ni le connecter ni connecter ses sources.',
    fig: 'nmos', see: ['registre', 'heartbeat', 'dns-sd', 'is-05'], ref: 'AMWA IS-04',
  },
  'is-05': {
    t: 'NMOS IS-05', aka: 'gestion des connexions', cat: 'NMOS',
    short: 'L\'API par laquelle un contrôleur dit à un récepteur : « abonne-toi à tel émetteur ».',
    body: "Chaque émetteur et chaque récepteur a deux jeux de paramètres :\n- **staged** : les réglages préparés ;\n- **active** : ceux en service.\n\nLe contrôleur écrit les paramètres préparés (le SDP de l'émetteur, ou les paramètres de transport), puis demande l'**activation** :\n- **immédiate** ;\n- **programmée** à une heure précise (TAI), ou après un délai. C'est utile pour basculer plusieurs récepteurs exactement en même temps.\n\nLe récepteur fait alors ses abonnements IGMP.",
    car: 'Exploitation → Connexions → « NMOS (IS-05) » puis « Connecter ». La grille du car fait la même chose.',
    fig: 'nmos', see: ['transport-params', 'sdp', 'controleur'], ref: 'AMWA IS-05',
  },
  'transport-params': {
    t: 'Paramètres de transport', aka: 'transport_params (IS-05)', cat: 'NMOS',
    short: 'Ce qu\'il faut dire à un récepteur pour qu\'il reçoive un flux, sur chacun des deux réseaux.',
    body: "Pour un récepteur RTP multicast :\n- `source_ip` : l'adresse de l'émetteur (filtre de source SSM) ;\n- `multicast_ip` : le groupe ;\n- `destination_port` : le port UDP ;\n- `interface_ip` : la carte du récepteur à utiliser ;\n- `rtp_enabled` : jambe active ou non.\n\nIl y a **un jeu par jambe** (rouge et bleue) pour ST 2022-7. Avec NMOS, le contrôleur les remplit à partir du SDP de l'émetteur. En saisie manuelle, on les tape soi-même.",
    car: 'Exploitation → Connexions → « Saisie manuelle » : adresse source, groupe multicast et port UDP pour A et pour B.',
    see: ['is-05', 'ssm', 'udp', 'st2022-7'], ref: 'AMWA IS-05 (paramètres RTP)',
  },
  registre: {
    t: 'Registre NMOS', aka: 'registry', cat: 'NMOS',
    short: 'Le serveur qui tient la liste à jour de tous les appareils et de leurs flux.',
    body: "Il offre deux API :\n- **Registration**, pour les appareils qui s'enregistrent ;\n- **Query**, pour les contrôleurs qui consultent, avec un abonnement aux changements en temps réel.\n\nOn en installe souvent deux pour la redondance. S'il tombe, les flux déjà établis continuent, mais on ne peut plus rien connecter.",
    car: 'Registre en 10.20.0.10 sur le réseau de contrôle. Panne « registre NMOS injoignable ».',
    see: ['is-04', 'controleur', 'reseau-ctl'], ref: 'AMWA IS-04',
  },
  heartbeat: {
    t: 'Battement (heartbeat)', cat: 'NMOS',
    short: 'Le « je suis toujours là » qu\'un appareil envoie au registre toutes les 5 secondes.',
    body: "Valeurs par défaut d'IS-04 : un battement toutes les **5 s**, et effacement du registre après **12 s** sans battement, soit un peu plus de deux battements manqués. Un appareil débranché disparaît donc vite du contrôleur.",
    see: ['is-04', 'registre'], ref: 'AMWA IS-04',
  },
  'dns-sd': {
    t: 'DNS-SD et mDNS', cat: 'NMOS',
    short: 'La découverte automatique du registre sur le réseau, sans saisir son adresse.',
    body: "Le registre publie un service DNS (`_nmos-register._tcp`). Deux variantes :\n- **mDNS** : diffusion multicast sur le réseau local, sans serveur ;\n- **DNS-SD unicast** : par un serveur DNS, mieux adapté aux grandes installations.\n\nSans découverte, on saisit l'adresse du registre dans chaque appareil.",
    car: 'Dans le car, pas de découverte automatique : on saisit 10.20.0.10.',
    see: ['is-04', 'registre'], ref: 'RFC 6763 (DNS-SD), RFC 6762 (mDNS) ; AMWA IS-04',
  },
  controleur: {
    t: 'Contrôleur de diffusion', aka: 'broadcast controller', cat: 'NMOS',
    short: 'Le logiciel qui affiche émetteurs et récepteurs et les connecte : la « grille » d\'un car IP.',
    body: "Il lit le registre (IS-04) et pilote les connexions (IS-05). Il propose une interface façon grille de commutation : choisir une destination, une source, puis TAKE.\n\nSelon les produits, il gère aussi le réseau (SDN : réservation de bande passante), les noms des sources, le tally et les salves de commutations simultanées.",
    car: 'La grille du car et l\'onglet Exploitation jouent ce rôle.',
    fig: 'nmos', see: ['is-05', 'sdn', 'registre'],
  },
  'ressources-nmos': {
    t: 'Nœud, émetteur, récepteur', aka: 'node, sender, receiver', cat: 'NMOS',
    short: 'Le vocabulaire NMOS pour décrire un appareil et ses entrées et sorties réseau.',
    body: "- **Nœud** (node) : l'appareil vu par NMOS, avec son adresse et ses API ;\n- **Source** : l'origine d'un contenu (une caméra, une voie de console) ;\n- **Flux** (flow) : ce contenu dans un format donné ;\n- **Émetteur** (sender) : la sortie réseau qui envoie un flux, avec son SDP ;\n- **Récepteur** (receiver) : l'entrée réseau qui peut s'abonner à un émetteur.\n\nChaque ressource a un **identifiant unique** (UUID).",
    see: ['is-04', 'is-05'], ref: 'AMWA IS-04 (modèle de données)',
  },

  // ================= Exploitation =================
  'interface-media': {
    t: 'Interfaces média A et B', cat: 'Exploitation',
    short: 'Les deux cartes réseau d\'un appareil ST 2110, une sur chaque réseau.',
    body: "Chaque carte a sa propre adresse IP, son masque et sa passerelle, dans le sous-réseau de la leaf où elle est branchée : 10.1.x.y pour la carte rouge, 10.2.x.y pour la bleue. Une erreur sur une carte coupe seulement cette jambe : l'image tient grâce à l'autre réseau, mais la protection ST 2022-7 est perdue.\n\nLa carte A (rouge) est appelée **primaire**, la B (bleu) **secondaire**.",
    see: ['reseaux-ab', 'sous-reseau', 'passerelle'],
  },
  'passerelle-ip': {
    t: 'Passerelle IP ↔ SDI', aka: 'gateway, edge device', cat: 'Exploitation',
    short: 'Un appareil qui convertit des signaux SDI en flux ST 2110, ou l\'inverse.',
    body: "Indispensable pour les équipements encore en SDI : serveurs, écrans, liaisons. Côté SDI, elle **désembedde** l'audio et les données ; côté IP, elle émet ou reçoit les flux -20, -30 et -40, synchronisés par PTP. Elle se configure comme tout appareil ST 2110 : adresses, NMOS, PTP, abonnements.",
    car: 'La passerelle des écrans d\'angle reçoit un flux et le rend en SDI vers les écrans du stade. C\'est le parcours « Mettre en service une passerelle » du chef de car.',
    see: ['st2110', 'interface-media'],
  },
  'sortie-usine': {
    t: 'Sortie d\'usine', aka: 'configuration par défaut', cat: 'Exploitation',
    short: 'Un appareil neuf ou réinitialisé n\'a pas les réglages du car : il faut le mettre en service.',
    body: "Réglages de sortie d'usine typiques : adresses génériques (192.168.x.x), pas de registre NMOS, PTP dans le domaine par défaut d'IEEE 1588 (0). L'appareil est branché, mais il ne parle à personne.\n\nOrdre de mise en service :\n1. les adresses des cartes ;\n2. le contrôle et NMOS ;\n3. PTP ;\n4. les abonnements ;\n5. la vérification à l'image, sur les deux réseaux.",
    see: ['interface-media', 'is-04', 'domaine'],
  },
};

// ---------------- libellés de l'interface → fiche ----------------
// Testés dans l'ordre sur le texte court d'un intitulé (titre, en-tête, étiquette de champ).
/** @type {[RegExp, string][]} */
export const TERM_PATTERNS = [
  [/dscp|qualité de service|\bqos\b/i, 'qos'],
  [/^gigue/i, 'gigue'], [/\biat\b/i, 'iat'], [/^cinst|cmax/i, 'cmax'], [/^vrx/i, 'vrx'], [/^conformit/i, 'conformite'],
  [/^latence/i, 'latence'], [/écart rouge|^écart$/i, 'ecart'], [/rtp → arrivée|décalage rtp/i, 'rtp-offset'], [/^pertes?\b|perdus|réparés/i, 'pertes'],
  [/^débit|paquets ?\/ ?s/i, 'debit'], [/^st 2110-21/i, 'st2110-21'], [/^mac multicast|^mac de destination/i, 'mac-mcast'],
  [/^décalage.*délai|délai moyen/i, 'delai-moyen'], [/^offset|^décalage/i, 'offset'], [/dérive/i, 'derive'], [/^sauts?\b/i, 'sauts'],
  [/priority ?1|priority ?2/i, 'priority'], [/clockclass|^qualité$/i, 'clockclass'], [/^identité/i, 'clockidentity'],
  [/^grand[s]? maître|^élu$/i, 'grand-maitre'], [/gps verrouillé/i, 'clockclass'], [/slave only|esclave uniquement|esclave seulement/i, 'slave-only'],
  [/^rôle ptp|^port esclave|ptp interface/i, 'port-ptp'], [/horloges? frontière|synchronisés$/i, 'bc'], [/^domaine/i, 'domaine'], [/^profil|2059/i, 'st2059'],
  [/^announce/i, 'announce'], [/^ptp\b|^synchronisation ptp|^état ptp|^ptp de l|^sync$|^delay_req$/i, 'ptp'],
  [/^registre/i, 'registre'], [/is-05|^connexions?\b/i, 'is-05'], [/is-04|^enregistrement$|nœuds enregistrés/i, 'is-04'],
  [/^battement/i, 'heartbeat'], [/^api du nœud|^api$|^nœuds$|^sources \(émetteurs|^destinations \(récepteurs|^émetteurs?$|^récepteurs?$|^émetteurs · récepteurs$/i, 'ressources-nmos'],
  [/^nmos\b|^contrôleur$|^contrôle et nmos/i, 'nmos'],
  [/^adresse source|source_ip/i, 'transport-params'], [/^groupe|groupes multicast|plan multicast|^émetteurs \(dest/i, 'groupe'], [/^port udp|^udp$/i, 'udp'], [/^pt$/i, 'pt'],
  [/plage pim-ssm|^pim-ssm$/i, 'ssm'], [/^sdn$|mode de commutation/i, 'sdn'], [/^pim\b|pim sparse|multicast-routing|^chemin (rouge|bleu)/i, 'pim'],
  [/snooping/i, 'snooping'], [/querier/i, 'querier'], [/^igmp/i, 'igmp'], [/mroute/i, 'mroute'],
  [/^loopback0?$/i, 'loopback'], [/\bospf\b|router-id/i, 'ospf'], [/^routage|ip routing|ip route\b/i, 'routage'],
  [/^vlan|vlan d'accès/i, 'vlan'], [/^interfaces vlan|\bsvi\b/i, 'svi'], [/^sous-réseau|^masque|adresses \/31|\(\/31\)/i, 'sous-reseau'],
  [/\(ip · passerelle\)|^interfaces média|^carte de l/i, 'interface-media'],
  [/^passerelle$/i, 'passerelle'], [/^adresse ip$|^adresse$/i, 'sous-reseau'], [/^adresse de contrôle|^contrôle$|^gestion/i, 'reseau-ctl'],
  [/^mtu/i, 'mtu'], [/^fec/i, 'fec'], [/^vitesse|sfp28|qsfp28/i, 'vitesse'], [/^charge|liens les plus chargés/i, 'charge'], [/port à observer|port miroir/i, 'span'],
  [/^spines?$/i, 'spine'], [/^leaf$|^leaves$/i, 'leaf'], [/^uplinks?$/i, 'uplink'], [/^équipements \(adresses/i, 'interface-media'],
  [/^ethernet$|^ipv4$/i, 'packet-enc'], [/^rtp\b/i, 'rtp'], [/rfc 4175/i, 'st2110-20'],
  [/^shutdown|^administratif/i, 'shutdown'], [/running|startup/i, 'config'], [/lldp|^raccordé à$/i, 'lldp'],
  [/^rouge$|^bleu$|réseau rouge|réseau bleu|^réseau utilisé|^a · rouge|^b · bleu/i, 'reseaux-ab'], [/^réceptions?$/i, 'st2022-7'], [/2022-7/i, 'st2022-7'],
  [/^norme$/i, 'st2110'], [/^format$/i, 'st2110-20'], [/^sdp\b/i, 'sdp'], [/\bptp\b/i, 'ptp'],
];
export function termFor(text) {
  const s = String(text || '').trim();
  if (!s || s.length > 64) return null;
  for (const [re, id] of TERM_PATTERNS) if (re.test(s)) return id;
  return null;
}

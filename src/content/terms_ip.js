// @ts-check
// ----------------------------------------------------------------------------------
// Fiches « ? » des bases du réseau IP et du streaming (leçons « Le réseau » de la v19.17) : modèle en couches,
// LAN / MAN / WAN, Ethernet et modules SFP, adresse réseau et de diffusion, CIDR, types d'adresses, adresses
// privées, IPv6, DNS, NAT, ports, TCP, traceroute ; contribution, SRT, RIST, RTMP, HLS, NDI, ARQ. Même format
// que le lexique commun (content/netterms.js) ; les fiches déjà écrites sont reprises par leur identifiant
// (udp, rtp, qos, cos, dhcp, arp, ping, pare-feu, latence, gigue, pertes, debit, mtu, fec, vitesse…).
// Valeurs vérifiées : ISO/IEC 7498-1 (OSI), RFC 1122 ; IEEE 802.3 (trame : 46 à 1 500 octets de données, FCS 4,
// préambule 8, intervalle 12) ; RFC 950 et 4632 (masques, CIDR), 919 (diffusion), 1918, 3927, 6598, 5771 ;
// RFC 8200, 4291, 5952 (IPv6) ; RFC 1034, 1035, 6762, 6763 (DNS, mDNS, DNS-SD) ; RFC 3022 (NAT) ; RFC 6335
// (ports) ; RFC 9293 (TCP) ; débit de TCP avec pertes : Mathis et al. (1997) ; SRT : latence par défaut 120 ms,
// guide de déploiement de Haivision (3 à 4 × le RTT pour quelques % de pertes) ; RIST : VSF TR-06-1 et TR-06-2 ;
// RTMP : port 1935 ; HLS : RFC 8216 ; DASH : ISO/IEC 23009-1 ; épuisement des adresses IPv4 de l'IANA : 2011.
// ----------------------------------------------------------------------------------
import { TERMS, CATS } from './netterms.js';
import { CTRL_CAT } from './terms_ctrlnet.js';

export const STREAM_CAT = 'Streaming et contribution';
for (const c of [CTRL_CAT, STREAM_CAT]) if (!CATS.includes(c)) CATS.push(c);

/** @type {Record<string, import('./netterms.js').Term>} */
const ADD = {
  // ================= les couches, l'étendue, le câble =================
  'modele-osi': {
    t: 'Modèle OSI et modèle TCP/IP', aka: 'les couches d\'un réseau', cat: CTRL_CAT,
    short: 'Une façon de découper une communication en couches qui se rendent service : sept dans le modèle OSI, quatre dans le modèle TCP/IP d\'Internet.',
    body: "Le modèle **OSI** découpe une communication en sept couches :\n- **1 physique** : le signal sur le câble ou la fibre (des bits) ;\n- **2 liaison** : la trame entre deux voisins (Ethernet, adresses MAC, VLAN) ;\n- **3 réseau** : le paquet de bout en bout (IP, routage) ;\n- **4 transport** : le segment TCP ou le datagramme UDP, et les ports ;\n- **5 session**, **6 présentation**, **7 application** : le dialogue, le format et le chiffrement des données, l'application elle-même (HTTP, RTP, NMOS).\n\nLe modèle **TCP/IP** regroupe en quatre : accès réseau (1 et 2), Internet (3), transport (4), application (5 à 7). Le vocabulaire en reste : un commutateur « de niveau 2 », un routeur « de niveau 3 ».",
    car: 'Au poste Réseau IP, l\'analyseur déplie chaque paquet couche par couche : Ethernet II, IPv4, UDP, RTP.',
    see: ['encapsulation', 'commutateur', 'routage', 'tcp'], ref: 'ISO/IEC 7498-1 ; RFC 1122',
  },
  encapsulation: {
    t: 'Encapsulation', aka: 'en-têtes, poupées russes', cat: CTRL_CAT,
    short: 'Chaque couche ajoute son en-tête devant ce que lui donne la couche du dessus : l\'image dans RTP, dans UDP, dans IP, dans une trame Ethernet.',
    body: "À l'émission, chaque couche emballe ce qu'elle reçoit : RTP ajoute 12 octets (numéro, horodatage), UDP 8 (les ports), IP 20 (les adresses), Ethernet 18 (adresses MAC, type, contrôle FCS). À la réception, chaque couche lit son en-tête et le retire : c'est la **décapsulation**.\n\nLe nom change avec la couche : **trame** (niveau 2), **paquet** (niveau 3), **segment** TCP ou **datagramme** UDP (niveau 4). Les en-têtes coûtent du débit : 1 200 octets d'image partent dans une trame de 1 258 octets, 1 278 sur le fil avec le préambule et l'intervalle entre trames, soit 94 % d'utile.",
    car: 'Le paquet ST 2110 ouvert couche par couche : leçon « Un paquet ST 2110-20 » et sa vue 3D.',
    see: ['modele-osi', 'mtu', 'rtp', 'udp'], ref: 'RFC 1122 ; IEEE 802.3',
  },
  'lan-wan': {
    t: 'LAN, MAN, WAN', aka: 'réseau local, métropolitain, étendu', cat: CTRL_CAT,
    short: 'La taille d\'un réseau : un lieu (LAN), une ville (MAN), des villes ou des pays (WAN). Plus il est grand, plus la latence monte et moins on maîtrise le chemin.',
    body: "- **LAN** (Local Area Network) : un car, un studio, un bâtiment ; il appartient à celui qui l'exploite ; Ethernet et Wi-Fi, de 1 à 100 Gb/s, moins d'une milliseconde d'aller-retour.\n- **MAN** (Metropolitan Area Network) : les sites d'une ville reliés par une boucle de fibre, louée ou « noire » (nue, éclairée par ses propres équipements), sur quelques dizaines de kilomètres.\n- **WAN** (Wide Area Network) : des villes, des pays ; les liens sont ceux des opérateurs (réseau managé), d'Internet ou d'un satellite.\n\nOn y ajoute le **PAN** (personnel : Bluetooth) et le **WLAN** (LAN sans fil). La lumière parcourt environ 200 000 km/s dans la fibre, soit **5 µs par kilomètre** ; un bond par satellite géostationnaire (36 000 km de montée, autant de descente) ajoute environ **240 ms**.",
    car: 'Le car est un LAN ; la contribution vers la régie finale passe par un WAN : la fibre de l\'opérateur (TX1) ou le satellite (TX2), au poste Transmission.',
    see: ['latence', 'contribution', 'ethernet'], ref: 'IEEE 802 (LAN, MAN)',
  },
  ethernet: {
    t: 'Ethernet', aka: 'IEEE 802.3', cat: CTRL_CAT,
    short: 'Le réseau local de presque tout : une trame (adresses MAC, type, données, contrôle) qui circule sur cuivre ou sur fibre, de 1 à 400 Gb/s.',
    body: "La **trame** : préambule (8 octets), adresse MAC de destination (6), de source (6), étiquette VLAN éventuelle (4), type (2 : 0x0800 pour IPv4), données de **46 à 1 500 octets** (la MTU), contrôle **FCS** (4). Entre deux trames, un silence de 12 octets.\n\nLes débits vont par paliers : 1, 10, 25, 40, 50, 100, 400 Gb/s. Sur **cuivre** (paire torsadée, RJ45), 100 m au plus ; au-delà, de la **fibre**, avec des modules SFP. Les liens sont **full duplex** : chaque sens a son débit, sans collision. Les deux bouts **négocient** la vitesse : un câble abîmé peut faire tomber un port Gigabit à 100 Mb/s, sans autre symptôme qu'un débit trop faible.",
    car: 'SW-CŒUR : 24 ports RJ45 Gigabit et 4 SFP. Dans le car IP, chaque leaf a 48 ports SFP28 (25 ou 10 GbE) et des ports QSFP28 à 100 GbE vers les spines.',
    see: ['rj45', 'sfp', 'mtu', 'mac', 'vitesse'], ref: 'IEEE 802.3',
  },
  sfp: {
    t: 'Module SFP', aka: 'SFP, SFP+, SFP28, QSFP28 : émetteurs-récepteurs enfichables', cat: CTRL_CAT,
    short: 'Le petit module qu\'on glisse dans un port de commutateur pour choisir le support (fibre multimode, monomode, cuivre) : son type fixe le débit et la portée.',
    body: "Un port **SFP** n'a pas de connecteur à lui : on y glisse le module adapté au lien. **SFP** : 1 Gb/s ; **SFP+** : 10 Gb/s ; **SFP28** : 25 Gb/s ; **QSFP28** : 100 Gb/s (quatre voies de 25).\n\nLa référence dit la portée : **SR** (short range, fibre multimode, de 70 à 400 m selon le débit et la fibre), **LR** (long range, fibre monomode, 10 km), **ER** (40 km). Les deux bouts doivent avoir le même type et la même longueur d'onde. Pour quelques mètres dans une baie, un câble **DAC** (cuivre, modules soudés) coûte moins cher.\n\nLa plupart des modules donnent leur température et leur niveau optique reçu (DDM), comme la CCU pour la fibre de la caméra.",
    car: 'Les liens entre leaves et spines du car IP (QSFP28, 100 GbE) et les quatre ports SFP de SW-CŒUR.',
    see: ['ethernet', 'fibre-monomode', 'niveau-optique', 'vitesse'], ref: 'SFF-8431 (SFP+), SFF-8665 (QSFP28)',
  },
  // ================= les adresses =================
  'adresse-reseau': {
    t: 'Adresse réseau', aka: 'adresse du sous-réseau', cat: CTRL_CAT,
    short: 'La première adresse d\'un sous-réseau, tous les bits d\'appareil à 0 : elle nomme le réseau (10.1.20.0/24) et ne se donne à aucun appareil.',
    body: "On l'obtient par un **ET logique** entre l'adresse et le masque : chaque bit reste s'il est sous un 1 du masque, devient 0 sinon. 10.1.20.31 ET 255.255.255.0 = **10.1.20.0**.\n\nQuand le masque coupe un octet, on raisonne par **blocs** : un /26 (255.255.255.192) découpe le dernier octet en blocs de 256 − 192 = 64 adresses (0, 64, 128, 192). 10.1.20.130/26 est dans le bloc qui commence à 128 : réseau **10.1.20.128**, diffusion 10.1.20.191.\n\nC'est l'adresse réseau qu'on écrit dans les tables de routage et dans le plan d'adressage.",
    car: 'Plan du car SDI : un réseau 10.1.<VLAN>.0/24 par VLAN ; réseau de contrôle du car IP : 10.20.0.0/22.',
    see: ['broadcast-ip', 'sous-reseau', 'cidr', 'routage'], ref: 'RFC 950, RFC 4632',
  },
  'broadcast-ip': {
    t: 'Adresse de diffusion', aka: 'broadcast', cat: CTRL_CAT,
    short: 'La dernière adresse d\'un sous-réseau, tous les bits d\'appareil à 1 : un paquet qui lui est envoyé est reçu par toutes les machines du sous-réseau.',
    body: "10.1.20.255 pour 10.1.20.0/24 ; 10.20.3.255 pour 10.20.0.0/22. Le paquet part dans une trame Ethernet de diffusion (FF:FF:FF:FF:FF:FF) : tous les appareils du VLAN la reçoivent, seuls ceux du sous-réseau la gardent.\n\nUne diffusion **ne traverse pas** les routeurs : c'est ce qui borne le bavardage d'un réseau (ARP, DHCP, découverte d'appareils). 255.255.255.255 est la diffusion « limitée », celle d'une machine qui ne connaît pas encore son réseau (requête DHCP).\n\nL'adresse de diffusion ne se donne à aucun appareil : en /24, la plus haute adresse utilisable est .254. IPv6 n'a plus de diffusion : il passe par du multicast.",
    car: 'Les requêtes ARP et DHCP du car sont des diffusions, bornées par les VLAN.',
    see: ['adresse-reseau', 'arp', 'dhcp', 'vlan', 'types-adresses'], ref: 'RFC 919, RFC 922',
  },
  cidr: {
    t: 'Notation CIDR (/24)', aka: 'Classless Inter-Domain Routing, longueur de préfixe', cat: CTRL_CAT,
    short: 'Le « /24 » après une adresse : le nombre de bits de la partie réseau. /24 = 255.255.255.0. Il a remplacé en 1993 les classes A, B et C.',
    body: "Le masque s'écrit en décimal (255.255.252.0) ou en longueur de préfixe (/22) : c'est la même chose, 22 bits à 1 puis 10 à 0.\n\nAvant 1993, la taille d'un réseau dépendait du premier nombre : classe **A** (1 à 126, /8), **B** (128 à 191, /16), **C** (192 à 223, /24), **D** (224 à 239, multicast), **E** (au-delà, réservée). Le CIDR a supprimé ce lien : on coupe à n'importe quel bit, sans gaspiller les adresses.\n\nQuelques tailles (adresses, puis appareils) :\n- /30 : 4 et 2 ; /29 : 8 et 6 ; /28 : 16 et 14 ;\n- /26 : 64 et 62 ; /25 : 128 et 126 ; /24 : 256 et 254 ;\n- /22 : 1 024 et 1 022 ; /16 : 65 536 et 65 534.",
    car: 'Au poste Réseau, le masque se saisit indifféremment « /24 » ou « 255.255.255.0 ».',
    see: ['sous-reseau', 'adresse-reseau', 'broadcast-ip'], ref: 'RFC 4632',
  },
  'types-adresses': {
    t: 'Unicast, diffusion, multicast', aka: 'unicast, broadcast, multicast, anycast', cat: CTRL_CAT,
    short: 'Quatre façons d\'adresser un paquet : à une machine (unicast), à tout le réseau local (diffusion), aux abonnés d\'un groupe (multicast), au plus proche d\'un ensemble (anycast).',
    body: "- **Unicast** : une source, une destination ; presque tout le trafic (commande d'un RCP, page web, transfert de fichier).\n- **Diffusion** (broadcast) : une source, tout le réseau local ; pour trouver quelqu'un (ARP) ou un serveur (DHCP). Elle s'arrête aux routeurs.\n- **Multicast** : une source, les seuls abonnés d'un **groupe** (224.0.0.0 à 239.255.255.255) ; le réseau recopie le flux là où on l'a demandé (IGMP). C'est la distribution des flux d'un car IP.\n- **Anycast** : la même adresse portée par plusieurs serveurs ; le routage mène au plus proche (serveurs DNS, réseaux de diffusion de contenu).",
    car: 'Car IP : chaque caméra émet en multicast (239.x.x.x) ; NMOS et la commande des appareils restent en unicast.',
    see: ['broadcast-ip', 'groupe', 'igmp', 'adresses-privees'], ref: 'RFC 1112, RFC 4786 (anycast)',
  },
  'adresses-privees': {
    t: 'Adresses privées et publiques', aka: 'RFC 1918', cat: CTRL_CAT,
    short: '10.0.0.0/8, 172.16.0.0/12 et 192.168.0.0/16 sont privées : libres d\'usage dans un réseau interne, jamais routées sur Internet. Une adresse publique est unique au monde.',
    body: "Les adresses IPv4 (un peu plus de 4 milliards) sont épuisées : la réserve mondiale de l'IANA s'est vidée en 2011. Les réseaux internes utilisent donc des plages **privées**, que chacun réutilise : le car en 10.1.x.x, une box en 192.168.1.x. Pour sortir sur Internet, un routeur **traduit** l'adresse privée en son adresse publique (NAT).\n\nD'autres plages ont un sens particulier :\n- **127.0.0.0/8** : la machine elle-même (127.0.0.1, « localhost ») ;\n- **169.254.0.0/16** : l'adresse qu'une machine se donne seule quand le DHCP ne répond pas ;\n- **100.64.0.0/10** : adresses partagées d'un opérateur (CGNAT, fréquent en 4G) ;\n- **224.0.0.0/4** : multicast ; **0.0.0.0** : « pas encore d'adresse ».",
    car: 'Le car SDI est en 10.1.0.0/16 (un /24 par VLAN), le car IP en 10.1, 10.2 et 10.20 : tout est privé ; le routeur / pare-feu fait la traduction vers Internet.',
    see: ['nat', 'dhcp', 'types-adresses', 'ipv6'], ref: 'RFC 1918, RFC 3927, RFC 6598',
  },
  ipv6: {
    t: 'IPv6', aka: 'Internet Protocol version 6', cat: CTRL_CAT,
    short: 'La version suivante d\'IP : des adresses de 128 bits écrites en hexadécimal (2001:db8:12::1), assez pour ne plus jamais manquer, et plus de diffusion.',
    body: "Une adresse IPv6 s'écrit en huit groupes de quatre chiffres hexadécimaux séparés par « : ». On supprime les zéros en tête de groupe, et une seule suite de groupes nuls s'écrit « :: » : 2001:0db8:0000:0000:0000:0000:0000:0001 devient **2001:db8::1**.\n\nUn réseau local est presque toujours un **/64** : 64 bits de réseau, 64 pour l'appareil, qui peut se fabriquer seul son adresse (SLAAC). Chaque interface a aussi une adresse **lien local** en fe80::/10 ; ::1 est la boucle locale. Plus de diffusion : la découverte des voisins (NDP, à la place d'ARP) passe en multicast (ff02::1 : tous les nœuds du lien).\n\nLes normes ST 2110 permettent IPv6, mais les cars restent en IPv4 ; les box et les réseaux mobiles, eux, sont déjà en double pile.",
    car: 'Le simulateur reste en IPv4, comme les cars ; on croise IPv6 sur une box ou en 4G/5G, lors d\'une contribution par Internet.',
    see: ['adresses-privees', 'types-adresses', 'cidr'], ref: 'RFC 8200, RFC 4291, RFC 5952',
  },
  dns: {
    t: 'DNS', aka: 'Domain Name System', cat: CTRL_CAT,
    short: 'L\'annuaire qui traduit un nom (regie.exemple.fr, youtube.com) en adresse IP. Sans lui, il faut connaître les adresses.',
    body: "La machine demande à son **résolveur** (l'adresse DNS reçue par DHCP ou réglée à la main) : « quelle est l'adresse de youtube.com ? ». Le résolveur interroge si besoin les serveurs racine, ceux de .com, puis ceux du domaine, et garde la réponse en **cache** le temps de sa durée de vie (TTL). Questions et réponses passent en **UDP sur le port 53**.\n\nEnregistrements courants : **A** (nom → IPv4), **AAAA** (nom → IPv6), **PTR** (adresse → nom), **SRV** (où trouver un service).\n\nSur un réseau sans serveur, le **mDNS** (multicast 224.0.0.251, port 5353) répond aux noms en .local, et **DNS-SD** annonce les services : c'est ainsi que les appareils NMOS trouvent leur registre.\n\nSigne d'un DNS en panne : le ping vers une adresse marche, vers un nom non.",
    car: 'Car IP : les nœuds NMOS trouvent le registre par DNS-SD ; les appareils de production ont des adresses fixes, sans dépendre d\'un DNS.',
    see: ['dhcp', 'dns-sd', 'registre', 'port'], ref: 'RFC 1034, RFC 1035, RFC 6762, RFC 6763',
  },
  nat: {
    t: 'Traduction d\'adresses (NAT)', aka: 'NAT, NAPT, PAT', cat: CTRL_CAT,
    short: 'Le routeur remplace l\'adresse privée d\'une machine par son adresse publique, et change le port : tout un réseau sort sur Internet avec une seule adresse.',
    body: "Quand le PC 192.168.1.20 ouvre une page, la box réécrit le paquet : source **203.0.113.7:40000** au lieu de 192.168.1.20:51515, et note la correspondance dans sa **table de traduction**. La réponse, adressée à 203.0.113.7:40000, est remise au PC.\n\nConséquence : ce qui **sort** reçoit sa réponse, mais un paquet qui **arrive** sans avoir été demandé ne correspond à aucune ligne : il est jeté. Pour être joint de l'extérieur (un récepteur SRT en attente, un serveur), il faut une **redirection de port** : « tout ce qui arrive sur le port 9000 va à l'encodeur 192.168.1.50 ».\n\nEn 4G/5G, l'opérateur ajoute souvent sa propre traduction (**CGNAT**, adresses 100.64.0.0/10) : impossible d'ouvrir un port, il faut appeler depuis l'appareil (SRT en mode caller) ou passer par un relais.",
    car: 'Le routeur / pare-feu du car SDI (10.1.10.254) fait sortir le car sur Internet. Pour jouer à plusieurs par Internet, le simulateur ouvre la box par UPnP (une redirection automatique) ou passe par un tunnel.',
    see: ['adresses-privees', 'port', 'pare-feu', 'srt'], ref: 'RFC 3022, RFC 6598',
  },
  port: {
    t: 'Port TCP ou UDP', aka: 'numéro de port, socket', cat: CTRL_CAT,
    short: 'Le numéro (0 à 65 535) qui désigne le service dans une machine : l\'adresse IP mène à la machine, le port au logiciel. 443 pour le web chiffré, 53 pour le DNS.',
    body: "Une machine fait tourner plusieurs services : chaque segment TCP ou datagramme UDP porte un **port source** et un **port de destination**. Le couple adresse et port s'appelle une **socket** (10.1.20.11:80 : le serveur web de la CCU).\n\nLes ports **0 à 1023** sont réservés aux services connus ; le client prend un port libre élevé pour sa propre extrémité. Ports du métier :\n- 80 (HTTP), 443 (HTTPS), 22 (SSH), 53 (DNS), 67 et 68 (DHCP), 123 (NTP) ;\n- 319 et 320 (PTP, UDP) ; 1935 (RTMP, TCP) ; 554 (RTSP) ; 5004 (RTP, usage courant) ;\n- SRT n'a pas de port réservé : on le choisit (9000, 9998…).\n\nUn pare-feu filtre par port ; une traduction d'adresses (NAT) change le port source.",
    car: 'Au poste Réseau IP, chaque flux RTP a son port UDP de destination (5004), et PTP passe par les ports 319 et 320.',
    see: ['tcp', 'udp', 'nat', 'pare-feu'], ref: 'RFC 6335 (registre IANA des ports)',
  },
  tcp: {
    t: 'TCP', aka: 'Transmission Control Protocol', cat: CTRL_CAT,
    short: 'Le transport fiable : connexion en trois messages, octets numérotés, accusés de réception, retransmission de ce qui manque. Tout arrive, dans l\'ordre, parfois en retard.',
    body: "TCP ouvre une **connexion** : SYN, SYN-ACK, ACK (la poignée de main en trois temps). Chaque octet est numéroté ; le récepteur **accuse réception** ; ce qui n'est pas acquitté à temps est **réémis**. Une **fenêtre** limite ce qui peut voyager sans accusé, et le **contrôle de congestion** ralentit l'envoi dès qu'une perte est détectée.\n\nLe prix de la fiabilité : quand un segment se perd, tout ce qui suit attend sa retransmission, au moins un aller-retour de plus. Sur un long chemin qui perd, le débit s'effondre : à 100 ms d'aller-retour et 1 % de pertes, une connexion plafonne vers **1,4 Mb/s**, quel que soit le lien (formule de Mathis).\n\nTCP porte le web (HTTP), les transferts de fichiers, la commande des appareils, les API NMOS, RTMP. Le temps réel préfère UDP.",
    car: 'Les interfaces web des appareils et les API NMOS passent par TCP ; les flux médias et PTP, par UDP.',
    see: ['udp', 'port', 'debit', 'pertes'], ref: 'RFC 9293 ; Mathis et al., 1997',
  },
  traceroute: {
    t: 'traceroute', aka: 'tracert sous Windows', cat: CTRL_CAT,
    short: 'L\'outil qui liste les routeurs traversés jusqu\'à une destination, avec le temps de chacun : là où la liste s\'arrête, le chemin est coupé.',
    body: "traceroute envoie des paquets dont le **TTL** vaut 1, puis 2, puis 3… Chaque routeur décrémente le TTL ; celui qui le voit tomber à 0 jette le paquet et renvoie un message ICMP « délai dépassé » : il se signale, avec son adresse et le temps de l'aller-retour.\n\nOn lit :\n- la liste des sauts, et où elle s'arrête ;\n- le temps à chaque saut : un bond brutal (50 ms de plus) trahit un long lien, un satellite ou une file encombrée ;\n- des « * * * » : un routeur qui ne répond pas à ce type de message (fréquent, pas forcément une panne).\n\nAvec ping (l'aller-retour vers une machine) et un test de débit (iperf), c'est l'outillage de base pour mesurer un chemin avant une contribution.",
    car: 'Au poste Réseau, le ping et ses étapes ; la vue 3D « La passerelle » montre traceroute.',
    see: ['ping', 'routage', 'latence', 'pertes'], ref: 'RFC 792 (ICMP), RFC 1393',
  },
  // ================= streaming et contribution =================
  contribution: {
    t: 'Contribution et distribution', aka: 'du lieu à la chaîne, de la chaîne au public', cat: STREAM_CAT,
    short: 'La contribution amène le signal du lieu à la chaîne (haut débit, peu de retard, très fiable) ; la distribution l\'emmène au public (des millions de récepteurs, quelques secondes admises).',
    body: "**Contribution** : du car à la régie finale, d'un studio à un autre. Peu de destinataires, une qualité proche de l'original (compression légère : JPEG XS, HEVC à haut débit, voire non compressé), une latence faible, deux chemins indépendants. Supports : fibre d'opérateur, réseau IP managé, satellite, Internet avec SRT ou RIST.\n\n**Distribution** : de la chaîne vers le public, par la TNT, le satellite, le câble ou Internet (HLS, DASH, par un réseau de diffusion de contenu, CDN). Des millions de récepteurs, une compression forte, et plusieurs secondes de retard acceptées.\n\nLes protocoles se choisissent selon ce rôle : SRT, RIST ou RTP pour contribuer, RTMP pour livrer une plateforme, HLS ou DASH pour distribuer.",
    car: 'Au poste Transmission : TX1 par la fibre de l\'opérateur (JPEG XS), TX2 par satellite (HEVC), et le retour antenne qui revient avec plusieurs secondes de retard.',
    see: ['srt', 'rist', 'hls', 'rtmp', 'lan-wan'],
  },
  srt: {
    t: 'SRT', aka: 'Secure Reliable Transport', cat: STREAM_CAT,
    short: 'Un protocole de contribution par Internet : de l\'UDP qui redemande les paquets perdus (ARQ) tant qu\'un tampon de latence le permet, et qui chiffre le flux.',
    body: "Ouvert en logiciel libre par Haivision en 2017, SRT transporte un flux (en général du MPEG-TS) en **UDP**. Le récepteur repère les paquets manquants grâce à leur numéro et les **redemande** (accusé négatif, NAK) ; l'émetteur les renvoie tant que le **tampon de latence** n'est pas écoulé. 120 ms par défaut ; on règle de l'ordre de **3 à 4 fois l'aller-retour** pour quelques % de pertes, davantage si le chemin perd beaucoup (guide de déploiement de Haivision), et on réserve du débit pour les retransmissions.\n\nSRT chiffre en **AES** (128 ou 256 bits) avec une phrase de passe. Trois modes : **caller** (appelle), **listener** (attend sur un port ouvert), **rendezvous** (les deux appellent en même temps, pour traverser deux NAT). Règle pratique : le côté derrière une box ou en 4G appelle ; le côté qui a une adresse publique et un port redirigé écoute.",
    car: 'La contribution du car du simulateur passe par la fibre de l\'opérateur et le satellite ; la vue 3D « Du car à la régie finale » montre SRT sur Internet.',
    see: ['arq', 'rist', 'nat', 'contribution', 'latence'], ref: 'Haivision, SRT Protocol Technical Overview ; projet de RFC « The SRT Protocol »',
  },
  rist: {
    t: 'RIST', aka: 'Reliable Internet Stream Transport', cat: STREAM_CAT,
    short: 'Le cousin normalisé de SRT : du RTP sur UDP avec retransmission des paquets perdus, défini par la Video Services Forum pour que les appareils de marques différentes s\'entendent.',
    body: "RIST est spécifié par la **VSF** : profil simple (TR-06-1, 2018), profil principal (TR-06-2 : chiffrement, multiplexage, tunnel). Il reprend RTP, déjà employé sur les réseaux managés, et y ajoute la demande de retransmission (RTCP NACK), un tampon de latence et l'agrégation de plusieurs chemins (deux accès Internet, plusieurs modems 4G).\n\nSRT et RIST font le même travail ; le choix tient souvent au parc d'encodeurs et de décodeurs déjà en place.",
    car: 'Même place que SRT dans une chaîne de contribution par Internet.',
    see: ['srt', 'arq', 'rtp', 'contribution'], ref: 'VSF TR-06-1, TR-06-2',
  },
  rtmp: {
    t: 'RTMP', aka: 'Real-Time Messaging Protocol', cat: STREAM_CAT,
    short: 'Le protocole pour envoyer un direct vers une plateforme (YouTube, Twitch, Facebook) : sur TCP, port 1935, avec une clé de diffusion. Quelques secondes de retard.',
    body: "Né avec Flash, RTMP a survécu comme **protocole d'envoi** (ingest) : l'encodeur se connecte au serveur de la plateforme en **TCP sur le port 1935** (RTMPS, chiffré, en général sur le 443) et s'identifie par une **clé de diffusion**. La plateforme réencode et redistribue en HLS ou DASH.\n\nParce qu'il passe par TCP, une perte provoque une retransmission et un ralentissement : sur une connexion 4G chargée, le flux prend du retard ou se coupe. On garde de la marge : un débit d'envoi nettement sous le débit montant mesuré.",
    car: 'À l\'entrepôt, vMix ou une caméra diffusent en RTMP vers une plateforme : il faut que le routeur donne accès à Internet et que la clé de diffusion soit saisie.',
    see: ['tcp', 'hls', 'contribution', 'port'], ref: 'Adobe, RTMP Specification 1.0 (2012)',
  },
  hls: {
    t: 'HLS et DASH', aka: 'HTTP Live Streaming (Apple), MPEG-DASH', cat: STREAM_CAT,
    short: 'La distribution au public par Internet : la vidéo coupée en segments de quelques secondes, servis comme des fichiers web par un CDN. Robuste, mais 10 à 30 s de retard.',
    body: "Le serveur découpe le direct en **segments** (2 à 6 s), dans plusieurs qualités, et publie une **liste de lecture** (.m3u8 pour HLS, .mpd pour DASH). Le lecteur télécharge les segments par HTTP, comme des fichiers, et choisit la qualité selon son débit (**débit adaptatif**). Un **CDN** (réseau de diffusion de contenu) garde les segments en cache près des spectateurs : un million de lecteurs ne chargent pas un seul serveur.\n\nLe retard vient des segments : le lecteur en attend plusieurs avant de commencer, d'où **10 à 30 s** de retard sur le direct. Les variantes à basse latence (LL-HLS, DASH bas retard) descendent vers 2 à 5 s.",
    car: 'Un retour regardé sur une plateforme arrive avec ce retard : on ne réalise jamais en le regardant.',
    see: ['rtmp', 'contribution', 'tcp', 'latence'], ref: 'RFC 8216 (HLS), ISO/IEC 23009-1 (DASH)',
  },
  ndi: {
    t: 'NDI', aka: 'Network Device Interface', cat: STREAM_CAT,
    short: 'Un format de production vidéo sur réseau local (vMix, caméras PTZ, logiciels) : peu compressé, trouvé seul sur le réseau, de l\'ordre de 100 à 150 Mb/s en 1080p.',
    body: "Créé par NewTek (aujourd'hui chez Vizrt), NDI transporte image, son, tally et commandes sur un réseau Ethernet ordinaire. Les sources s'annoncent par **mDNS** : il suffit d'être sur le même réseau pour les voir.\n\n**NDI** (plein débit) compresse peu : de l'ordre de 100 à 150 Mb/s en 1080p, environ une image de retard ; **NDI|HX** compresse en H.264 ou HEVC, autour de 10 à 20 Mb/s, avec plus de retard. Quelques sources NDI plein débit remplissent un lien Gigabit.\n\nC'est le monde de la production légère ; le car de production, lui, est en SDI ou en ST 2110.",
    car: 'À l\'entrepôt, des caméras PTZ en NDI|HX et vMix sur le réseau du plateau.',
    see: ['types-adresses', 'dns', 'debit'], ref: 'Vizrt, NDI SDK (ordres de grandeur)',
  },
  arq: {
    t: 'ARQ et FEC', aka: 'retransmission sur demande, correction en avance', cat: STREAM_CAT,
    short: 'Deux façons de réparer les pertes sans TCP : redemander le paquet manquant (ARQ, au prix d\'un aller-retour) ou envoyer d\'avance de la redondance (FEC, au prix du débit).',
    body: "**ARQ** : le récepteur voit un trou dans les numéros de séquence et le signale ; l'émetteur renvoie le paquet. Efficace, mais chaque réparation coûte au moins un aller-retour : le tampon de latence doit en contenir plusieurs (SRT, RIST).\n\n**FEC** : l'émetteur ajoute des paquets de parité (par exemple sur les lignes et les colonnes d'une matrice de paquets, ST 2022-1) ; le récepteur reconstruit un paquet perdu sans rien demander. Pas d'aller-retour, mais un surdébit permanent, et une limite : au-delà de quelques pertes groupées, plus rien ne se répare.\n\nDans un car ST 2110, ni l'un ni l'autre : deux réseaux complets (ST 2022-7).",
    car: 'Le car IP répare par ses deux réseaux, rouge et bleu (ST 2022-7).',
    see: ['srt', 'rist', 'fec', 'st2022-7'], ref: 'SMPTE ST 2022-1 (FEC) ; RFC 4585 (NACK)',
  },
};
Object.assign(TERMS, ADD);

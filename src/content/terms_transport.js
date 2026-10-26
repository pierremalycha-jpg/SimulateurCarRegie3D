// @ts-check
// ----------------------------------------------------------------------------------
// Fiches « ? » des leçons « bases du réseau » du Cours (cours/reseau_bases.js, reseau_adresses.js,
// reseau_transport.js) : couches, échelles, supports, adressage, services, transport, streaming,
// QoS. Elles s'ajoutent au lexique commun (content/netterms.js), dans la famille « Bases du réseau »
// du réseau de contrôle (content/terms_ctrlnet.js) et une famille « Internet et streaming ».
// Valeurs vérifiées : voir l'en-tête de cours/reseau_calc.js (RFC 791, 768, 9293, 3550, 1918, 6598,
// 3927, 2474, 3246, 2597 ; IEEE 802.3 ; guide de déploiement SRT).
// ----------------------------------------------------------------------------------
import { TERMS, CATS } from './netterms.js';
import { CTRL_CAT } from './terms_ctrlnet.js';

export const NET_CAT = 'Internet et streaming';
if (!CATS.includes(NET_CAT)) CATS.push(NET_CAT);

/** @type {Record<string, import('./netterms.js').Term>} */
const ADD = {
  osi: {
    t: 'Modèle OSI, modèle TCP/IP', aka: 'les couches du réseau', cat: CTRL_CAT,
    short: 'Une façon de découper le réseau en couches qui ont chacune leur rôle : 7 dans le modèle OSI, 4 dans le modèle TCP/IP qu\'utilisent Internet et le car.',
    body: "Les couches, de bas en haut :\n- **1 Physique** : les bits sur le câble, la fibre ou la radio ;\n- **2 Liaison** : la trame d'une machine à sa voisine (Ethernet, adresses MAC, VLAN) ;\n- **3 Réseau** : le paquet de machine à machine à travers les routeurs (IP) ;\n- **4 Transport** : du programme au programme (TCP, UDP, ports) ;\n- **5 à 7** : session, présentation, application (HTTP, DNS, RTP, NMOS…).\n\nLe modèle TCP/IP regroupe 1 et 2 (accès réseau) et 5 à 7 (application). On dit « un switch de niveau 2 », « un problème de couche 1 » : on dépanne de bas en haut.",
    see: ['encapsulation', 'mac', 'tcp', 'udp'], ref: 'ISO/IEC 7498-1 ; RFC 1122',
  },
  encapsulation: {
    t: 'Encapsulation', aka: 'en-têtes, trame, paquet, segment', cat: CTRL_CAT,
    short: 'À l\'envoi, chaque couche ajoute son en-tête devant les données qu\'elle reçoit ; à l\'arrivée, chacune retire le sien.',
    body: "Un flux ST 2110 : les données reçoivent un en-tête **RTP** (12 octets), puis **UDP** (8), puis **IPv4** (20), puis **Ethernet** (14, plus 4 de contrôle d'erreur à la fin, et 4 pour une étiquette VLAN). Sur le câble s'ajoutent un préambule (8 octets) et un silence entre trames (12).\n\nLe nom change selon la couche : **trame** (liaison), **paquet** (réseau), **segment** TCP ou **datagramme** UDP (transport). Le paquet IP ne dépasse pas la **MTU** (1 500 octets sur Ethernet).",
    see: ['osi', 'mtu', 'rtp', 'udp'], ref: 'RFC 791, 768, 3550 ; IEEE 802.3',
  },
  'lan-wan': {
    t: 'LAN, MAN, WAN', aka: 'réseau local, métropolitain, étendu', cat: CTRL_CAT,
    short: 'Les réseaux classés par étendue : le LAN (un car, un bâtiment), le MAN (une agglomération), le WAN (un pays et au-delà, loué à des opérateurs).',
    body: "- **LAN** : à soi, très rapide (10 à 100 Gb/s par lien), délai de quelques microsecondes. Le **WLAN** est un LAN sans fil (Wi-Fi).\n- **MAN** : jusqu'à quelques dizaines de km, souvent la fibre d'un opérateur jusqu'à son **nodal**.\n- **WAN** : un pays, un continent ; capacité louée (fibre, réseau privé de l'opérateur, Internet, satellite, 4G/5G).\n\nLe délai grandit avec la distance : environ 5 µs par km de fibre, au moins 239 ms par satellite géostationnaire.",
    see: ['latence', 'debit', 'srt'],
  },
  sfp: {
    t: 'Module SFP', aka: 'SFP, SFP+, SFP28, QSFP28', cat: CTRL_CAT,
    short: 'Le petit module qu\'on glisse dans le port d\'un switch pour le relier à une fibre (ou à un câble) : il fixe le débit, la longueur d\'onde et la portée.',
    body: "- **SFP** : 1 Gb/s ; **SFP+** : 10 Gb/s ; **SFP28** : 25 Gb/s ; **QSFP28** : 100 Gb/s (quatre voies).\n- **SR** : fibre multimode, 850 nm, quelques centaines de mètres (10 Gb/s sur 300 m d'OM3).\n- **LR** : fibre monomode, 1 310 nm, 10 km ; **ER** : 40 km.\n\nLes deux bouts d'un lien doivent avoir le même type de module, sur le bon type de fibre. Entre deux appareils d'une baie, un câble **DAC** (cuivre serti sur deux modules) remplace deux modules et une fibre.",
    see: ['fibre-monomode', 'niveau-optique', 'vitesse', 'rj45'], ref: 'IEEE 802.3 (10GBASE-SR/LR/ER, 25GBASE-SR/LR, 100GBASE-SR4/LR4)',
  },
  cidr: {
    t: 'Préfixe (CIDR) et découpage', aka: '/24, /26, VLSM', cat: CTRL_CAT,
    short: 'L\'écriture « /26 » donne le nombre de bits de réseau ; découper un réseau, c\'est emprunter des bits à la partie machine pour faire des sous-réseaux.',
    body: "- /24 = masque 255.255.255.0 : 256 adresses, 254 machines ; /26 = 255.255.255.192 : 64 adresses, 62 machines ; /30 : 4 adresses, 2 machines.\n- Adresse du réseau : bits machine à 0 ; adresse de diffusion : bits machine à 1. Aucune des deux ne se donne à un appareil.\n- Découper un /24 en 4 : 2 bits empruntés, quatre /26. On découpe par puissances de 2.\n- **VLSM** : chaque besoin reçoit le plus petit sous-réseau qui le loge.\n\nLes classes A, B, C d'avant 1993 ne servent plus : le préfixe est toujours donné avec l'adresse.",
    see: ['sous-reseau', 'diffusion', 'adresses-privees'], ref: 'RFC 4632 (CIDR)',
  },
  'adresses-privees': {
    t: 'Adresses privées et publiques', aka: 'RFC 1918, CGNAT, 169.254', cat: CTRL_CAT,
    short: 'Les adresses privées (10/8, 172.16/12, 192.168/16) servent dans les réseaux locaux et ne circulent pas sur Internet ; les publiques y sont uniques.',
    body: "- **Privées** (RFC 1918) : 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16. Le car utilise 10.x.x.x.\n- **Partagées** par l'opérateur (CGNAT, RFC 6598) : 100.64.0.0/10. La box n'est pas joignable directement depuis Internet.\n- **Lien local** (RFC 3927) : 169.254.0.0/16, prise par une machine qui n'a pas reçu de réponse DHCP.\n- **Boucle locale** : 127.0.0.1, la machine elle-même.\n- **Multicast** : 224.0.0.0 à 239.255.255.255.\n\nPour sortir sur Internet, les adresses privées passent par le **NAT**.",
    see: ['nat', 'sous-reseau', 'dhcp'], ref: 'RFC 1918, 6598, 3927',
  },
  diffusion: {
    t: 'Diffusion (broadcast)', aka: 'adresse de diffusion, domaine de diffusion', cat: CTRL_CAT,
    short: 'Un paquet envoyé à l\'adresse de diffusion (bits machine à 1, MAC FF:FF:FF:FF:FF:FF) est reçu par toutes les machines du réseau ; le routeur l\'arrête.',
    body: "La diffusion sert à **chercher** quelqu'un : ARP (« qui a cette adresse ? »), DHCP (« un serveur peut-il me donner une adresse ? »).\n\nElle reste dans son **domaine de diffusion**, le VLAN : le routeur ne la fait pas suivre. Une boucle de câblage peut provoquer une **tempête de diffusion** qui sature le VLAN.\n\nPour un flux vu par plusieurs récepteurs, on n'utilise jamais la diffusion mais le **multicast**.",
    see: ['arp', 'dhcp', 'vlan', 'groupe'],
  },
  dns: {
    t: 'DNS', aka: 'Domain Name System', cat: CTRL_CAT,
    short: 'Le service qui traduit un nom (serveur.chaine.fr) en adresse IP. Sans lui, rien ne marche par son nom, même si le ping vers une adresse passe.',
    body: "La machine interroge son **serveur DNS** (donné par le DHCP ou réglé à la main), en UDP sur le port 53, et garde la réponse un moment.\n\nPanne typique : le ping vers 203.0.113.10 répond, mais « serveur.chaine.fr » est introuvable : le DNS est faux ou injoignable.\n\nEn car IP, NMOS trouve son registre par **DNS-SD** (le service est annoncé dans le DNS, ou en multicast par mDNS).",
    see: ['dhcp', 'dns-sd', 'port'], ref: 'RFC 1034, 1035',
  },
  nat: {
    t: 'NAT, redirection de port', aka: 'traduction d\'adresses, UPnP', cat: CTRL_CAT,
    short: 'La box fait sortir toutes les machines privées sous son adresse publique et note chaque connexion ; rien n\'entre sans y avoir été invité, sauf par une redirection de port.',
    body: "À la sortie, la box remplace l'adresse et le port source par son adresse publique et un port libre, et note la correspondance. La réponse revient sur ce port : elle la rend à la bonne machine.\n\nPour accueillir une connexion venue d'Internet (héberger une partie, recevoir un flux SRT en écoute), il faut une **redirection de port**, réglée à la main ou demandée par la machine (**UPnP**). Si l'opérateur partage l'adresse (CGNAT), aucune redirection ne marche : on passe par un **tunnel** ouvert depuis l'intérieur.",
    see: ['adresses-privees', 'pare-feu', 'port'], ref: 'RFC 3022',
  },
  port: {
    t: 'Port (TCP, UDP)', aka: 'numéro de port', cat: CTRL_CAT,
    short: 'Le numéro (0 à 65 535) qui désigne le programme destinataire sur une machine : 443 pour le web sécurisé, 53 pour le DNS, 319 et 320 pour PTP.',
    body: "L'adresse IP désigne la machine, le port le programme. Ports connus : HTTP 80, HTTPS 443, SSH 22, DNS 53, DHCP 67 et 68, NTP 123, SNMP 161, PTP 319 et 320, RTMP 1935. Le client prend un port libre au hasard.\n\nUn pare-feu filtre souvent par port ; une redirection de port fait entrer un port de la box vers une machine du réseau local.",
    see: ['tcp', 'udp', 'nat'], ref: 'IANA, registre des ports',
  },
  tcp: {
    t: 'TCP', aka: 'Transmission Control Protocol', cat: CTRL_CAT,
    short: 'Le transport fiable : connexion, numérotation, accusés de réception, renvoi de ce qui se perd. Tout arrive, dans l\'ordre, mais en retard après une perte.',
    body: "- **Connexion** en trois temps (SYN, SYN-ACK, ACK) avant toute donnée.\n- Chaque octet est numéroté et **accusé** ; ce qui ne l'est pas est **renvoyé**.\n- **Contrôle de congestion** : TCP ralentit à chaque perte. Sur une longue distance avec des pertes, son débit s'effondre (1 % de pertes à 50 ms d'aller-retour : environ 3 Mb/s).\n\nPour les fichiers, le web, les commandes (NMOS, contrôle des appareils). Pas pour la vidéo en direct sur un réseau qui perd des paquets : on prend UDP (avec SRT pour réparer).",
    see: ['udp', 'port', 'srt'], ref: 'RFC 9293',
  },
  dscp: {
    t: 'DSCP', aka: 'Differentiated Services Code Point', cat: CTRL_CAT,
    short: 'Les 6 bits de l\'en-tête IP qui disent la classe d\'un paquet : EF (46) pour PTP, AF41 (34) pour l\'audio et la vidéo, 0 pour le trafic ordinaire.',
    body: "Valeurs normalisées : **EF** = 46 (faible délai), **AFxy** = 8x + 2y (AF41 = 34), **CSx** = 8x (CS2 = 16), **BE** = 0.\n\nChaque commutateur lit le DSCP et range le paquet dans la file d'attente de sa classe : la classe EF est servie en priorité stricte. AES67 et ST 2110 recommandent PTP en EF et les médias en AF41.\n\nAu niveau 2, la priorité **CoS** de l'étiquette VLAN joue le même rôle sur 3 bits.",
    see: ['qos', 'cos', 'ptp'], ref: 'RFC 2474, 3246, 2597 ; AES67',
  },
  srt: {
    t: 'SRT', aka: 'Secure Reliable Transport', cat: NET_CAT,
    short: 'Un protocole de contribution sur UDP : il redemande et renvoie les paquets perdus dans un délai de latence réglé, et chiffre le flux. Pour envoyer un direct par Internet.',
    body: "Le récepteur signale les paquets manquants, l'émetteur les renvoie, tant que le délai de **latence** réglé le permet. On règle ce délai d'après l'aller-retour mesuré et le taux de pertes : environ 3 allers-retours jusqu'à 1 % de pertes, 4 jusqu'à 3 %, davantage au-delà (repères du guide de déploiement SRT ; jamais moins de 120 ms).\n\nModes : **appelant** (caller), **en écoute** (listener, qui doit être joignable : redirection de port) et rendez-vous. Chiffrement AES.\n\nSRT remplace peu à peu RTMP pour envoyer un flux vers une régie ou une plateforme.",
    see: ['udp', 'rtp', 'rtmp', 'latence'], ref: 'Protocole ouvert SRT (SRT Alliance), guide de déploiement Haivision',
  },
  rtmp: {
    t: 'RTMP', aka: 'Real-Time Messaging Protocol', cat: NET_CAT,
    short: 'Le protocole historique pour pousser un flux de l\'encodeur vers une plateforme de diffusion (port 1935, sur TCP). Simple, mais il décroche sur une liaison qui perd des paquets.',
    body: "L'encodeur ouvre une connexion TCP vers le serveur de la plateforme et y envoie le flux compressé (H.264 et AAC le plus souvent). Sur TCP, chaque perte fait ralentir la connexion : sur une liaison longue ou chargée, le flux prend du retard puis décroche.\n\nLa plateforme repackage ensuite le flux en HLS ou DASH pour les spectateurs.",
    see: ['tcp', 'srt', 'hls'],
  },
  hls: {
    t: 'HLS, DASH', aka: 'streaming adaptatif par HTTP', cat: NET_CAT,
    short: 'La vidéo est découpée en segments de quelques secondes, en plusieurs qualités, servis en HTTP par un CDN : des millions de lecteurs, mais 10 à 30 s de retard (2 à 5 s en faible latence).',
    body: "- Une **liste de lecture** (manifeste) décrit les segments et les qualités disponibles.\n- Le lecteur télécharge les segments comme des fichiers (HTTP, donc TCP), auprès d'un **CDN** proche, et change de qualité selon son débit (**débit adaptatif**).\n- Il garde en général **trois segments** d'avance : avec des segments de 6 s, plus de 20 s de retard.\n- **LL-HLS** et DASH à faible latence découpent en morceaux d'environ une seconde.",
    see: ['rtmp', 'srt', 'latence'], ref: 'RFC 8216 (HLS) ; ISO/IEC 23009-1 (MPEG-DASH)',
  },
};
Object.assign(TERMS, ADD);

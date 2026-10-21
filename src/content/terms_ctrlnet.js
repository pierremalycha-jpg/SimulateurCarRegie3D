// @ts-check
// ----------------------------------------------------------------------------------
// Fiches « ? » pour le réseau de contrôle du car SDI (IP, masque, passerelle, VLAN, QoS…). Elles s'ajoutent au lexique commun
// (content/netterms.js) : même format, mêmes boutons « ? » (ui/term.js), même lexique.
// Niveau « bases » : ce qui manquait au lexique du car IP. Les fiches déjà écrites sont reprises
// par leur identifiant : vlan, svi, sous-reseau (adresse IP et masque), passerelle, conflit-ip,
// routage, qos (DSCP), charge, vitesse, shutdown, udp.
// Valeurs vérifiées : 1000BASE-T sur 4 paires, 100 m par lien (IEEE 802.3ab) ; PoE 802.3af 15,4 W
// par port côté switch (12,95 W disponibles à l'appareil), 802.3at 30 W ; étiquette 802.1Q de
// 4 octets (VLAN 1 à 4094 sur 12 bits, priorité sur 3 bits) ; classes DiffServ de la RFC 4594 (EF 46,
// CS4 32, CS2 16, CS1 8) ; ARP (RFC 826) ; DHCP (RFC 2131), adresses 169.254.0.0/16 (RFC 3927) ;
// adresses privées (RFC 1918) ; TSL UMD v5.0 sur UDP.
// ----------------------------------------------------------------------------------
import { TERMS, CATS, TERM_PATTERNS } from './netterms.js';

export const CTRL_CAT = 'Bases du réseau';
if (!CATS.includes(CTRL_CAT)) CATS.push(CTRL_CAT);

/** @type {Record<string, import('./netterms.js').Term>} */
const ADD = {
  'ctrl-sdi': {
    t: 'Réseau de contrôle du car SDI', cat: CTRL_CAT,
    short: 'Même quand les images passent en SDI, tout ce qui se pilote (caméras, mélangeur, grille, ralentis, intercom) passe par un réseau Ethernet Gigabit.',
    body: "Dans un car SDI, chaque image voyage sur son câble coaxial, à travers la grille. Mais les appareils se **commandent** par Ethernet :\n- le **RCP** règle sa caméra à travers la **CCU** ;\n- le **pupitre du mélangeur** envoie chaque touche à son **processeur** ;\n- le logiciel de la **grille** envoie les prises (TAKE) ;\n- **IPDirector** dialogue avec les serveurs **EVS** ;\n- le **tally** et le nom des sources (**UMD**) arrivent au multiview ;\n- l'**intercom** et la télécommande de la **console son** ;\n- la supervision, l'heure, les fichiers d'habillage, Internet.\n\nOn range ces machines dans des **VLAN** par usage (caméras, production, ralentis, intercom…) : une erreur ou une tempête de trafic dans un VLAN ne gêne pas les autres, et chaque groupe a son plan d'adresses.",
    car: "Trois switchs Gigabit : SW-CŒUR (niveau 3, zone technique), SW-PROD et SW-VISION (PoE, sous les pupitres). Plan : 10.1.<VLAN>.<machine>/24, passerelle en .1.",
    fig: 'cn-plan', see: ['vlan', 'sous-reseau', 'passerelle', 'commutateur', 'cos'],
  },
  mac: {
    t: 'Adresse MAC', aka: 'adresse physique (Ethernet)', cat: CTRL_CAT,
    short: 'L\'identifiant de la carte réseau de chaque machine : 6 octets écrits en hexadécimal (02:CA:12:4F:A0:31). Le switch s\'en sert pour choisir le port de sortie.',
    body: "Une adresse MAC fait **48 bits**, écrits en 6 octets hexadécimaux. Les 3 premiers octets désignent le fabricant (OUI), les 3 suivants le numéro de la carte.\n\nAdresse IP et adresse MAC n'ont pas le même rôle :\n- l'**adresse IP** dit dans quel réseau est la machine et laquelle c'est : on la choisit, elle suit le plan d'adressage ;\n- l'**adresse MAC** est le numéro de la prise réseau : elle ne change pas quand on change l'adresse IP, mais elle change quand on remplace la machine.\n\nPour envoyer un paquet à une adresse IP de son réseau, une machine doit d'abord trouver la MAC qui va avec : c'est le rôle d'**ARP**.",
    car: "Fiche de chaque machine, tables ARP et MAC (onglet Outils). Dans le simulateur, les MAC sont fictives : le 02 du début signale une adresse « administrée localement ».",
    fig: 'cn-mac', see: ['arp', 'table-mac', 'commutateur'], ref: 'IEEE 802 (adresses MAC sur 48 bits)',
  },
  arp: {
    t: 'ARP', aka: 'Address Resolution Protocol', cat: CTRL_CAT,
    short: 'La question « qui a l\'adresse 10.1.20.13 ? » envoyée à tout le VLAN : la machine qui a cette adresse répond avec sa MAC. Sans réponse, pas de communication.',
    body: "Avant d'envoyer un paquet à une machine de son sous-réseau (ou à sa passerelle), une machine diffuse une **requête ARP** à tout son VLAN. La machine qui a l'adresse répond « c'est moi, ma MAC est … ». Le résultat est gardé quelques minutes dans la **table ARP**.\n\nTrois conséquences pratiques :\n- la requête ne sort **jamais du VLAN** : une machine branchée dans le mauvais VLAN ne reçoit pas la question et ne répond pas ;\n- si **deux machines** ont la même adresse, deux réponses arrivent : c'est le **conflit d'adresse IP**, la communication devient instable ;\n- une machine absente de la table ARP alors qu'elle est branchée a souvent une adresse hors du sous-réseau.",
    car: "Outils → table ARP du SW-CŒUR, VLAN par VLAN : deux MAC pour la même adresse signalent un conflit.",
    fig: 'cn-arp', see: ['mac', 'conflit-ip', 'vlan'], ref: 'RFC 826 (ARP)',
  },
  commutateur: {
    t: 'Switch et routeur', aka: 'commutateur (niveau 2), routeur (niveau 3)', cat: CTRL_CAT,
    short: 'Le switch relie les machines d\'un même réseau en lisant les adresses MAC ; le routeur relie des réseaux différents en lisant les adresses IP. Un switch « de niveau 3 » fait les deux.',
    body: "Le **switch** (commutateur) apprend sur quel port se trouve chaque adresse MAC (sa **table MAC**) et envoie chaque trame seulement vers le bon port. Il ne regarde pas l'adresse IP et ne fait jamais passer une trame d'un VLAN à un autre.\n\nLe **routeur** lit l'adresse IP de destination et choisit par où l'envoyer : c'est lui qui fait passer un paquet d'un sous-réseau à un autre. L'adresse du routeur dans un sous-réseau est la **passerelle** des machines de ce sous-réseau.\n\nUn **switch de niveau 3** a, en plus, une interface de routeur dans chaque VLAN (une **SVI**) : il route entre les VLAN sans routeur séparé.",
    car: "SW-PROD et SW-VISION sont des switchs d'accès (niveau 2). SW-CŒUR est de niveau 3 : il porte la passerelle .1 de chaque VLAN. Le routeur / pare-feu fait la sortie vers Internet.",
    fig: 'cn-switch', see: ['table-mac', 'passerelle', 'svi', 'vlan', 'pare-feu'],
  },
  trunk: {
    t: 'Port access et port trunk', aka: 'étiquette VLAN IEEE 802.1Q', cat: CTRL_CAT,
    short: 'Un port access appartient à un seul VLAN, sans que la machine le sache ; un port trunk transporte plusieurs VLAN entre deux switchs, chaque trame portant une étiquette avec son numéro de VLAN.',
    body: "- **Port access** : on y branche une machine. Le switch range tout ce qui y entre dans le VLAN du port. La machine n'envoie pas d'étiquette : son VLAN se règle **sur le switch**, pas dans la machine.\n- **Port trunk** : entre deux switchs (ou vers un routeur). Chaque trame reçoit une **étiquette 802.1Q** de 4 octets : le numéro de VLAN (12 bits, de 1 à 4094) et une priorité (3 bits, la **CoS**). Le switch d'en face la lit et remet la trame dans le bon VLAN.\n\nUn trunk n'accepte que la liste de ses **VLAN autorisés**. Un VLAN oublié dans la liste coupe toutes les machines de ce VLAN branchées sur l'autre switch.",
    car: "Liens montants SW-PROD ↔ SW-CŒUR et SW-VISION ↔ SW-CŒUR : trunk, VLAN 10 à 90. Le routeur est aussi sur un trunk (VLAN 10 et 90). Tous les autres ports sont en access.",
    fig: 'cn-trunk', see: ['vlan', 'cos', 'commutateur'], ref: 'IEEE 802.1Q',
  },
  cos: {
    t: 'CoS (802.1p) et classes de QoS du car', aka: 'Class of Service, priorité de trame', cat: CTRL_CAT,
    short: 'Une priorité de 0 à 7 écrite dans l\'étiquette VLAN de la trame. Avec le DSCP de l\'en-tête IP, elle dit au switch quels paquets faire passer en premier quand un lien est plein.',
    body: "La QoS ne change rien tant que les liens ont de la place. Elle sert quand un lien **sature**, par exemple pendant une grosse copie de fichiers : le switch range les paquets dans des files d'attente et sert d'abord la plus prioritaire.\n\nLe plan du car, de la plus prioritaire à la moins prioritaire :\n- **voix** (intercom) : CoS 5, DSCP 46 (EF), file prioritaire stricte ;\n- **commande et tally** (RCP, mélangeur, grille, console) : CoS 4, DSCP 32 (CS4) ;\n- **gestion** (supervision, heure) : CoS 2, DSCP 16 (CS2) ;\n- **données** au mieux : CoS 0, DSCP 0 ;\n- **fichiers et Internet** : CoS 1, DSCP 8 (CS1).\n\nPiège : en 802.1p, la CoS **1** (« arrière-plan ») passe **après** la CoS 0. Et un switch qui ne « fait pas confiance » au marquage le traite comme du 0.",
    car: "Switchs → QoS de chaque switch ; Outils → lancer une copie de fichiers : avec la QoS, l'intercom reste net ; sans elle, il hache.",
    fig: 'cn-qos', see: ['qos', 'trunk', 'charge'], ref: 'IEEE 802.1Q (priorité PCP) ; RFC 4594 (classes de service DiffServ)',
  },
  dhcp: {
    t: 'DHCP ou adresse fixe', aka: 'Dynamic Host Configuration Protocol', cat: CTRL_CAT,
    short: 'Avec DHCP, la machine demande son adresse, son masque et sa passerelle à un serveur. Avec une adresse fixe, on les saisit à la main. Dans un car, les machines de production sont en adresse fixe.',
    body: "Le DHCP se fait en quatre messages : la machine **cherche** un serveur (Discover), le serveur **propose** une adresse (Offer), la machine la **demande** (Request), le serveur **confirme** (Ack). L'adresse est prêtée pour une durée (le **bail**).\n\nSans serveur DHCP dans son VLAN, la machine se donne une adresse automatique en **169.254.x.x** : elle ne joint personne.\n\nPourquoi des adresses fixes en production : le RCP doit retrouver sa CCU à la même adresse tous les jours, la supervision doit savoir qui est qui, et le plan d'adressage sert de document de dépannage. Le DHCP est réservé aux invités et aux portables.",
    car: "VLAN 90 (invités) : le routeur prête les adresses 10.1.90.100 à 10.1.90.199. Les autres VLAN n'ont pas de serveur DHCP.",
    fig: 'cn-dhcp', see: ['sous-reseau', 'passerelle', 'pare-feu'], ref: 'RFC 2131 (DHCP) ; RFC 3927 (adresses 169.254.0.0/16)',
  },
  rj45: {
    t: 'Câble RJ45, catégorie 6 et Gigabit', aka: '1000BASE-T, paires torsadées', cat: CTRL_CAT,
    short: 'Le câble réseau en cuivre : 4 paires torsadées et une prise RJ45 à 8 contacts. En Gigabit (1000BASE-T), les 4 paires servent, sur 100 m au plus.',
    body: "- **Catégorie** : la catégorie 5e suffit pour le Gigabit, la **catégorie 6** donne plus de marge contre les perturbations ; c'est le câble courant d'un car.\n- **Longueur** : **100 m** au plus par lien, cordons compris. Au-delà, on passe en fibre (module SFP).\n- **Gigabit** : les 4 paires transmettent en même temps. Une paire abîmée fait souvent redescendre le lien à 100 Mb/s, ou le coupe.\n- Les deux bouts se mettent d'accord sur la vitesse (**auto-négociation**) ; le **voyant** du port s'allume quand le lien monte.\n\nPremier réflexe en dépannage : le voyant du port est-il allumé ? Câble branché des deux côtés ? C'est la « couche 1 ».",
    car: "Tous les ports du car SDI sont en cuivre Cat6 à 1 Gb/s. Un câble débranché éteint le voyant du port (onglet Switchs) et la machine disparaît de la table MAC.",
    fig: 'cn-rj45', see: ['poe', 'vitesse', 'commutateur'], ref: 'IEEE 802.3ab (1000BASE-T) ; ANSI/TIA-568 (câblage)',
  },
  ping: {
    t: 'Ping', aka: 'ICMP echo', cat: CTRL_CAT,
    short: 'Le test de base : une machine envoie une « demande d\'écho » à une autre, qui répond. Une réponse prouve que le chemin marche dans les deux sens.',
    body: "Le ping envoie un message **ICMP echo request** ; la machine visée renvoie un **echo reply**, et on mesure le temps aller-retour.\n\nAttention : la **réponse** part avec la configuration de la machine visée (son masque, sa passerelle). Un ping peut donc échouer à cause de l'une ou de l'autre machine.\n\nMéthode :\n1. ping d'une machine du **même VLAN** : teste câbles, switchs et VLAN ;\n2. ping de la **passerelle** : teste l'adresse et le masque ;\n3. ping d'une machine d'**un autre VLAN** : teste les passerelles des deux côtés.\n\n« Délai d'attente dépassé » veut dire : pas de réponse, sans dire pourquoi. Un pare-feu peut aussi bloquer exprès.",
    car: "Outils → ping entre deux machines, avec le chemin et l'explication ; balayage depuis le PC de supervision pour trouver qui ne répond plus.",
    fig: 'cn-ping', see: ['arp', 'passerelle', 'pare-feu'], ref: 'RFC 792 (ICMP)',
  },
  poe: {
    t: 'PoE', aka: 'Power over Ethernet, IEEE 802.3af / 802.3at', cat: CTRL_CAT,
    short: 'Le switch alimente la machine par le câble réseau : pas de bloc secteur pour un RCP, un panneau d\'intercom ou une borne Wi-Fi.',
    body: "En **802.3af**, le switch fournit jusqu'à **15,4 W** par port (environ 13 W arrivent à l'appareil) ; en **802.3at** (PoE+), jusqu'à **30 W**. Le switch a un budget total : on ne peut pas alimenter tous les ports au maximum.\n\nConséquence en exploitation : débrancher le câble d'un RCP en PoE, c'est aussi l'**éteindre**.",
    car: "SW-PROD et SW-VISION sont des switchs PoE : ils alimentent les RCP, les panneaux d'intercom et la borne Wi-Fi.",
    see: ['rj45', 'commutateur'], ref: 'IEEE 802.3af, 802.3at',
  },
  'tsl-umd': {
    t: 'Tally et UMD sur IP (TSL)', aka: 'TSL UMD v5.0', cat: CTRL_CAT,
    short: 'Le protocole qui envoie au multiview le nom de chaque source (UMD) et l\'état de ses lampes de tally. Ancien sur liaison série, il passe par le réseau en UDP depuis la version 5.0.',
    body: "Sous chaque image du multiview, une étiquette donne le **nom de la source** (UMD, l'étiquette sous moniteur) et allume le **tally** : rouge à l'antenne, vert en preset. Ces informations viennent du mélangeur (ou du système de contrôle du car) par le protocole **TSL UMD** :\n- versions 3.1 et 4.0 : liaison série, parfois recopiées dans des paquets UDP ;\n- **version 5.0** : prévue pour le réseau, en **UDP**, chaque écran et chaque fenêtre ayant son numéro.\n\nSi ce lien réseau tombe, les images restent, mais les noms et les tally disparaissent du multiview : le réalisateur ne sait plus ce qui est à l'antenne.",
    car: "L'interface tally du mélangeur (type MKS-X7700, VLAN 30) envoie le TSL UMD au multiview (10.1.30.30).",
    see: ['ctrl-sdi', 'udp'], ref: 'TSL Products, UMD protocol (versions 3.1, 4.0 et 5.0)',
  },
  supervision: {
    t: 'Supervision : SNMP et NTP', cat: CTRL_CAT,
    short: 'SNMP permet au PC de supervision de lire l\'état et les alarmes des machines ; NTP leur donne à toutes la même heure. Les deux traversent les VLAN par la passerelle.',
    body: "- **SNMP** : chaque appareil (switchs, générateur de synchro, onduleurs…) a un agent qui répond aux questions du superviseur (état des ports, alarmes, températures) et peut lui envoyer une alerte de lui-même.\n- **NTP** : un serveur donne l'heure ; chaque machine s'y recale régulièrement. Ici, c'est le générateur de synchro, lui-même calé sur le GPS : journaux, alarmes et fichiers sont horodatés pareil.\n\nComme le superviseur et le serveur NTP sont dans le VLAN de gestion, une machine à la **passerelle fausse** continue de faire son travail dans son VLAN mais disparaît de la supervision et perd l'heure.",
    car: "Générateur de synchro : 10.1.10.20 (supervision et serveur NTP). PC de supervision : 10.1.10.50 ; son balayage (onglet Outils) envoie un ping à chaque machine.",
    see: ['passerelle', 'ping', 'ctrl-sdi'], ref: 'RFC 3411 (SNMP) ; RFC 5905 (NTPv4)',
  },
  'pare-feu': {
    t: 'Routeur, pare-feu et Internet', aka: 'NAT, adresses privées', cat: CTRL_CAT,
    short: 'Le routeur relie le car à Internet ; le pare-feu décide ce qui a le droit de passer. Ici, les invités du Wi-Fi sortent sur Internet mais ne voient jamais la production.',
    body: "Les adresses du car (10.x.x.x) sont des **adresses privées** : elles ne circulent pas sur Internet. Le routeur les **traduit** (NAT) en son adresse publique à la sortie, et remet les réponses à la bonne machine au retour.\n\nLe **pare-feu** applique des règles :\n- la production peut sortir (envoyer un fichier à la chaîne, une mise à jour) ;\n- les **invités** (VLAN 90) ne sortent que vers Internet : ils ne peuvent pas joindre un RCP ou la grille ;\n- personne ne peut entrer depuis Internet, sauf les réponses à ce qui est sorti.\n\nLe SW-CŒUR envoie vers le routeur tout ce qui n'est pas dans un VLAN du car : c'est sa **route par défaut**.",
    car: "Routeur / pare-feu : 10.1.10.254 dans le VLAN 10, 10.1.90.1 dans le VLAN 90 (passerelle et serveur DHCP des invités). Serveur de la chaîne : 203.0.113.10, sur Internet.",
    see: ['passerelle', 'dhcp', 'vlan'], ref: 'RFC 1918 (adresses privées) ; RFC 3022 (NAT)',
  },
  'table-mac': {
    t: 'Table MAC d\'un switch', aka: 'table d\'adresses (CAM)', cat: CTRL_CAT,
    short: 'Le switch note, pour chaque adresse MAC, le port par où elle est arrivée. Il envoie ensuite chaque trame seulement sur le bon port.',
    body: "Le switch **apprend** en regardant l'adresse MAC source de chaque trame qui entre : « cette MAC est derrière le port 13, dans le VLAN 40 ». Une entrée qui ne sert plus est oubliée au bout de quelques minutes (souvent 5).\n\nPour une MAC inconnue, le switch envoie la trame sur tous les ports du VLAN, puis apprend la réponse.\n\nEn dépannage : une machine absente de la table MAC n'envoie rien. Câble, port désactivé, machine éteinte ? Une machine présente mais dans un autre VLAN que prévu : mauvais VLAN de port.",
    car: "Outils → table MAC de chaque switch. Les machines des autres switchs y apparaissent derrière le port du lien montant.",
    see: ['mac', 'commutateur', 'arp'],
  },
};
Object.assign(TERMS, ADD);

// intitulés de l'interface → fiche (testés après ceux du lexique commun : aucun intitulé du car IP n'est concerné)
TERM_PATTERNS.push(
  [/^table mac/i, 'table-mac'], [/^adresse mac|^mac$/i, 'mac'], [/^table arp|^arp\b/i, 'arp'],
  [/^mode d'adressage|^dhcp\b/i, 'dhcp'], [/^port (access|trunk)|^access ou trunk|^mode du port/i, 'trunk'],
  [/^cos\b|802\.1p/i, 'cos'], [/^câble\b|\brj45\b|catégorie 6/i, 'rj45'], [/^ping\b|^balayage/i, 'ping'], [/^poe\b/i, 'poe'],
  [/^tally et umd|\btsl\b/i, 'tsl-umd'], [/^supervision|\bsnmp\b|^ntp\b/i, 'supervision'], [/pare-feu/i, 'pare-feu'],
  [/^switchs?$|^switch et routeur/i, 'commutateur'], [/^réseau de contrôle du car/i, 'ctrl-sdi'],
);

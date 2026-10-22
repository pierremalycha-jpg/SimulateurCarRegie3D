// @ts-check
// ----------------------------------------------------------------------------------
// Catalogue, groupe « réseau et ordinateurs » : le switch PoE+ administrable NETGEAR M4250-26G4F-PoE+
// (GSM4230P), le routeur d'accès Internet (une box fibre ou 4G : quatre ports LAN, DHCP sur
// 192.168.1.0/24) et le PC de régie Windows avec sa carte Blackmagic DeckLink Duo 2 (vMix, ATEM
// Software Control, Ross DashBoard).
//
// Conventions propres à ce groupe (le moteur et les panneaux les lisent) :
//   - switch : le port n a l'id `port-n` (n = 1 à 30 : 1-24 PoE+, 25-26 cuivre, 27-30 cages SFP) et sa
//     clé dans cfg.ports est n ; l'adresse d'administration (cfg.reseau) est portée par tous les ports
//     du VLAN 1 (nic: true). Le port OOB (gestion hors bande) est à part : il n'est pas commuté.
//   - routeur : cfg.lan est le serveur DHCP et l'adresse de la passerelle ; cfg.reseau la recopie
//     (règle commune « tout appareil réseau a un cfg.reseau ») ; cfg.wan dit s'il y a Internet.
//   - PC : les quatre BNC de la DeckLink Duo 2 sont bidirectionnels (dir 'io') ; cfg.decklink[n]
//     ('in' | 'out') dit dans quel sens chacun travaille (Desktop Video Setup, « connector mapping »).
//
// Sources (extraits de recherche ; les sites constructeurs ne répondent pas depuis le conteneur) :
// NETGEAR M4250 Installation Guide, Main User Manual, AV UI User Manual et fiche technique (M4250
// Datasheet) ; base de connaissances NETGEAR 000068389 (adresse IP du switch) ; Blackmagic Desktop
// Video Installation and Operation Manual et FAQ développeurs (DeckLink Duo 2 : connecteurs par
// paires, half-duplex par connecteur) ; prix relevés chez des revendeurs (ordres de grandeur).
// ----------------------------------------------------------------------------------
import { row } from './divers.js';

/** @typedef {import('../types.js').Modele} Modele */
/** @typedef {import('../types.js').Port} Port */
/** @typedef {import('../types.js').FaceItem} FaceItem */

const range = (/** @type {number} */ a, /** @type {number} */ b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// ---------------------------------------------------------------- switch M4250
/** @type {Port[]} */
const SW_PORTS = [
  ...range(1, 24).map((n) => /** @type {Port} */ ({ id: 'port-' + n, label: String(n), kind: 'rj45', sig: 'ip', dir: 'io', group: 'Ports 1 à 24 · Gigabit PoE+', poe: true, nic: true, desc: `Port Gigabit ${n}, PoE+ (IEEE 802.3at, 30 W au plus par port) : une caméra PTZ, un pupitre ou un Teranex s'y alimente par le câble réseau. VLAN et profil réglés dans cfg.ports[${n}].` })),
  ...range(25, 26).map((n) => /** @type {Port} */ ({ id: 'port-' + n, label: String(n), kind: 'rj45', sig: 'ip', dir: 'io', group: 'Ports 25 et 26 · Gigabit cuivre, sans PoE', nic: true, desc: `Port Gigabit ${n} sans PoE : le routeur, le PC de régie, un mélangeur ou un second switch.` })),
  ...range(27, 30).map((n) => /** @type {Port} */ ({ id: 'port-' + n, label: String(n), kind: 'sfp', sig: 'ip', dir: 'io', group: 'Ports 27 à 30 · cages SFP 1 Gbit/s', nic: true, desc: `Cage SFP ${n} : il faut y glisser un module (fibre 1000BASE-SX/LX ou cuivre 1000BASE-T) avant de câbler. Liaison montante vers un autre switch, sans PoE.` })),
  { id: 'oob', label: 'OOB', kind: 'rj45', sig: 'ip', dir: 'io', group: 'Gestion', desc: 'Port de gestion hors bande (out-of-band) : il n\'est pas commuté avec les ports 1 à 30 et porte sa propre adresse (192.168.0.239 de secours). On y branche un PC d\'administration, jamais un appareil de production.' },
  { id: 'iec', label: 'AC IN 100-240 V', kind: 'iec', sig: 'secteur', dir: 'in', group: 'Alimentation', watts: 36, desc: 'Secteur, embase IEC C14 : 36 W pour le switch seul, jusqu\'à 401 W quand les 24 ports PoE+ débitent leurs 300 W.' },
];
/** configuration d'usine des ports : tout dans le VLAN 1, PoE actif sur 1 à 24, profil « défaut » */
const SW_CFG_PORTS = Object.fromEntries(range(1, 30).map((n) => [n, { vlan: 1, poe: n <= 24, profil: 'defaut' }]));

function switchFaces() {
  /** @type {FaceItem[]} */ const av = [
    { t: 'body', x: 10, y: 10, w: 960, h: 150, r: 4 },
    { t: 'text', x: 24, y: 32, s: 'NETGEAR · AV Line M4250-26G4F-PoE+ · 24 × PoE+ 300 W · 2 × 1G · 4 × SFP', size: 12 },
    { t: 'group', x: 20, y: 44, w: 150, h: 108, l: 'État et gestion' },
    { t: 'led', id: 'led-pwr', x: 44, y: 78, c: 'green', l: 'PWR' }, { t: 'led', id: 'led-fan', x: 84, y: 78, c: 'green', l: 'FAN' }, { t: 'led', id: 'led-poemax', x: 128, y: 78, c: 'amber', l: 'PoE MAX' },
    { t: 'port', id: 'oob', k: 'rj45', x: 60, y: 125, l: 'OOB' }, { t: 'btn', id: 'reset', x: 105, y: 115, w: 50, h: 20, l: 'RESET' },
    { t: 'group', x: 190, y: 44, w: 425, h: 108, l: 'PoE+ · 1 à 24' },
    { t: 'group', x: 630, y: 44, w: 70, h: 108, l: '25 · 26' },
    { t: 'group', x: 715, y: 44, w: 125, h: 108, l: 'SFP 1G · 27 à 30' },
    { t: 'text', x: 862, y: 95, s: 'M4250', size: 16 }, { t: 'text', x: 862, y: 112, s: 'AV Line', size: 10, w: 400 },
  ];
  // deux rangées : impairs en haut, pairs en bas, comme sur l'appareil
  row(av, range(1, 12).map((i) => 'port-' + (2 * i - 1)), 215, 76, 34, 'rj45', range(1, 12).map((i) => String(2 * i - 1)), { small: true });
  row(av, range(1, 12).map((i) => 'port-' + 2 * i), 215, 124, 34, 'rj45', range(1, 12).map((i) => String(2 * i)), { small: true });
  av.push({ t: 'port', id: 'port-25', k: 'rj45', x: 665, y: 76, l: '25', small: true }, { t: 'port', id: 'port-26', k: 'rj45', x: 665, y: 124, l: '26', small: true });
  av.push({ t: 'port', id: 'port-27', k: 'sfp', x: 748, y: 76, l: '27', small: true }, { t: 'port', id: 'port-28', k: 'sfp', x: 748, y: 124, l: '28', small: true });
  av.push({ t: 'port', id: 'port-29', k: 'sfp', x: 806, y: 76, l: '29', small: true }, { t: 'port', id: 'port-30', k: 'sfp', x: 806, y: 124, l: '30', small: true });
  /** @type {FaceItem[]} */ const ar = [
    { t: 'body', x: 10, y: 10, w: 960, h: 100, r: 4 },
    { t: 'text', x: 24, y: 34, s: 'FACE ARRIÈRE · 100-240 V ~ 50/60 Hz · 401 W au plus (PoE+ compris) · sans ventilateur à faible charge', size: 12 },
    { t: 'port', id: 'iec', k: 'iec', x: 900, y: 62, l: 'AC IN' },
  ];
  return { avant: { label: 'Face avant (ports)', w: 980, h: 170, items: av }, arriere: { label: 'Face arrière (secteur)', w: 980, h: 120, items: ar } };
}

// ---------------------------------------------------------------- routeur (box)
/** @type {Port[]} */
const ROUTEUR_PORTS = [
  ...range(1, 4).map((n) => /** @type {Port} */ ({ id: 'lan-' + n, label: `LAN ${n}`, kind: 'rj45', sig: 'ip', dir: 'io', group: 'LAN', nic: true, desc: `Port LAN ${n} (Gigabit) : les quatre ports LAN sont commutés entre eux ; le serveur DHCP y distribue 192.168.1.100 à .199 et la passerelle 192.168.1.1.` })),
  { id: 'wan', label: 'WAN', kind: 'rj45', sig: 'ip', dir: 'io', group: 'Internet', desc: 'Liaison vers Internet : le boîtier fibre (ONT) ou, sur une box 4G, le modem interne (rien à câbler ici). C\'est cfg.wan qui dit ce qu\'il y a derrière : fibre, 4G ou rien.' },
  { id: 'alim', label: 'ALIM 12 V', kind: 'iec', sig: 'secteur', dir: 'in', group: 'Alimentation', watts: 12, desc: 'Bloc secteur fourni avec la box (12 V) : il se branche sur une prise 230 V, comme un cordon secteur.' },
];
function routeurFaces() {
  /** @type {FaceItem[]} */ const ar = [
    { t: 'body', x: 10, y: 10, w: 500, h: 130, r: 10 },
    { t: 'text', x: 24, y: 34, s: 'BOX D\'ACCÈS INTERNET · 4 × LAN GIGABIT · WAN', size: 12 },
    { t: 'group', x: 20, y: 50, w: 80, h: 85, l: 'Internet' }, { t: 'port', id: 'wan', k: 'rj45', x: 60, y: 90, l: 'WAN' },
    { t: 'group', x: 115, y: 50, w: 270, h: 85, l: 'LAN' },
    { t: 'group', x: 400, y: 50, w: 100, h: 85, l: 'Alim' }, { t: 'port', id: 'alim', k: 'iec', x: 450, y: 90, l: '12 V' },
  ];
  row(ar, range(1, 4).map((n) => 'lan-' + n), 150, 90, 65, 'rj45', range(1, 4).map((n) => 'LAN ' + n));
  /** @type {FaceItem[]} */ const av = [
    { t: 'body', x: 10, y: 10, w: 500, h: 90, r: 10 },
    { t: 'text', x: 24, y: 34, s: 'BOX · voyants', size: 12 },
    { t: 'led', id: 'led-pwr', x: 160, y: 60, c: 'green', l: 'POWER' }, { t: 'led', id: 'led-wan', x: 230, y: 60, c: 'green', l: 'INTERNET' },
    { t: 'led', id: 'led-lan1', x: 310, y: 60, c: 'green', l: 'LAN 1' }, { t: 'led', id: 'led-lan2', x: 360, y: 60, c: 'green', l: 'LAN 2' }, { t: 'led', id: 'led-lan3', x: 410, y: 60, c: 'green', l: 'LAN 3' }, { t: 'led', id: 'led-lan4', x: 460, y: 60, c: 'green', l: 'LAN 4' },
  ];
  return { arriere: { label: 'Face arrière (ports)', w: 520, h: 150, items: ar }, avant: { label: 'Face avant (voyants)', w: 520, h: 110, items: av } };
}

// ---------------------------------------------------------------- PC de régie (vMix, DeckLink Duo 2)
/** @type {Port[]} */
const PC_PORTS = [
  { id: 'lan', label: 'LAN', kind: 'rj45', sig: 'ip', dir: 'io', group: 'Carte mère', nic: true, desc: 'Le seul port Ethernet du PC (Gigabit, sur la carte mère) : NDI|HX, commande des caméras PTZ, ATEM Software Control, DashBoard et le streaming passent tous par lui. Un second port demanderait une carte réseau en plus.' },
  ...range(1, 4).map((n) => /** @type {Port} */ ({ id: 'usb-' + n, label: `USB ${n}`, kind: 'usba', sig: 'usb', dir: 'io', group: 'Carte mère', desc: 'USB-A 3.x : clavier, souris, clé, périphérique de commande.' })),
  { id: 'usbc-1', label: 'USB-C', kind: 'usbc', sig: 'usb', dir: 'io', group: 'Carte mère', desc: 'USB-C 3.x : un disque USB-C (relecture des fichiers ISO d\'un ATEM ou d\'un HyperDeck).' },
  { id: 'hdmi-out', label: 'HDMI', kind: 'hdmi', sig: 'hdmi', dir: 'out', group: 'Carte graphique', desc: 'Sortie HDMI de la carte graphique : le moniteur de l\'opérateur (l\'interface vMix, ATEM Software Control ou DashBoard), pas une sortie vidéo de production.' },
  ...range(1, 4).map((n) => /** @type {Port} */ ({ id: 'sdi-' + n, label: `SDI ${n}`, kind: 'bnc', sig: 'sdi', dir: 'io', group: 'DeckLink Duo 2', desc: `BNC ${n} de la DeckLink Duo 2 (SD/HD/3G-SDI) : entrée ou sortie selon cfg.decklink[${n}]. D'usine, la carte travaille par paires (SDI 1 et 2, SDI 3 et 4 : une entrée et une sortie) ; en mode un connecteur par sous-périphérique, chaque BNC est une entrée ou une sortie indépendante.` })),
  { id: 'iec', label: 'AC IN', kind: 'iec', sig: 'secteur', dir: 'in', group: 'Alimentation', watts: 350, desc: 'Alimentation du PC (IEC C14) : 350 W en régie, ordre de grandeur pour un PC avec carte graphique.' },
];
function pcFaces() {
  /** @type {FaceItem[]} */ const ar = [
    { t: 'body', x: 10, y: 10, w: 540, h: 380, r: 6 },
    { t: 'text', x: 24, y: 34, s: 'PC DE RÉGIE · tour Windows · face arrière', size: 12 },
    { t: 'group', x: 20, y: 50, w: 330, h: 80, l: 'Alimentation' }, { t: 'port', id: 'iec', k: 'iec', x: 70, y: 92, l: 'AC IN' },
    { t: 'group', x: 20, y: 145, w: 330, h: 95, l: 'Carte mère · E/S' },
    { t: 'port', id: 'lan', k: 'rj45', x: 60, y: 192, l: 'LAN' },
    { t: 'port', id: 'usbc-1', k: 'usb', x: 310, y: 192, l: 'USB-C' },
    { t: 'group', x: 20, y: 255, w: 330, h: 80, l: 'Carte graphique' }, { t: 'port', id: 'hdmi-out', k: 'usb', x: 70, y: 297, l: 'HDMI' },
    { t: 'group', x: 370, y: 50, w: 160, h: 320, l: 'DeckLink Duo 2' }, { t: 'text', x: 395, y: 84, s: '4 × BNC SD/HD/3G-SDI', size: 9, w: 400 },
  ];
  row(ar, range(1, 4).map((n) => 'usb-' + n), 115, 192, 45, 'usb', range(1, 4).map((n) => 'USB ' + n));
  range(1, 4).forEach((n) => ar.push({ t: 'port', id: 'sdi-' + n, k: 'bnc', x: 450, y: 70 + n * 62, l: `SDI ${n}` }));
  /** @type {FaceItem[]} */ const av = [
    { t: 'body', x: 10, y: 10, w: 300, h: 380, r: 6 },
    { t: 'text', x: 24, y: 34, s: 'PC DE RÉGIE', size: 13 }, { t: 'text', x: 24, y: 52, s: 'Windows · vMix · ATEM Software Control · DashBoard', size: 9, w: 400 },
    { t: 'btn', id: 'power', x: 115, y: 90, w: 90, h: 30, l: 'MARCHE' }, { t: 'led', id: 'led-pwr', x: 160, y: 145, c: 'green', l: 'ALIM' }, { t: 'led', id: 'led-disk', x: 160, y: 190, c: 'amber', l: 'DISQUE' },
    { t: 'disk', id: 'ssd', x: 60, y: 230, w: 200, h: 130 },
  ];
  return { arriere: { label: 'Face arrière (connecteurs)', w: 560, h: 400, items: ar }, avant: { label: 'Face avant', w: 320, h: 400, items: av } };
}

/** @type {Record<string, Modele>} */
export const RESEAU = {
  'switch-m4250': {
    id: 'switch-m4250', marque: 'NETGEAR', nom: 'AV Line M4250-26G4F-PoE+ (GSM4230P)', court: 'Switch M4250', famille: 'reseau', pose: 'rack', u: 1, largeur: 1,
    role: 'Le cœur du réseau de la régie : 24 ports Gigabit PoE+ (300 W pour l\'ensemble), 2 ports cuivre et 4 cages SFP, administrable (VLAN 802.1Q, QoS, IGMP Plus, profils NDI et Dante dans l\'AV UI).',
    ports: SW_PORTS,
    reseau: { dhcp: true, ip: '169.254.100.100', mask: '255.255.0.0', gw: '' },
    services: [{ id: 'web', role: 'serveur', port: 80, desc: 'Interface d\'administration (AV UI et Main UI, HTTP et HTTPS) : identifiant admin, mot de passe vide à la première connexion.' }],
    watts: 36, prix: 1500,
    cfg: { ports: SW_CFG_PORTS, vlans: { 1: 'default' }, poeBudget: 300, igmp: true, qos: true, reseau: { dhcp: true, ip: '169.254.100.100', mask: '255.255.0.0', gw: '' } },
    faces: switchFaces(),
    specs: [
      '24 ports 10/100/1000BASE-T PoE+ (IEEE 802.3at, 30 W par port au plus), 2 ports 10/100/1000BASE-T sans PoE, 4 cages SFP 1000BASE-X : 30 ports, fond de panier non bloquant de 60 Gbit/s.',
      'Budget PoE+ total : 300 W (en pratique, dix caméras PTZ ou pupitres à 25-30 W, pas vingt-quatre).',
      'Administration : interface d\'usine en DHCP sur le VLAN 1 ; sans serveur DHCP, le switch prend 169.254.100.100 / 255.255.0.0 après environ deux minutes (le port OOB prend 192.168.0.239). Identifiant admin, mot de passe vide, à changer à la première connexion.',
      'AV UI : profils par usage (vidéo NDI, Dante, AES67, Q-SYS…) qui règlent VLAN, QoS (DSCP et 802.1p) et IGMP Plus (snooping et querier multicast) sans ligne de commande.',
      'Consommation : 36 W sans PoE, 401 W au plus avec les 300 W de PoE ; silencieux (ventilateur à l\'arrêt à faible charge). 1 U, 440 × 257 × 43 mm, 4,3 kg.',
      'Prix : ordre de grandeur 1 300 à 1 900 € HT selon le revendeur.',
    ],
    doc: 'NETGEAR, AV Line of Fully Managed Switches M4250 Series : Installation Guide (M4250_IG_EN.pdf), Main User Manual (M4250_UM_EN.pdf), AV UI User Manual (M4250_AV_UM_EN.pdf), fiche technique M4250 Datasheet ; base de connaissances NETGEAR 000068389 « How do I find the IP address of my NETGEAR fully managed switch ».',
    averifier: [
      'Le port OOB et le port console existent sur la gamme M4250 (manuel) ; leur place exacte sur la face avant du 26G4F-PoE+ et la nature du port console (RJ45, mini-USB ou USB-C) ne sont pas confirmées : le port console n\'est pas modélisé.',
      'L\'adresse de secours 169.254.100.100 / 255.255.0.0 vient du manuel et de la base de connaissances NETGEAR (quatre requêtes DHCP, puis repli après 120 s) : à vérifier sur l\'appareil du BTS, dont la configuration a peut-être été changée.',
      'IGMP snooping actif d\'usine (igmp: true) et QoS activée d\'usine (qos: true) : c\'est le réglage attendu de l\'AV UI, non confirmé port par port dans la documentation lue.',
      'Le port USB de façade (sauvegarde de configuration, mise à jour) n\'est pas modélisé.',
      'Les 36 W sans PoE et 401 W avec PoE sont les chiffres de la fiche technique ; le moteur ne compte que les 36 W dans le budget secteur : la puissance PoE réellement débitée s\'y ajoute (voir le rapport).',
    ],
    boite: { w: 0.44, h: 0.0432, d: 0.257, couleur: '#1f2328' },
  },
  routeur: {
    id: 'routeur', marque: 'Générique', nom: 'Box d\'accès Internet (fibre ou 4G)', court: 'Routeur', famille: 'reseau', pose: 'table',
    role: 'La sortie vers Internet : quatre ports LAN commutés, serveur DHCP sur 192.168.1.0/24 (passerelle 192.168.1.1), liaison WAN fibre ou 4G. Sans elle, pas de streaming.',
    ports: ROUTEUR_PORTS,
    reseau: { dhcp: false, ip: '192.168.1.1', mask: '255.255.255.0', gw: '' },
    services: [{ id: 'web', role: 'serveur', port: 80, desc: 'Page d\'administration de la box (http://192.168.1.1) : DHCP, plage d\'adresses, état de la liaison.' }],
    watts: 12, prix: 200,
    cfg: {
      lan: { ip: '192.168.1.1', mask: '255.255.255.0', dhcp: { on: true, de: 100, a: 199 } },
      wan: 'fibre',
      reseau: { dhcp: false, ip: '192.168.1.1', mask: '255.255.255.0', gw: '' },
    },
    faces: routeurFaces(),
    specs: [
      'Quatre ports LAN Gigabit commutés entre eux : tout ce qui y est branché est dans le même domaine de niveau 2 que le port LAN du switch.',
      'Serveur DHCP d\'usine : 192.168.1.100 à 192.168.1.199, masque 255.255.255.0, passerelle et DNS 192.168.1.1 (valeurs courantes des box françaises ; chaque opérateur a les siennes).',
      'WAN : fibre (ONT ou fibre intégrée) ou 4G (modem et carte SIM intégrés) ; « aucun » quand la régie n\'a pas d\'accès Internet. Le débit montant décide du streaming (ordre de grandeur : 6 à 10 Mbit/s pour du 1080p H.264).',
      'Consommation : une dizaine de watts ; prix : fournie par l\'opérateur (fibre) ou 150 à 300 € HT pour un routeur 4G.',
    ],
    doc: 'Appareil générique : pas de document constructeur. Valeurs d\'usine courantes des box d\'accès (192.168.1.1/24, DHCP .100 à .199).',
    averifier: [
      'La plage DHCP (100 à 199) et l\'adresse 192.168.1.1 sont celles du brief : chaque box a les siennes (certaines distribuent 192.168.0.x ou 192.168.1.10 à .50).',
      'Le port WAN est modélisé en RJ45 ; sur une box fibre l\'ONT est souvent intégré, sur une box 4G la liaison est hertzienne : rien ne s\'y câble dans l\'entrepôt.',
      'Le bloc secteur fourni (12 V) est compté comme un cordon secteur (port iec), pour qu\'il se branche au mur ou au bandeau.',
    ],
    boite: { w: 0.25, h: 0.05, d: 0.18, couleur: '#eef0f2' },
  },
  'pc-regie': {
    id: 'pc-regie', marque: 'Générique', nom: 'PC de régie Windows + DeckLink Duo 2', court: 'PC régie', famille: 'ordinateur', pose: 'table',
    role: 'Le poste de régie logicielle : vMix (mélange, NDI|HX, enregistrement, streaming) avec quatre BNC SDI par la carte Blackmagic DeckLink Duo 2 ; ou ATEM Software Control pour l\'ATEM, ou DashBoard pour le Carbonite.',
    ports: PC_PORTS,
    reseau: { dhcp: true, ip: '', mask: '', gw: '' },
    services: [
      { id: 'ptz-http', role: 'client', port: 80, desc: 'vMix pilote les caméras PTZ Panasonic par leur serveur HTTP (cfg.vmix.ptz[i].ip).' },
      { id: 'ndi', role: 'client', desc: 'vMix reçoit les flux NDI|HX des caméras qui l\'ont activé (découverte mDNS sur le même sous-réseau).' },
      { id: 'atem', role: 'client', port: 9910, desc: 'ATEM Software Control : commande de l\'ATEM en TCP 9910 (cfg.logiciel = atem-control).' },
      { id: 'rosstalk', role: 'client', port: 7788, desc: 'DashBoard parle au Carbonite (RossTalk TCP 7788, cfg.logiciel = dashboard).' },
      { id: 'dashboard', role: 'client', port: 5253, desc: 'DashBoard : découverte et panneaux du Carbonite (TCP 5253).' },
      { id: 'rtmp', role: 'client', desc: 'vMix diffuse en RTMP vers YouTube, Twitch… : il faut Internet par le routeur (cfg.vmix.stream).' },
    ],
    watts: 350, prix: 3200,
    formats: ['1080p50', '1080i50', '720p50', '1080p59', '1080i59'],
    cfg: {
      logiciel: 'vmix',
      decklink: { 1: 'in', 2: 'in', 3: 'in', 4: 'out' },
      vmix: { entrees: [{ type: 'decklink', source: '' }], ptz: [{ ip: '', modele: '' }], tally: true, enregistre: false, stream: false },
      reseau: { dhcp: true, ip: '', mask: '', gw: '' },
    },
    faces: pcFaces(),
    specs: [
      'Tour Windows 11 : processeur 8 cœurs, 32 Go, carte graphique dédiée, SSD NVMe pour l\'enregistrement (ordre de grandeur d\'un PC vMix recommandé par l\'éditeur).',
      'DeckLink Duo 2 (PCIe) : quatre BNC SD/HD/3G-SDI indépendants, chacun entrée ou sortie. D\'usine, Desktop Video Setup les groupe par paires (SDI 1 et 2, SDI 3 et 4 : entrée + sortie) ; en « connector mapping » un seul connecteur par sous-périphérique, les quatre sont libres (3 entrées + 1 sortie programme, par exemple).',
      'Un seul port Ethernet Gigabit : NDI|HX, commande PTZ, ATEM Software Control, DashBoard et streaming partagent le même câble vers le switch.',
      'vMix accepte des entrées de formats différents (il convertit) ; la sortie programme est au format réglé dans vMix. Tally vMix vers les caméras par IP (commande PTZ).',
      'Prix : PC ≈ 1 800 €, DeckLink Duo 2 ≈ 550 €, licence vMix 4K ≈ 700 € HT : ordre de grandeur 3 200 € HT.',
    ],
    doc: 'Blackmagic Design, Desktop Video Installation and Operation Manual (DeckLink Duo 2 : connecteurs et « connector mapping ») et FAQ développeurs Desktop Video ; vMix, Supported Hardware et Reference PC ; ATEM Software Control (manuel ATEM) ; Ross DashBoard User Guide.',
    averifier: [
      'Le brief dit « entrées ou sorties par paires » : la documentation Blackmagic dit que c\'est le mode d\'usine (paires full-duplex) et que chaque BNC devient indépendant en mode un connecteur par sous-périphérique ; cfg.decklink règle chaque BNC, ce qui suppose ce second mode.',
      'La configuration du PC (processeur, mémoire, carte graphique, 350 W) et les prix sont des ordres de grandeur, pas une fiche constructeur.',
      'Le nombre de ports USB (4 × USB-A, 1 × USB-C) et la sortie HDMI unique sont ceux d\'une carte mère courante : à adapter au PC du BTS.',
      'Pas d\'entrée audio analogique modélisée (le micro passe par un Teranex ou par l\'audio embarqué SDI).',
    ],
    boite: { w: 0.21, h: 0.45, d: 0.45, couleur: '#15181b' },
  },
};

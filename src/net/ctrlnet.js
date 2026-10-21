// @ts-check
import { S, emit } from '../state.js';
import { randPick } from '../util.js';

// ----------------------------------------------------------------------------------
// Réseau de contrôle Gigabit du car SDI (modèle, sans interface : testable sous Node).
//
// Dans un car SDI, les images passent par les câbles coaxiaux et la grille ; tout ce qui se
// pilote passe par Ethernet : RCP → CCU, pupitre → processeur du mélangeur, logiciel → grille,
// IPDirector → serveur EVS, tally et noms (TSL UMD) → multiview, intercom, télécommande de la
// console son, supervision (SNMP, NTP), fichiers (habillage, NAS), Wi-Fi des invités.
//
// Trois switchs Gigabit administrables : un cœur de niveau 3 (routage entre VLAN, une interface
// VLAN = passerelle .1 par VLAN) et deux switchs d'accès PoE (production, vision) reliés au cœur
// par des liens montants en trunk 802.1Q. Plan d'adressage : 10.1.<VLAN>.<machine>/24.
//
// Le moteur simule ce que fait vraiment un paquet : la machine compare l'adresse visée à son
// propre sous-réseau (adresse + masque) ; si elle est « chez elle », elle cherche la MAC par ARP
// dans son VLAN, sinon elle passe par sa passerelle ; le cœur route vers le VLAN de destination ;
// le routeur / pare-feu sort vers Internet et isole les invités. La réponse refait le chemin
// inverse avec la configuration de l'autre machine. On en tire : ping, tables ARP et MAC, état
// de chaque machine et de chaque fonction du car (RCP qui a sa CCU, IPDirector qui voit l'EVS…),
// charge des liens montants et pertes par classe de QoS.
//
// API pour les autres postes : ctrlReach(a, b), ctrlOk(id), ctrlFunc(clé), ctrlCam(n), et
// l'événement emit('ctrlnet', { type: 'change' | 'lost' | 'back' | 'ping' | 'sweep' | 'go', … }).
// ----------------------------------------------------------------------------------

// ---------------- adresses IPv4 ----------------
/** @param {string} s @returns {number | null} adresse sur 32 bits, null si la saisie n'est pas une adresse */
export function parseIp(s) {
  const m = String(s || '').trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const b = m.slice(1).map(Number);
  if (b.some((x) => x > 255)) return null;
  return ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
}
/** @param {number} n */
export const ipStr = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
/** @param {number} p longueur du préfixe */
export const maskOf = (p) => (p <= 0 ? 0 : (0xffffffff << (32 - p)) >>> 0);
/** @param {number} p */
export const maskStr = (p) => ipStr(maskOf(p));
/**
 * masque saisi : « 255.255.255.0 », « /24 » ou « 24 » ; null si incohérent (les « 1 » doivent être
 * à gauche, d'un seul tenant : 255.255.0.255 n'est pas un masque)
 * @param {string} s @returns {number | null}
 */
export function parseMask(s) {
  const t = String(s || '').trim();
  const m = t.match(/^\/?(\d{1,2})$/);
  if (m) { const p = +m[1]; return p >= 0 && p <= 32 ? p : null; }
  const n = parseIp(t); if (n == null) return null;
  for (let p = 0; p <= 32; p++) if (maskOf(p) === n) return p;
  return null;
}
/** @param {number} ip @param {number} p */
export const netOf = (ip, p) => (ip & maskOf(p)) >>> 0;
/** @param {number} ip @param {number} p */
export const bcastOf = (ip, p) => (netOf(ip, p) | (~maskOf(p) >>> 0)) >>> 0;
/** @param {number} a @param {number} b @param {number} p même sous-réseau vu avec le masque p */
export const sameNet = (a, b, p) => netOf(a, p) === netOf(b, p);
/** @param {string} ip @param {number} p */
export function subnetStr(ip, p) { const n = parseIp(ip); return n == null ? '?' : `${ipStr(netOf(n, p))}/${p}`; }

// ---------------- plan d'adressage ----------------
export const BASE = '10.1';
/**
 * VLAN par usage. Le troisième nombre de l'adresse est le numéro du VLAN : 10.1.20.33 est dans le VLAN 20.
 * @typedef {{ id: number, name: string, use: string, qos: string, gw: string, gwOn: string, dhcp?: boolean }} Vlan
 * @type {Vlan[]}
 */
export const VLANS = [
  { id: 10, name: 'Gestion', use: 'Switchs, générateur de synchro (supervision SNMP, heure NTP), mesure, routeur, PC de supervision', qos: 'gestion', gw: '10.1.10.1', gwOn: 'core' },
  { id: 20, name: 'Caméras', use: 'CCU et RCP : les réglages des caméras', qos: 'commande', gw: '10.1.20.1', gwOn: 'core' },
  { id: 30, name: 'Production', use: 'Mélangeur (pupitre ↔ processeur), grille, multiview, tally et UMD', qos: 'commande', gw: '10.1.30.1', gwOn: 'core' },
  { id: 40, name: 'Ralentis', use: 'Serveur EVS et IPDirector (base de clips)', qos: 'donnees', gw: '10.1.40.1', gwOn: 'core' },
  { id: 50, name: 'Intercom et son', use: 'Matrice et panneaux d\'intercom, console son (surface ↔ cœur)', qos: 'voix', gw: '10.1.50.1', gwOn: 'core' },
  { id: 60, name: 'Fichiers et habillage', use: 'PC d\'habillage, NAS (stockage partagé)', qos: 'fichiers', gw: '10.1.60.1', gwOn: 'core' },
  { id: 90, name: 'Invités et Internet', use: 'Point d\'accès Wi-Fi et portables des invités (adresses par DHCP), isolés de la production', qos: 'fichiers', gw: '10.1.90.1', gwOn: 'router', dhcp: true },
];
export const vlanById = (v) => VLANS.find((x) => x.id === v) || null;
export const vlanName = (v) => { const x = vlanById(v); return x ? `VLAN ${v} · ${x.name}` : v === 1 ? 'VLAN 1 (par défaut, inutilisé)' : `VLAN ${v} (absent du plan)`; };
export const vlanNet = (v) => `${BASE}.${v}.0/24`;
export const PREFIX = 24;
export const DHCP_POOL = [100, 199];

/**
 * Classes de QoS, de la plus prioritaire à la moins prioritaire. Marquage CoS (802.1p, 3 bits dans
 * l'étiquette VLAN) et DSCP (6 bits dans l'en-tête IP), valeurs des classes de service de la RFC 4594
 * (EF 46 pour la voix, CS4 32 pour l'interactif temps réel, CS2 16 pour la gestion, CS1 8 pour ce qui
 * peut attendre) ; CoS 5 pour la voix est l'usage le plus courant. Attention : en 802.1p, la CoS 1
 * (« arrière-plan ») passe APRÈS la CoS 0 (« au mieux »).
 * @type {Record<string, { name: string, short: string, cos: number, dscp: number, phb: string, rank: number, what: string }>}
 */
export const QOS = {
  voix: { name: 'Voix (intercom)', short: 'Voix', cos: 5, dscp: 46, phb: 'EF', rank: 0, what: 'Intercom : une voix hachée s\'entend tout de suite. File prioritaire stricte.' },
  commande: { name: 'Commande et tally', short: 'Commande', cos: 4, dscp: 32, phb: 'CS4', rank: 1, what: 'RCP, pupitre du mélangeur, grille, tally, télécommande de la console : peu de débit, mais il faut que ça réponde tout de suite.' },
  gestion: { name: 'Gestion', short: 'Gestion', cos: 2, dscp: 16, phb: 'CS2', rank: 2, what: 'Supervision (SNMP), heure (NTP), interfaces web des appareils.' },
  donnees: { name: 'Données (au mieux)', short: 'Données', cos: 0, dscp: 0, phb: 'DF', rank: 3, what: 'Le reste : base de clips IPDirector, échanges ordinaires.' },
  fichiers: { name: 'Fichiers et Internet', short: 'Fichiers', cos: 1, dscp: 8, phb: 'CS1', rank: 4, what: 'Copies de fichiers, Internet, invités : ça peut attendre, ça passe en dernier.' },
};
export const QOS_ORDER = Object.keys(QOS).sort((a, b) => QOS[a].rank - QOS[b].rank);

// ---------------- switchs ----------------
/** @typedef {{ id: string, name: string, model: string, where: string, ports: number, sfp: number, l3: boolean, poe: boolean, mgmt: string }} SwitchDef */
/** @type {SwitchDef[]} */
export const SWITCHES = [
  { id: 'core', name: 'SW-CŒUR', model: 'Switch Gigabit administrable de niveau 3 · 24 ports RJ45 + 4 SFP', where: 'Baie « Réseau · Multiview », zone technique', ports: 28, sfp: 4, l3: true, poe: false, mgmt: 'core' },
  { id: 'prod', name: 'SW-PROD', model: 'Switch Gigabit administrable PoE · 24 ports RJ45 + 2 SFP', where: 'Sous les pupitres de la régie production', ports: 26, sfp: 2, l3: false, poe: true, mgmt: 'swprod' },
  { id: 'vision', name: 'SW-VISION', model: 'Switch Gigabit administrable PoE · 24 ports RJ45 + 2 SFP', where: 'Sous les pupitres de la régie vision et ralentis', ports: 26, sfp: 2, l3: false, poe: true, mgmt: 'swvision' },
];
export const swById = (id) => SWITCHES.find((s) => s.id === id) || null;
// liens montants : port du cœur ↔ port du switch d'accès (trunk 802.1Q, 1 Gb/s)
export const UPLINKS = [
  { id: 'up-prod', a: { sw: 'core', n: 25 }, b: { sw: 'prod', n: 25 }, label: 'SW-PROD ↔ SW-CŒUR' },
  { id: 'up-vision', a: { sw: 'core', n: 26 }, b: { sw: 'vision', n: 25 }, label: 'SW-VISION ↔ SW-CŒUR' },
];
const ALL_VLANS = VLANS.map((v) => v.id);

// ---------------- machines ----------------
/**
 * @typedef {object} DevDef
 * @property {string} id
 * @property {string} name nom court (étiquette, tableau)
 * @property {string} role à quoi elle sert dans le car
 * @property {string} kind famille (icône, regroupement)
 * @property {string} zone où elle est dans le car
 * @property {string} sw switch du plan
 * @property {number} port port du plan
 * @property {number} vlan VLAN du plan
 * @property {string} ip adresse du plan
 * @property {string} qos classe du plan
 * @property {boolean} [poe] alimentée par le câble réseau
 * @property {boolean} [ro] réglages non modifiables depuis le poste (routeur de la chaîne, switchs)
 * @property {boolean} [dhcp] adresse obtenue par DHCP dans le plan (invités)
 * @property {string} [wifi] raccordée en Wi-Fi par ce point d'accès
 * @property {{ vlan: number, ip: string }[]} [ifaces] routeur : une interface par VLAN (port en trunk)
 */
/** @type {DevDef[]} */
const DEFS = [];
const def = (o) => { DEFS.push({ qos: vlanById(o.vlan) ? vlanById(o.vlan).qos : 'donnees', ...o }); };
// SW-CŒUR (zone technique)
for (let n = 1; n <= 12; n++) def({ id: 'ccu' + n, name: `CCU ${n}`, role: `Voie caméra ${n} (type HDCU) : reçoit les réglages du RCP ${n} et les transmet à la caméra par la fibre.`, kind: 'ccu', zone: 'Baie CCU', sw: 'core', port: n, vlan: 20, ip: `${BASE}.20.${10 + n}`, qos: 'commande' });
def({ id: 'mixproc', name: 'Mélangeur · processeur', role: 'Processeur du mélangeur (type XVS-6000) : exécute ce que demande le pupitre (« MVS LAN » Gigabit).', kind: 'mixer', zone: 'Baie mélangeur', sw: 'core', port: 13, vlan: 30, ip: `${BASE}.30.10`, qos: 'commande' });
def({ id: 'siu', name: 'Interface tally', role: 'Interface système du mélangeur (type MKS-X7700) : envoie le tally et les noms des sources (UMD) au multiview en TSL UMD sur IP.', kind: 'tally', zone: 'Baie mélangeur', sw: 'core', port: 14, vlan: 30, ip: `${BASE}.30.11`, qos: 'commande' });
def({ id: 'grid', name: 'Grille · contrôleur', role: 'Carte de contrôle de la grille vidéo : reçoit les prises (TAKE) du logiciel et des panneaux.', kind: 'grid', zone: 'Baie grille', sw: 'core', port: 15, vlan: 30, ip: `${BASE}.30.20`, qos: 'commande' });
def({ id: 'gridpc', name: 'PC de la grille', role: 'Ordinateur du logiciel de commande de la grille (prises, salvos, noms des sources).', kind: 'pc', zone: 'Zone technique, poste Grille', sw: 'core', port: 16, vlan: 30, ip: `${BASE}.30.21`, qos: 'commande' });
def({ id: 'mv', name: 'Multiview', role: 'Processeur du multiview : affiche les tally et les noms (UMD) reçus par le réseau sous chaque image.', kind: 'mv', zone: 'Baie « Réseau · Multiview »', sw: 'core', port: 17, vlan: 30, ip: `${BASE}.30.30`, qos: 'commande' });
def({ id: 'evs', name: 'Serveur EVS', role: 'Serveur de ralentis (type XT4K) : son port LAN Gigabit sert à IPDirector (base de clips) et à la gestion.', kind: 'evs', zone: 'Baie EVS', sw: 'core', port: 18, vlan: 40, ip: `${BASE}.40.10`, qos: 'donnees' });
def({ id: 'icmatrix', name: 'Matrice d\'intercom', role: 'Cœur de l\'intercom : relie les panneaux et les beltpacks, en audio sur IP (AES67).', kind: 'icom', zone: 'Baie intercom', sw: 'core', port: 19, vlan: 50, ip: `${BASE}.50.10`, qos: 'voix' });
def({ id: 'audiocore', name: 'Console son · cœur', role: 'Cœur de traitement (DSP) de la console son : la surface le télécommande par le réseau.', kind: 'audio', zone: 'Baie audio', sw: 'core', port: 20, vlan: 50, ip: `${BASE}.50.20`, qos: 'commande' });
def({ id: 'nas', name: 'NAS', role: 'Stockage partagé : modèles d\'habillage, logos, fichiers à envoyer à la chaîne.', kind: 'nas', zone: 'Baie « Réseau · Multiview »', sw: 'core', port: 21, vlan: 60, ip: `${BASE}.60.20`, qos: 'fichiers' });
def({ id: 'spg', name: 'Synchro (SPG)', role: 'Générateur de synchro : son port Ethernet sert à la supervision (SNMP) et donne l\'heure aux machines (serveur NTP).', kind: 'spg', zone: 'Baie synchro', sw: 'core', port: 22, vlan: 10, ip: `${BASE}.10.20`, qos: 'gestion' });
def({ id: 'router', name: 'Routeur · pare-feu', role: 'Sortie vers Internet et la chaîne. Il isole les invités (VLAN 90) de la production. Port en trunk : une interface dans le VLAN 10, une dans le VLAN 90.', kind: 'router', zone: 'Baie transmission', sw: 'core', port: 23, vlan: 10, ip: `${BASE}.10.254`, qos: 'gestion', ro: true, ifaces: [{ vlan: 10, ip: `${BASE}.10.254` }, { vlan: 90, ip: `${BASE}.90.1` }] });
def({ id: 'prism', name: 'Mesure', role: 'Instrument de mesure vidéo (moniteur de forme d\'onde) : interface web et mises à jour par le réseau.', kind: 'mesure', zone: 'Baie de mesure', sw: 'core', port: 24, vlan: 10, ip: `${BASE}.10.21`, qos: 'gestion' });
// SW-PROD (régie production et son)
def({ id: 'mixpanel', name: 'Mélangeur · pupitre', role: 'Pupitre du truquiste (type ICP-X7000) : chaque touche part en commande vers le processeur.', kind: 'mixer', zone: 'Régie production', sw: 'prod', port: 1, vlan: 30, ip: `${BASE}.30.12`, qos: 'commande', poe: false });
def({ id: 'icpreal', name: 'Intercom réalisateur', role: 'Panneau d\'intercom du réalisateur (audio sur IP, alimenté par le câble : PoE).', kind: 'icom', zone: 'Régie production', sw: 'prod', port: 2, vlan: 50, ip: `${BASE}.50.21`, qos: 'voix', poe: true });
def({ id: 'icpson', name: 'Intercom son', role: 'Panneau d\'intercom de la cabine son (PoE).', kind: 'icom', zone: 'Cabine son', sw: 'prod', port: 3, vlan: 50, ip: `${BASE}.50.22`, qos: 'voix', poe: true });
def({ id: 'audiosurf', name: 'Console son · surface', role: 'Surface de la console son : faders et écrans, elle pilote le cœur DSP par le réseau.', kind: 'audio', zone: 'Cabine son', sw: 'prod', port: 4, vlan: 50, ip: `${BASE}.50.30`, qos: 'commande' });
def({ id: 'gfxpc', name: 'PC d\'habillage', role: 'Moteur graphique de l\'habillage : charge ses modèles et ses logos sur le NAS.', kind: 'pc', zone: 'Régie production', sw: 'prod', port: 5, vlan: 60, ip: `${BASE}.60.10`, qos: 'fichiers' });
def({ id: 'supv', name: 'PC de supervision', role: 'Ordinateur du chef de car : surveille toutes les machines (ping, SNMP) et ouvre leurs interfaces web. Il passe par la passerelle pour joindre les autres VLAN.', kind: 'pc', zone: 'Poste du chef de car', sw: 'prod', port: 6, vlan: 10, ip: `${BASE}.10.50`, qos: 'gestion' });
def({ id: 'ap', name: 'Point d\'accès Wi-Fi', role: 'Borne Wi-Fi des invités et des portables (PoE) : ses clients arrivent dans le VLAN 90.', kind: 'wifi', zone: 'Plafond de la régie', sw: 'prod', port: 7, vlan: 90, ip: `${BASE}.90.2`, qos: 'fichiers', poe: true });
def({ id: 'guest', name: 'Portable invité', role: 'Ordinateur d\'un invité (commentateur, journaliste) en Wi-Fi : il prend son adresse par DHCP et ne voit qu\'Internet.', kind: 'laptop', zone: 'Wi-Fi', sw: 'prod', port: 7, vlan: 90, ip: '', qos: 'fichiers', dhcp: true, wifi: 'ap' });
// SW-VISION (régie vision et ralentis)
for (let n = 1; n <= 12; n++) def({ id: 'rcp' + n, name: `RCP ${n}`, role: `Pupitre de réglage de la caméra ${n} : iris, noir, couleurs. Il parle à la CCU ${n} par le réseau et il est alimenté par le câble (PoE).`, kind: 'rcp', zone: 'Régie vision', sw: 'vision', port: n, vlan: 20, ip: `${BASE}.20.${30 + n}`, qos: 'commande', poe: true });
def({ id: 'ipd', name: 'IPDirector', role: 'Poste IPDirector : nomme, indexe et range les clips des serveurs EVS.', kind: 'pc', zone: 'Régie ralentis', sw: 'vision', port: 13, vlan: 40, ip: `${BASE}.40.20`, qos: 'donnees' });
def({ id: 'icpvision', name: 'Intercom vision', role: 'Panneau d\'intercom de la régie vision (PoE).', kind: 'icom', zone: 'Régie vision', sw: 'vision', port: 14, vlan: 50, ip: `${BASE}.50.23`, qos: 'voix', poe: true });
// les switchs : leur adresse d'administration (dans le VLAN de gestion)
def({ id: 'core', name: 'SW-CŒUR', role: 'Switch de cœur, de niveau 3 : il relie les deux switchs d\'accès et route entre les VLAN (il porte la passerelle .1 de chacun).', kind: 'switch', zone: 'Baie « Réseau · Multiview »', sw: 'core', port: 0, vlan: 10, ip: `${BASE}.10.1`, qos: 'gestion', ro: true });
def({ id: 'swprod', name: 'SW-PROD', role: 'Switch d\'accès de la régie production et de la cabine son (PoE).', kind: 'switch', zone: 'Régie production', sw: 'prod', port: 0, vlan: 10, ip: `${BASE}.10.2`, qos: 'gestion', ro: true });
def({ id: 'swvision', name: 'SW-VISION', role: 'Switch d\'accès de la régie vision et ralentis (PoE).', kind: 'switch', zone: 'Régie vision', sw: 'vision', port: 0, vlan: 10, ip: `${BASE}.10.3`, qos: 'gestion', ro: true });
export const DEVS = DEFS;
export const devById = (id) => DEFS.find((d) => d.id === id) || null;
// MAC fictives, administrées localement (2e chiffre hexadécimal = 2) : 3 octets « fabricant » puis 3 octets de série
const MAC = {};
DEFS.forEach((d, i) => { let h = 2166136261; for (const ch of d.id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; const b = [0x02, 0xca, 0x12 + (i % 5), (h >>> 16) & 255, (h >>> 8) & 255, (h + i) & 255]; MAC[d.id] = b.map((x) => x.toString(16).padStart(2, '0').toUpperCase()).join(':'); });
export const macOf = (id) => MAC[id] || '';
// serveur de la chaîne, sur Internet (plage réservée à la documentation, RFC 5737)
export const CHAINE = { id: 'chaine', name: 'Serveur de la chaîne (Internet)', ip: '203.0.113.10' };

/**
 * Fonctions du car qui passent par le réseau : si l'une tombe, l'opérateur concerné le signale.
 * @typedef {{ key: string, a: string, b: string, label: string, who: string, lost: string, station: string, rate: number, back?: number, cls: string }} Func
 * @type {Func[]}
 */
export const FUNCS = [
  ...Array.from({ length: 12 }, (_, i) => ({ key: 'cam' + (i + 1), a: 'rcp' + (i + 1), b: 'ccu' + (i + 1), label: `RCP ${i + 1} → CCU ${i + 1} (réglages de la caméra ${i + 1})`, who: 'VISION', lost: `Je n'ai plus la main sur la caméra ${i + 1} au RCP !`, station: 'vision', rate: 0.3, cls: 'commande' })),
  { key: 'mixer', a: 'mixpanel', b: 'mixproc', label: 'Pupitre → processeur du mélangeur', who: 'TRUQUISTE', lost: 'Le pupitre du mélangeur ne répond plus !', station: 'melangeur', rate: 2, cls: 'commande' },
  { key: 'tally', a: 'siu', b: 'mv', label: 'Tally et noms (TSL UMD) → multiview', who: 'RÉALISATEUR', lost: 'Plus de tally ni de noms sous les images du multiview !', station: 'realisateur', rate: 0.2, cls: 'commande' },
  { key: 'grille', a: 'gridpc', b: 'grid', label: 'Logiciel de grille → grille', who: 'GRILLE', lost: 'Le logiciel ne joint plus la grille : mes prises ne passent plus !', station: 'grille', rate: 0.2, cls: 'commande' },
  { key: 'evs', a: 'ipd', b: 'evs', label: 'IPDirector → serveur EVS', who: 'RALENTIS', lost: 'IPDirector ne voit plus le serveur EVS !', station: 'ipdirector', rate: 5, back: 40, cls: 'donnees' },
  { key: 'icom-real', a: 'icpreal', b: 'icmatrix', label: 'Intercom du réalisateur → matrice', who: 'RÉALISATEUR', lost: 'Mon panneau d\'intercom est muet !', station: 'intercom', rate: 4, cls: 'voix' },
  { key: 'icom-son', a: 'icpson', b: 'icmatrix', label: 'Intercom de la cabine son → matrice', who: 'SON', lost: 'Plus d\'intercom dans la cabine son !', station: 'intercom', rate: 4, cls: 'voix' },
  { key: 'icom-vision', a: 'icpvision', b: 'icmatrix', label: 'Intercom de la vision → matrice', who: 'VISION', lost: 'Le panneau d\'intercom de la vision est muet !', station: 'intercom', rate: 4, cls: 'voix' },
  { key: 'son', a: 'audiosurf', b: 'audiocore', label: 'Surface → cœur de la console son', who: 'SON', lost: 'La surface ne pilote plus le cœur de la console !', station: 'son', rate: 6, cls: 'commande' },
  { key: 'gfx', a: 'gfxpc', b: 'nas', label: 'PC d\'habillage → NAS', who: 'HABILLAGE', lost: 'Je n\'accède plus aux fichiers du NAS !', station: 'habillage', rate: 2, back: 20, cls: 'fichiers' },
  { key: 'wifi', a: 'guest', b: 'chaine', label: 'Wi-Fi des invités → Internet', who: 'INVITÉ', lost: 'Plus d\'Internet sur le Wi-Fi.', station: 'reseau', rate: 5, back: 30, cls: 'fichiers' },
];
export const funcByKey = (k) => FUNCS.find((f) => f.key === k) || null;
export const funcsOf = (id) => FUNCS.filter((f) => f.a === id || f.b === id);
// copie de fichiers (NAS → PC d'habillage) : TCP remplit tout ce qu'on lui laisse
const COPY = { a: 'nas', b: 'gfxpc', rate: 1000, cls: 'fichiers' };

// ---------------- état ----------------
/** @typedef {{ sw: string, port: number, ip: string, prefix: number, gw: string, qos: string, dhcp: boolean }} DevCfg */
/** @typedef {{ mode: 'access' | 'trunk', vlan: number, allowed: number[], cable: boolean, enabled: boolean }} PortCfg */
export const CN = {
  ver: 0,
  /** @type {Record<string, DevCfg>} */ m: {},
  /** @type {Record<string, PortCfg>} */ p: {},
  /** @type {Record<string, { qos: boolean }>} */ sw: {},
  copy: false,
  /** @type {any} */ res: null,
  resVer: -1,
  /** @type {Record<string, string>} */ funcState: {},
  // où en est l'interface du poste (lu par le chef de car, réglé par lui pour « Emmène-moi »)
  view: { tab: 'topo', dev: 'rcp1', sw: 'core', src: 'supv', dst: 'ccu1', arpVlan: 20, macSw: 'core', filter: 'all' },
  /** @type {any} */ lastPing: null,
  /** @type {any} */ lastSweep: null,
};
const pk = (sw, n) => `${sw}:${n}`;
export const portKey = pk;
const planPort = (sw, n) => {
  const up = UPLINKS.find((u) => (u.a.sw === sw && u.a.n === n) || (u.b.sw === sw && u.b.n === n));
  if (up) return { mode: 'trunk', vlan: 1, allowed: [...ALL_VLANS], cable: true, enabled: true };
  const d = DEFS.find((x) => x.sw === sw && x.port === n && !x.wifi);
  if (!d) return { mode: 'access', vlan: 1, allowed: [], cable: false, enabled: true };
  if (d.ifaces) return { mode: 'trunk', vlan: 1, allowed: d.ifaces.map((f) => f.vlan), cable: true, enabled: true };
  return { mode: 'access', vlan: d.vlan, allowed: [], cable: true, enabled: true };
};
const planDev = (d) => ({ sw: d.sw, port: d.port, ip: d.ip, prefix: PREFIX, gw: d.wifi || d.ifaces ? '' : vlanById(d.vlan).gw, qos: d.qos, dhcp: !!d.dhcp });
/** remet tout le réseau selon le plan (sans pannes) */
export function resetCtrlNet(quiet = true) {
  CN.m = {}; CN.p = {}; CN.sw = {};
  for (const d of DEFS) CN.m[d.id] = planDev(d);
  for (const s of SWITCHES) { CN.sw[s.id] = { qos: true }; for (let n = 1; n <= s.ports; n++) CN.p[pk(s.id, n)] = /** @type {PortCfg} */ (planPort(s.id, n)); }
  CN.copy = false; CN.lastPing = null; CN.lastSweep = null;
  changed({ quiet, why: 'reset' });
}
/** remet une machine (et son port) selon le plan */
export function resetDevice(id, quiet = false) {
  const d = devById(id); if (!d) return;
  const cur = CN.m[id];
  if (cur && cur.port && (cur.sw !== d.sw || cur.port !== d.port)) CN.p[pk(cur.sw, cur.port)] = /** @type {PortCfg} */ (planPort(cur.sw, cur.port));
  CN.m[id] = planDev(d);
  if (d.port && !d.wifi) CN.p[pk(d.sw, d.port)] = /** @type {PortCfg} */ (planPort(d.sw, d.port));
  changed({ quiet, why: 'reset-dev', dev: id });
}
export const planOf = (id) => { const d = devById(id); return d ? planDev(d) : null; };
/**
 * mode « Tout à faire » : les RCP et les CCU sortent du carton avec leur adresse d'usine
 * (192.168.0.x, sans passerelle) ; il faut leur donner l'adresse du plan pour que chaque RCP
 * reprenne la main sur sa caméra
 */
export function factoryCtrlNet() {
  resetCtrlNet(true);
  for (let n = 1; n <= 12; n++) {
    for (const [id, k] of /** @type {[string, number][]} */ ([['rcp' + n, 100], ['ccu' + n, 10]])) if (CN.m[id]) Object.assign(CN.m[id], { ip: `192.168.0.${k + n}`, prefix: 24, gw: '', dhcp: false });
  }
  changed({ quiet: true, why: 'factory' });
}
export const planPortOf = (sw, n) => planPort(sw, n);

// ---------------- événements ----------------
/** note une action : pour le chef de car (journal « netlog ») et pour les autres postes (« ctrlnet ») */
export function note(ev, o = {}) { emit('netlog', { type: 'ctrlnet', ev, ...o }); emit('ctrlnet', { type: ev, ...o }); }
function changed(o = {}) {
  CN.ver++;
  const R = evaluate();
  // fonctions du car perdues ou rétablies : l'opérateur concerné le signale (sauf réglage silencieux)
  for (const f of FUNCS) {
    const st = R.funcs[f.key].state, was = CN.funcState[f.key];
    CN.funcState[f.key] = st;
    if (was === undefined || was === st || S.ipMode) continue;
    if (st !== 'ok' && (was === 'ok')) emit('ctrlnet', { type: 'lost', func: f.key, who: f.who, msg: st === 'degrade' ? degradedMsg(f, R) : f.lost, state: st, why: R.funcs[f.key].why, quiet: !!o.quiet });
    else if (st === 'ok') emit('ctrlnet', { type: 'back', func: f.key, who: f.who, quiet: !!o.quiet });
  }
  emit('ctrlnet', { type: 'change', ...o });
}
const degradedMsg = (f, R) => (f.cls === 'voix' ? `L'intercom hache (${Math.round(R.funcs[f.key].loss * 100)} % de paquets perdus) !` : `${f.label} : ça rame, des commandes se perdent.`);

// ---------------- réglages (ce que l'on change au poste) ----------------
/**
 * règle une machine ; les champs absents ne changent pas. Accepte toute configuration syntaxiquement
 * valide (comme une vraie machine) : les erreurs de plan se voient ensuite au diagnostic et au ping.
 * @param {string} id @param {Partial<DevCfg>} cfg @param {{ quiet?: boolean }} [o]
 * @returns {{ ok: boolean, errors: Record<string, string> }}
 */
export function setDevice(id, cfg, o = {}) {
  const d = devById(id); const cur = CN.m[id];
  if (!d || !cur) return { ok: false, errors: { _: 'Machine inconnue.' } };
  const errors = checkFields({ ...cur, ...cfg, ip: cfg.ip ?? cur.ip, mask: cfg.prefix != null ? String(cfg.prefix) : String(cur.prefix), gw: cfg.gw ?? cur.gw }, !!(cfg.dhcp ?? cur.dhcp));
  if (Object.keys(errors).length) return { ok: false, errors };
  Object.assign(cur, cfg);
  changed({ ...o, why: 'device', dev: id });
  return { ok: true, errors: {} };
}
/**
 * contrôle de saisie de la fiche d'une machine (champs texte) : formats seulement
 * @param {{ ip?: string, mask?: string, gw?: string }} f @param {boolean} dhcp
 * @returns {Record<string, string>}
 */
export function checkFields(f, dhcp = false) {
  /** @type {Record<string, string>} */
  const e = {};
  if (dhcp) return e;
  if (parseIp(f.ip) == null) e.ip = 'Une adresse IPv4 s\'écrit en quatre nombres de 0 à 255 séparés par des points, par exemple 10.1.20.33.';
  const p = parseMask(f.mask);
  if (p == null) e.mask = 'Masque incohérent : les bits à 1 doivent être à gauche, d\'un seul tenant (255.255.255.0, 255.255.0.0, 255.255.255.240…), ou un préfixe /0 à /32.';
  else if (p < 8 || p > 30) e.mask = 'Préfixe hors d\'usage pour une machine : entre /8 et /30 (ici, /24).';
  if (f.gw && String(f.gw).trim() && parseIp(f.gw) == null) e.gw = 'La passerelle est une adresse IPv4 (par exemple 10.1.20.1), ou rien.';
  if (!e.ip && p != null && !e.mask) {
    const n = parseIp(f.ip);
    if (n === netOf(n, p)) e.ip = `${f.ip} est l'adresse du réseau lui-même (${ipStr(netOf(n, p))}/${p}) : aucune machine ne peut la prendre.`;
    else if (n === bcastOf(n, p)) e.ip = `${f.ip} est l'adresse de diffusion du réseau (tous les appareils à la fois) : aucune machine ne peut la prendre.`;
  }
  return e;
}
/** @param {string} sw @param {number} n @param {Partial<PortCfg>} cfg @param {{ quiet?: boolean }} [o] */
export function setPort(sw, n, cfg, o = {}) {
  const p = CN.p[pk(sw, n)]; if (!p) return false;
  if (cfg.allowed) cfg = { ...cfg, allowed: [...new Set(cfg.allowed.filter((v) => v >= 1 && v <= 4094))].sort((a, b) => a - b) };
  if (cfg.vlan != null && !(cfg.vlan >= 1 && cfg.vlan <= 4094)) return false;
  Object.assign(p, cfg);
  changed({ ...o, why: 'port', sw, n });
  return true;
}
/** le VLAN d'une machine se règle sur le port du switch où elle est branchée (port access) */
export function setDeviceVlan(id, vlan, o = {}) {
  const at = attachPort(id); if (!at) return false;
  return setPort(at.sw, at.n, { vlan }, o);
}
/** brancher la machine sur un autre port (même switch ou autre) */
export function moveDevice(id, sw, n, o = {}) {
  const cur = CN.m[id]; if (!cur || !CN.p[pk(sw, n)]) return false;
  if (cur.port && !devById(id).wifi) { const old = CN.p[pk(cur.sw, cur.port)]; if (old) old.cable = false; }
  cur.sw = sw; cur.port = n; CN.p[pk(sw, n)].cable = true;
  changed({ ...o, why: 'move', dev: id });
  return true;
}
export function setSwitchQos(sw, on, o = {}) { if (!CN.sw[sw]) return false; CN.sw[sw].qos = !!on; changed({ ...o, why: 'qos', sw }); return true; }
export function setCopy(on, o = {}) { CN.copy = !!on; changed({ ...o, why: 'copy' }); note('copy', { on: CN.copy }); }
/** l'interface du poste suit (chef de car : « Emmène-moi », « Fais-le pour moi ») */
export function ctrlGo(v) { Object.assign(CN.view, v); note('go', { ...v }); }

// ---------------- topologie ----------------
/** port où la machine est branchée (le point d'accès pour une machine en Wi-Fi) */
export function attachPort(id) {
  const d = devById(id), c = CN.m[id]; if (!d || !c) return null;
  if (d.wifi) { const a = CN.m[d.wifi]; return { sw: a.sw, n: a.port, via: d.wifi }; }
  if (!c.port) return null; // switch : son processeur interne
  return { sw: c.sw, n: c.port };
}
export const portOf = (sw, n) => CN.p[pk(sw, n)];
/** machine branchée sur un port (hors Wi-Fi), ou lien montant */
export function portUse(sw, n) {
  const up = UPLINKS.find((u) => (u.a.sw === sw && u.a.n === n) || (u.b.sw === sw && u.b.n === n));
  if (up) { const o = up.a.sw === sw ? up.b : up.a; return { uplink: up, peer: o }; }
  const id = Object.keys(CN.m).find((k) => !devById(k).wifi && CN.m[k].sw === sw && CN.m[k].port === n);
  return id ? { dev: id } : null;
}
const portUp = (p) => !!(p && p.cable && p.enabled);
/** le port transporte ce VLAN (access : son VLAN ; trunk : VLAN autorisés, ou natif sans étiquette) */
export const carries = (p, v) => (p.mode === 'trunk' ? p.allowed.includes(v) || p.vlan === v : p.vlan === v);
/** VLAN des trames sans étiquette envoyées par la machine (celui du port, ou du point d'accès) */
export function vlanOfDev(id) {
  const d = devById(id); if (!d) return null;
  if (!CN.m[id].port && !d.wifi) return 10; // switch : interface d'administration dans le VLAN de gestion
  const at = attachPort(id); const p = at && portOf(at.sw, at.n);
  return p ? p.vlan : null;
}
// lien montant utilisable dans un VLAN : les deux ports actifs, câble branché, VLAN transporté des deux côtés
function upOk(u, v) { const a = portOf(u.a.sw, u.a.n), b = portOf(u.b.sw, u.b.n); return portUp(a) && portUp(b) && carries(a, v) && carries(b, v); }
/** les deux switchs sont reliés dans ce VLAN (étoile autour du cœur) */
export function swLinked(a, b, v) {
  if (a === b) return true;
  const C = cache(); const k = a + '|' + b + '|' + v;
  let r = C.swl.get(k);
  if (r === undefined) { const ok = (sw) => sw === 'core' || UPLINKS.some((u) => (u.b.sw === sw || u.a.sw === sw) && upOk(u, v)); r = ok(a) && ok(b); C.swl.set(k, r); }
  return r;
}
const linkUpRaw = (id) => {
  const d = devById(id); if (!CN.m[id].port && !d.wifi) return true;
  if (d.wifi && !linkUpRaw(d.wifi)) return false;
  const at = attachPort(id); return portUp(portOf(at.sw, at.n));
};
/** le lien physique de la machine est monté (câble, port actif ; pour le Wi-Fi : celui du point d'accès) */
export const linkUp = (id) => { const C = cache(); let r = C.up[id]; if (r === undefined) r = C.up[id] = linkUpRaw(id); return r; };
// ---------------- cache : rien n'est recalculé tant que la configuration ne change pas (CN.ver) ----------------
/** @type {{ ver: number, up: Record<string, boolean>, ifs: Record<string, any[]>, swl: Map<string, boolean>, idx: Map<string, { id: string, sw: string, router?: string }[]> | null }} */
const TC = { ver: -1, up: {}, ifs: {}, swl: new Map(), idx: null };
function cache() { if (TC.ver !== CN.ver) { TC.ver = CN.ver; TC.up = {}; TC.ifs = {}; TC.swl = new Map(); TC.idx = null; } return TC; }
/** pourquoi le lien physique de la machine ne monte pas (ou '') */
export function linkWhy(id) {
  const d = devById(id); if (!d) return '';
  if (d.wifi && !linkUp(d.wifi)) return `son point d'accès Wi-Fi (${devById(d.wifi).name}) n'est plus raccordé`;
  const at = attachPort(id); if (!at || d.wifi) return '';
  const p = portOf(at.sw, at.n), S2 = swById(at.sw);
  if (!p.cable) return `câble débranché (${S2.name}, port ${at.n})`;
  if (!p.enabled) return `port désactivé sur le switch (${S2.name}, port ${at.n} en shutdown)`;
  return '';
}

// ---------------- adresses effectives (DHCP) ----------------
/** interfaces IP de la machine : { vlan, ip (nombre), prefix, gw (nombre | null), str } */
export function ifacesOf(id) {
  const C = cache(); let r = C.ifs[id];
  if (!r) r = C.ifs[id] = ifacesRaw(id);
  return r;
}
function ifacesRaw(id) {
  const d = devById(id), c = CN.m[id]; if (!d || !c) return [];
  if (d.ifaces) return d.ifaces.map((f) => ({ vlan: f.vlan, ip: parseIp(f.ip), prefix: PREFIX, gw: null, str: f.ip }));
  const v = vlanOfDev(id);
  if (c.dhcp) { const l = leaseOf(id); return [{ vlan: v, ip: parseIp(l.ip), prefix: l.prefix, gw: l.gw ? parseIp(l.gw) : null, str: l.ip, dhcp: l }]; }
  const ip = parseIp(c.ip);
  return ip == null ? [] : [{ vlan: v, ip, prefix: c.prefix, gw: c.gw ? parseIp(c.gw) : null, str: c.ip }];
}
/** bail DHCP : un serveur (le routeur, dans le VLAN 90) doit être joignable dans le VLAN de la machine */
export function leaseOf(id) {
  const v = vlanOfDev(id); const at = attachPort(id);
  const srv = DEFS.find((d) => d.ifaces && d.ifaces.some((f) => f.vlan === v) && vlanById(v) && vlanById(v).dhcp);
  const ok = srv && at && linkUp(id) && linkUp(srv.id) && swLinked(at.sw, CN.m[srv.id].sw, v) && carries(portOf(CN.m[srv.id].sw, CN.m[srv.id].port), v);
  const i = DEFS.findIndex((d) => d.id === id);
  if (!ok) return { ip: `169.254.${(i * 7) % 250 + 1}.${(i * 13) % 250 + 2}`, prefix: 16, gw: '', server: '', apipa: true };
  return { ip: `${BASE}.${v}.${DHCP_POOL[0] + (i % 50)}`, prefix: PREFIX, gw: vlanById(v).gw, server: srv.id, apipa: false };
}
/** adresse principale effective de la machine (texte) */
export const ipOf = (id) => { const f = ifacesOf(id)[0]; return f ? f.str : ''; };

// ---------------- acheminement d'un paquet ----------------
// routeurs : le cœur (une interface VLAN par VLAN, route par défaut vers le routeur) et le routeur / pare-feu
const SVIS = VLANS.filter((v) => v.gwOn === 'core').map((v) => ({ vlan: v.id, ip: parseIp(v.gw), prefix: PREFIX }));
const coreSvis = () => SVIS;
const INTERNAL = { net: parseIp('10.0.0.0'), prefix: 8 };
const isInternal = (ip) => sameNet(ip, INTERNAL.net, INTERNAL.prefix);
const nameOf = (id) => (id === 'chaine' ? CHAINE.name : id === 'core@' ? 'SW-CŒUR (routage)' : devById(id) ? devById(id).name : id);

/**
 * qui répond à l'ARP pour `ip` dans le VLAN `v`, vu depuis le switch `fromSw` : machines et
 * interfaces de routeur joignables à travers les switchs dans ce VLAN
 * @returns {{ id: string, router?: string }[]}
 */
function arpWho(fromSw, v, ip) {
  const C = cache();
  if (!C.idx) {
    // annuaire « VLAN | adresse » → qui peut répondre (machines branchées, interfaces de routeur)
    const idx = new Map(); const put = (k, o) => { const l = idx.get(k); if (l) l.push(o); else idx.set(k, [o]); };
    for (const d of DEFS) {
      if (d.id === 'core' || !linkUp(d.id)) continue; // le cœur répond par ses interfaces VLAN (ci-dessous)
      for (const f of ifacesOf(d.id)) {
        if (f.ip == null) continue;
        // switch d'accès : son interface d'administration est dans le switch lui-même
        if (d.kind === 'switch') { put(f.vlan + '|' + f.ip, { id: d.id, sw: CN.m[d.id].sw }); continue; }
        const at = attachPort(d.id); if (!at) continue;
        const p = portOf(at.sw, at.n);
        if (d.ifaces ? !p.allowed.includes(f.vlan) : !carries(p, f.vlan)) continue;
        put(f.vlan + '|' + f.ip, { id: d.id, sw: at.sw, router: d.ifaces ? d.id : undefined });
      }
    }
    // le cœur : son interface VLAN (passerelle .1 du VLAN), dans le switch de cœur
    for (const s of coreSvis()) put(s.vlan + '|' + s.ip, { id: 'core@', sw: 'core', router: 'core' });
    C.idx = idx;
  }
  return (C.idx.get(v + '|' + ip) || []).filter((o) => swLinked(fromSw, o.sw, v)).map((o) => ({ id: o.id, router: o.router }));
}
/** switch où se trouve une machine (celui de son port, du point d'accès, ou le switch lui-même) */
export function swOf(id) { if (id === 'core@' || id === 'chaine') return 'core'; const at = attachPort(id); return at ? at.sw : CN.m[id] ? CN.m[id].sw : 'core'; }

/** @typedef {{ ok: boolean, to?: string, hops: string[], why?: string, fix?: string, unstable?: string[] }} Sent résultat de l'envoi d'un paquet */
/**
 * envoie un paquet de la machine `src` vers l'adresse `dst` (nombre)
 * @returns {Sent}
 */
export function send(src, dst) {
  const hops = [nameOf(src)];
  const fail = (why, fix = '') => ({ ok: false, hops, why, fix });
  if (!linkUp(src)) return fail(`${nameOf(src)} : ${linkWhy(src) || 'lien coupé'}`, 'Couche 1 : vérifier le câble et le voyant du port.');
  const fs = ifacesOf(src);
  if (!fs.length) return fail(`${nameOf(src)} n'a pas d'adresse IP valide.`, 'Régler l\'adresse dans sa fiche.');
  const d = devById(src);
  let f = fs[0];
  if (d.ifaces) { const g = fs.find((x) => sameNet(dst, x.ip, x.prefix)); if (g) f = g; }
  const fromSw = swOf(src);
  if (f.str.startsWith('169.254.')) return fail(`${nameOf(src)} n'a pas obtenu d'adresse par DHCP (adresse automatique ${f.str}) : aucun serveur DHCP ne répond dans le VLAN ${f.vlan}.`, 'Passer la machine en adresse fixe, ou la brancher dans un VLAN qui a un serveur DHCP.');
  const local = sameNet(dst, f.ip, f.prefix);
  let nh = dst;
  if (!local) {
    if (d.ifaces) return routeFrom(src, f.vlan, dst, hops, 0);
    if (f.gw == null) return fail(`${ipStr(dst)} est hors du sous-réseau de la machine (${ipStr(netOf(f.ip, f.prefix))}/${f.prefix}), et elle n'a pas de passerelle.`, 'Régler la passerelle (.1 de son VLAN).');
    if (!sameNet(f.gw, f.ip, f.prefix)) return fail(`La passerelle ${ipStr(f.gw)} n'est pas dans le sous-réseau de la machine (${ipStr(netOf(f.ip, f.prefix))}/${f.prefix}) : elle ne sait pas la joindre.`, 'Vérifier le masque et la passerelle.');
    nh = f.gw;
  }
  const who = arpWho(fromSw, f.vlan, nh);
  if (!who.length) {
    if (local) return fail(`Dans le VLAN ${f.vlan}, personne ne répond à l'ARP « qui a ${ipStr(nh)} ? » : la machine visée n'est pas dans ce VLAN, ou pas joignable.`, 'Vérifier le VLAN des deux ports et l\'adresse de la machine visée.');
    return fail(`La passerelle ${ipStr(nh)} ne répond pas dans le VLAN ${f.vlan} : ce n'est pas la passerelle de ce VLAN, ou le port de la machine n'est pas dans le bon VLAN.`, 'La passerelle d\'un VLAN est son adresse .1 (interface VLAN du cœur).');
  }
  const unstable = who.length > 1 ? who.map((w) => w.id) : undefined;
  const w = who[0];
  hops.push(swPath(fromSw, swOf(w.id), f.vlan));
  if (!local || w.router) {
    if (!w.router) return fail(`${ipStr(nh)} répond, mais c'est ${nameOf(w.id)}, pas un routeur.`, 'Vérifier la passerelle.');
    const r = routeFrom(w.router === 'core' ? 'core@' : w.router, f.vlan, dst, hops, 0);
    if (unstable) r.unstable = unstable;
    return r;
  }
  hops.push(nameOf(w.id));
  return { ok: true, to: w.id, hops, unstable };
}
const swPath = (a, b, v) => (a === b ? `${swById(a).name} (VLAN ${v})` : `${swById(a).name} → lien montant (trunk, VLAN ${v}) → ${swById(b).name}`);

/**
 * le paquet est arrivé dans un routeur (`r` = 'core@' ou 'router') par le VLAN `inV` (0 : depuis Internet)
 * @returns {Sent}
 */
function routeFrom(r, inV, dst, hops, depth) {
  const fail = (why, fix = '') => ({ ok: false, hops, why, fix });
  if (depth > 4) return fail('Boucle de routage.');
  const NET90 = parseIp(`${BASE}.90.0`);
  if (r === 'core@') {
    hops.push('SW-CŒUR : routage');
    if (coreSvis().some((s) => s.ip === dst)) return { ok: true, to: 'core@', hops };
    const svi = coreSvis().find((s) => sameNet(dst, s.ip, s.prefix));
    if (svi) return deliver('core', svi.vlan, dst, hops, 'SW-CŒUR');
    // route par défaut : le routeur / pare-feu (10.1.10.254, VLAN 10)
    const who = arpWho('core', 10, parseIp(`${BASE}.10.254`)).filter((w) => w.router === 'router');
    if (!who.length) return fail('Le cœur n\'a plus de chemin vers le routeur (route par défaut vers 10.1.10.254 injoignable).', 'Vérifier le port du routeur (trunk, VLAN 10 et 90).');
    hops.push('route par défaut → Routeur · pare-feu');
    return routeFrom('router', 10, dst, hops, depth + 1);
  }
  // routeur / pare-feu : il isole les invités (VLAN 90) de la production, dans les deux sens
  hops.push('Routeur · pare-feu');
  const to90 = sameNet(dst, NET90, PREFIX);
  if (inV === 90 && isInternal(dst) && !to90) return fail('Le pare-feu bloque : le VLAN des invités n\'a pas accès à la production.', 'C\'est voulu : les invités ne voient qu\'Internet.');
  if (devById('router').ifaces.some((f) => parseIp(f.ip) === dst)) return { ok: true, to: 'router', hops };
  if (to90) {
    if (inV !== 90 && inV !== 0) return fail('Le pare-feu bloque : la production ne parle pas aux machines des invités.', 'C\'est voulu : le VLAN 90 est isolé.');
    return deliver('core', 90, dst, hops, 'Le routeur', 'router');
  }
  if (sameNet(dst, parseIp(`${BASE}.10.0`), PREFIX)) return deliver('core', 10, dst, hops, 'Le routeur', 'router');
  if (isInternal(dst)) {
    // vers les autres VLAN de la production : par le cœur (route 10.1.0.0/16 via 10.1.10.1)
    if (!arpWho(swOf('router'), 10, parseIp(`${BASE}.10.1`)).length) return fail('Le routeur ne joint plus le cœur (10.1.10.1) dans le VLAN 10.');
    hops.push('route 10.1.0.0/16 → SW-CŒUR (10.1.10.1)');
    return routeFrom('core@', 10, dst, hops, depth + 1);
  }
  if (inV === 0) return fail(`Aucune route vers ${ipStr(dst)}.`);
  if (dst === parseIp(CHAINE.ip)) { hops.push('Internet', CHAINE.name); return { ok: true, to: 'chaine', hops }; }
  return fail(`Personne ne répond à ${ipStr(dst)} sur Internet.`);
}
/**
 * dernier saut : le routeur cherche la machine par ARP dans le VLAN de sortie
 * @returns {Sent}
 */
function deliver(fromSw, v, dst, hops, rname, routerId = '') {
  const sw = routerId ? swOf(routerId) : fromSw;
  const who = arpWho(sw, v, dst).filter((w) => w.id !== routerId && w.id !== 'core@');
  if (!who.length) return { ok: false, hops, why: `${rname} envoie vers le VLAN ${v}, mais personne n'y répond à l'ARP pour ${ipStr(dst)} : la machine visée n'est pas dans ce VLAN, ou pas branchée.`, fix: 'Vérifier le VLAN du port de la machine visée et son adresse.' };
  const w = who[0];
  hops.push(swPath(sw, swOf(w.id), v), nameOf(w.id));
  return { ok: true, to: w.id, hops, unstable: who.length > 1 ? who.map((x) => x.id) : undefined };
}

/**
 * ping de la machine a vers b (identifiant de machine, 'chaine', ou adresse IP saisie)
 * @returns {{ state: 'ok' | 'instable' | 'echec', ok: boolean, a: string, b: string, dstIp: string, req: any, rep: any, why: string, fix: string, hops: string[], answered?: string[] }}
 */
export function ping(a, b) {
  const dstStr = b === 'chaine' ? CHAINE.ip : devById(b) ? ipOf(b) : String(b);
  const dst = parseIp(dstStr);
  const base = { a, b, dstIp: dstStr, req: null, rep: null, hops: [] };
  if (!devById(a)) return { ...base, state: 'echec', ok: false, why: 'Source inconnue.', fix: '' };
  if (dst == null) return { ...base, state: 'echec', ok: false, why: `${nameOf(b)} n'a pas d'adresse IP valide.`, fix: 'Régler son adresse dans sa fiche.' };
  const req = send(a, dst);
  if (!req.ok) return { ...base, req, state: 'echec', ok: false, why: req.why, fix: req.fix || '', hops: req.hops };
  const target = devById(b) || b === 'chaine' ? b : req.to;
  // la réponse part de la machine qui a reçu la demande, avec SA configuration, vers l'adresse de a
  const fa = ifacesOf(a); const srcF = fa.find((f) => sameNet(dst, f.ip, f.prefix)) || fa[0];
  const srcIp = srcF.ip;
  const rep = req.to === 'chaine' ? routeFrom('router', 0, srcIp, [], 0) : send(req.to === 'core@' ? 'core' : req.to, srcIp);
  if (rep.ok && rep.to !== a && !(a === 'core' && rep.to === 'core@')) { rep.ok = false; rep.why = `elle part vers ${ipStr(srcIp)}, mais c'est ${nameOf(rep.to)} qui a cette adresse dans son VLAN (conflit d'adresse IP).`; }
  const wrong = target !== req.to && !(target === 'core' && req.to === 'core@');
  const unstable = req.unstable || rep.unstable;
  if (!rep.ok) return { ...base, req, rep, state: 'echec', ok: false, why: `La demande arrive à ${nameOf(req.to)}, mais sa réponse ne revient pas : ${rep.why}`, fix: rep.fix || '', hops: req.hops };
  if (wrong) return { ...base, req, rep, state: 'instable', ok: false, why: `C'est ${nameOf(req.to)} qui répond à ${dstStr}, pas ${nameOf(target)} : deux machines ont la même adresse (conflit d'adresse IP).`, fix: 'Rendre son adresse du plan à la machine qui a pris celle d\'une autre.', hops: req.hops, answered: [req.to] };
  if (unstable) {
    const all = [...new Set([...(req.unstable || []), ...(rep.unstable || [])])].filter((x) => x !== 'core@');
    return { ...base, req, rep, state: 'instable', ok: false, why: `Deux machines répondent à la même adresse (${all.map(nameOf).join(' et ')}) : les réponses arrivent une fois sur deux. C'est un conflit d'adresse IP.`, fix: 'Rendre son adresse du plan à la machine qui a pris celle d\'une autre.', hops: req.hops, answered: all };
  }
  return { ...base, req, rep, state: 'ok', ok: true, why: '', fix: '', hops: req.hops };
}
/**
 * le résultat d'un ping expliqué simplement : pourquoi ça passe (même VLAN ou routage) ou pourquoi ça casse
 * @param {ReturnType<typeof ping>} r @returns {string}
 */
export function explainPing(r) {
  const A = nameOf(r.a), B = nameOf(r.b);
  if (r.state === 'instable') return `${r.why} ${r.fix}`;
  if (!r.ok) return `${A} ne joint pas ${B}. ${r.why}${r.fix ? ' À vérifier : ' + r.fix : ''}`;
  if (r.b === 'chaine') return `${B} est sur Internet. ${A} confie le paquet à sa passerelle (${(CN.m[r.a].dhcp ? leaseOf(r.a).gw : CN.m[r.a].gw) || 'le routeur'}) ; le cœur l'envoie au routeur par sa route par défaut, et le routeur / pare-feu le fait sortir. La réponse revient par le même chemin.`;
  const fa = ifacesOf(r.a)[0], fb = ifacesOf(r.b === 'core' ? 'core' : r.req.to)[0];
  if (!fa || !fb) return `${A} joint ${B}.`;
  const routed = r.hops.some((h) => /routage|Routeur/.test(h));
  if (!routed) return `${A} et ${B} sont dans le même VLAN (${fa.vlan}) et le même sous-réseau (${ipStr(netOf(fa.ip, fa.prefix))}/${fa.prefix}) : ${A} demande « qui a ${r.dstIp} ? » (ARP), ${B} répond avec son adresse MAC, et les trames passent ${swOf(r.a) === swOf(r.b) ? `par le switch ${swById(swOf(r.a)).name}` : 'd\'un switch à l\'autre par le lien montant (trunk 802.1Q, étiquette VLAN ' + fa.vlan + ')'}, sans routeur.`;
  return `${A} (${ipStr(netOf(fa.ip, fa.prefix))}/${fa.prefix}) et ${B} (${r.dstIp}) ne sont pas dans le même sous-réseau. ${A} confie donc le paquet à sa passerelle ${fa.gw != null ? ipStr(fa.gw) : ''}, l'interface VLAN ${fa.vlan} du SW-CŒUR, qui le route vers le VLAN ${fb.vlan}. ${B} répond par sa propre passerelle (${fb.gw != null ? ipStr(fb.gw) : '?'}) : les deux doivent être justes.`;
}
/** ping fait au poste : mémorisé pour l'affichage et noté pour le chef de car */
export function doPing(a, b) {
  const r = ping(a, b);
  CN.lastPing = { ...r, t: Date.now() };
  note('ping', { a, b, ok: r.ok, state: r.state });
  return r;
}
/** balayage : le PC de supervision envoie un ping à toutes les machines du car */
export function sweep(from = 'supv') {
  const rows = DEFS.filter((d) => d.id !== from && d.kind !== 'laptop' && d.vlan !== 90).map((d) => { const r = ping(from, d.id); return { id: d.id, state: r.state, why: r.why }; });
  CN.lastSweep = { from, rows, t: Date.now() };
  note('sweep', { from, bad: rows.filter((r) => r.state !== 'ok').map((r) => r.id) });
  return CN.lastSweep;
}

// ---------------- évaluation : état de chaque machine, des fonctions, des liens ----------------
/** conflits d'adresse : même adresse dans le même VLAN (les deux machines sont branchées) */
function conflicts() {
  const by = {};
  for (const d of DEFS) {
    if (d.id === 'core' || !linkUp(d.id)) continue; // le cœur : ses interfaces VLAN, comptées ci-dessous
    for (const f of ifacesOf(d.id)) { if (f.ip == null || f.str.startsWith('169.254.')) continue; const k = f.vlan + '|' + f.ip; (by[k] = by[k] || []).push(d.id); }
  }
  for (const s of coreSvis()) { const k = s.vlan + '|' + s.ip; if (by[k]) by[k].push('core@'); }
  return Object.values(by).filter((l) => l.length > 1);
}
/** évalue tout le réseau (une fois par version : rien n'est recalculé tant que rien ne change) */
export function evaluate() {
  if (CN.res && CN.resVer === CN.ver) return CN.res;
  const conf = conflicts();
  /** @type {Record<string, { state: string, ok: boolean, why: string, loss: number }>} */
  const funcs = {};
  // d'abord qui joint qui, puis la charge des liens montants (seuls les échanges qui passent la chargent)
  const reach = {};
  for (const f of FUNCS) reach[f.key] = ping(f.a, f.b);
  const load = linkLoads((k) => reach[k].state !== 'echec');
  for (const f of FUNCS) {
    const r = reach[f.key];
    let state = r.state === 'ok' ? 'ok' : r.state === 'instable' ? 'instable' : 'coupe';
    const loss = state === 'ok' ? flowLoss(f.a, f.b, f.cls, load) : 0;
    let why = r.why;
    const k = CN.m[f.a] ? CN.m[f.a].qos : f.cls;
    // les transferts de fichiers (TCP) ralentissent sans dommage : seules les autres fonctions se dégradent
    if (state === 'ok' && loss > 0.005 && f.cls !== 'fichiers') { state = 'degrade'; why = `Lien montant saturé : ${Math.round(loss * 100)} % de paquets perdus dans la classe « ${QOS[k] ? QOS[k].name : k} ».`; }
    funcs[f.key] = { state, ok: state === 'ok', why, loss };
  }
  /** @type {Record<string, { level: 'ok' | 'warn' | 'err', issues: { sev: string, text: string, field?: string }[] }>} */
  const devs = {};
  for (const d of DEFS) devs[d.id] = diagnose(d.id, conf, funcs);
  const err = Object.values(devs).filter((x) => x.level === 'err').length, warn = Object.values(devs).filter((x) => x.level === 'warn').length;
  CN.res = { devs, funcs, conf, load, err, warn, ok: DEFS.length - err - warn };
  CN.resVer = CN.ver;
  return CN.res;
}
/** diagnostic d'une machine : réglages hors du plan, lien, conflit, fonctions du car qui en dépendent */
function diagnose(id, conf, funcs) {
  const d = devById(id), c = CN.m[id];
  /** @type {{ sev: string, text: string, field?: string }[]} */
  const iss = [];
  const add = (sev, text, field) => iss.push({ sev, text, field });
  const lw = linkWhy(id);
  if (lw) add('err', `Lien coupé : ${lw}.`, 'port');
  const v = vlanOfDev(id);
  if (!d.ifaces && d.kind !== 'switch') {
    if (c.dhcp) {
      const l = leaseOf(id);
      if (l.apipa) add('err', `En DHCP, mais aucun serveur DHCP ne répond dans le VLAN ${v} : adresse automatique ${l.ip}, inutilisable.`, 'mode');
      else if (!d.dhcp) add('warn', 'En DHCP : son adresse peut changer d\'un jour à l\'autre. Une machine de production a une adresse fixe, notée au plan.', 'mode');
    } else {
      const ip = parseIp(c.ip);
      if (v != null && v !== 1 && vlanById(v) && ip != null && !sameNet(ip, parseIp(`${BASE}.${v}.0`), PREFIX)) {
        const other = VLANS.find((x) => sameNet(ip, parseIp(`${BASE}.${x.id}.0`), PREFIX));
        add('err', other ? `Le port est dans le VLAN ${v} (${vlanById(v).name}), mais l'adresse ${c.ip} est celle du VLAN ${other.id} (${other.name}) : mauvais VLAN de port, ou mauvaise adresse.` : `L'adresse ${c.ip} n'appartient pas au sous-réseau du VLAN ${v} (${vlanNet(v)}).`, other && other.id === d.vlan ? 'vlan' : 'ip');
      } else if (v === 1 || (v != null && !vlanById(v))) add('err', `Le port est dans le ${vlanName(v)} : aucune autre machine du car n'y est.`, 'vlan');
      if (c.prefix !== PREFIX) add(c.prefix > PREFIX ? 'err' : 'warn', `Masque ${maskStr(c.prefix)} (/${c.prefix}) au lieu de ${maskStr(PREFIX)} (/24) : la machine se trompe sur qui est « chez elle ».`, 'mask');
      if (!c.gw) add('warn', 'Pas de passerelle : la machine ne joint que son propre sous-réseau (ni supervision, ni heure NTP, ni Internet).', 'gw');
      else if (ip != null && parseIp(c.gw) != null && !sameNet(parseIp(c.gw), ip, c.prefix)) add('err', `La passerelle ${c.gw} n'est pas dans le sous-réseau de la machine (${subnetStr(c.ip, c.prefix)}).`, 'gw');
      else if (vlanById(d.vlan) && c.gw !== vlanById(d.vlan).gw) add('warn', `Passerelle ${c.gw} au lieu de ${vlanById(d.vlan).gw} (la .1 de son VLAN).`, 'gw');
      if (c.ip !== d.ip && !iss.some((i) => i.field === 'ip')) add('warn', `Adresse ${c.ip} au lieu de ${d.ip} (plan d'adressage).`, 'ip');
    }
  }
  for (const l of conf) if (l.includes(id)) add('err', `Conflit d'adresse IP : ${ipOf(id)} est aussi l'adresse de ${l.filter((x) => x !== id).map(nameOf).join(', ')}.`, 'ip');
  if (QOS[c.qos] && c.qos !== d.qos && d.kind !== 'switch') add('warn', `Classe QoS « ${QOS[c.qos].name} » au lieu de « ${QOS[d.qos].name} » : en cas de lien chargé, ses paquets ne passent pas au bon rang.`, 'qos');
  // fonctions du car
  for (const f of funcsOf(id)) {
    const st = funcs[f.key];
    if (st.state === 'coupe') add('err', `${f.label} : coupé. ${st.why}`);
    else if (st.state === 'instable') add('err', `${f.label} : instable. ${st.why}`);
    else if (st.state === 'degrade') add('warn', `${f.label} : dégradé. ${st.why}`);
  }
  // supervision et heure : depuis le PC de supervision et vers le serveur NTP (synchro)
  if (!lw && d.vlan !== 90 && d.kind !== 'laptop' && id !== 'supv' && !iss.some((i) => i.sev === 'err')) {
    const r = ping('supv', id);
    if (!r.ok && linkUp('supv')) add('warn', `Ne répond plus au PC de supervision : ${r.why}`);
    else if (id !== 'spg' && d.kind !== 'switch' && !d.ifaces && !ping(id, 'spg').ok && linkUp('spg')) add('warn', 'Ne joint pas le serveur NTP (synchro) : son horloge va dériver.');
  }
  const level = /** @type {'ok' | 'warn' | 'err'} */ (iss.some((i) => i.sev === 'err') ? 'err' : iss.length ? 'warn' : 'ok');
  return { level, issues: iss };
}
/** état d'une machine (calculé à la demande) */
export const devState = (id) => evaluate().devs[id];

// ---------------- charge des liens montants et QoS ----------------
/** débits (Mb/s) par lien montant, dans chaque sens, par classe ; pertes par classe si le lien sature */
function linkLoads(passes = (_k) => true) {
  const L = {};
  for (const u of UPLINKS) L[u.id] = { up: emptyDir(), down: emptyDir(), cap: 1000 };
  const flows = [];
  for (const f of FUNCS) if (passes(f.key)) { flows.push([f.a, f.b, f.rate]); flows.push([f.b, f.a, f.back ?? f.rate]); }
  if (CN.copy) flows.push([COPY.a, COPY.b, COPY.rate]);
  for (const [a, b, rate] of flows) {
    const cls = a === 'chaine' ? 'fichiers' : CN.m[a] ? CN.m[a].qos : 'donnees';
    const sa = swOf(a), sb = swOf(b);
    if (a !== 'chaine' && !linkUp(a)) continue;
    if (b !== 'chaine' && !linkUp(b)) continue;
    const va = a === 'chaine' ? 90 : vlanOfDev(a), vb = b === 'chaine' ? 90 : vlanOfDev(b);
    if (sa === sb && va === vb) continue; // reste dans le switch
    const ua = UPLINKS.find((u) => u.b.sw === sa), ub = UPLINKS.find((u) => u.b.sw === sb);
    if (ua && upOk(ua, va)) add(L[ua.id].up, cls, rate);
    if (ub && upOk(ub, vb)) add(L[ub.id].down, cls, rate);
  }
  for (const u of UPLINKS) for (const dir of ['up', 'down']) {
    const D = L[u.id][dir]; const egress = dir === 'up' ? u.b.sw : u.a.sw;
    const total = Object.values(D.by).reduce((s, x) => s + x, 0);
    D.total = Math.min(total, L[u.id].cap); D.demand = total;
    if (total <= L[u.id].cap) continue;
    if (CN.sw[egress] && CN.sw[egress].qos) {
      // files à priorité stricte : chaque classe passe dans l'ordre, la dernière prend ce qui reste
      let room = L[u.id].cap;
      for (const k of QOS_ORDER) { const want = D.by[k] || 0; const got = Math.min(want, room); room -= got; D.loss[k] = want ? (want - got) / want : 0; }
    } else for (const k of QOS_ORDER) D.loss[k] = 1 - L[u.id].cap / total; // une seule file : tout le monde perd
  }
  return L;
}
const emptyDir = () => ({ by: {}, loss: {}, total: 0, demand: 0 });
function add(D, cls, rate) { D.by[cls] = (D.by[cls] || 0) + rate; }
/** pertes subies par les paquets d'une fonction (pire des deux sens) */
function flowLoss(a, b, cls, L) {
  let worst = 0;
  for (const [x, y] of [[a, b], [b, a]]) {
    const k = x === 'chaine' ? 'fichiers' : CN.m[x] ? CN.m[x].qos : cls;
    const sx = swOf(x), sy = swOf(y);
    const ux = UPLINKS.find((u) => u.b.sw === sx), uy = UPLINKS.find((u) => u.b.sw === sy);
    if (sx === sy) continue;
    if (ux) worst = Math.max(worst, L[ux.id].up.loss[k] || 0);
    if (uy) worst = Math.max(worst, L[uy.id].down.loss[k] || 0);
  }
  return worst;
}
/** débit d'un port (Mb/s, dans les deux sens) : liens montants et machines */
export function portLoad(sw, n) {
  const u = portUse(sw, n); const R = evaluate();
  if (!u) return 0;
  if (u.uplink) { const L = R.load[u.uplink.id]; return L.up.total + L.down.total; }
  let t = 0;
  for (const f of FUNCS) if (f.a === u.dev || f.b === u.dev || (u.dev === 'ap' && (f.a === 'guest' || f.b === 'guest'))) t += f.rate + (f.back ?? f.rate);
  if (CN.copy && (u.dev === COPY.a || u.dev === COPY.b)) t += COPY.rate;
  return linkUp(u.dev) ? t : 0;
}

// ---------------- tables ARP et MAC ----------------
/** table ARP de l'interface VLAN du cœur : adresse IP → MAC, apprises dans le VLAN */
export function arpTable(v) {
  const rows = [];
  for (const d of DEFS) {
    if (d.kind === 'switch' && d.id === 'core') continue;
    if (!linkUp(d.id)) continue;
    for (const f of ifacesOf(d.id)) {
      if (f.vlan !== v || f.ip == null || !sameNet(f.ip, parseIp(`${BASE}.${v}.0`), PREFIX) || f.str.startsWith('169.254.')) continue;
      const at = attachPort(d.id);
      if (at && !swLinked('core', at.sw, v)) continue;
      rows.push({ ip: f.str, mac: macOf(d.id), dev: d.id, port: at ? `${swById(at.sw).name} · port ${at.n}` : swById(CN.m[d.id].sw).name });
    }
  }
  rows.sort((a, b) => parseIp(a.ip) - parseIp(b.ip));
  const dup = new Set(rows.filter((r, i) => rows.some((s, j) => j !== i && s.ip === r.ip)).map((r) => r.ip));
  return rows.map((r) => ({ ...r, dup: dup.has(r.ip) }));
}
/** table MAC d'un switch : chaque MAC apprise sur le port par où elle arrive, dans son VLAN */
export function macTable(sw) {
  const rows = [];
  for (const d of DEFS) {
    if (d.kind === 'switch') continue;
    if (!linkUp(d.id)) continue;
    const at = attachPort(d.id); if (!at) continue;
    const vl = d.ifaces ? d.ifaces.map((f) => f.vlan) : [vlanOfDev(d.id)];
    for (const v of vl) {
      if (at.sw === sw) rows.push({ mac: macOf(d.id), vlan: v, port: at.n, dev: d.id, via: '' });
      else if (swLinked(sw, at.sw, v)) {
        const u = sw === 'core' ? UPLINKS.find((x) => x.b.sw === at.sw) : UPLINKS.find((x) => x.b.sw === sw);
        rows.push({ mac: macOf(d.id), vlan: v, port: sw === 'core' ? u.a.n : u.b.n, dev: d.id, via: 'lien montant' });
      }
    }
  }
  return rows.sort((a, b) => a.vlan - b.vlan || a.port - b.port);
}

// ---------------- API pour les autres postes ----------------
/**
 * la machine a joint-elle la machine b (ping dans les deux sens) ?
 * @param {string} a @param {string} b @returns {{ ok: boolean, state: string, why: string, hops: string[] }}
 */
export function ctrlReach(a, b) {
  if (S.ipMode) return { ok: true, state: 'ok', why: 'Car IP : le réseau de contrôle du car SDI n\'est pas simulé.', hops: [] };
  const r = ping(a, b);
  return { ok: r.ok, state: r.state, why: r.why, hops: r.hops };
}
/** une machine fait son travail : lien monté, toutes ses fonctions du car en état (supervision exclue) */
export function ctrlOk(id) {
  if (S.ipMode || !devById(id)) return { ok: true, why: '' };
  const R = evaluate();
  const lw = linkWhy(id); if (lw) return { ok: false, why: lw };
  const bad = funcsOf(id).map((f) => [f, R.funcs[f.key]]).find(([, s]) => s.state !== 'ok');
  return bad ? { ok: false, why: `${bad[0].label} : ${bad[1].why}` } : { ok: true, why: '' };
}
/** état d'une fonction du car : 'cam3', 'mixer', 'tally', 'grille', 'evs', 'icom-real', 'icom-son', 'icom-vision', 'son', 'gfx', 'wifi' */
export function ctrlFunc(key) {
  const f = funcByKey(key);
  if (S.ipMode || !f) return { ok: true, state: 'ok', why: '', label: f ? f.label : key };
  const s = evaluate().funcs[key];
  return { ok: s.ok, state: s.state, why: s.why, label: f.label, loss: s.loss };
}
/** le RCP n a-t-il la main sur la CCU n ? (caméras 13 à 16 du grand dispositif : non simulées, toujours oui) */
export const ctrlCam = (n) => (n >= 1 && n <= 12 ? ctrlFunc('cam' + n) : { ok: true, state: 'ok', why: '', label: `Caméra ${n}` });

// ---------------- pannes (ajoutées au simulateur de pannes, src/faults.js) ----------------
const pick = (list) => randPick(list.filter((x) => x.can ? x.can() : true));
/** @type {any[]} */
export const CTRL_FAULTS = [
  {
    id: 'cn-conflit', label: 'Conflit d\'adresse IP sur le réseau de contrôle', where: 'Réseau de contrôle (car SDI)',
    can: () => !S.ipMode,
    inject() {
      const c = pick([{ dev: 'rcp4', takes: 'ccu2' }, { dev: 'ipd', takes: 'evs' }, { dev: 'icpvision', takes: 'icpreal' }, { dev: 'gridpc', takes: 'mv' }]);
      const was = CN.m[c.dev].ip; CN.m[c.dev].ip = CN.m[c.takes].ip; CN.m[c.dev].dhcp = false; changed({ why: 'fault' });
      return { dev: c.dev, takes: c.takes, was };
    },
    check: (st) => !evaluate().conf.some((l) => l.includes(st.dev) || l.includes(st.takes)),
    repair(st) { resetDevice(st.dev, true); },
    hint: 'Deux machines se perturbent (réponses une fois sur deux). Réseau de contrôle : balayage depuis la supervision, table ARP (deux MAC pour la même adresse), puis rendre son adresse du plan à la machine fautive.',
  },
  {
    id: 'cn-vlan', label: 'Port de switch dans le mauvais VLAN', where: 'Réseau de contrôle (car SDI)',
    can: () => !S.ipMode,
    inject() {
      const c = pick([{ dev: 'rcp' + randPick([1, 2, 3, 4, 5, 6]), to: 40 }, { dev: 'evs', to: 30 }, { dev: 'mixpanel', to: 50 }, { dev: 'mv', to: 20 }]);
      const at = attachPort(c.dev); CN.p[pk(at.sw, at.n)].vlan = c.to; changed({ why: 'fault' });
      return { dev: c.dev, sw: at.sw, n: at.n, vlan: devById(c.dev).vlan };
    },
    check: (st) => portOf(st.sw, st.n).vlan === st.vlan || (attachPort(st.dev) && portOf(attachPort(st.dev).sw, attachPort(st.dev).n).vlan === st.vlan),
    repair(st) { CN.p[pk(st.sw, st.n)].vlan = st.vlan; changed({ quiet: true, why: 'repair' }); },
    hint: 'Une machine ne répond plus du tout (ni à l\'ARP ni au ping) alors que son voyant de port est allumé. Réseau de contrôle → Switchs : le VLAN de son port n\'est pas celui du plan.',
  },
  {
    id: 'cn-masque', label: 'Mauvais masque de sous-réseau sur une machine', where: 'Réseau de contrôle (car SDI)',
    can: () => !S.ipMode,
    inject() {
      const c = pick([{ dev: 'ipd' }, { dev: 'rcp' + randPick([1, 2, 3, 5, 8, 11]) }, { dev: 'icpvision' }]);
      CN.m[c.dev].prefix = 28; CN.m[c.dev].dhcp = false; changed({ why: 'fault' });
      return { dev: c.dev };
    },
    check: (st) => CN.m[st.dev].prefix === PREFIX,
    repair(st) { CN.m[st.dev].prefix = PREFIX; changed({ quiet: true, why: 'repair' }); },
    hint: 'Une machine ne joint plus ses partenaires ni sa passerelle. Sa fiche : masque 255.255.255.240 (/28) au lieu de 255.255.255.0 (/24).',
  },
  {
    id: 'cn-cable', label: 'Câble réseau débranché', where: 'Réseau de contrôle (car SDI)',
    can: () => !S.ipMode,
    inject() {
      const c = pick([{ dev: 'mv' }, { dev: 'ipd' }, { dev: 'mixpanel' }, { dev: 'grid' }, { dev: 'rcp' + randPick([7, 8, 9, 10, 11, 12]) }]);
      const at = attachPort(c.dev); CN.p[pk(at.sw, at.n)].cable = false; changed({ why: 'fault' });
      return { dev: c.dev, sw: at.sw, n: at.n };
    },
    check: (st) => !linkWhy(st.dev),
    repair(st) { CN.p[pk(st.sw, st.n)].cable = true; CN.p[pk(st.sw, st.n)].enabled = true; changed({ quiet: true, why: 'repair' }); },
    hint: 'Une machine a disparu : voyant de port éteint, absente de la table MAC. Réseau de contrôle → Switchs : rebrancher le câble du port.',
  },
];
/** machine à regarder pour une panne en cours (pour le chef de car et le poste) */
export const faultDev = (entry) => (entry && entry.st ? entry.st.dev : null);
/** ajoute les pannes du réseau de contrôle au simulateur de pannes (une seule fois) */
export function addCtrlFaults(list) { for (const f of CTRL_FAULTS) if (!list.some((x) => x.id === f.id)) list.push(f); }

resetCtrlNet(true);

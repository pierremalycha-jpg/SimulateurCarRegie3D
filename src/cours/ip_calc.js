// @ts-check
import { parseIp, ipStr, maskOf, netOf, bcastOf, sameNet } from '../net/ctrlnet.js';

// ----------------------------------------------------------------------------------
// Les calculs des leçons « bases du réseau » et de leurs vues 3D, sans affichage (testés à part) :
// adresses IPv4 (réseau, diffusion, plage, découpage, type d'adresse), encapsulation et trame Ethernet,
// propagation et sérialisation, débit d'une connexion TCP qui perd des paquets, latence conseillée de
// SRT, files d'attente d'un port engorgé (QoS), traduction d'adresses (NAT), gigue (RFC 3550).
// Les fonctions d'adresse viennent du réseau de contrôle du car (net/ctrlnet.js) : mêmes calculs que le poste.
// Références : RFC 791 (IPv4), 950 et 4632 (masques, CIDR), 1918 (adresses privées), 3021 (/31), 3927
// (169.254), 5771 et 4607 (multicast, SSM), 6598 (CGNAT), 5737 (documentation), 793 et 9293 (TCP), 768
// (UDP), 3550 (RTP, gigue), 4594 et AES67 (DSCP) ; IEEE 802.3 (trame Ethernet) ; débit TCP : Mathis,
// Semke, Mahdavi et Ott (1997) ; latence SRT : guide de déploiement SRT de Haivision (ordres de grandeur).
// ----------------------------------------------------------------------------------
export { parseIp, ipStr, maskOf, netOf, bcastOf, sameNet };

/** les 32 bits d'une adresse, par octet : « 00001010.00000001.00010100.00011111 » */
export const bits32 = (n) => [24, 16, 8, 0].map((s) => ((n >>> s) & 255).toString(2).padStart(8, '0')).join('.');

/**
 * Tout ce que disent une adresse et son préfixe : réseau, diffusion, première et dernière adresse d'appareil,
 * nombre d'appareils. En /31 (lien entre deux routeurs, RFC 3021) les deux adresses servent ; en /32, une seule.
 * @param {string | number} ip @param {number} p
 */
export function infoReseau(ip, p) {
  const n = typeof ip === 'string' ? parseIp(ip) : ip >>> 0;
  if (n == null || !(p >= 0 && p <= 32)) return null;
  const net = netOf(n, p), bc = bcastOf(n, p), taille = 2 ** (32 - p);
  const hotes = p === 32 ? 1 : p === 31 ? 2 : taille - 2;
  const premier = p >= 31 ? net : net + 1, dernier = p >= 31 ? bc : bc - 1;
  return {
    ip: ipStr(n), p, masque: ipStr(maskOf(p)), joker: ipStr(~maskOf(p) >>> 0),
    reseau: ipStr(net), broadcast: p >= 31 ? null : ipStr(bc), premier: ipStr(premier), dernier: ipStr(dernier),
    taille, hotes, bits: bits32(n), bitsMasque: bits32(maskOf(p)),
    estReseau: p < 31 && n === net, estBroadcast: p < 31 && n === bc,
  };
}
/**
 * Découper un réseau /p en sous-réseaux /q (q > p) : la liste, 256 au plus.
 * @param {string} reseau @param {number} p @param {number} q
 */
export function decouper(reseau, p, q) {
  const n = parseIp(reseau); if (n == null || q < p || q > 32) return [];
  const base = netOf(n, p), pas = 2 ** (32 - q), k = Math.min(2 ** (q - p), 256);
  return Array.from({ length: k }, (_, i) => infoReseau(base + i * pas, q));
}
/** le plus petit préfixe qui loge n appareils (adresses du réseau et de diffusion en plus) */
export function prefixePour(n) { for (let p = 30; p >= 0; p--) if (2 ** (32 - p) - 2 >= n) return p; return 0; }

/** les plages particulières, de la plus précise à la plus large */
export const PLAGES = [
  { cidr: '255.255.255.255/32', type: 'diffusion limitée', routable: false, ref: 'RFC 919', detail: 'Tous les appareils du réseau local, jamais au-delà d\'un routeur.' },
  { cidr: '224.0.0.0/24', type: 'multicast local', routable: false, ref: 'RFC 5771', detail: 'Protocoles du lien (OSPF 224.0.0.5, IGMP 224.0.0.22, mDNS 224.0.0.251) : jamais routé.' },
  { cidr: '192.0.2.0/24', type: 'documentation', routable: false, ref: 'RFC 5737', detail: 'Réservée aux exemples des livres et des normes.' },
  { cidr: '198.51.100.0/24', type: 'documentation', routable: false, ref: 'RFC 5737', detail: 'Réservée aux exemples des livres et des normes.' },
  { cidr: '203.0.113.0/24', type: 'documentation', routable: false, ref: 'RFC 5737', detail: 'Réservée aux exemples des livres et des normes.' },
  { cidr: '169.254.0.0/16', type: 'lien local (APIPA)', routable: false, ref: 'RFC 3927', detail: 'Adresse que se donne seule une machine en DHCP qui n\'a reçu aucune réponse : elle ne joint presque personne.' },
  { cidr: '192.168.0.0/16', type: 'privée', routable: false, ref: 'RFC 1918', detail: 'Réseau interne (box, petits réseaux). Pour sortir sur Internet, il faut une traduction d\'adresses (NAT).' },
  { cidr: '172.16.0.0/12', type: 'privée', routable: false, ref: 'RFC 1918', detail: 'Réseau interne. Pour sortir sur Internet, il faut une traduction d\'adresses (NAT).' },
  { cidr: '100.64.0.0/10', type: 'partagée (CGNAT)', routable: false, ref: 'RFC 6598', detail: 'Donnée par un opérateur (souvent en 4G/5G) derrière sa propre traduction d\'adresses : on ne peut pas être joint de l\'extérieur.' },
  { cidr: '232.0.0.0/8', type: 'multicast SSM', routable: true, ref: 'RFC 4607', detail: 'Multicast « source spécifique » : on s\'abonne au couple (source, groupe).' },
  { cidr: '239.0.0.0/8', type: 'multicast privé', routable: false, ref: 'RFC 2365', detail: 'Multicast à portée administrative : le plan d\'adressage des flux d\'un car.' },
  { cidr: '10.0.0.0/8', type: 'privée', routable: false, ref: 'RFC 1918', detail: 'Réseau interne (le car : 10.1.x.x). Pour sortir sur Internet, il faut une traduction d\'adresses (NAT).' },
  { cidr: '127.0.0.0/8', type: 'boucle locale', routable: false, ref: 'RFC 1122', detail: 'La machine elle-même (127.0.0.1, localhost) : le paquet ne sort jamais de la carte.' },
  { cidr: '0.0.0.0/8', type: 'non spécifiée', routable: false, ref: 'RFC 1122', detail: '« Ce réseau » : 0.0.0.0 sert d\'adresse source à une machine qui n\'en a pas encore (requête DHCP).' },
  { cidr: '224.0.0.0/4', type: 'multicast', routable: true, ref: 'RFC 5771', detail: 'Une adresse de groupe : un émetteur, tous les abonnés.' },
  { cidr: '240.0.0.0/4', type: 'réservée', routable: false, ref: 'RFC 1112', detail: 'Ancienne classe E, inutilisable.' },
].map((x) => { const [a, l] = x.cidr.split('/'); return { ...x, net: /** @type {number} */ (parseIp(a)), p: +l }; }).sort((a, b) => b.p - a.p);

/** la classe historique (avant 1993) d'après le premier nombre : A, B, C, D (multicast), E */
export function classe(ip) {
  const n = typeof ip === 'string' ? parseIp(ip) : ip; if (n == null) return null;
  const o = n >>> 24;
  return o < 128 ? { c: 'A', p: 8 } : o < 192 ? { c: 'B', p: 16 } : o < 224 ? { c: 'C', p: 24 } : o < 240 ? { c: 'D', p: null } : { c: 'E', p: null };
}
/**
 * Le type d'une adresse : publique, privée, boucle locale, APIPA, multicast…
 * @param {string} ip
 * @returns {{ type: string, routable: boolean, ref: string, detail: string, cidr: string } | null}
 */
export function typeAdresse(ip) {
  const n = parseIp(ip); if (n == null) return null;
  for (const x of PLAGES) if (netOf(n, x.p) === x.net) return { type: x.type, routable: x.routable, ref: x.ref, detail: x.detail, cidr: x.cidr };
  return { type: 'publique', routable: true, ref: 'RFC 791', detail: 'Unique sur Internet, attribuée par un opérateur : on peut la joindre de partout (si le pare-feu le permet).', cidr: '' };
}
/**
 * Ce que devient un envoi vers dst pour une machine ip/p : unicast (voisin ou par la passerelle), diffusion
 * du sous-réseau, diffusion limitée, multicast, boucle locale.
 * @param {string} dst @param {string} ip @param {number} p
 */
export function portee(dst, ip, p) {
  const d = parseIp(dst), s = parseIp(ip); if (d == null || s == null) return null;
  const t = typeAdresse(dst);
  if (d === 0xffffffff) return { genre: 'diffusion', ou: 'tout le réseau local, sans passer de routeur' };
  if (t && t.type.startsWith('multicast')) return { genre: 'multicast', ou: 'les abonnés du groupe, recopié par le réseau' };
  if (t && t.type === 'boucle locale') return { genre: 'boucle', ou: 'la machine elle-même, rien ne sort' };
  if (p < 31 && d === bcastOf(s, p)) return { genre: 'diffusion', ou: 'tous les appareils du sous-réseau ' + ipStr(netOf(s, p)) + '/' + p };
  if (sameNet(d, s, p)) return { genre: 'unicast', ou: 'un voisin du même sous-réseau, en direct' };
  return { genre: 'unicast', ou: 'une machine d\'un autre réseau, par la passerelle' };
}

// ---------------- les couches et la trame ----------------
/** en-têtes en octets : application (RTP), transport (UDP, TCP sans options), IP, Ethernet (+ étiquette VLAN), sur le fil */
export const TETE = { rtp: 12, udp: 8, tcp: 20, icmp: 8, ip: 20, eth: 18, vlan: 4, fil: 20 };
/**
 * Encapsuler des données utiles : les couches, de l'application au fil, avec la taille de chacune.
 * @param {number} donnees octets utiles @param {{ transport?: 'udp' | 'tcp' | 'icmp', rtp?: boolean, vlan?: boolean }} [o]
 */
export function encapsuler(donnees, o = {}) {
  const tr = o.transport || 'udp', rtp = o.rtp ?? tr === 'udp';
  const out = [];
  let t = donnees;
  out.push({ couche: 7, nom: 'Données (application)', tete: 0, total: t });
  if (rtp) { t += TETE.rtp; out.push({ couche: 7, nom: 'RTP', tete: TETE.rtp, total: t }); }
  t += TETE[tr]; out.push({ couche: tr === 'icmp' ? 3 : 4, nom: tr === 'udp' ? 'UDP (datagramme)' : tr === 'tcp' ? 'TCP (segment)' : 'ICMP (écho)', tete: TETE[tr], total: t });
  t += TETE.ip; out.push({ couche: 3, nom: 'IP (paquet)', tete: TETE.ip, total: t });
  const eth = TETE.eth + (o.vlan ? TETE.vlan : 0), pad = Math.max(0, 46 - t);
  t += eth + pad; out.push({ couche: 2, nom: 'Ethernet (trame)', tete: eth + pad, total: t });
  t += TETE.fil; out.push({ couche: 1, nom: 'Sur le fil (préambule, intervalle)', tete: TETE.fil, total: t });
  return { couches: out, surFil: t, efficacite: donnees / t, ipTrop: donnees + (rtp ? TETE.rtp : 0) + TETE[tr] + TETE.ip > 1500 };
}
/** temps de sérialisation (µs) : le temps de « poser » n octets sur un lien de g Gb/s */
export const serialisationUs = (octets, gbps) => octets * 8 / (gbps * 1e3);

/** les liens Ethernet du cours : débit, support, portée (IEEE 802.3, ordres de grandeur des fiches techniques) */
export const LIENS = [
  { id: '1g-cuivre', nom: '1 GbE cuivre (RJ45, catégorie 5e/6)', gbps: 1, portee: '100 m' },
  { id: '10g-cuivre', nom: '10 GbE cuivre (RJ45, catégorie 6A)', gbps: 10, portee: '100 m (55 m en catégorie 6)' },
  { id: '10g-sfp', nom: '10 GbE fibre (SFP+)', gbps: 10, portee: '300 m en multimode OM3, 10 km en monomode' },
  { id: '25g-sfp', nom: '25 GbE fibre (SFP28)', gbps: 25, portee: '70 à 100 m en multimode, 10 km en monomode' },
  { id: '100g-qsfp', nom: '100 GbE fibre (QSFP28)', gbps: 100, portee: '100 m en multimode, 10 km en monomode' },
];
/** combien de flux de g Gb/s tiennent sur un lien, en gardant une marge (90 % de charge au plus par défaut) */
export const fluxParLien = (gFlux, gLien, charge = 0.9) => Math.floor(gLien * charge / gFlux + 1e-9);

// ---------------- distance et temps ----------------
/** vitesse de propagation (km/s) : fibre (indice ≈ 1,47), paire torsadée (≈ 0,66 c), air (radio, satellite) */
export const VITESSE = { fibre: 204000, cuivre: 198000, air: 299792 };
/** temps de propagation (ms) sur km kilomètres */
export const propagationMs = (km, milieu = 'fibre') => km / VITESSE[milieu] * 1000;
/** altitude d'un satellite géostationnaire (km) */
export const GEO_KM = 35786;
/** un bond satellite (montée et descente, au plus court) : ≈ 239 ms */
export const bondSatelliteMs = () => propagationMs(2 * GEO_KM, 'air');

/** les étendues de réseau du cours (ordres de grandeur) */
export const ETENDUES = {
  lan: { nom: 'LAN (réseau local)', km: 0.1, ex: 'le car, un studio, un bâtiment', qui: 'toi', techno: 'Ethernet cuivre et fibre, Wi-Fi', debit: '1 à 100 Gb/s', rtt: 'moins de 1 ms' },
  man: { nom: 'MAN (réseau métropolitain)', km: 15, ex: 'le stade relié au centre technique de la ville', qui: 'un opérateur ou une collectivité (fibre louée, fibre noire)', techno: 'fibre, boucle métropolitaine', debit: '1 à 100 Gb/s', rtt: 'de l\'ordre de 0,1 à 1 ms' },
  wan: { nom: 'WAN (réseau étendu)', km: 250, ex: 'le car relié à la régie finale à Paris', qui: 'des opérateurs (réseau managé, Internet)', techno: 'fibre opérateur, MPLS, Internet, satellite, 4G/5G', debit: 'de quelques Mb/s à 10 Gb/s', rtt: 'de quelques ms à 600 ms (satellite)' },
};

// ---------------- TCP et UDP ----------------
/**
 * Débit d'une connexion TCP qui perd une fraction perte des paquets (formule de Mathis : MSS / RTT × √(3/2) / √p),
 * plafonné par le lien. Sans perte, le lien (ou la fenêtre) limite seul.
 * @param {number} rttMs aller-retour @param {number} perte fraction (0,01 = 1 %) @param {number} [lienMbps] @param {number} [mss]
 */
export function debitTcp(rttMs, perte, lienMbps = 1000, mss = 1460) {
  if (perte <= 0) return lienMbps;
  const mbps = (mss * 8 / (rttMs / 1000)) * Math.sqrt(1.5) / Math.sqrt(perte) / 1e6;
  return Math.min(lienMbps, mbps);
}
/** débit maximal fixé par la fenêtre de réception : fenêtre / RTT (Mb/s) */
export const debitFenetre = (fenetreOctets, rttMs) => fenetreOctets * 8 / (rttMs / 1000) / 1e6;
/** un flux UDP à débit constant sur un lien qui perd : paquets par seconde, et perdus par seconde */
export function pertesUdp(mbps, perte, octets = 1316) {
  const pps = mbps * 1e6 / (octets * 8);
  return { pps, perdusS: pps * perte };
}

// ---------------- les protocoles du streaming ----------------
/** SRT : multiplicateur du RTT selon les pertes (guide de déploiement de Haivision ; RTT pris à 20 ms au moins) */
export const SRT_RTT = [[1, 3], [3, 4], [7, 6], [10, 8], [12, 8], [20, 10], [25, 13], [27, 14], [30, 14], [40, 30]];
/**
 * Latence SRT conseillée pour un lien (RTT en ms, pertes en %) : multiplicateur × RTT ; surdébit à prévoir
 * pour les retransmissions (100 / multiplicateur %). null au-delà de 40 % de pertes.
 * @param {number} rttMs @param {number} pertePct
 */
export function latenceSrt(rttMs, pertePct) {
  const row = SRT_RTT.find(([max]) => pertePct <= max); if (!row) return null;
  const mult = row[1];
  return { mult, latence: Math.round(mult * Math.max(20, rttMs)), surdebit: Math.round(100 / mult) };
}
/** les protocoles : transport, ce qui répare les pertes, usage, latence typique (ordre de grandeur) */
export const PROTOCOLES = {
  'st2110': { nom: 'ST 2110 (RTP)', transport: 'UDP, multicast', repare: 'rien (deux réseaux en ST 2022-7)', usage: 'production, dans le car (réseau managé)', latence: 'moins d\'une image', debit: 'non compressé : 2,2 Gb/s en 1080p50' },
  'rtp': { nom: 'RTP sur UDP (MPEG-TS, ST 2022-2)', transport: 'UDP', repare: 'FEC (ST 2022-1) en option', usage: 'contribution sur réseau managé', latence: 'quelques dizaines de ms', debit: '10 à 100 Mb/s compressé' },
  'srt': { nom: 'SRT', transport: 'UDP', repare: 'retransmissions (ARQ) dans un tampon de latence', usage: 'contribution par Internet', latence: '120 ms par défaut, 3 à 4 × le RTT', debit: '5 à 50 Mb/s compressé' },
  'rist': { nom: 'RIST', transport: 'UDP (RTP)', repare: 'retransmissions (ARQ)', usage: 'contribution par Internet, interopérable', latence: 'de l\'ordre de quelques centaines de ms', debit: '5 à 50 Mb/s compressé' },
  'rtmp': { nom: 'RTMP', transport: 'TCP (port 1935)', repare: 'TCP (retransmission, au prix du retard)', usage: 'envoi vers une plateforme (YouTube, Twitch…)', latence: 'de 2 à 5 s, plus la plateforme', debit: '3 à 10 Mb/s' },
  'hls': { nom: 'HLS et DASH', transport: 'TCP (HTTP)', repare: 'TCP ; segments de quelques secondes', usage: 'distribution au public par un CDN', latence: '10 à 30 s (2 à 5 s en basse latence)', debit: 'plusieurs qualités au choix du lecteur' },
  'webrtc': { nom: 'WebRTC', transport: 'UDP (SRTP)', repare: 'retransmissions et correction, courtes', usage: 'retour vidéo, interview à distance, navigateur', latence: 'moins d\'une seconde', debit: '1 à 5 Mb/s' },
  'ndi': { nom: 'NDI', transport: 'TCP ou UDP, réseau local', repare: 'selon le mode', usage: 'production légère sur réseau local (vMix, caméras PTZ)', latence: 'de l\'ordre d\'une image', debit: '≈ 100 à 150 Mb/s en 1080p (NDI|HX : 10 à 20 Mb/s)' },
};

// ---------------- qualité de service ----------------
/** les classes du cours, de la plus prioritaire à la moins prioritaire (DSCP : AES67, RFC 4594) */
export const CLASSES = {
  ptp: { nom: 'PTP (horloge)', dscp: 46, phb: 'EF', cos: 7, rang: 0 },
  media: { nom: 'Médias (vidéo, son)', dscp: 34, phb: 'AF41', cos: 5, rang: 1 },
  commande: { nom: 'Commandes, intercom', dscp: 32, phb: 'CS4', cos: 4, rang: 2 },
  fichiers: { nom: 'Fichiers, au mieux', dscp: 0, phb: 'DF', cos: 0, rang: 3 },
};
/**
 * Un port de sortie : chaque classe offre un débit (Mb/s) ; le lien en sert lienMbps. En 'fifo', une seule
 * file : si le lien déborde, toutes les classes perdent la même part et attendent derrière un tampon plein. En
 * 'prio', une file par classe servie par priorité stricte : les premières passent, la dernière perd tout l'excès.
 * Retard de file en ms (tampon plein : tampon / débit servi à la file), modèle fluide (ordres de grandeur).
 * @param {Record<string, number>} offert @param {number} lienMbps @param {'fifo' | 'prio'} mode @param {number} [tamponKo]
 */
export function filesQos(offert, lienMbps, mode, tamponKo = 1024) {
  const ids = Object.keys(offert).sort((a, b) => (CLASSES[a]?.rang ?? 9) - (CLASSES[b]?.rang ?? 9));
  const total = ids.reduce((s, k) => s + offert[k], 0);
  const plein = (mbps) => (mbps > 0 ? tamponKo * 1024 * 8 / (mbps * 1e6) * 1000 : Infinity);
  /** @type {Record<string, { offert: number, servi: number, perdu: number, pertePct: number, retardMs: number }>} */
  const out = {};
  if (mode === 'fifo') {
    const k = total > lienMbps ? lienMbps / total : 1;
    const retard = total > lienMbps ? plein(lienMbps) : 0;
    for (const id of ids) { const s = offert[id] * k; out[id] = { offert: offert[id], servi: s, perdu: offert[id] - s, pertePct: (1 - k) * 100, retardMs: retard }; }
  } else {
    let reste = lienMbps;
    for (const id of ids) {
      const s = Math.min(offert[id], reste); reste -= s;
      const sature = offert[id] > s + 1e-9;
      out[id] = { offert: offert[id], servi: s, perdu: offert[id] - s, pertePct: offert[id] ? (offert[id] - s) / offert[id] * 100 : 0, retardMs: sature ? plein(s) : 0 };
    }
  }
  return { classes: out, total, charge: total / lienMbps };
}

// ---------------- traduction d'adresses (NAT) ----------------
/**
 * Une box ou un routeur qui fait de la traduction d'adresses et de ports (NAPT) : en sortie, chaque couple
 * (adresse privée, port) reçoit un port de l'adresse publique ; en entrée, seul ce qui répond à une sortie, ou
 * ce qu'une redirection de port désigne, passe.
 * @param {string} publique
 */
export function routeurNat(publique) {
  /** @type {Map<number, { ip: string, port: number, vers: string }>} */
  const table = new Map();
  /** @type {Map<number, { ip: string, port: number }>} */
  const redir = new Map();
  let prochain = 40000;
  return {
    publique, table, redir,
    /** une machine du réseau privé envoie vers dst : l'adresse et le port vus de l'extérieur */
    sortie(ip, port, vers) {
      for (const [p, e] of table) if (e.ip === ip && e.port === port && e.vers === vers) return { ip: publique, port: p };
      const p = prochain++; table.set(p, { ip, port, vers }); return { ip: publique, port: p };
    },
    /** un paquet arrive de l'extérieur sur le port p : pour qui ? null s'il est bloqué */
    entree(p, de) {
      const e = table.get(p); if (e && e.vers === de) return { ip: e.ip, port: e.port, par: 'réponse' };
      const r = redir.get(p); if (r) return { ...r, par: 'redirection' };
      return null;
    },
    rediriger(p, ip, port) { redir.set(p, { ip, port }); },
  };
}

// ---------------- mesures ----------------
/**
 * Gigue d'arrivée de RTP (RFC 3550, § 6.4.1) : J += (|D| − J) / 16, où D est l'écart de temps de transit entre
 * deux paquets successifs. transits : temps de transit de chaque paquet (même unité).
 * @param {number[]} transits
 */
export function gigueRtp(transits) {
  let j = 0;
  for (let i = 1; i < transits.length; i++) j += (Math.abs(transits[i] - transits[i - 1]) - j) / 16;
  return j;
}
/**
 * Le budget de latence d'un chemin : propagation, sérialisation à chaque saut, traversée des équipements, files.
 * @param {{ km: number, milieu?: string, sauts?: number, octets?: number, gbps?: number, equipementUs?: number, fileMs?: number }} o
 */
export function budgetLatence(o) {
  const prop = propagationMs(o.km, o.milieu || 'fibre'), sauts = o.sauts ?? 1;
  const seri = sauts * serialisationUs(o.octets ?? 1500, o.gbps ?? 1) / 1000;
  const equip = sauts * (o.equipementUs ?? 5) / 1000, file = o.fileMs ?? 0;
  return { prop, seri, equip, file, total: prop + seri + equip + file };
}

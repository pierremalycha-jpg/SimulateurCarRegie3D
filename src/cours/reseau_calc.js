// @ts-check
// ----------------------------------------------------------------------------------
// Les calculs des leçons « bases du réseau » du chapitre Réseau (reseau_bases.js, reseau_adresses.js,
// reseau_transport.js) : purs, sans DOM, testés par tests/unit/reseau-cours.test.mjs. Les manipulations
// et les quiz s'appuient sur eux : aucune valeur n'est écrite à la main dans les leçons.
//
// Valeurs de référence :
// - IPv4 (RFC 791) : 32 bits ; en-tête de 20 octets sans option. Adresses privées (RFC 1918) : 10/8,
//   172.16/12, 192.168/16 ; partagées par l'opérateur (RFC 6598) : 100.64/10 ; lien local (RFC 3927) :
//   169.254/16 ; boucle locale 127/8 ; multicast 224/4 (ex-classe D). /31 sur un lien point à point
//   (RFC 3021) : deux adresses utilisables, ni réseau ni diffusion.
// - Ethernet (IEEE 802.3) : en-tête 14 octets + FCS 4, étiquette 802.1Q 4, préambule et délimiteur 8,
//   silence entre trames 12 ; charge utile de 46 à 1 500 octets (MTU 1 500).
// - UDP (RFC 768) : en-tête 8 octets ; TCP (RFC 9293) : 20 octets sans option ; RTP (RFC 3550) : 12.
// - Propagation dans la fibre : indice ≈ 1,47, soit ≈ 4,9 µs par km (on retient 5 µs/km) ; orbite
//   géostationnaire à 35 786 km d'altitude : ≥ 239 ms pour monter et redescendre.
// - Débit d'une connexion TCP limité par les pertes (formule de Mathis et al., 1997) :
//   débit ≈ (MSS / RTT) × (1,22 / √p) ; et par la fenêtre : débit ≤ fenêtre / RTT.
// - SRT : latence à régler selon le taux de pertes (guide de déploiement SRT de Haivision, repères) :
//   ≤ 1 % → 3 × RTT, ≤ 3 % → 4, ≤ 7 % → 6, ≤ 10 % → 8, ≤ 12 % → 10, ≤ 20 % → 13, ≤ 40 % → 20 ;
//   jamais moins de 120 ms (valeur par défaut de SRT).
// - QoS : DSCP sur 6 bits (RFC 2474) ; EF = 46 (RFC 3246), AF41 = 34 (RFC 2597), CS = 8 × classe ;
//   AES67 et ST 2110 : PTP en EF (46), médias en AF41 (34).
// - Liens Ethernet (IEEE 802.3) : voir LIENS plus bas.
// ----------------------------------------------------------------------------------

// ======================================================================================
// Adresses IPv4
// ======================================================================================
/** « 10.1.20.31 » → nombre (null si invalide) */
export function ipNum(s) {
  const m = /^\s*(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\s*$/.exec(String(s));
  if (!m) return null;
  const o = m.slice(1).map(Number);
  if (o.some((x) => x > 255)) return null;
  return ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
}
/** nombre → « 10.1.20.31 » */
export const ipTxt = (n) => `${n >>> 24}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;
/** masque /p en nombre */
export const masque = (p) => (p <= 0 ? 0 : (0xffffffff << (32 - p)) >>> 0);
/** les 32 bits d'une adresse, par octet : « 00001010.00000001… » */
export const ipBits = (n) => [24, 16, 8, 0].map((s) => ((n >>> s) & 255).toString(2).padStart(8, '0')).join('.');

/** nature d'une adresse : privée, publique, boucle locale… (texte court) */
export function natureIp(n) {
  const dans = (net, p) => ((n & masque(p)) >>> 0) === ipNum(net);
  if (dans('127.0.0.0', 8)) return 'boucle locale (la machine elle-même)';
  if (dans('10.0.0.0', 8) || dans('172.16.0.0', 12) || dans('192.168.0.0', 16)) return 'privée (RFC 1918) : ne circule pas sur Internet';
  if (dans('100.64.0.0', 10)) return 'partagée par l\'opérateur (RFC 6598, CGNAT)';
  if (dans('169.254.0.0', 16)) return 'lien local (RFC 3927) : la machine n\'a pas eu de réponse DHCP';
  if (dans('224.0.0.0', 4)) return 'multicast (un groupe, pas une machine)';
  if (dans('240.0.0.0', 4)) return 'réservée';
  if (dans('0.0.0.0', 8)) return 'non spécifiée';
  return 'publique : unique sur Internet';
}
/** ancienne classe (avant CIDR, 1993) : A, B, C, D ou E */
export function classe(n) {
  const a = n >>> 24;
  return a < 128 ? 'A' : a < 192 ? 'B' : a < 224 ? 'C' : a < 240 ? 'D' : 'E';
}

/**
 * Tout ce qu'on lit d'une adresse et de son masque.
 * @param {number} ip
 * @param {number} p longueur du préfixe (0 à 32)
 */
export function sousReseau(ip, p) {
  const m = masque(p), reseau = (ip & m) >>> 0, diffusion = (reseau | (~m >>> 0)) >>> 0;
  const total = 2 ** (32 - p);
  // /31 : lien point à point, les deux adresses servent (RFC 3021) ; /32 : une seule machine
  const hotes = p >= 31 ? total : total - 2;
  const premier = p >= 31 ? reseau : reseau + 1, dernier = p >= 31 ? diffusion : diffusion - 1;
  let role = 'machine';
  if (p < 31 && ip === reseau) role = 'adresse du réseau';
  else if (p < 31 && ip === diffusion) role = 'adresse de diffusion';
  return { ip, p, masque: m, joker: (~m) >>> 0, reseau, diffusion, total, hotes, premier, dernier, role, classe: classe(ip), nature: natureIp(ip) };
}

/**
 * Découper un réseau en n sous-réseaux égaux : on emprunte k bits à la partie machine, 2^k ≥ n.
 * @returns {{ p: number, emprunt: number, parSous: number, sous: { reseau: number, diffusion: number, premier: number, dernier: number }[] } | null}
 */
export function decouper(reseau, p, n) {
  const k = Math.ceil(Math.log2(Math.max(1, n)));
  const np = p + k;
  if (np > 30) return null; // plus de place pour deux machines par sous-réseau
  const pas = 2 ** (32 - np), base = (reseau & masque(p)) >>> 0;
  const sous = [];
  for (let i = 0; i < 2 ** k; i++) {
    const r = base + i * pas;
    sous.push({ reseau: r, diffusion: r + pas - 1, premier: r + 1, dernier: r + pas - 2 });
  }
  return { p: np, emprunt: k, parSous: pas - 2, sous };
}

/** plus petit préfixe qui loge h machines (h + 2 adresses : réseau et diffusion) */
export const prefixePour = (h) => 32 - Math.ceil(Math.log2(h + 2));

/**
 * Plan d'adressage à la demande (VLSM) : chaque besoin reçoit le plus petit sous-réseau qui le loge,
 * du plus gros au plus petit, à la suite dans le bloc de départ.
 * @param {number} base adresse du bloc
 * @param {number} p son préfixe
 * @param {{ nom: string, hotes: number }[]} besoins
 */
export function planVlsm(base, p, besoins) {
  const tries = besoins.map((b, i) => ({ ...b, i })).sort((a, b) => b.hotes - a.hotes || a.i - b.i);
  const fin = ((base & masque(p)) >>> 0) + 2 ** (32 - p);
  let cur = (base & masque(p)) >>> 0;
  const lignes = [];
  for (const b of tries) {
    const bp = prefixePour(Math.max(1, b.hotes)), taille = 2 ** (32 - bp);
    if (cur % taille) cur += taille - (cur % taille); // un sous-réseau commence sur un multiple de sa taille
    const ok = cur + taille <= fin;
    lignes.push({ nom: b.nom, hotes: b.hotes, p: bp, reseau: cur, diffusion: cur + taille - 1, places: taille - 2, ok });
    if (ok) cur += taille;
  }
  const utilise = lignes.filter((l) => l.ok).reduce((a, l) => a + (l.diffusion - l.reseau + 1), 0);
  return { lignes, utilise, total: 2 ** (32 - p), ok: lignes.every((l) => l.ok) };
}

// ======================================================================================
// Couches et encapsulation
// ======================================================================================
/** octets d'en-tête ajoutés par chaque couche */
export const ENTETES = { rtp: 12, udp: 8, tcp: 20, ipv4: 20, ipv6: 40, eth: 14, vlan: 4, fcs: 4, preambule: 8, silence: 12 };
export const MTU = 1500;

/**
 * Une charge utile descend les couches : ce que chaque couche ajoute, et ce qui passe sur le câble.
 * @param {number} donnees octets de l'application dans un paquet
 * @param {{ transport?: 'udp' | 'tcp', rtp?: boolean, vlan?: boolean, ipv6?: boolean }} [o]
 */
export function encapsuler(donnees, o = {}) {
  const tr = o.transport || 'udp';
  const couches = [];
  couches.push({ couche: 'Application', nom: 'données', octets: donnees });
  if (o.rtp) couches.push({ couche: 'Application', nom: 'en-tête RTP', octets: ENTETES.rtp });
  couches.push({ couche: 'Transport', nom: tr === 'tcp' ? 'en-tête TCP' : 'en-tête UDP', octets: ENTETES[tr] });
  couches.push({ couche: 'Réseau', nom: o.ipv6 ? 'en-tête IPv6' : 'en-tête IPv4', octets: o.ipv6 ? ENTETES.ipv6 : ENTETES.ipv4 });
  const paquetIp = couches.reduce((a, c) => a + c.octets, 0);
  couches.push({ couche: 'Liaison', nom: o.vlan ? 'en-tête Ethernet + étiquette VLAN' : 'en-tête Ethernet', octets: ENTETES.eth + (o.vlan ? ENTETES.vlan : 0) });
  couches.push({ couche: 'Liaison', nom: 'FCS (contrôle d\'erreur)', octets: ENTETES.fcs });
  // trame trop courte : bourrage jusqu'à 46 octets de charge utile Ethernet
  const bourrage = Math.max(0, 46 - paquetIp);
  const trame = paquetIp + bourrage + ENTETES.eth + (o.vlan ? ENTETES.vlan : 0) + ENTETES.fcs;
  const surLeCable = trame + ENTETES.preambule + ENTETES.silence;
  return { couches, paquetIp, bourrage, trame, surLeCable, rendement: donnees / surLeCable, tropGros: paquetIp > MTU };
}

// ======================================================================================
// Distances, débits et latences
// ======================================================================================
export const US_PAR_KM_FIBRE = 5;      // ≈ 4,9 µs/km
export const ALTITUDE_GEO_KM = 35786;
export const C_KM_S = 299792;
/** temps de sérialisation : mettre n octets sur un lien de d bit/s (en µs) */
export const serialisation = (octets, bitsParS) => (octets * 8) / bitsParS * 1e6;
/** propagation dans la fibre (en ms) */
export const propagationFibre = (km) => km * US_PAR_KM_FIBRE / 1000;
/** un bond par satellite géostationnaire, montée et descente, station sous le satellite (ms) : le minimum */
export const bondGeo = () => (2 * ALTITUDE_GEO_KM) / C_KM_S * 1000;

/**
 * Les échelles du réseau, de la régie à l'antenne. Débit : ordre de grandeur de ce qu'on loue ou
 * installe ; latence : aller simple, propagation et équipements (ordre de grandeur).
 */
export const ECHELLES = [
  { id: 'lan', echelle: 'LAN', court: 'Dans le car', nom: 'Dans le car : pupitre → baie technique', km: 0.03, support: 'cuivre ou fibre, commutateurs du car', debit: 10e9, equip: 0.01 },
  { id: 'lan2', echelle: 'LAN', court: 'Dans le stade', nom: 'Dans le stade : car → caméra, local technique', km: 1, support: 'fibre posée pour le match', debit: 10e9, equip: 0.01 },
  { id: 'man', echelle: 'MAN', court: 'Stade → nodal', nom: 'Stade → nodal de l\'opérateur, même agglomération', km: 15, support: 'fibre de l\'opérateur', debit: 10e9, equip: 0.1 },
  { id: 'wan', echelle: 'WAN', court: 'Lens → Paris', nom: 'Lens → régie finale à Paris', km: 250, support: 'fibre de l\'opérateur (le câble suit les routes)', debit: 1e9, equip: 0.5 },
  { id: 'wan-int', echelle: 'WAN', court: 'Par Internet', nom: 'Lens → régie à l\'étranger, par Internet', km: 1500, support: 'Internet (plusieurs opérateurs)', debit: 0.1e9, equip: 5 },
  { id: 'sat', echelle: 'WAN', court: 'Satellite', nom: 'Car → satellite géostationnaire → téléport', km: 0, support: 'liaison satellite (DSNG)', debit: 0.04e9, equip: 10 },
  { id: 'cell', echelle: 'WAN', court: 'Sac 4G/5G', nom: 'Sac à dos 4G/5G (cartes SIM agrégées)', km: 300, support: 'réseau mobile + Internet', debit: 0.02e9, equip: 40 },
];
/** latence aller simple d'une échelle (ms) : propagation + équipements + sérialisation d'un paquet de 1 500 octets */
export function latenceEchelle(e) {
  const prop = e.id === 'sat' ? bondGeo() : propagationFibre(e.km);
  const ser = serialisation(1500, e.debit) / 1000;
  return { prop, ser, equip: e.equip, total: prop + ser + e.equip };
}

// ======================================================================================
// Câbles et liens Ethernet (IEEE 802.3) : débit, support, portée
// ======================================================================================
/** @type {{ nom: string, debit: number, support: 'cuivre' | 'mm' | 'sm' | 'dac', cable: string, portee: number, note?: string }[]} */
export const LIENS = [
  { nom: '1000BASE-T', debit: 1, support: 'cuivre', cable: 'paires torsadées Cat 5e ou mieux (RJ45)', portee: 100 },
  { nom: '2.5GBASE-T', debit: 2.5, support: 'cuivre', cable: 'Cat 5e', portee: 100 },
  { nom: '5GBASE-T', debit: 5, support: 'cuivre', cable: 'Cat 6', portee: 100 },
  { nom: '10GBASE-T', debit: 10, support: 'cuivre', cable: 'Cat 6A (Cat 6 : 55 m au plus)', portee: 100 },
  { nom: 'Câble DAC (twinax)', debit: 25, support: 'dac', cable: 'cuivre serti sur deux modules SFP', portee: 5, note: 'entre deux appareils d\'une même baie' },
  { nom: '1000BASE-SX', debit: 1, support: 'mm', cable: 'fibre multimode (OM2 et mieux)', portee: 550 },
  { nom: '10GBASE-SR', debit: 10, support: 'mm', cable: 'multimode OM3 (OM4 : 400 m)', portee: 300 },
  { nom: '25GBASE-SR', debit: 25, support: 'mm', cable: 'multimode OM3 (OM4 : 100 m)', portee: 70 },
  { nom: '100GBASE-SR4', debit: 100, support: 'mm', cable: 'multimode OM3, 4 paires de fibres (OM4 : 100 m)', portee: 70 },
  { nom: '1000BASE-LX', debit: 1, support: 'sm', cable: 'fibre monomode (modules courants : 10 km)', portee: 5000 },
  { nom: '10GBASE-LR', debit: 10, support: 'sm', cable: 'fibre monomode', portee: 10000 },
  { nom: '25GBASE-LR', debit: 25, support: 'sm', cable: 'fibre monomode', portee: 10000 },
  { nom: '100GBASE-LR4', debit: 100, support: 'sm', cable: 'fibre monomode, 4 longueurs d\'onde', portee: 10000 },
  { nom: '10GBASE-ER', debit: 10, support: 'sm', cable: 'fibre monomode', portee: 40000 },
];
/** les liens qui tiennent un débit (Gb/s) sur une distance (m), du moins cher au plus cher (cuivre, multimode, monomode) */
export function liensPossibles(debitG, metres) {
  const rang = { dac: 0, cuivre: 1, mm: 2, sm: 3 };
  return LIENS.filter((l) => l.debit >= debitG && l.portee >= metres).sort((a, b) => rang[a.support] - rang[b.support] || a.debit - b.debit || a.portee - b.portee);
}

// ======================================================================================
// Unicast, diffusion, multicast
// ======================================================================================
/**
 * Un émetteur, un flux de d Mb/s, n récepteurs intéressés parmi m machines du réseau.
 * Ce que porte le lien de l'émetteur, et combien de machines reçoivent le flux sans l'avoir demandé.
 */
export function modesEnvoi(mode, n, m, d) {
  if (mode === 'unicast') return { lienSource: n * d, recus: n, inutiles: 0, copies: n };
  if (mode === 'broadcast') return { lienSource: d, recus: m, inutiles: m - n, copies: 1 };
  return { lienSource: d, recus: n, inutiles: 0, copies: 1 }; // multicast avec snooping IGMP
}

// ======================================================================================
// TCP et UDP
// ======================================================================================
/**
 * Débit utile d'une connexion TCP (bit/s) : le plus petit du lien, de la fenêtre / RTT, et de la
 * limite due aux pertes (Mathis). rtt en ms, perte en fraction (0,01 = 1 %), fenêtre en octets.
 */
export function debitTcp({ lien, rtt, perte, mss = 1460, fenetre = 4 * 1024 * 1024 }) {
  const r = rtt / 1000;
  const parFenetre = r > 0 ? (fenetre * 8) / r : Infinity;
  const parPertes = perte > 0 && r > 0 ? ((mss * 8) / r) * (1.22 / Math.sqrt(perte)) : Infinity;
  const debit = Math.min(lien, parFenetre, parPertes);
  const limite = debit === lien ? 'le lien' : debit === parFenetre ? 'la fenêtre' : 'les pertes';
  return { debit, parFenetre, parPertes, limite };
}
/** un flux à débit constant sur UDP : ce qui arrive, ce qui manque (rien n'est renvoyé) */
export function fluxUdp({ debit, perte, paquetsParS }) {
  return { recu: debit * (1 - perte), perdusParS: paquetsParS * perte };
}
/** un flux à débit constant sur TCP : il ne tient que si TCP peut aller plus vite que lui ; chaque perte retarde d'au moins un RTT */
export function fluxTcp({ debit, lien, rtt, perte }) {
  const t = debitTcp({ lien, rtt, perte });
  return { tient: t.debit >= debit * 1.05, debitTcp: t.debit, retardPerte: rtt, limite: t.limite };
}

// ======================================================================================
// Streaming : contribution et diffusion
// ======================================================================================
/** repères SRT : multiplicateur du RTT selon le taux de pertes (guide de déploiement Haivision) */
const SRT_PALIERS = [[0.01, 3], [0.03, 4], [0.07, 6], [0.10, 8], [0.12, 10], [0.20, 13], [0.40, 20]];
/** latence SRT conseillée (ms) ; null au-delà de 40 % de pertes */
export function latenceSrt(rtt, perte) {
  const pal = SRT_PALIERS.find(([p]) => perte <= p);
  if (!pal) return null;
  return Math.max(120, pal[1] * rtt);
}
/**
 * Latence de bout en bout (ms, ordre de grandeur) et comportement face aux pertes de chaque protocole.
 * @param {'rtp' | 'srt' | 'rtmp' | 'hls' | 'llhls'} proto
 * @param {{ rtt: number, perte: number, segment?: number, debit?: number, lien?: number }} o segment en s, débits en bit/s
 */
export function streaming(proto, o) {
  const un = o.rtt / 2, seg = o.segment || 6;
  if (proto === 'rtp') {
    const tampon = 20; // tampon de gigue d'un récepteur RTP
    return { latence: un + tampon, pertes: o.perte > 0 ? 'images abîmées : rien n\'est renvoyé (FEC possible, ST 2022-1)' : 'aucune', ok: o.perte <= 0.0001, transport: 'UDP' };
  }
  if (proto === 'srt') {
    const l = latenceSrt(o.rtt, o.perte);
    return l == null
      ? { latence: Infinity, pertes: 'trop de pertes : SRT ne rattrape plus', ok: false, transport: 'UDP' }
      : { latence: un + l, pertes: 'paquets perdus redemandés et renvoyés dans le délai de latence réglé', ok: true, transport: 'UDP' };
  }
  if (proto === 'rtmp') {
    const t = fluxTcp({ debit: o.debit || 8e6, lien: o.lien || 100e6, rtt: o.rtt, perte: o.perte });
    return { latence: un + 2000, pertes: t.tient ? 'renvoyés par TCP : retard, mais rien ne manque' : `TCP ralentit (${(t.debitTcp / 1e6).toFixed(1)} Mb/s possibles) : le flux prend du retard puis décroche`, ok: t.tient, transport: 'TCP' };
  }
  // HLS / DASH : encodage (≈ 1 s), un segment entier à fabriquer, puis trois segments d'avance dans le
  // lecteur ; en LL-HLS, des parties d'environ 1 s remplacent les segments
  const morceau = proto === 'llhls' ? 1 : seg;
  return { latence: un + 1000 + morceau * 1000 + 3 * morceau * 1000, pertes: 'renvoyés par TCP (HTTP) ; le lecteur change de qualité si le débit baisse', ok: true, transport: 'TCP (HTTP)' };
}

// ======================================================================================
// QoS : files d'attente
// ======================================================================================
/** classes de trafic du car IP, de la plus prioritaire à la moins prioritaire */
export const CLASSES = [
  { id: 'ptp', nom: 'PTP (horloge)', dscp: 46, phb: 'EF', octets: 90 },
  { id: 'audio', nom: 'Audio ST 2110-30', dscp: 34, phb: 'AF41', octets: 300 },
  { id: 'video', nom: 'Vidéo ST 2110-20', dscp: 34, phb: 'AF41', octets: 1500 },
  { id: 'ctrl', nom: 'Contrôle (NMOS, RCP)', dscp: 16, phb: 'CS2', octets: 500 },
  { id: 'fichiers', nom: 'Fichiers, mises à jour', dscp: 0, phb: 'BE (par défaut)', octets: 1500 },
];
/** valeur du champ DSCP d'un PHB : EF 46, AFxy = 8x + 2y, CSx = 8x, BE 0 */
export function dscp(phb) {
  if (phb === 'EF') return 46;
  let m = /^AF([1-4])([1-3])$/.exec(phb); if (m) return 8 * +m[1] + 2 * +m[2];
  m = /^CS([0-7])$/.exec(phb); if (m) return 8 * +m[1];
  return 0;
}
/**
 * Attente d'un paquet de chaque classe quand une rafale est déjà en file sur le port de sortie.
 * FIFO : chacun attend toute la rafale. Priorité stricte : un paquet n'attend que les classes plus
 * prioritaires que lui (ici, rien d'autre en file) et la fin de la trame en cours d'envoi (≤ 1 500 octets).
 * @param {number} rafale octets déjà en file (fichiers, vidéo d'une image…)
 * @param {number} lien bit/s du port de sortie
 * @param {'fifo' | 'prio'} mode
 */
export function attenteFile(rafale, lien, mode) {
  const enCours = serialisation(1500, lien);
  return CLASSES.map((c) => {
    const attente = mode === 'fifo' || c.id === 'fichiers' ? serialisation(rafale, lien) : enCours;
    return { ...c, attente, total: attente + serialisation(c.octets, lien) };
  });
}
/** erreur de PTP due à une attente asymétrique (µs) : la moitié de la différence aller / retour */
export const erreurPtp = (aller, retour) => Math.abs(aller - retour) / 2;

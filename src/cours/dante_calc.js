// @ts-check
// ----------------------------------------------------------------------------------
// Les calculs de la leçon « Dante : l'audio sur le réseau » (cours/son_console.js), repris par sa vue 3D et
// son exercice : purs, testés (tests/unit/son-console.test.mjs).
//  · un canal : 48 000 échantillons de 24 bits par seconde, 1,152 Mb/s de charge utile ;
//  · un flux : des paquets réguliers (1 ms ici, comme le profil par défaut d'AES67) qui portent les
//    échantillons de quelques canaux ; en-têtes comptés comme ceux d'AES67 (RTP 12, UDP 8, IPv4 20, Ethernet
//    18 avec le contrôle, 20 de préambule et d'intervalle sur le fil) : Dante a ses propres en-têtes, du même
//    ordre de grandeur (le débit réel est à lire dans Dante Controller) ;
//  · des flux de quelques canaux (4 au plus par défaut, ordre de grandeur) : en unicast, une copie par
//    récepteur abonné ; en multicast, une seule copie, recopiée par le réseau ;
//  · la latence choisie dans Dante Controller (0,25 à 5 ms selon les appareils, 1 ms par défaut) doit couvrir le
//    trajet le plus long : à chaque commutateur, la sérialisation du paquet et l'attente derrière les trames
//    déjà en file (modèle simple d'une file : une trame de 1 538 octets × charge ÷ (1 − charge)) ;
//  · l'horloge : un leader PTP élu ; un appareil « Preferred Leader » l'emporte, sinon la plus petite identité
//    (règle finale du BMCA, simplifiée) ;
//  · QoS recommandée par Audinate : DSCP 56 (CS7) pour les messages PTP qui datent, 46 (EF) pour l'audio.
// ----------------------------------------------------------------------------------

/** charge utile d'un canal, en bit/s */
export const canalUtile = (fs = 48000, bits = 24) => fs * bits;
/** les en-têtes d'un paquet audio sur le fil, en octets (comptés comme AES67 : RTP, UDP, IPv4, Ethernet, préambule et intervalle) */
export const ENTETES = { rtp: 12, udp: 8, ip: 20, eth: 18, fil: 20 };
export const ENTETES_TOTAL = Object.values(ENTETES).reduce((s, v) => s + v, 0);
/** canaux au plus dans un flux unicast, par défaut (ordre de grandeur) */
export const CANAUX_PAR_FLUX = 4;
/** les latences proposées par Dante Controller, en ms (selon l'appareil) */
export const LATENCES = [0.25, 0.5, 1, 2, 5];
export const LATENCE_DEFAUT = 1;
/** QoS recommandée par Audinate */
export const DSCP = { ptp: { valeur: 56, nom: 'CS7' }, audio: { valeur: 46, nom: 'EF' } };
/** la plus grande trame Ethernet sur le fil (1 500 d'IP, 18 d'en-tête et de contrôle, 20 de préambule et d'intervalle) */
export const TRAME_MAX = 1538;

/**
 * Un flux audio : sa taille de paquet et son débit sur le fil.
 * @param {{ canaux: number, fs?: number, bits?: number, paquetMs?: number }} o
 */
export function flux(o) {
  const fs = o.fs ?? 48000, bits = o.bits ?? 24, ms = o.paquetMs ?? 1;
  const ech = Math.round(fs * ms / 1000);
  const utiles = ech * o.canaux * bits / 8;
  const fil = utiles + ENTETES_TOTAL;
  const pps = 1000 / ms;
  return { ech, utiles, fil, pps, debit: fil * 8 * pps, debitUtile: canalUtile(fs, bits) * o.canaux, surcout: ENTETES_TOTAL / fil };
}
/** combien de flux unicast pour envoyer n canaux d'un émetteur vers un récepteur */
export const fluxPour = (/** @type {number} */ canaux, parFlux = CANAUX_PAR_FLUX) => Math.ceil(canaux / parFlux);
/**
 * Ce qu'un émetteur envoie pour que r récepteurs reçoivent ses n canaux, en flux de quelques canaux : en unicast,
 * chaque flux part une fois par récepteur ; en multicast, une seule fois, et le réseau le recopie.
 * @param {{ canaux: number, recepteurs: number, multicast: boolean, parFlux?: number, paquetMs?: number }} o
 */
export function emission(o) {
  const par = o.parFlux ?? CANAUX_PAR_FLUX, copies = o.multicast ? 1 : o.recepteurs;
  // les flux d'un émetteur : des flux pleins, le dernier peut-être partiel
  const pleins = Math.floor(o.canaux / par), reste = o.canaux - pleins * par;
  const unJeu = pleins * flux({ canaux: par, paquetMs: o.paquetMs }).debit + (reste ? flux({ canaux: reste, paquetMs: o.paquetMs }).debit : 0);
  return { flux: fluxPour(o.canaux, par) * copies, debit: unJeu * copies };
}
/** la charge d'un lien : débit (bit/s) sur sa capacité (Mb/s) */
export const charge = (/** @type {number} */ debit, /** @type {number} */ lienMbps) => debit / (lienMbps * 1e6);

/**
 * Le retard d'un paquet sur le trajet, en µs : à chaque bond (commutateur), sa sérialisation et l'attente derrière
 * les trames déjà en file, selon la charge du lien de sortie.
 * @param {{ bonds: number, lienMbps: number, octets: number, charge?: number }} o
 */
export function delaiChemin(o) {
  const r = o.lienMbps * 1e6, ch = Math.min(0.97, Math.max(0, o.charge ?? 0));
  const ser = o.octets * 8 / r * 1e6;
  const attente = TRAME_MAX * 8 / r * 1e6 * ch / (1 - ch);
  const parBond = ser + attente;
  return { ser, attente, parBond, total: o.bonds * parBond + ser };
}
/** la latence choisie couvre-t-elle le trajet ? marge en µs (négative : des paquets arrivent trop tard, le son claque) */
export function tient(/** @type {number} */ latenceMs, /** @type {number} */ delaiUs) {
  const marge = latenceMs * 1000 - delaiUs;
  return { ok: marge > 0, marge };
}
/** la plus petite latence de la liste qui couvre le trajet, avec une marge (×2) pour la gigue */
export function latenceConseillee(/** @type {number} */ delaiUs) {
  return LATENCES.find((l) => l * 1000 >= 2 * delaiUs) ?? LATENCES[LATENCES.length - 1];
}

/**
 * Le leader d'horloge (élection PTP, simplifiée) : un appareil « Preferred Leader » d'abord (s'il y en a
 * plusieurs, ou aucun, la plus petite identité d'horloge, tirée de l'adresse MAC, l'emporte).
 * @param {{ nom: string, id: string, preferred?: boolean, externe?: boolean }[]} apps
 */
export function leader(apps) {
  const pool = apps.some((a) => a.preferred) ? apps.filter((a) => a.preferred) : apps;
  return pool.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0] || null;
}
/** les adresses d'un appareil Dante sans serveur DHCP : link-local 169.254.0.0/16 sur le primaire */
export const SANS_DHCP = { primaire: '169.254.0.0/16', secondaire: '172.31.0.0/16' };

// @ts-check
import { parseIp, parseMask, sameNet, ipStr, netOf } from '../../net/ctrlnet.js';

// ----------------------------------------------------------------------------------
// Le DMX de l'atelier « DMX et Art-Net » (Labo). Calcul pur.
//   - DMX512 (ANSI E1.11) : un univers = 512 canaux de 8 bits (0 à 255), envoyés en série à
//     250 kbit/s sur une paire torsadée (RS-485), XLR 5 broches. Une trame : la coupure (break,
//     176 µs ici, au moins 92 µs), la marque qui suit (12 µs), puis le code de début et les canaux,
//     11 bits chacun (44 µs). 512 canaux : 22,8 ms, 44 trames par seconde au plus.
//   - Un appareil occupe une suite de canaux (son empreinte, qui dépend de son mode) à partir de son
//     adresse de départ : le suivant commence à adresse + empreinte. Un paramètre sur 16 bits prend
//     deux canaux (grossier puis fin).
//   - La ligne : 32 récepteurs au plus par segment (charges unitaires RS-485), environ 300 m de câble
//     120 Ω (ordre de grandeur), une terminaison de 120 Ω au bout ; pas de dérivation en Y : un
//     splitter (répartiteur isolé) pour faire plusieurs branches.
//   - Art-Net 4 : UDP port 6454 ; l'univers est un Port-Address de 15 bits = Net (7 bits), Sub-Net
//     (4 bits), Universe (4 bits) ; adresses d'usine 2.x.x.x ou 10.x.x.x en /8. Une console numérote
//     souvent ses univers à partir de 1 : son univers 1 part en Port-Address 0.
//   - sACN (ANSI E1.31) : univers 1 à 63 999, en multicast vers 239.255.(u ÷ 256).(u mod 256), port 5568.
// ----------------------------------------------------------------------------------
export const CANAUX = 512;
export const TIMING = { debit: 250000, breakUs: 176, mabUs: 12, slotUs: 44 };
export const LIGNE = { recepteurs: 32, longueur: 300, ohms: 120 };
export const ARTNET = { port: 6454, maxPortAddress: 32767 };
export const SACN = { port: 5568, min: 1, max: 63999 };

/**
 * @typedef {object} Modele un type d'appareil (générique) et ses modes
 * @property {string} id
 * @property {string} nom
 * @property {Record<string, string[]>} modes nom du mode → fonction de chaque canal
 */
/** @type {Record<string, Modele>} */
export const MODELES = {
  par: { id: 'par', nom: 'PAR LED RGBW', modes: { '4 canaux': ['Rouge', 'Vert', 'Bleu', 'Blanc'], '8 canaux': ['Intensité', 'Rouge', 'Vert', 'Bleu', 'Blanc', 'Stroboscope', 'Macro couleur', 'Vitesse'] } },
  panneau: { id: 'panneau', nom: 'Panneau LED bicolore', modes: { '2 canaux': ['Intensité', 'Température'], '4 canaux': ['Intensité', 'Intensité fin', 'Température', 'Stroboscope'] } },
  decoupe: { id: 'decoupe', nom: 'Découpe LED', modes: { '1 canal': ['Intensité'], '5 canaux': ['Intensité', 'Intensité fin', 'Stroboscope', 'Courbe', 'Ventilation'] } },
  lyre: { id: 'lyre', nom: 'Lyre spot', modes: { '16 canaux': ['Pan', 'Pan fin', 'Tilt', 'Tilt fin', 'Vitesse', 'Intensité', 'Obturateur', 'Couleur', 'Gobo', 'Rotation gobo', 'Prisme', 'Focus', 'Zoom', 'Iris', 'Frost', 'Contrôle'], '24 canaux': ['Pan', 'Pan fin', 'Tilt', 'Tilt fin', 'Vitesse', 'Intensité', 'Intensité fin', 'Obturateur', 'Cyan', 'Magenta', 'Jaune', 'CTO', 'Couleur', 'Gobo', 'Rotation gobo', 'Gobo 2', 'Prisme', 'Rotation prisme', 'Focus', 'Zoom', 'Iris', 'Frost', 'Effets', 'Contrôle'] } },
  gradateur: { id: 'gradateur', nom: 'Bloc gradateur 6 circuits', modes: { '6 canaux': ['Circuit 1', 'Circuit 2', 'Circuit 3', 'Circuit 4', 'Circuit 5', 'Circuit 6'] } },
};
/** empreinte (nombre de canaux) d'un modèle dans un mode */
export const empreinte = (/** @type {string} */ modele, /** @type {string} */ mode) => { const M = MODELES[modele]; return M && M.modes[mode] ? M.modes[mode].length : 0; };
/** adresse de départ de l'appareil suivant */
export const suivante = (adresse, fp) => adresse + fp;
/** dernier canal occupé */
export const dernier = (adresse, fp) => adresse + fp - 1;

/**
 * @typedef {{ id: string, nom: string, modele: string, mode: string, adresse: number }} Appareil un appareil patché (adresse 0 : pas patché)
 */
/**
 * Le plan d'un univers : qui occupe quel canal, les conflits, ce qui dépasse.
 * @param {Appareil[]} list
 */
export function planUnivers(list) {
  /** @type {string[][]} */ const occ = Array.from({ length: CANAUX + 1 }, () => []);
  const depasse = [], invalides = [];
  for (const a of list) {
    const fp = empreinte(a.modele, a.mode);
    if (!(a.adresse >= 1 && a.adresse <= CANAUX) || !Number.isInteger(a.adresse)) { if (a.adresse) invalides.push(a.id); continue; }
    if (dernier(a.adresse, fp) > CANAUX) depasse.push(a.id);
    for (let c = a.adresse; c <= Math.min(CANAUX, dernier(a.adresse, fp)); c++) occ[c].push(a.id);
  }
  const conflits = new Set(); for (const o of occ) if (o.length > 1) for (const id of o) conflits.add(id);
  return { occ, conflits: [...conflits], depasse, invalides, libres: occ.slice(1).filter((o) => !o.length).length };
}
/** les appareils sont patchés à la suite à partir de depart, dans l'ordre de la liste, sans trou ni chevauchement */
export function aLaSuite(/** @type {Appareil[]} */ list, depart) {
  let a = depart;
  for (const x of list) { if (x.adresse !== a) return false; a = suivante(a, empreinte(x.modele, x.mode)); }
  return dernier(a, 0) <= CANAUX;
}

// ---------------- valeurs ----------------
/** valeur DMX (0 à 255) d'un pourcentage */
export const valeur8 = (pct) => Math.round(Math.min(Math.max(pct, 0), 100) / 100 * 255);
/** pourcentage d'une valeur DMX */
export const pct8 = (v) => v / 255 * 100;
/** un paramètre sur 16 bits : la valeur (0 à 65 535), l'octet grossier et l'octet fin */
export function valeur16(pct) {
  const v = Math.round(Math.min(Math.max(pct, 0), 100) / 100 * 65535);
  return { v, grossier: v >> 8, fin: v & 255 };
}
/** adresse absolue (1 à …) d'un univers et d'une adresse (« 3.017 » → 1 041) */
export const absolue = (univers, adresse) => (univers - 1) * CANAUX + adresse;
/** univers et adresse d'une adresse absolue */
export const versUA = (abs) => ({ univers: Math.floor((abs - 1) / CANAUX) + 1, adresse: ((abs - 1) % CANAUX) + 1 });
/** les commutateurs DIP (1, 2, 4… 256) d'une adresse : les interrupteurs levés */
export const dip = (adresse) => Array.from({ length: 9 }, (_, k) => !!((adresse >> k) & 1));
/** l'adresse que donnent des commutateurs DIP levés */
export const deDip = (/** @type {boolean[]} */ dips) => dips.reduce((s, on, k) => s + (on ? 1 << k : 0), 0);

// ---------------- la trame et la ligne ----------------
/** durée d'une trame (µs) de n canaux, et trames par seconde */
export function trame(n = CANAUX) {
  const us = TIMING.breakUs + TIMING.mabUs + TIMING.slotUs * (n + 1);
  return { us, hz: 1e6 / us };
}
/**
 * Le diagnostic d'une ligne DMX : branches (une sans splitter), récepteurs par branche, longueur,
 * terminaison, dérivation en Y.
 * @param {{ recepteurs: number, longueur: number, terminaison: boolean, y: boolean, splitter: number }} L
 *   splitter : nombre de sorties du répartiteur (0 : pas de répartiteur) ; les récepteurs se partagent les branches
 */
export function diagLigne(L) {
  const branches = Math.max(1, L.splitter || 1);
  const parBranche = Math.ceil(L.recepteurs / branches);
  const pb = [];
  if (L.y) pb.push({ id: 'y', t: 'Une dérivation en Y : le signal se réfléchit au bout de chaque branche. Un splitter fait des branches propres.' });
  if (parBranche > LIGNE.recepteurs) pb.push({ id: 'charge', t: `${parBranche} récepteurs sur une branche : au-delà de ${LIGNE.recepteurs}, l'émetteur RS-485 ne tient plus le niveau. Un splitter partage la ligne.` });
  if (L.longueur > LIGNE.longueur) pb.push({ id: 'longueur', t: `${L.longueur} m de câble : au-delà de ${LIGNE.longueur} m environ, le signal s'affaiblit et se déforme. Un splitter (qui régénère) ou un nœud réseau près des projecteurs.` });
  if (!L.terminaison) pb.push({ id: 'terminaison', t: `Pas de terminaison de ${LIGNE.ohms} Ω au bout : le signal se réfléchit et les projecteurs du bout clignotent ou décrochent.` });
  return { ok: pb.length === 0, pb, branches, parBranche };
}

// ---------------- Art-Net et sACN ----------------
/** le Port-Address d'Art-Net (15 bits) */
export const portAddress = (net, sub, uni) => ((net & 127) << 8) | ((sub & 15) << 4) | (uni & 15);
/** Net, Sub-Net et Universe d'un Port-Address */
export const dePortAddress = (pa) => ({ net: (pa >> 8) & 127, sub: (pa >> 4) & 15, uni: pa & 15 });
/** l'adresse multicast sACN d'un univers */
export const sacnMulticast = (u) => `239.255.${(u >> 8) & 255}.${u & 255}`;
/** le débit d'un univers en Art-Net (ArtDmx de 530 octets, en-têtes UDP, IP, Ethernet, préambule et intervalle compris), en kbit/s */
export function debitArtnet(hz = 44) {
  const octets = 18 + CANAUX + 8 + 20 + 14 + 4 + 8 + 12;
  return { octets, kbps: octets * 8 * hz / 1000 };
}
/**
 * La console joint-elle le nœud ? (même sous-réseau, même protocole, le bon univers).
 * @param {{ ip: string, masque: string, protocole: 'artnet' | 'sacn', univers: number }} console univers numérotés à partir de 1
 * @param {{ ip: string, masque: string, protocole: 'artnet' | 'sacn', net: number, sub: number, uni: number, sacn: number }} noeud
 */
export function liaison(console, noeud) {
  const pb = [];
  const ci = parseIp(console.ip), ni = parseIp(noeud.ip), cm = parseMask(console.masque), nm = parseMask(noeud.masque);
  if (ci == null) pb.push({ id: 'ip-console', t: 'L\'adresse IP de la console n\'est pas valide.' });
  if (ni == null) pb.push({ id: 'ip-noeud', t: 'L\'adresse IP du nœud n\'est pas valide.' });
  if (cm == null || nm == null) pb.push({ id: 'masque', t: 'Un masque n\'est pas valide.' });
  if (ci != null && ni != null && ci === ni) pb.push({ id: 'meme-ip', t: 'La console et le nœud ont la même adresse : conflit.' });
  if (ci != null && ni != null && cm != null && nm != null && !(sameNet(ci, ni, cm) && sameNet(ci, ni, nm))) pb.push({ id: 'reseau', t: `Pas dans le même sous-réseau (${ipStr(netOf(ci, cm))}/${cm} et ${ipStr(netOf(ni, nm))}/${nm}) : sans routeur, ils ne se joignent pas.` });
  if (console.protocole !== noeud.protocole) pb.push({ id: 'protocole', t: `La console parle ${console.protocole === 'artnet' ? 'Art-Net' : 'sACN'}, le nœud écoute ${noeud.protocole === 'artnet' ? 'Art-Net' : 'sACN'}.` });
  else if (console.protocole === 'artnet') {
    const attendu = console.univers - 1, recu = portAddress(noeud.net, noeud.sub, noeud.uni);
    if (attendu !== recu) pb.push({ id: 'univers', t: `La console envoie son univers ${console.univers} en Port-Address ${attendu} ; le nœud écoute ${recu} (Net ${noeud.net}, Sub-Net ${noeud.sub}, Universe ${noeud.uni}).` });
  } else if (console.univers !== noeud.sacn) pb.push({ id: 'univers', t: `La console envoie l'univers sACN ${console.univers} (${sacnMulticast(console.univers)}) ; le nœud écoute l'univers ${noeud.sacn}.` });
  return { ok: pb.length === 0, pb };
}

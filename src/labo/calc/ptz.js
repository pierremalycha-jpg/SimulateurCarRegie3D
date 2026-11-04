// @ts-check
import { parseIp, ipStr, parseMask, netOf, bcastOf, maskOf } from '../../net/ctrlnet.js';
import { filesQos } from '../../cours/ip_calc.js';

// ----------------------------------------------------------------------------------
// Le modèle de l'atelier « Caméras PTZ » du Labo (v19.30) : un banc de mise en service comme celui du BTS,
// des caméras tourelles Panasonic AW-HE130 et AW-UE20, un pupitre AW-RP150, un PC technique avec Easy IP
// Setup et un navigateur, un switch PoE+ administrable. Pur, sans affichage : l'atelier l'affiche
// (labo/ateliers/ptz.js), les défis le jugent (labo/defis/ptz.js), les leçons du chapitre « Les caméras PTZ »
// en tirent leurs chiffres (cours/ptz*.js), les tests le rejouent.
//
// Ce qui est modélisé :
//   - le lien et l'alimentation : chaque appareil sur un port du switch ; le port en PoE (802.3af, 15,4 W
//     à la source) ou PoE+ (802.3at, 30 W) ; le switch réserve la puissance de la classe annoncée et coupe
//     les derniers ports quand son budget est dépassé ; un appareil qui demande du PoE+ ne démarre pas en PoE ;
//   - l'adressage : adresse, masque, passerelle, port HTTP ; deux appareils se joignent s'ils sont dans le
//     même VLAN, chacun voit l'autre dans son sous-réseau, et aucune des deux adresses n'est en double ;
//   - Easy IP Setup : la recherche par diffusion trouve les caméras du VLAN du PC, même hors de son
//     sous-réseau, et les distingue par leur adresse MAC ; elle ne change les réglages réseau qu'au cours
//     des 20 minutes qui suivent la mise sous tension (réglage d'usine de la caméra) ;
//   - la page web de la caméra : l'adresse et le port de l'URL, le compte administrateur à créer au
//     premier accès ;
//   - le pupitre : sa propre adresse, puis une adresse (et le port HTTP) par numéro de caméra ;
//   - la qualité de service : le marquage DSCP des flux de la caméra, la confiance et les files du switch,
//     sur un lien engorgé (calcul des files de cours/ip_calc.js) ;
//   - la mise en service pas à pas (etapes) : ce qui est fait, d'après l'état.
// Les chiffres du constructeur sont dans MODELES (sources dans le README, section v19.30) ; une valeur qui
// n'est qu'un ordre de grandeur est marquée comme telle.
// ----------------------------------------------------------------------------------

/** les modes PoE d'un port : puissance garantie à la source (pse) et reçue par l'appareil (pd), en W (IEEE 802.3) */
export const POE = {
  off: { nom: 'Coupé', court: 'coupé', pse: 0, pd: 0, norme: '' },
  af: { nom: 'PoE (802.3af, 15,4 W)', court: 'PoE', pse: 15.4, pd: 12.95, norme: 'IEEE 802.3af' },
  at: { nom: 'PoE+ (802.3at, 30 W)', court: 'PoE+', pse: 30, pd: 25.5, norme: 'IEEE 802.3at' },
};
const RANG_POE = { off: 0, af: 1, at: 2 };
/** la classe PoE : puissance réservée à la source par un switch qui alloue à la classe */
export const CLASSES_POE = { 0: 15.4, 1: 4, 2: 7, 3: 15.4, 4: 30 };

/** les réglages d'usine Panasonic (modes d'emploi des AW-HE130, AW-UE20, AW-RP150) */
export const USINE = { ip: '192.168.0.10', masque: '255.255.255.0', passerelle: '192.168.0.1', http: 80 };
/**
 * Les appareils du banc.
 *   poe : le mode qu'il lui faut (null : alimenté par le secteur) ; classe : la classe PoE qu'il annonce ;
 *   conso : sa consommation en PoE, en W (ordre de grandeur de la fiche technique) ;
 *   usine : son adresse en sortant du carton.
 */
export const MODELES = {
  he130: {
    nom: 'AW-HE130', type: 'camera', poe: 'at', classe: 4, conso: 25, dc: 21.6,
    capteur: 'trois capteurs MOS 1/2,86 pouce (Full HD)', zoom: 'zoom optique 20× (4,5 à 90 mm)', sorties: '3G-SDI, HDMI, IP (H.264 ; NDI|HX sous licence)',
    // micrologiciel 2.00 et suivants : la fenêtre d'Easy IP Setup est « Unlimited » d'usine ; un compte d'usine (admin) à changer
    usine: { ...USINE }, periode: 'illimite', compte: { user: 'admin', usine: true },
  },
  ue20: {
    nom: 'AW-UE20', type: 'camera', poe: 'at', classe: 4, conso: 17, dc: 15.6,
    capteur: 'un capteur MOS 4K 1/2,8 pouce', zoom: 'zoom optique 12× (3,9 à 46,8 mm)', sorties: '3G-SDI, HDMI, USB, IP (H.264, H.265 ; RTSP, RTMP, SRT)',
    // fenêtre d'Easy IP Setup : 20 min d'usine ; pas de compte : il se crée au premier accès à la page web
    usine: { ...USINE }, periode: '20min', compte: null,
  },
  rp150: {
    // l'adresse du pupitre : celle des exemples de mise en service Panasonic (192.168.0.9), à lire au menu RP IP SET
    nom: 'AW-RP150', type: 'pupitre', poe: 'at', classe: 4, conso: 25, dc: 12,
    usine: { ip: '192.168.0.9', masque: '255.255.255.0', passerelle: '192.168.0.1', http: 80 },
  },
  pc: { nom: 'PC technique', type: 'pc', poe: null, classe: null, conso: 0, usine: { ip: '192.168.1.20', masque: '255.255.255.0', passerelle: '192.168.1.1', http: 0 } },
};
/** le switch du banc : un switch PoE+ administrable à 8 ports (budget : ordre de grandeur d'un modèle courant) */
export const SWITCH = { ports: 8, budget: 124 };
/** la fenêtre d'Easy IP Setup après la mise sous tension, en minutes (réglage d'usine de la caméra) */
export const FENETRE_EASYIP = 20;
/** la règle du banc pour un mot de passe (bonne pratique, pas une exigence du constructeur) */
export const MDP = { min: 8, max: 32 };
/** le compte d'usine d'une AW-HE130 (mode d'emploi) : à changer avant d'exploiter */
export const COMPTE_USINE = { user: 'admin', mdp: '12345' };

// ---------------- adresses ----------------
/** l'adresse lisible (null si la saisie n'en est pas une) */
export const ipOk = (s) => parseIp(s) != null;
/** le préfixe d'un masque (null si ce n'est pas un masque) */
export const prefixe = (m) => { const p = parseMask(m); return p == null || p < 8 || p > 30 ? null : p; };
/** l'adresse du réseau et la diffusion d'une adresse et de son masque */
export function reseauDe(ip, masque) {
  const n = parseIp(ip), p = prefixe(masque); if (n == null || p == null) return null;
  return { reseau: ipStr(netOf(n, p)), diffusion: ipStr(bcastOf(n, p)), p, hotes: 2 ** (32 - p) - 2 };
}
/** une adresse utilisable par un appareil dans ce réseau (ni l'adresse du réseau ni la diffusion) */
export function adresseHote(ip, masque) {
  const n = parseIp(ip), p = prefixe(masque); if (n == null || p == null) return false;
  return n !== netOf(n, p) && n !== bcastOf(n, p);
}
/** b est-il dans le sous-réseau de a, vu avec le masque de a ? */
export function dansReseau(ipA, masqueA, ipB) {
  const a = parseIp(ipA), b = parseIp(ipB), p = prefixe(masqueA); if (a == null || b == null || p == null) return false;
  return netOf(a, p) === netOf(b, p);
}
/** le masque pour un préfixe (« 255.255.255.0 » pour 24) */
export const masqueDe = (p) => ipStr(maskOf(p));
/** l'adresse n d'un réseau (« 192.168.10.0 », 11 → « 192.168.10.11 ») */
export const hote = (reseau, n) => ipStr(((parseIp(reseau) || 0) + n) >>> 0);

// ---------------- l'état ----------------
/**
 * @typedef {object} Appareil
 * @property {string} id
 * @property {string} nom ce qu'on lit sur l'étiquette (« CAM 1 »)
 * @property {keyof MODELES} modele
 * @property {string} mac
 * @property {number} port port du switch (0 : débranché)
 * @property {string} ip
 * @property {string} masque
 * @property {string} passerelle
 * @property {number} http port HTTP (caméras)
 * @property {boolean} [dhcp]
 * @property {boolean} [secteur] son bloc secteur 12 V est branché : il ne demande pas de PoE au switch
 * @property {null | { user: string, usine?: boolean }} [compte] le compte administrateur de la page web (null : à créer ; usine : celui du carton, à changer)
 * @property {'20min' | 'illimite'} [periode] la fenêtre d'Easy IP Setup
 * @property {number | null} [t0] la minute de mise sous tension (null : éteint)
 * @property {number} [dscp] le marquage DSCP de ses flux vidéo
 * @property {boolean} [flux] son flux vidéo IP (H.264) est diffusé sur le réseau
 * @property {number} [debit] le débit de ce flux, en Mb/s
 */
/**
 * @typedef {object} Port
 * @property {number} n
 * @property {'off' | 'af' | 'at'} poe
 * @property {number} vlan
 */
/** les ports du switch, réglage d'usine : PoE+ partout, tout dans le VLAN 1 */
/** @returns {Port[]} */
export const portsUsine = () => Array.from({ length: SWITCH.ports }, (_, i) => ({ n: i + 1, poe: /** @type {'off' | 'af' | 'at'} */ ('at'), vlan: 1 }));
/** une adresse MAC Panasonic de démonstration (le préfixe du constructeur, puis un numéro) */
export const macDe = (k) => `08-00-23-${['4A', '5B', '6C', '7D', '8E', '9F'][k % 6]}-${(16 + k * 37).toString(16).toUpperCase().padStart(2, '0').slice(-2)}-${(40 + k * 53).toString(16).toUpperCase().padStart(2, '0').slice(-2)}`;
/** un appareil tel qu'il sort du carton */
export function appareilUsine(id, nom, modele, k, port = 0) {
  const M = MODELES[modele];
  /** @type {Appareil} */
  const a = { id, nom, modele, mac: macDe(k), port, ...M.usine };
  if (M.type === 'camera') Object.assign(a, { secteur: false, dhcp: false, compte: M.compte ? { ...M.compte } : null, periode: M.periode, t0: null, dscp: 0, flux: false, debit: 20 });
  if (M.type === 'pupitre') Object.assign(a, { secteur: false, t0: null });
  if (M.type === 'pc') Object.assign(a, { t0: 0 });
  return a;
}
/** le plan d'adressage type (la fiche de configuration du banc) */
export function planType(reseau = '192.168.10.0', p = 24) {
  return { reseau, p, masque: masqueDe(p), passerelle: hote(reseau, 1), pc: hote(reseau, 100), rp: hote(reseau, 10), cams: { cam1: hote(reseau, 11), cam2: hote(reseau, 12), cam3: hote(reseau, 13) }, http: 80, dscp: 34, vlan: 1 };
}
/** le banc, état de départ : tout est sorti du carton et posé sur la table, rien n'est branché */
export function bancUsine() {
  return {
    minutes: 0,
    switch: { budget: SWITCH.budget, ports: portsUsine(), qos: { confiance: 'aucune', files: 'fifo' }, lien: 100 },
    appareils: [
      appareilUsine('pc', 'PC technique', 'pc', 0, 0),
      appareilUsine('cam1', 'CAM 1', 'he130', 1, 0),
      appareilUsine('cam2', 'CAM 2', 'he130', 2, 0),
      appareilUsine('cam3', 'CAM 3', 'ue20', 3, 0),
      appareilUsine('rp', 'Pupitre', 'rp150', 4, 0),
    ],
    // le pupitre : une adresse et un port par numéro de caméra ; les caméras testées (bougées depuis le pupitre)
    rp: { cams: /** @type {Record<string, { ip: string, port: number }>} */ ({}), sel: 1, testees: /** @type {string[]} */ ([]) },
    easyip: { cherche: false },
    transfert: 0,
    plan: planType(),
  };
}
const app = (st, id) => st.appareils.find((a) => a.id === id) || null;
export const appareil = app;
export const cameras = (st) => st.appareils.filter((a) => MODELES[a.modele].type === 'camera');

// ---------------- le lien et l'alimentation ----------------
/**
 * Ce que fait le switch : pour chaque appareil, son lien, son alimentation et la puissance réservée. Le switch
 * alloue la puissance de la classe annoncée, port par port dans l'ordre ; au-delà du budget, il refuse les ports
 * suivants (priorité au plus petit numéro, comme la plupart des switchs à priorité égale).
 * @returns {{ par: Record<string, { lien: boolean, alimente: boolean, reserve: number, conso: number, pb: string }>, reserve: number, conso: number, budget: number, depasse: boolean }}
 */
export function alimentation(st) {
  /** @type {Record<string, { lien: boolean, alimente: boolean, reserve: number, conso: number, pb: string }>} */
  const par = {}; let reserve = 0, conso = 0; let depasse = false;
  const ports = st.switch.ports;
  // deux appareils sur le même port : seul le premier a le lien
  const pris = new Set();
  const tri = [...st.appareils].sort((a, b) => (a.port || 99) - (b.port || 99));
  for (const a of tri) {
    const M = MODELES[a.modele], P = ports.find((x) => x.n === a.port);
    const r = { lien: false, alimente: false, reserve: 0, conso: 0, pb: '' };
    par[a.id] = r;
    if (!P) { r.pb = 'débranché'; r.alimente = !M.poe || !!a.secteur; continue; }
    if (pris.has(P.n)) { r.pb = `le port ${P.n} est déjà pris`; r.alimente = !M.poe || !!a.secteur; continue; }
    pris.add(P.n); r.lien = true;
    if (!M.poe) { r.alimente = true; continue; } // le PC est sur le secteur
    if (a.secteur) { r.alimente = true; continue; } // sur son bloc 12 V : rien à réserver sur le switch
    if (P.poe === 'off') { r.pb = `pas de PoE sur le port ${P.n}`; continue; }
    if (RANG_POE[P.poe] < RANG_POE[M.poe]) { r.pb = `${M.nom} demande du ${POE[M.poe].court} (classe ${M.classe}) : le port ${P.n} ne donne que ${fmt(POE[P.poe].pse)} W`; continue; }
    const res = CLASSES_POE[M.classe];
    if (reserve + res > st.switch.budget + 1e-9) { r.pb = `budget PoE du switch dépassé (${fmt(reserve)} W déjà réservés sur ${fmt(st.switch.budget)} W)`; depasse = true; continue; }
    reserve += res; conso += M.conso; Object.assign(r, { alimente: true, reserve: res, conso: M.conso });
  }
  return { par, reserve, conso, budget: st.switch.budget, depasse };
}
const fmt = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
/**
 * Met à jour la minute de mise sous tension de chaque appareil (t0) d'après l'alimentation : un appareil qui
 * s'allume la prend, un appareil qui s'éteint la perd. Couper puis rendre le PoE d'un port redémarre l'appareil.
 */
export function majTension(st) {
  const A = alimentation(st);
  for (const a of st.appareils) {
    const on = A.par[a.id] && A.par[a.id].alimente;
    if (on && (a.t0 == null)) a.t0 = st.minutes;
    if (!on && MODELES[a.modele].poe && !a.secteur) a.t0 = null;
  }
  return st;
}
/** l'appareil est allumé et a son lien */
export function enMarche(st, id) { const A = alimentation(st).par[id]; return !!(A && A.lien && A.alimente); }
/** depuis combien de minutes il est sous tension (null : éteint) */
export function depuis(st, id) { const a = app(st, id); return a && a.t0 != null && enMarche(st, id) ? st.minutes - a.t0 : null; }

// ---------------- qui joint qui ----------------
/** l'adresse effective d'un appareil (en DHCP sans serveur sur le banc : aucune) */
export const adresse = (a) => (a.dhcp ? null : ipOk(a.ip) ? a.ip : null);
/** les adresses en double parmi les appareils en marche : { ip: [ids] } */
export function doublons(st) {
  /** @type {Record<string, string[]>} */ const m = {};
  for (const a of st.appareils) { const ip = adresse(a); if (ip && enMarche(st, a.id)) (m[ip] = m[ip] || []).push(a.id); }
  return Object.fromEntries(Object.entries(m).filter(([, v]) => v.length > 1));
}
/**
 * a joint-il b (une requête de a, la réponse de b) ? Les deux en marche, dans le même VLAN, des adresses
 * valides, chacun voit l'autre dans son sous-réseau, et l'adresse de b n'est pas en double (la réponse
 * viendrait de n'importe lequel des deux : rien de sûr). Pas de routeur sur le banc.
 * @returns {{ ok: boolean, pb: string }}
 */
export function joint(st, idA, idB) {
  const a = app(st, idA), b = app(st, idB);
  if (!a || !b) return { ok: false, pb: 'appareil inconnu' };
  if (!enMarche(st, idA)) return { ok: false, pb: `${a.nom} n'est pas en marche (${alimentation(st).par[idA].pb})` };
  if (!enMarche(st, idB)) return { ok: false, pb: `${b.nom} n'est pas en marche (${alimentation(st).par[idB].pb})` };
  const pa = st.switch.ports.find((x) => x.n === a.port), pb = st.switch.ports.find((x) => x.n === b.port);
  if (pa.vlan !== pb.vlan) return { ok: false, pb: `${a.nom} est dans le VLAN ${pa.vlan}, ${b.nom} dans le VLAN ${pb.vlan} : le switch ne les relie pas` };
  const ia = adresse(a), ib = adresse(b);
  if (!ib) return { ok: false, pb: b.dhcp ? `${b.nom} attend une adresse en DHCP : il n'y a pas de serveur DHCP sur le banc` : `l'adresse de ${b.nom} n'est pas valide` };
  if (!ia) return { ok: false, pb: a.dhcp ? `${a.nom} attend une adresse en DHCP : il n'y a pas de serveur DHCP sur le banc` : `l'adresse de ${a.nom} n'est pas valide` };
  if (prefixe(a.masque) == null) return { ok: false, pb: `le masque de ${a.nom} (${a.masque}) n'est pas un masque` };
  if (prefixe(b.masque) == null) return { ok: false, pb: `le masque de ${b.nom} (${b.masque}) n'est pas un masque` };
  const d = doublons(st);
  if (d[ib]) return { ok: false, pb: `${ib} est en double (${d[ib].map((id) => app(st, id).nom).join(', ')}) : les réponses se mélangent` };
  if (!dansReseau(ia, a.masque, ib)) return { ok: false, pb: `${b.nom} (${ib}) n'est pas dans le sous-réseau de ${a.nom} (${reseauDe(ia, a.masque).reseau}/${prefixe(a.masque)}) et le banc n'a pas de routeur` };
  if (!dansReseau(ib, b.masque, ia)) return { ok: false, pb: `${b.nom} ne voit pas ${a.nom} dans son sous-réseau (masque ${b.masque}) : il ne sait pas lui répondre` };
  return { ok: true, pb: '' };
}

// ---------------- Easy IP Setup (sur le PC technique) ----------------
/**
 * La liste d'Easy IP Setup après « Search » : les caméras en marche du segment Ethernet du PC (même VLAN),
 * quelle que soit leur adresse IP (la recherche part en diffusion et revient par la MAC) ; elle ne traverse
 * pas de routeur. Une caméra réglée sur « 20min » n'est plus affichée passé 20 minutes sous tension
 * (masquees) : on la redémarre, ou l'on règle « Unlimited » dans sa page web.
 */
export function rechercheEasyIp(st) {
  const pc = app(st, 'pc');
  if (!pc || !enMarche(st, 'pc')) return { ok: false, pb: 'le PC n\'est pas branché au switch', liste: [], masquees: [] };
  const vlanPc = st.switch.ports.find((x) => x.n === pc.port).vlan;
  const vues = cameras(st).filter((c) => enMarche(st, c.id) && st.switch.ports.find((x) => x.n === c.port).vlan === vlanPc);
  const visible = (c) => c.periode === 'illimite' || (depuis(st, c.id) ?? 0) < FENETRE_EASYIP;
  const liste = vues.filter(visible).map((c) => ({ id: c.id, mac: c.mac, ip: c.dhcp ? '0.0.0.0' : c.ip, masque: c.masque, passerelle: c.passerelle, http: c.http, modele: MODELES[c.modele].nom, nom: c.nom, dhcp: !!c.dhcp, minutes: depuis(st, c.id) ?? 0, joignable: joint(st, 'pc', c.id).ok }));
  return { ok: true, pb: '', liste, masquees: vues.filter((c) => !visible(c)).map((c) => c.id) };
}
/**
 * « Network Settings » d'Easy IP Setup : rend le réglage à poser, ou pourquoi la caméra le refuse.
 * @param {{ ip: string, masque: string, passerelle: string, http: number, dhcp?: boolean }} r
 * @returns {{ ok: boolean, pb: string, patch: Record<string, any> }}
 */
export function reglerEasyIp(st, id, r) {
  const R = rechercheEasyIp(st), L = R.liste.find((x) => x.id === id);
  if (R.masquees.includes(id)) return { ok: false, pb: `la caméra est sous tension depuis plus de ${FENETRE_EASYIP} minutes : Easy IP Setup ne la voit plus. Redémarrez-la (couper puis rendre son PoE), ou réglez « Unlimited » dans sa page web.`, patch: {} };
  if (!L) return { ok: false, pb: 'caméra introuvable : faites d\'abord une recherche', patch: {} };
  if (!r.dhcp) {
    if (!ipOk(r.ip)) return { ok: false, pb: `« ${r.ip} » n'est pas une adresse IPv4`, patch: {} };
    if (prefixe(r.masque) == null) return { ok: false, pb: `« ${r.masque} » n'est pas un masque de sous-réseau`, patch: {} };
    if (!adresseHote(r.ip, r.masque)) return { ok: false, pb: `${r.ip} est l'adresse du réseau ou de diffusion avec ce masque : pas une adresse d'appareil`, patch: {} };
    if (r.passerelle && !ipOk(r.passerelle)) return { ok: false, pb: `« ${r.passerelle} » n'est pas une adresse de passerelle`, patch: {} };
    if (r.passerelle && !dansReseau(r.ip, r.masque, r.passerelle)) return { ok: false, pb: `la passerelle ${r.passerelle} n'est pas dans le sous-réseau de la caméra`, patch: {} };
  }
  const http = Math.round(Number(r.http));
  if (!(http === 80 || (http >= 1 && http <= 65535))) return { ok: false, pb: 'le port HTTP va de 1 à 65 535', patch: {} };
  // la caméra redémarre son réseau avec les nouveaux réglages
  return { ok: true, pb: '', patch: { [`appareils.${id}.ip`]: r.ip, [`appareils.${id}.masque`]: r.masque, [`appareils.${id}.passerelle`]: r.passerelle || '', [`appareils.${id}.http`]: http, [`appareils.${id}.dhcp`]: !!r.dhcp } };
}

// ---------------- la page web de la caméra (navigateur du PC) ----------------
/** lit une URL tapée : « 192.168.0.10 », « http://192.168.0.10:8080/ » */
export function lireUrl(s) {
  const m = String(s || '').trim().match(/^(?:(https?):\/\/)?([^/:\s]+)(?::(\d{1,5}))?(\/.*)?$/i);
  if (!m) return null;
  const https = (m[1] || '').toLowerCase() === 'https';
  return { https, hote: m[2], port: m[3] ? Number(m[3]) : https ? 443 : 80 };
}
/**
 * Ce que montre le navigateur du PC pour cette URL.
 * @returns {{ ok: boolean, cam: string | null, pb: string, code: 'ok' | 'url' | 'delai' | 'refuse' | 'compte' }}
 */
export function ouvrirUrl(st, url) {
  const u = lireUrl(url);
  if (!u || !ipOk(u.hote)) return { ok: false, cam: null, code: 'url', pb: 'Tapez l\'adresse IP de la caméra, par exemple http://192.168.0.10 (et :port si son port HTTP n\'est pas 80).' };
  const cible = st.appareils.find((a) => adresse(a) === u.hote && a.id !== 'pc' && enMarche(st, a.id) && MODELES[a.modele].type === 'camera');
  const j = cible ? joint(st, 'pc', cible.id) : { ok: false, pb: `aucune caméra ne répond à ${u.hote}` };
  if (!cible || !j.ok) return { ok: false, cam: cible ? cible.id : null, code: 'delai', pb: `Délai de connexion dépassé : ${j.pb}.` };
  if (u.https) return { ok: false, cam: cible.id, code: 'refuse', pb: 'Connexion refusée : la caméra répond en HTTP sur ce banc (HTTPS n\'est pas activé).' };
  if (u.port !== cible.http) return { ok: false, cam: cible.id, code: 'refuse', pb: `Connexion refusée : ${cible.nom} écoute en HTTP sur le port ${cible.http}, pas ${u.port}.` };
  if (!cible.compte) return { ok: true, cam: cible.id, code: 'compte', pb: '' };
  return { ok: true, cam: cible.id, code: 'ok', pb: '' };
}
/**
 * Le compte administrateur (création au premier accès, ou changement du compte d'usine) : la règle du banc,
 * une bonne pratique (8 caractères au moins, pas le nom, pas le mot de passe d'usine), pas celle du constructeur.
 */
export function verifierCompte(user, mdp, mdp2) {
  const u = String(user || '').trim(), p = String(mdp || '');
  if (!/^[A-Za-z0-9_.-]{1,32}$/.test(u)) return { ok: false, pb: 'Nom d\'utilisateur : 1 à 32 caractères, lettres, chiffres, point, tiret ou souligné.' };
  if (p.length < MDP.min || p.length > MDP.max) return { ok: false, pb: `Mot de passe : ${MDP.min} à ${MDP.max} caractères.` };
  if (p === COMPTE_USINE.mdp || p.toLowerCase() === u.toLowerCase() || /^(.)\1+$/.test(p)) return { ok: false, pb: 'Mot de passe trop facile : ni le nom, ni le mot de passe d\'usine, ni un seul caractère répété.' };
  if (p !== mdp2) return { ok: false, pb: 'Les deux mots de passe ne sont pas identiques.' };
  return { ok: true, pb: '' };
}

// ---------------- le pupitre AW-RP150 ----------------
/**
 * Les caméras du pupitre : pour chaque numéro enregistré, la caméra trouvée et l'état de la liaison.
 * @returns {Array<{ n: number, ip: string, port: number, cam: string | null, ok: boolean, pb: string }>}
 */
export function liaisonsPupitre(st) {
  return Object.entries(st.rp.cams || {}).map(([k, r]) => {
    const n = Number(k);
    if (!r || !r.ip) return { n, ip: '', port: 80, cam: null, ok: false, pb: 'pas d\'adresse' };
    const cam = st.appareils.find((a) => MODELES[a.modele].type === 'camera' && adresse(a) === r.ip && enMarche(st, a.id));
    if (!cam) return { n, ip: r.ip, port: r.port, cam: null, ok: false, pb: `aucune caméra ne répond à ${r.ip}` };
    const j = joint(st, 'rp', cam.id);
    if (!j.ok) return { n, ip: r.ip, port: r.port, cam: cam.id, ok: false, pb: j.pb };
    if (Number(r.port) !== cam.http) return { n, ip: r.ip, port: r.port, cam: cam.id, ok: false, pb: `${cam.nom} écoute sur le port ${cam.http}, le pupitre l'appelle sur le port ${r.port}` };
    // une caméra sans compte administrateur est vue mais ne se pilote pas (modes d'emploi de la gamme UE)
    if (!cam.compte) return { n, ip: r.ip, port: r.port, cam: cam.id, ok: false, pb: `${cam.nom} n'a pas encore de compte administrateur : le pupitre la voit mais ne peut pas la piloter` };
    return { n, ip: r.ip, port: r.port, cam: cam.id, ok: true, pb: '' };
  }).sort((a, b) => a.n - b.n);
}
/** la caméra pilotée par le numéro n du pupitre (null si la liaison ne tient pas) */
export function camDuNumero(st, n) { const L = liaisonsPupitre(st).find((x) => x.n === n); return L && L.ok ? L.cam : null; }

// ---------------- la qualité de service ----------------
/**
 * Le lien du PC (port du switch vers le PC technique, qui reçoit les flux IP des caméras) : les flux des
 * caméras qui diffusent, les commandes (le pupitre et la page web, quelques dizaines de kb/s : ordre de
 * grandeur) et un transfert de fichiers vers le PC. Le switch classe un flux en « médias » s'il fait confiance
 * au DSCP et que la caméra marque AF41 (34) ou EF (46) ; sinon tout part au mieux. En files « fifo », tout
 * attend dans la même file ; en « prio », la file des médias passe d'abord.
 */
export function qos(st) {
  const flux = cameras(st).filter((c) => c.flux && enMarche(st, c.id));
  const confiance = st.switch.qos.confiance === 'dscp';
  const media = (c) => confiance && (c.dscp === 34 || c.dscp === 46);
  const offert = { media: 0, commande: 0.1, fichiers: Number(st.transfert) || 0 };
  for (const c of flux) { if (media(c)) offert.media += c.debit; else offert.fichiers += c.debit; }
  const F = filesQos(offert, st.switch.lien, st.switch.qos.files === 'prio' ? 'prio' : 'fifo');
  const parCam = Object.fromEntries(flux.map((c) => { const cl = media(c) ? 'media' : 'fichiers'; return [c.id, { classe: cl, pertePct: F.classes[cl].pertePct, retardMs: F.classes[cl].retardMs }]; }));
  const pertesVideo = Math.max(0, ...Object.values(parCam).map((x) => x.pertePct));
  return { flux: flux.map((c) => c.id), offert, F, parCam, pertesVideo, charge: F.charge, ok: pertesVideo < 0.01 };
}
/** l'octet ToS (ou Traffic Class) qui porte un DSCP : DSCP × 4 */
export const tosDe = (dscp) => dscp * 4;
/** les valeurs DSCP qu'on rencontre (RFC 2474, 2597, 3246, 4594) */
export const DSCP = { DF: 0, CS1: 8, AF11: 10, AF21: 18, AF31: 26, CS4: 32, AF41: 34, CS5: 40, EF: 46, CS6: 48 };
/** le DSCP d'une classe AFxy : 8x + 2y */
export const dscpAF = (x, y) => 8 * x + 2 * y;

// ---------------- la mise en service, pas à pas ----------------
/**
 * Les étapes de la mise en service du banc, d'après la fiche de configuration (st.plan) : chacune dit si elle
 * est faite, et sinon ce qui manque. La suivante à faire est la première qui ne l'est pas.
 * @returns {Array<{ id: string, titre: string, fait: boolean, reste: string, vue: string, pc?: string }>}
 */
export function etapes(st) {
  const P = st.plan, A = alimentation(st), cams = cameras(st);
  const nomDe = (id) => (app(st, id) || { nom: id }).nom;
  const liste = (ids) => ids.map(nomDe).join(', ');
  const E = [];
  const nonBranches = st.appareils.filter((a) => !A.par[a.id].lien).map((a) => a.id);
  E.push({ id: 'cabler', titre: 'Brancher chaque appareil sur un port du switch', vue: 'banc', fait: !nonBranches.length, reste: nonBranches.length ? `à brancher : ${liste(nonBranches)}` : '' });
  const eteints = st.appareils.filter((a) => A.par[a.id].lien && !A.par[a.id].alimente).map((a) => a.id);
  E.push({ id: 'alimenter', titre: 'Alimenter les caméras et le pupitre en PoE+', vue: 'banc', fait: !nonBranches.length && !eteints.length, reste: eteints.length ? `${liste(eteints)} : ${A.par[eteints[0]].pb}` : nonBranches.length ? 'branchez d\'abord tout le monde' : '' });
  const pc = app(st, 'pc');
  const pcOk = pc.ip === P.pc && prefixe(pc.masque) === P.p && !pc.dhcp;
  E.push({ id: 'pc', titre: `Adresser le PC technique : ${P.pc} / ${P.masque}`, vue: 'pc', pc: 'reseau', fait: pcOk, reste: pcOk ? '' : `le PC est en ${pc.dhcp ? 'DHCP' : pc.ip + ' / ' + pc.masque}` });
  E.push({ id: 'chercher', titre: 'Chercher les caméras avec Easy IP Setup', vue: 'pc', pc: 'easyip', fait: !!st.easyip.cherche, reste: st.easyip.cherche ? '' : 'cliquez sur « Search » dans Easy IP Setup' });
  const malAdr = cams.filter((c) => c.dhcp || c.ip !== P.cams[c.id] || prefixe(c.masque) !== P.p || c.passerelle !== P.passerelle);
  E.push({ id: 'adresser', titre: 'Donner à chaque caméra l\'adresse du plan (Network Settings)', vue: 'pc', pc: 'easyip', fait: !malAdr.length, reste: malAdr.length ? `à régler : ${liste(malAdr.map((c) => c.id))}` : '' });
  const sansCompte = cams.filter((c) => !c.compte || c.compte.usine);
  E.push({ id: 'compte', titre: 'Ouvrir la page web de chaque caméra : créer le compte administrateur, ou changer celui d\'usine', vue: 'pc', pc: 'web', fait: !sansCompte.length, reste: sansCompte.length ? `à faire : ${sansCompte.map((c) => `${c.nom} (${c.compte ? 'compte d\'usine' : 'pas de compte'})`).join(', ')}` : '' });
  const rp = app(st, 'rp');
  const rpOk = rp.ip === P.rp && prefixe(rp.masque) === P.p && rp.passerelle === P.passerelle;
  E.push({ id: 'pupitre', titre: `Adresser le pupitre : ${P.rp} / ${P.masque}`, vue: 'pupitre', fait: rpOk, reste: rpOk ? '' : `le pupitre est en ${rp.ip} / ${rp.masque}` });
  const L = liaisonsPupitre(st);
  const manque = cams.filter((c, k) => { const l = L.find((x) => x.n === k + 1); return !l || !l.ok || l.cam !== c.id; });
  E.push({ id: 'enregistrer', titre: 'Enregistrer CAM 1, 2 et 3 sous les numéros 1, 2 et 3 du pupitre', vue: 'pupitre', fait: !manque.length, reste: manque.length ? `pas encore reliées : ${liste(manque.map((c) => c.id))}` : '' });
  const qosOk = cams.every((c) => c.dscp === P.dscp) && st.switch.qos.confiance === 'dscp' && st.switch.qos.files === 'prio';
  E.push({ id: 'qos', titre: `Marquer les flux des caméras en DSCP ${P.dscp} (AF41) et régler le switch : confiance DSCP, file prioritaire`, vue: 'banc', fait: qosOk, reste: qosOk ? '' : !st.switch.qos.confiance || st.switch.qos.confiance !== 'dscp' ? 'le switch ne lit pas encore le DSCP' : st.switch.qos.files !== 'prio' ? 'le switch n\'a qu\'une file' : 'des caméras ne marquent pas encore leurs flux' });
  const nonTestees = cams.filter((c) => !(st.rp.testees || []).includes(c.id));
  E.push({ id: 'recette', titre: 'La recette : bouger chaque caméra depuis le pupitre', vue: 'pupitre', fait: !nonTestees.length && !manque.length, reste: nonTestees.length ? `pas encore bougées : ${liste(nonTestees.map((c) => c.id))}` : '' });
  return E;
}
/** la recette du banc : chaque caméra jointe par le PC et pilotée par le pupitre */
export function recette(st) {
  const cams = cameras(st);
  const L = liaisonsPupitre(st);
  const pb = [];
  for (const c of cams) {
    const j = joint(st, 'pc', c.id); if (!j.ok) pb.push(`PC → ${c.nom} : ${j.pb}`);
    if (!L.some((l) => l.ok && l.cam === c.id)) { const l = L.find((x) => x.cam === c.id); pb.push(`Pupitre → ${c.nom} : ${l ? l.pb : 'pas enregistrée au pupitre'}`); }
  }
  return { ok: !pb.length, pb };
}

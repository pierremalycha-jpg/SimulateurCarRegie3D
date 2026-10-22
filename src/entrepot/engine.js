// @ts-check
import { CATALOGUE, portOf, compatibles } from './catalogue/index.js';
import { parseIp, ipStr, parseMask, netOf, sameNet } from '../net/ctrlnet.js';

// ----------------------------------------------------------------------------------
// Le moteur de l'entrepôt : à partir du montage (build.js) et du catalogue, il calcule ce qui
// marche vraiment. Pur (pas de DOM, pas d'état caché) : evaluate(build) renvoie un Eval
// (types.js). Les panneaux, la 3D et les missions lisent ce résultat ; rien d'autre ne décide.
//
// Ce qu'il calcule, dans l'ordre :
//   1. les câbles : chaque liaison est-elle valable (signal, sens, connecteurs) ;
//   2. l'énergie : qui est alimenté (secteur par le mur et les bandeaux, 12 V par un bloc, PoE+ par
//      un port de switch qui le fournit, dans la limite de son budget), qui est allumé ;
//   3. l'IP : domaines de niveau 2 (switchs et VLAN de leurs ports, switch interne de l'ATEM, ports
//      LAN du routeur, câble direct), adresses effectives (fixe, DHCP d'un routeur, sinon
//      169.254.x.y), conflits d'adresses, qui joint qui (même domaine, même sous-réseau) ;
//   4. la vidéo : ce qui arrive sur chaque entrée SDI/HDMI (source, format, audio embarqué), en
//      traversant les boucles (HyperDeck, Teranex, RP150), le Teranex embedder (il remplace une
//      paire par son micro), les mélangeurs (PGM, PVW, AUX, multiview ; une entrée d'un autre
//      format est refusée) et le PC de régie en vMix (DeckLink entrées / sorties, NDI|HX) ;
//   5. les services : RP150 → caméras (HTTP 80, ou série), GPI & Tally → ATEM (9910), PC → ATEM,
//      ATEM → HyperDeck (9993), vMix → caméras (HTTP, NDI|HX), streaming → Internet par le routeur,
//      l'enregistrement (HyperDeck, ISO de l'ATEM), le Teranex (paire embarquée / désembarquée) ;
//   6. le tally : du mélangeur aux caméras, par le chemin qui existe (GPI & Tally Interface →
//      RP150 TALLY/GPIO 1 → TALLY IP → caméras ; Carbonite TALLY → RP150 ; vMix → caméras en IP) ;
//   7. les alertes (par appareil) : ce qui manque, en français, pour le panneau et le tuteur.
//
// Les clés de configuration lues ici sont celles du brief (cfg.reseau, format, pgm, aux, sorties, audio,
// cameras, tallyIp, tallyIn, atemIp, hyperdecks, source, media, distant, enregistre, paire,
// entree, ports[n].vlan / poe, lan.dhcp, wan, logiciel, decklink, vmix…). Les identifiants de
// ports attendus : sdi-in-N, sdi-out-pgm, sdi-out-aux-N, sdi-out-mv, hdmi-out, lan / lan-N,
// gpio1, tally, relais-N, serial / serial-N, rs422, sd1, sd2, usbc / usbc-N, audio-in-N,
// decklink-N (PC), wan (routeur). Tout le reste se déduit du signal et du sens des ports.
// ----------------------------------------------------------------------------------
/** @typedef {import('./types.js').Build} Build */
/** @typedef {import('./types.js').Eval} Eval */
/** @typedef {import('./types.js').Appareil} Appareil */
/** @typedef {import('./types.js').Modele} Modele */
/** @typedef {import('./types.js').Port} Port */
/** @typedef {import('./types.js').Flux} Flux */

/** budget électrique des prises murales (W), et d'un bandeau (W) */
export const MUR_W = 3680, BANDEAU_W = 2300;
/** adresse de secours quand un appareil en DHCP ne trouve pas de serveur (lien local, RFC 3927) */
export const LINK_LOCAL = '169.254.0.0/16';

const key = (dev, port) => `${dev}:${port}`;
export { key as portKey };
/** le numéro qui termine un identifiant de port (lan-12 → 12, sdi-in-3 → 3, decklink-2 → 2 ; 0 sinon) */
export const numOf = (/** @type {string} */ id) => { const m = String(id || '').match(/(\d+)$/); return m ? +m[1] : 0; };
/** numéro de port de switch pour cfg.ports[n] : lan-N → N, sfp-K → 26 + K (après les 26 ports cuivre) */
export const switchPortNum = (/** @type {string} */ id) => (/^sfp/.test(id) ? 26 + numOf(id) : numOf(id));

// ---------------- ce qu'un appareil « est », d'après son modèle et sa configuration ----------------
const isSwitch = (/** @type {Modele} */ m, /** @type {any} */ cfg) => !!m && m.famille === 'reseau' && !!cfg && !!cfg.ports && typeof cfg.ports === 'object';
const isRouteur = (/** @type {Modele} */ m, /** @type {any} */ cfg) => !!m && m.famille === 'reseau' && !!cfg && !!cfg.lan && typeof cfg.lan === 'object';
const isMelangeur = (/** @type {Modele} */ m) => !!m && m.famille === 'melangeur';
const isVmix = (/** @type {Modele} */ m, /** @type {any} */ cfg) => !!m && m.famille === 'ordinateur' && !!cfg && cfg.logiciel === 'vmix';
const isCamera = (/** @type {Modele} */ m) => !!m && m.famille === 'camera';
const isPupitre = (/** @type {Modele} */ m, /** @type {any} */ cfg) => !!m && m.famille === 'pupitre' && !!cfg && Array.isArray(cfg.cameras);
const isEnregistreur = (/** @type {Modele} */ m, /** @type {any} */ cfg) => !!m && m.famille === 'enregistreur' && !!cfg && 'source' in cfg;
const isTeranex = (/** @type {Modele} */ m, /** @type {any} */ cfg) => !!m && m.famille === 'convertisseur' && !!cfg && cfg.paire != null;
const isEmbedder = (/** @type {Modele} */ m, /** @type {any} */ cfg) => isTeranex(m, cfg) && m.ports.some((p) => (p.sig === 'audio' || p.sig === 'aes') && p.dir === 'in');
const isGpiTally = (/** @type {Modele} */ m, /** @type {any} */ cfg) => !!m && !!cfg && 'atemIp' in cfg;
const isMedia = (/** @type {Modele} */ m) => !!m && (m.id === 'carte-sd' || m.id === 'disque-usbc' || m.ports.some((p) => p.sig === 'media' && p.dir === 'out'));
const isMicro = (/** @type {Modele} */ m) => !!m && m.famille === 'son' && m.ports.some((p) => p.sig === 'audio' && p.dir === 'out');
/** le modèle rend (serveur) ou demande (client) ce service ? sans liste de services : d'après la famille */
export function aService(/** @type {Modele} */ m, /** @type {string} */ id, role = 'serveur') {
  if (!m) return false;
  if (Array.isArray(m.services) && m.services.length) return m.services.some((s) => s.id === id && s.role === role);
  if (role === 'serveur') {
    if (id === 'ptz-http' || id === 'tally-ip' || id === 'web') return m.famille === 'camera';
    if (id === 'atem') return m.famille === 'melangeur' && /atem/.test(m.id);
    if (id === 'hyperdeck') return m.famille === 'enregistreur';
    if (id === 'rosstalk') return m.famille === 'melangeur' && /carbonite|ross/.test(m.id);
  }
  return false;
}
const isVideo = (/** @type {Port} */ p) => p.sig === 'sdi' || p.sig === 'hdmi';
/** sens effectif d'un port vidéo (une entrée/sortie de DeckLink suit cfg.decklink[n]) */
function dirVideo(/** @type {Port} */ p, /** @type {any} */ cfg) {
  if (p.dir !== 'io') return p.dir;
  const d = cfg && cfg.decklink ? cfg.decklink[numOf(p.id)] : '';
  return d === 'out' ? 'out' : 'in';
}
/** le format d'une caméra : sa configuration, sinon le premier du modèle */
const formatDe = (/** @type {Appareil} */ a, /** @type {Modele} */ m) => (a.cfg && a.cfg.format) || (m && m.formats && m.formats[0]) || '1080p50';
/** rôle d'une sortie de mélangeur : 'pgm', 'pvw', 'mv' ou un numéro d'entrée */
function roleSortie(/** @type {Port} */ p, /** @type {any} */ cfg, /** @type {Modele} */ m) {
  const id = p.id;
  // une sortie affectable (Carbonite : OUT n, HDMI OUT) : cfg.sorties[port] = 'pgm' | 'pvw' | 'mv' | n
  const choisi = cfg && cfg.sorties && typeof cfg.sorties === 'object' ? cfg.sorties[id] : undefined;
  if (choisi != null && choisi !== '') return /^\d+$/.test(String(choisi)) ? +choisi : String(choisi);
  if (/mv|multiview/.test(id)) return 'mv';
  if (/pvw|preview/.test(id)) return 'pvw';
  const aux = id.match(/aux-?(\d+)/);
  if (aux) { const v = cfg && cfg.aux ? cfg.aux[+aux[1]] : undefined; return v == null || v === '' ? 'pgm' : typeof v === 'number' || /^\d+$/.test(String(v)) ? +v : String(v); }
  if (p.sig === 'hdmi') { if (cfg && cfg.hdmiOut && typeof cfg.hdmiOut === 'string') return cfg.hdmiOut; return m.ports.some((q) => /mv|multiview/.test(q.id) && q.sig === 'sdi') ? 'mv' : 'pgm'; }
  return 'pgm';
}
/** copie d'un flux qui traverse un appareil (boucle, enregistreur en E-E) */
const via = (/** @type {Flux | null} */ f, /** @type {string} */ dev) => (f ? { ...f, audio: f.audio.map((x) => ({ ...x })), via: [...f.via, dev] } : null);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** adresse de lien local déterministe pour un appareil sans serveur DHCP */
function linkLocalFor(/** @type {string} */ uid, /** @type {Modele} */ m) {
  const u = m && m.cfg && m.cfg.reseau && linkLocal(m.cfg.reseau.ip) ? m.cfg.reseau.ip : (m && m.reseau && linkLocal(m.reseau.ip) ? m.reseau.ip : '');
  if (u) return u;
  let h = 7; for (const ch of uid) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `169.254.${1 + (h % 254)}.${1 + ((h >>> 8) % 254)}`;
}

/**
 * @param {Build} B
 * @returns {Eval}
 */
export function evaluate(B) {
  const E = /** @type {Eval} */ ({ power: {}, poe: {}, cables: {}, video: {}, ip: {}, reach: {}, services: {}, tally: {}, alertes: [], ver: 0 });
  const byUid = new Map(B.appareils.map((a) => [a.uid, a]));
  const M = (/** @type {Appareil} */ a) => (a ? CATALOGUE[a.modele] : undefined);
  const nom = (/** @type {string} */ uid) => { const a = byUid.get(uid); return a ? a.nom : '?'; };
  const cablesAt = (dev, port) => B.cables.filter((c) => (c.a.dev === dev && c.a.port === port) || (c.b.dev === dev && c.b.port === port));
  /** l'autre bout du câble branché sur ce port, s'il est valable */
  const peer = (dev, port, strict = true) => {
    const c = cablesAt(dev, port)[0]; if (!c) return null;
    if (strict && E.cables[c.uid] && !E.cables[c.uid].ok) return null;
    const o = c.a.dev === dev && c.a.port === port ? c.b : c.a; return { ...o, cable: c };
  };
  const on = (/** @type {string} */ uid) => !!(E.power[uid] && E.power[uid].on);
  const alerte = (/** @type {string} */ dev, /** @type {'erreur' | 'attention' | 'info'} */ level, /** @type {string} */ msg) => { if (!E.alertes.some((x) => x.dev === dev && x.msg === msg)) E.alertes.push({ dev, level, msg }); };

  // ---- 1. câbles ----
  for (const c of B.cables) {
    const A = byUid.get(c.a.dev), Bb = byUid.get(c.b.dev);
    const pa = A ? portOf(A.modele, c.a.port) : null, pb = Bb ? portOf(Bb.modele, c.b.port) : null;
    if (!pa || !pb) { E.cables[c.uid] = { ok: false, why: 'Un bout du câble ne mène nulle part.' }; continue; }
    const r = compatibles(pa, pb); E.cables[c.uid] = { ok: r.ok, why: r.why };
  }

  // ---- 2. énergie ----
  // le secteur se propage depuis le mur : mur → bandeau (interrupteur) → prises ; un appareil est
  // alimenté si un de ses ports secteur/12 V/PoE reçoit, et allumé si son interrupteur n'est pas sur arrêt
  const secteur = new Set(); // ports de sortie secteur sous tension : « dev:port »
  const murs = B.appareils.filter((a) => M(a) && M(a).pose === 'mur');
  for (const m of murs) for (const p of M(m).ports) if (p.sig === 'secteur' && p.dir === 'out') secteur.add(key(m.uid, p.id));
  const fedBy = (/** @type {Appareil} */ a) => {
    const m = M(a); if (!m) return null;
    for (const p of m.ports) {
      if (p.dir !== 'in' && p.dir !== 'io') continue;
      const o = peer(a.uid, p.id); if (!o) continue;
      if (p.sig === 'secteur' && secteur.has(key(o.dev, o.port))) return { source: 'secteur', via: o.dev, port: p.id };
      if (p.sig === 'dc12' && on(o.dev)) return { source: '12 V', via: o.dev, port: p.id };
      if (p.sig === 'ip' && p.poe) {
        const oa = byUid.get(o.dev); const om = oa ? M(oa) : null; const op = om ? om.ports.find((x) => x.id === o.port) : null;
        const coupe = oa && oa.cfg && oa.cfg.ports && oa.cfg.ports[switchPortNum(o.port)] && oa.cfg.ports[switchPortNum(o.port)].poe === false;
        if (op && op.poe && !coupe && on(o.dev)) return { source: 'PoE+', via: o.dev, port: p.id, watts: p.watts || 0 };
      }
    }
    return null;
  };
  // on itère : l'énergie se propage de proche en proche (mur → bandeau → bloc 12 V → appareil…)
  /** @type {Record<string, number>} puissance PoE+ débitée par switch (comptée une fois, à la dernière passe) */
  const poeUsed = {};
  /** @type {Record<string, ReturnType<typeof fedBy>>} par quoi chaque appareil est alimenté */
  const alimPar = {};
  for (let pass = 0; pass < 8; pass++) {
    for (const k of Object.keys(poeUsed)) poeUsed[k] = 0;
    for (const a of B.appareils) {
      const m = M(a); if (!m) continue;
      if (m.pose === 'mur') { E.power[a.uid] = { on: true, source: 'réseau électrique', why: '', watts: 0 }; continue; }
      const f = fedBy(a); alimPar[a.uid] = f;
      const sw = (a.cfg && a.cfg.interrupteur === false) || a.on === false;
      const needs = m.ports.some((p) => (p.sig === 'secteur' || p.sig === 'dc12' || (p.sig === 'ip' && p.poe)) && (p.dir === 'in' || p.dir === 'io'));
      if (!needs) { E.power[a.uid] = { on: true, source: 'sans alimentation', why: '', watts: 0 }; continue; }
      if (!f) { E.power[a.uid] = { on: false, source: '', why: 'Aucune alimentation branchée (secteur, 12 V ou PoE+).', watts: m.watts || 0 }; continue; }
      if (f.source === 'PoE+') poeUsed[f.via] = (poeUsed[f.via] || 0) + (f.watts || m.watts || 0);
      E.power[a.uid] = { on: !sw, source: f.source + (f.via && f.via !== 'mur' ? ` (${nom(f.via)})` : ''), why: sw ? 'Interrupteur sur arrêt.' : '', watts: m.watts || 0 };
      // ce que l'appareil fournit à son tour
      if (!sw) for (const p of m.ports) if ((p.sig === 'secteur' || p.sig === 'dc12') && p.dir === 'out') secteur.add(key(a.uid, p.id));
    }
  }
  // ce qu'un switch débite en PoE+ et un bloc en 12 V passe par leur prise secteur : on le replie dans leurs watts
  for (let pass = 0; pass < 2; pass++) {
    /** @type {Record<string, number>} */ const fournit = {};
    for (const a of B.appareils) { const f = alimPar[a.uid]; if (!f || !on(a.uid) || (f.source !== 'PoE+' && f.source !== '12 V')) continue; fournit[f.via] = (fournit[f.via] || 0) + (f.source === 'PoE+' ? (f.watts || (M(a) && M(a).watts) || 0) : ((M(a) && M(a).watts) || 0)); }
    for (const [uid, w] of Object.entries(fournit)) if (E.power[uid]) E.power[uid].watts = ((M(byUid.get(uid)) || {}).watts || 0) + w;
  }
  /** charge secteur en aval d'un appareil qui distribue le secteur (bandeau) : ses appareils, et les bandeaux qu'il alimente */
  const charge = (/** @type {string} */ uid, depth = 0) => { let w = 0; if (depth > 6) return 0; for (const a of B.appareils) { const f = alimPar[a.uid]; if (f && f.source === 'secteur' && f.via === uid && on(a.uid)) w += E.power[a.uid].watts + charge(a.uid, depth + 1); } return w; };
  for (const a of B.appareils) { const m = M(a); if (!m || m.pose === 'mur' || !on(a.uid) || !m.ports.some((p) => p.sig === 'secteur' && p.dir === 'out')) continue; const w = charge(a.uid); if (w > BANDEAU_W) alerte(a.uid, 'erreur', `${w} W sur un bandeau de 10 A (${BANDEAU_W} W) : son fusible saute.`); }
  // budget PoE des switchs
  for (const a of B.appareils) {
    const m = M(a); if (!m || !m.ports.some((p) => p.poe && p.sig === 'ip' && m.famille === 'reseau')) continue;
    const budget = Number((a.cfg && a.cfg.poeBudget) || (m.cfg && m.cfg.poeBudget) || 0);
    E.poe[a.uid] = { budget, used: Math.round(poeUsed[a.uid] || 0), ok: !budget || (poeUsed[a.uid] || 0) <= budget };
    if (!E.poe[a.uid].ok) alerte(a.uid, 'erreur', `Budget PoE+ dépassé : ${E.poe[a.uid].used} W demandés pour ${budget} W.`);
  }
  // budget du mur et des bandeaux
  let total = 0; for (const a of B.appareils) if (on(a.uid) && E.power[a.uid].source.startsWith('secteur')) total += E.power[a.uid].watts;
  if (total > MUR_W) alerte('mur', 'erreur', `${total} W sur un disjoncteur de 16 A (${MUR_W} W) : il saute.`);
  for (const a of B.appareils) if (E.power[a.uid] && !E.power[a.uid].on) alerte(a.uid, 'erreur', E.power[a.uid].why || 'Pas alimenté.');
  for (const [id, c] of Object.entries(E.cables)) if (!c.ok) { const cb = B.cables.find((x) => x.uid === id); if (cb) alerte(cb.a.dev, 'erreur', `Câble ${nom(cb.a.dev)} → ${nom(cb.b.dev)} : ${c.why}`); }

  // ---- 3. IP ----
  // domaines de niveau 2 : les ports « ip » reliés par un câble valable entre deux appareils allumés,
  // pontés à l'intérieur d'un switch (même VLAN), d'un appareil à switch interne (ATEM) ou d'un routeur (LAN)
  const parent = new Map();
  const find = (x) => { while (parent.has(x) && parent.get(x) !== x) x = parent.get(x); return x; };
  const union = (x, y) => { const a = find(x), b = find(y); if (!parent.has(a)) parent.set(a, a); if (!parent.has(b)) parent.set(b, b); if (a !== b) parent.set(b, a); };
  /** VLAN d'un port de switch (cfg.ports[n].vlan, 1 par défaut) ; 0 : port non commuté (hors de cfg.ports, comme OOB) */
  const vlanDe = (/** @type {Appareil} */ sw, /** @type {string} */ port) => { const p = sw.cfg.ports[switchPortNum(port)]; if (!p) return 0; return p.vlan != null ? Number(p.vlan) : 1; };
  for (const c of B.cables) {
    if (c.sig !== 'ip' || !E.cables[c.uid] || !E.cables[c.uid].ok) continue;
    if (!on(c.a.dev) || !on(c.b.dev)) continue;
    union(key(c.a.dev, c.a.port), key(c.b.dev, c.b.port));
  }
  for (const a of B.appareils) {
    const m = M(a); if (!m || !on(a.uid)) continue;
    const ipPorts = m.ports.filter((p) => p.sig === 'ip');
    if (isSwitch(m, a.cfg)) { const first = {}; for (const p of ipPorts) { const v = vlanDe(a, p.id); if (!v) continue; if (first[v]) union(key(a.uid, first[v]), key(a.uid, p.id)); else first[v] = p.id; } } else if (isRouteur(m, a.cfg)) { const lan = ipPorts.filter((p) => !/^wan/.test(p.id)); for (let i = 1; i < lan.length; i++) union(key(a.uid, lan[0].id), key(a.uid, lan[i].id)); } else if (ipPorts.length > 1) { for (let i = 1; i < ipPorts.length; i++) union(key(a.uid, ipPorts[0].id), key(a.uid, ipPorts[i].id)); }
  }
  /** interface réseau de chaque appareil : le port qui la porte, l'adresse voulue */
  /** @type {Record<string, { port: string, dhcp: boolean, ip: string, mask: string, gw: string, lie: boolean, dom: string, ipN: number | null, pfx: number | null }>} */
  const net = {};
  const liePort = (/** @type {Appareil} */ a, /** @type {string} */ port) => { const o = peer(a.uid, port); return !!o && on(o.dev) && on(a.uid); };
  for (const a of B.appareils) {
    const m = M(a); if (!m) continue;
    const ipPorts = m.ports.filter((p) => p.sig === 'ip');
    const r = a.cfg && a.cfg.reseau;
    if (!ipPorts.length && !r && !isRouteur(m, a.cfg)) continue;
    let port, cfgIp;
    if (isRouteur(m, a.cfg)) {
      const lan = ipPorts.filter((p) => !/^wan/.test(p.id));
      port = (lan.find((p) => liePort(a, p.id)) || lan[0] || { id: '' }).id;
      cfgIp = { dhcp: false, ip: String(a.cfg.lan.ip || ''), mask: String(a.cfg.lan.mask || '255.255.255.0'), gw: '' };
    } else {
      if (isSwitch(m, a.cfg) || ipPorts.length > 1) { const lies = ipPorts.filter((p) => liePort(a, p.id)); const v1 = isSwitch(m, a.cfg) ? lies.filter((p) => vlanDe(a, p.id) === 1) : lies; const comm = isSwitch(m, a.cfg) ? lies.filter((p) => vlanDe(a, p.id) > 0) : lies; port = (v1[0] || comm[0] || lies[0] || ipPorts.find((p) => p.nic) || ipPorts[0] || { id: '' }).id; } else port = (ipPorts.find((p) => p.nic) || ipPorts[0] || { id: '' }).id;
      cfgIp = { dhcp: !!(r && r.dhcp), ip: String((r && r.ip) || ''), mask: String((r && r.mask) || ''), gw: String((r && r.gw) || '') };
    }
    const lie = port ? (isSwitch(m, a.cfg) || isRouteur(m, a.cfg) || ipPorts.length > 1 ? ipPorts.some((p) => liePort(a, p.id)) : liePort(a, port)) : false;
    net[a.uid] = { port, ...cfgIp, lie, dom: lie ? find(key(a.uid, port)) : '', ipN: null, pfx: null };
  }
  // serveurs DHCP : le premier routeur allumé de chaque domaine, avec sa plage
  /** @type {Record<string, { uid: string, base: number, de: number, a: number, n: number, mask: string, gw: string }>} */
  const dhcpDe = {};
  for (const a of B.appareils) {
    const m = M(a); if (!m || !isRouteur(m, a.cfg) || !net[a.uid] || !net[a.uid].lie) continue;
    const d = a.cfg.lan.dhcp; if (!d || d.on === false) continue;
    const base = parseIp(a.cfg.lan.ip); const pfx = parseMask(a.cfg.lan.mask || '255.255.255.0'); if (base == null || pfx == null) continue;
    const dom = net[a.uid].dom; if (dhcpDe[dom]) continue;
    dhcpDe[dom] = { uid: a.uid, base: netOf(base, pfx), de: Number(d.de || 100), a: Number(d.a || 199), n: 0, mask: a.cfg.lan.mask || '255.255.255.0', gw: a.cfg.lan.ip };
  }
  // adresses effectives
  for (const a of B.appareils) {
    const n = net[a.uid]; if (!n) continue;
    const m = M(a);
    let { ip, mask, gw } = n;
    if (n.dhcp) {
      const s = n.lie ? dhcpDe[n.dom] : null;
      if (s && s.de + s.n <= s.a) { ip = ipStr(s.base + s.de + s.n); s.n++; mask = s.mask; gw = s.gw; } else { ip = linkLocalFor(a.uid, m); mask = '255.255.0.0'; gw = ''; }
    }
    n.ipN = parseIp(ip); n.pfx = parseMask(mask);
    E.ip[a.uid] = { ip, mask, gw, dhcp: n.dhcp, link: n.lie, conflit: false, domaine: n.dom };
  }
  // noms lisibles des domaines : d'après le switch (et le VLAN), l'appareil à switch interne, le routeur, sinon la liaison directe
  /** @type {Record<string, string>} */
  const domNom = {};
  for (const a of B.appareils) {
    const m = M(a); if (!m || !on(a.uid)) continue;
    if (isSwitch(m, a.cfg)) for (const p of m.ports) { if (p.sig !== 'ip') continue; const v = vlanDe(a, p.id); const d = find(key(a.uid, p.id)); if (!domNom[d]) domNom[d] = v ? `${a.nom} · VLAN ${v}` : `${a.nom} · ${p.label} (hors commutation)`; }
  }
  for (const a of B.appareils) { const m = M(a); const n = net[a.uid]; if (!m || !n || !n.dom || domNom[n.dom]) continue; domNom[n.dom] = isRouteur(m, a.cfg) ? `${a.nom} · LAN` : m.ports.filter((p) => p.sig === 'ip').length > 1 ? `${a.nom} · switch interne` : ''; }
  const membres = {}; for (const [uid, n] of Object.entries(net)) if (n.dom) (membres[n.dom] = membres[n.dom] || []).push(uid);
  for (const [d, l] of Object.entries(membres)) if (!domNom[d]) domNom[d] = `liaison directe ${l.map(nom).join(' ↔ ')}`;
  const seen = {}; for (const d of Object.keys(domNom)) { const base = domNom[d]; seen[base] = (seen[base] || 0) + 1; if (seen[base] > 1) domNom[d] = `${base} (${seen[base]})`; }
  for (const [uid, n] of Object.entries(net)) if (E.ip[uid]) E.ip[uid].domaine = n.dom ? domNom[n.dom] || n.dom : '';
  // conflits : même adresse dans le même domaine, les deux reliés
  const parAdr = {};
  for (const [uid, n] of Object.entries(net)) { if (!n.lie || n.ipN == null) continue; const k = `${n.dom}|${n.ipN}`; (parAdr[k] = parAdr[k] || []).push(uid); }
  for (const l of Object.values(parAdr)) if (l.length > 1) for (const uid of l) { E.ip[uid].conflit = true; alerte(uid, 'erreur', `Conflit d'adresse avec ${l.filter((x) => x !== uid).map(nom).join(', ')} (${E.ip[uid].ip}).`); }
  /** a joint b en IP ? (même domaine, reliés, allumés, sans conflit, dans le même sous-réseau vu de chaque côté) */
  const reach = (/** @type {string} */ a, /** @type {string} */ b) => {
    const x = net[a], y = net[b]; if (!x || !y || a === b) return false;
    if (!x.lie || !y.lie || !x.dom || x.dom !== y.dom) return false;
    if (E.ip[a].conflit || E.ip[b].conflit) return false;
    if (x.ipN == null || y.ipN == null || x.pfx == null || y.pfx == null) return false;
    return sameNet(x.ipN, y.ipN, x.pfx) && sameNet(x.ipN, y.ipN, y.pfx);
  };
  const uids = Object.keys(net);
  for (const a of uids) for (const b of uids) if (a !== b) E.reach[`${a}>${b}`] = reach(a, b);
  /** l'appareil dont l'adresse effective est `ip`, dans le domaine de `from` (sinon n'importe où) */
  const parIp = (/** @type {string} */ ip, from = '') => { const n = parseIp(ip); if (n == null) return null; const l = uids.filter((u) => net[u].ipN === n && (!from || !net[from] || !net[from].dom || net[u].dom === net[from].dom)); return l.length ? byUid.get(l[0]) || null : null; };
  /** accès Internet : joint un routeur dont il a l'adresse comme passerelle, et ce routeur a un WAN */
  const internet = (/** @type {string} */ uid) => {
    const n = net[uid]; if (!n) return { ok: false, why: 'Pas d\'interface réseau.' };
    const rts = B.appareils.filter((r) => isRouteur(M(r), r.cfg) && net[r.uid]);
    if (!rts.length) return { ok: false, why: 'Aucun routeur dans le montage.' };
    const gw = parseIp(E.ip[uid].gw);
    const r = rts.find((x) => net[x.uid].ipN === gw);
    if (gw == null) return { ok: false, why: 'Pas de passerelle configurée.' };
    if (!r) return { ok: false, why: `La passerelle ${E.ip[uid].gw} n'est pas l'adresse LAN d'un routeur.` };
    if (!reach(uid, r.uid)) return { ok: false, why: `Le routeur ${r.nom} (${E.ip[r.uid].ip}) est injoignable : ${explainReach(B, E, uid, r.uid)}` };
    if (!r.cfg.wan || r.cfg.wan === 'aucun') return { ok: false, why: `Le routeur ${r.nom} n'a pas d'accès Internet (WAN : aucun).` };
    return { ok: true, why: '' };
  };
  // alertes réseau
  for (const a of B.appareils) {
    const n = net[a.uid]; if (!n) continue;
    const m = M(a);
    if (!on(a.uid)) continue;
    if (!n.lie) { alerte(a.uid, 'attention', 'Aucun câble réseau actif (ou le switch en face n\'est pas alimenté).'); continue; }
    if (n.dhcp && linkLocal(E.ip[a.uid].ip)) alerte(a.uid, 'attention', `En DHCP sans serveur : adresse de lien local ${E.ip[a.uid].ip}, injoignable depuis une machine en adresse fixe.`);
    if (!n.dhcp && n.ipN == null && !isRouteur(m, a.cfg)) alerte(a.uid, 'erreur', `Adresse IP « ${n.ip} » invalide.`);
    if (n.pfx == null) alerte(a.uid, 'erreur', `Masque « ${n.mask} » invalide.`);
    if (!n.dhcp && n.gw && parseIp(n.gw) != null && n.ipN != null && n.pfx != null && !sameNet(/** @type {number} */ (parseIp(n.gw)), n.ipN, n.pfx)) alerte(a.uid, 'attention', `La passerelle ${n.gw} n'est pas dans le sous-réseau de l'appareil.`);
  }

  // ---- 4. vidéo ----
  /** @type {Record<string, Flux | null>} */
  const out = {};
  /** @type {Record<string, Flux | null>} */
  const ins = {};
  const inFlux = (dev, port) => { const o = peer(dev, port); return o ? out[key(o.dev, o.port)] || null : null; };
  /** @type {Array<{ dev: string, n: number, format: string, veut: string }>} */
  const refus = [];
  /** @type {Record<string, Record<number, Flux | null>>} entrées acceptées par mélangeur */
  const entrees = {};
  /** @type {Record<string, Record<number, { flux: Flux | null, cam: string, why: string }>>} entrées de vMix par PC */
  const vmixIn = {};
  const microSur = (/** @type {Appareil} */ a, /** @type {Port[]} */ ports) => { for (const p of ports) { const o = peer(a.uid, p.id); if (o && isMicro(M(byUid.get(o.dev)))) return byUid.get(o.dev); } return null; };
  /** source audio d'un Teranex embedder selon cfg.entree */
  const entreeAudio = (/** @type {Appareil} */ a, /** @type {Modele} */ m) => {
    const e = a.cfg.entree || 'xlr';
    return m.ports.filter((p) => p.dir === 'in' && (p.sig === 'audio' || p.sig === 'aes') && (e === 'optique' ? p.kind === 'toslink' : e === 'aes' ? p.sig === 'aes' && p.kind !== 'toslink' : e === 'rca' ? p.kind === 'rca' : /xlr/.test(p.kind)));
  };
  for (let pass = 0; pass < 10; pass++) {
    let changed = false;
    const set = (k, f) => { if (!same(out[k], f)) { out[k] = f; changed = true; } };
    for (const a of B.appareils) {
      const m = M(a); if (!m) continue;
      const cfg = a.cfg || {};
      const vin = m.ports.filter((p) => isVideo(p) && dirVideo(p, cfg) === 'in');
      const vout = m.ports.filter((p) => isVideo(p) && dirVideo(p, cfg) === 'out');
      for (const p of vin) ins[key(a.uid, p.id)] = inFlux(a.uid, p.id);
      if (!on(a.uid)) { for (const p of vout) set(key(a.uid, p.id), null); continue; }
      if (isCamera(m)) {
        for (const p of vout) {
          const actif = p.sig === 'sdi' ? cfg.sdiOut !== false : cfg.hdmiOut !== false;
          set(key(a.uid, p.id), actif ? { src: a.uid, srcPort: p.id, format: formatDe(a, m), label: a.nom, audio: [], via: [] } : null);
        }
        continue;
      }
      if (isMelangeur(m)) {
        const fmt = cfg.format || (m.formats && m.formats[0]) || '';
        /** @type {Record<number, Flux | null>} */ const acc = {};
        const nSdi = vin.filter((p) => p.sig === 'sdi').length;
        for (const p of vin) {
          const n = numOf(p.id) || (p.sig === 'hdmi' ? nSdi + 1 : 0); if (!n) continue;
          const f = ins[key(a.uid, p.id)];
          if (f && fmt && f.format !== fmt) { acc[n] = null; if (!refus.some((r) => r.dev === a.uid && r.n === n)) refus.push({ dev: a.uid, n, format: f.format, veut: fmt }); } else acc[n] = f;
        }
        entrees[a.uid] = acc;
        const pgm = Number(cfg.pgm) || 1, pvw = Number(cfg.pvw) || 0;
        const onair = acc[pgm] || null;
        /** @type {Flux['audio']} */ const audio = [];
        const push = (ch, from) => { if (!audio.some((x) => x.ch === ch && x.from === from)) audio.push({ ch, from }); };
        for (const [k, f] of Object.entries(acc)) { if (!f) continue; const mode = cfg.audio && cfg.audio[k] != null ? cfg.audio[k] : 'afv'; if (mode === 'on' || (mode === 'afv' && +k === pgm)) for (const x of f.audio) push(x.ch, x.from); }
        const mics = m.ports.filter((p) => p.sig === 'audio' && p.dir === 'in');
        mics.forEach((p, i) => { const mode = cfg.audio ? cfg.audio[`mic${i + 1}`] : 'off'; if (mode === 'on' || mode === 'afv') { const o = peer(a.uid, p.id); const mic = o ? byUid.get(o.dev) : null; if (mic && isMicro(M(mic))) push(i + 1, mic.uid); } });
        const pgmFlux = /** @type {Flux} */ (onair ? { src: a.uid, srcPort: 'sdi-out-pgm', format: fmt || onair.format, label: 'PGM', audio, via: [...onair.via, onair.src] } : { src: a.uid, srcPort: 'sdi-out-pgm', format: fmt, label: 'PGM (noir)', audio, via: [] });
        for (const p of vout) {
          const role = roleSortie(p, cfg, m);
          let f = /** @type {Flux | null} */ (null);
          if (role === 'pgm') f = { ...pgmFlux, srcPort: p.id };
          else if (role === 'mv') f = { src: a.uid, srcPort: p.id, format: fmt, label: 'Multiview', audio: audio.map((x) => ({ ...x })), via: [] };
          else if (role === 'pvw') f = acc[pvw] ? { ...via(acc[pvw], a.uid), srcPort: p.id, label: 'PVW' } : { src: a.uid, srcPort: p.id, format: fmt, label: 'PVW (noir)', audio: [], via: [] };
          else if (typeof role === 'number') f = acc[role] ? { ...via(acc[role], a.uid), srcPort: p.id } : null;
          set(key(a.uid, p.id), f);
        }
        continue;
      }
      if (isVmix(m, cfg)) {
        const v = cfg.vmix || {}; const list = Array.isArray(v.entrees) ? v.entrees : [];
        /** @type {Record<number, { flux: Flux | null, cam: string, why: string }>} */ const vi = {};
        list.forEach((e, i) => {
          const n = i + 1; if (!e) return;
          if (e.type === 'ndi') {
            const src = String(e.source || '').trim();
            const cam = src ? B.appareils.find((c) => isCamera(M(c)) && (c.uid === src || c.nom === src || (E.ip[c.uid] && E.ip[c.uid].ip === src))) : null;
            if (!cam) vi[n] = { flux: null, cam: '', why: src ? `Source NDI « ${src} » : aucune caméra de ce nom ou de cette adresse.` : 'Source NDI vide.' };
            else if (!cam.cfg || !cam.cfg.ndi) vi[n] = { flux: null, cam: cam.uid, why: `${cam.nom} : NDI|HX n'est pas activé sur la caméra.` };
            else if (!on(cam.uid)) vi[n] = { flux: null, cam: cam.uid, why: `${cam.nom} n'est pas alimentée.` };
            else if (!reach(a.uid, cam.uid)) vi[n] = { flux: null, cam: cam.uid, why: `${cam.nom} est injoignable : ${explainReach(B, E, a.uid, cam.uid)}` };
            else vi[n] = { flux: { src: cam.uid, srcPort: 'ndi', format: formatDe(cam, M(cam)), label: `${cam.nom} (NDI|HX)`, audio: [], via: [] }, cam: cam.uid, why: '' };
          } else {
            const k = numOf(String(e.source || '')); const p = vin.find((q) => numOf(q.id) === k);
            if (!p) vi[n] = { flux: null, cam: '', why: k ? `DeckLink ${k} n'est pas une entrée (cfg.decklink).` : 'Entrée DeckLink non choisie.' };
            else { const f = ins[key(a.uid, p.id)]; vi[n] = { flux: f, cam: f ? f.src : '', why: f ? '' : `Rien n'arrive sur DeckLink ${k}.` }; }
          }
        });
        vmixIn[a.uid] = vi;
        const pgm = Number(v.pgm) || 1; const onair = vi[pgm] ? vi[pgm].flux : null;
        for (const p of vout) set(key(a.uid, p.id), p.sig === 'hdmi' ? { src: a.uid, srcPort: p.id, format: onair ? onair.format : '1080p50', label: 'vMix (écran)', audio: [], via: [] } : onair ? { src: a.uid, srcPort: p.id, format: onair.format, label: 'PGM', audio: onair.audio.map((x) => ({ ...x })), via: [...onair.via, onair.src] } : { src: a.uid, srcPort: p.id, format: '1080p50', label: 'PGM (noir)', audio: [], via: [] });
        continue;
      }
      // boucles actives (HyperDeck, Teranex, RP150) : la sortie recopie l'entrée
      const thruTargets = new Set();
      for (const p of vin) if (p.thru) { thruTargets.add(p.thru); set(key(a.uid, p.thru), via(ins[key(a.uid, p.id)], a.uid)); }
      if (isTeranex(m, cfg)) {
        const sdiIn = vin.find((p) => p.sig === 'sdi'); const f = sdiIn ? ins[key(a.uid, sdiIn.id)] : null;
        if (isEmbedder(m, cfg)) {
          const mic = microSur(a, entreeAudio(a, m));
          const paire = Number(cfg.paire) || 1;
          for (const p of vout) {
            // la sortie SDI de l'embedder est déclarée comme boucle de l'entrée : elle recopie l'image, avec la paire remplacée
            if (!f) { set(key(a.uid, p.id), null); continue; }
            const g = via(f, a.uid);
            if (mic) { g.audio = g.audio.filter((x) => x.ch !== paire * 2 - 1 && x.ch !== paire * 2); g.audio.push({ ch: paire * 2 - 1, from: mic.uid }, { ch: paire * 2, from: mic.uid }); g.audio.sort((x, y) => x.ch - y.ch); }
            set(key(a.uid, p.id), g);
          }
        } else for (const p of vout) if (!thruTargets.has(p.id)) set(key(a.uid, p.id), via(f, a.uid));
        continue;
      }
      if (isEnregistreur(m, cfg)) {
        const src = cfg.source === 'hdmi' ? 'hdmi' : 'sdi';
        const pin = vin.find((p) => p.sig === src) || vin[0]; const f = pin ? ins[key(a.uid, pin.id)] : null;
        for (const p of vout) if (!thruTargets.has(p.id)) set(key(a.uid, p.id), via(f, a.uid));
        continue;
      }
      for (const p of vout) if (!thruTargets.has(p.id)) set(key(a.uid, p.id), null);
    }
    if (!changed) break;
  }
  for (const [k, f] of Object.entries(ins)) E.video[k] = f;
  for (const r of refus) alerte(r.dev, 'erreur', `Format ${r.format} refusé par ${nom(r.dev)} sur l'entrée ${r.n} (réglé en ${r.veut}) : format non pris en charge.`);
  // moniteurs : ce qu'ils voient
  for (const a of B.appareils) {
    const m = M(a); if (!m || m.famille !== 'moniteur' || !on(a.uid)) continue;
    const vin = m.ports.filter((p) => isVideo(p) && p.dir === 'in');
    if (!vin.some((p) => E.video[key(a.uid, p.id)])) alerte(a.uid, 'info', 'Aucun signal.');
  }

  // ---- 5. services ----
  /** @type {Record<string, Array<{ slot: number, cam: string, mode: string, ok: boolean }>>} les slots des pupitres */
  const slots = {};
  const serv = (/** @type {string} */ k, ok, why, label) => { E.services[k] = { ok: !!ok, why: ok ? '' : why, label }; return !!ok; };
  const mediaSur = (/** @type {Appareil} */ a, /** @type {string} */ portId) => { const o = peer(a.uid, portId); return o && isMedia(M(byUid.get(o.dev))) ? byUid.get(o.dev) : null; };
  for (const a of B.appareils) {
    const m = M(a); if (!m) continue; const cfg = a.cfg || {};
    const allume = on(a.uid);
    // interface web d'un appareil : joignable si relié, adressé, sans conflit
    if (aService(m, 'web') && net[a.uid]) serv(`${a.uid}:web`, allume && net[a.uid].lie && net[a.uid].ipN != null && !E.ip[a.uid].conflit, !allume ? 'Pas alimenté.' : !net[a.uid].lie ? 'Pas de lien réseau.' : E.ip[a.uid].conflit ? 'Conflit d\'adresse.' : 'Adresse invalide.', `Interface web (${E.ip[a.uid].ip})`);
    // pupitre : ses slots caméra, en IP (HTTP 80) ou en série
    if (isPupitre(m, cfg)) {
      const serie = m.ports.filter((p) => (p.sig === 'rs422' || p.sig === 'rs232') && (p.dir === 'out' || p.dir === 'io'));
      slots[a.uid] = [];
      cfg.cameras.forEach((c, i) => {
        if (!c) return; const slot = Number(c.slot) || i + 1; const mode = c.mode || 'off';
        if (mode === 'ip') {
          const ip = String(c.ip || '').trim();
          const t = ip ? parIp(ip, a.uid) || parIp(ip) : null;
          const k = `${a.uid}:ptz-http:${t ? t.uid : ip || 'slot' + slot}`;
          const label = `Slot ${slot} → ${t ? t.nom : ip || '(vide)'}`;
          let ok = false, why = '';
          if (!allume) why = 'Le pupitre n\'est pas alimenté.';
          else if (!ip) why = `Slot ${slot} : pas d'adresse.`;
          else if (!t) why = `${a.nom} cherche ${ip} : personne.`;
          else if (!aService(M(t), 'ptz-http')) why = `${t.nom} (${ip}) n'est pas une caméra pilotable en HTTP.`;
          else if (!on(t.uid)) why = `${t.nom} n'est pas alimentée.`;
          else if (!reach(a.uid, t.uid)) why = `${t.nom} (${ip}) est injoignable : ${explainReach(B, E, a.uid, t.uid)}`;
          else ok = true;
          serv(k, ok, why, label);
          slots[a.uid].push({ slot, cam: t ? t.uid : '', mode, ok });
          if (!ok && allume) alerte(a.uid, 'erreur', why);
        } else if (mode === 'serial') {
          const p = serie.find((q) => q.id === `serial-${slot}`) || (serie.length === 1 ? serie[0] : serie.find((q) => q.id === 'serial')) || null;
          const o = p ? peer(a.uid, p.id) : null; const t = o ? byUid.get(o.dev) : null;
          const k = `${a.uid}:ptz-serial:${t ? t.uid : 'slot' + slot}`;
          let ok = false, why = '';
          if (!allume) why = 'Le pupitre n\'est pas alimenté.';
          else if (!p) why = `Slot ${slot} en série : le pupitre n'a pas de port série pour ce slot.`;
          else if (!t) why = `Slot ${slot} en série : rien n'est branché sur ${p.label}.`;
          else if (!isCamera(M(t))) why = `Slot ${slot} en série : ${t.nom} n'est pas une caméra.`;
          else if (!on(t.uid)) why = `${t.nom} n'est pas alimentée.`;
          else if (t.cfg && t.cfg.serie && t.cfg.serie !== p.sig) why = `${t.nom} est réglée en ${String(t.cfg.serie).toUpperCase()}, le câble est en ${p.sig.toUpperCase()}.`;
          else ok = true;
          serv(k, ok, why, `Slot ${slot} (série) → ${t ? t.nom : '(rien)'}`);
          slots[a.uid].push({ slot, cam: t ? t.uid : '', mode, ok });
          if (!ok && allume) alerte(a.uid, 'erreur', why);
        }
      });
      // TALLY IP : le pupitre renvoie le tally reçu en GPI aux caméras de ses slots
      if (cfg.tallyIp) for (const s of slots[a.uid]) {
        if (!s.cam) continue; const cam = byUid.get(s.cam);
        const tmode = cam.cfg && cam.cfg.tally ? cam.cfg.tally : 'ip';
        serv(`${a.uid}:tally-ip:${s.cam}`, s.ok && tmode !== 'off' && (s.mode === 'serial' || tmode === 'ip'), !s.ok ? `Slot ${s.slot} : caméra non pilotée.` : tmode === 'off' ? `${cam.nom} : tally désactivé dans la caméra.` : `${cam.nom} attend le tally en série, le slot est en IP.`, `Tally IP → ${cam.nom}`);
      }
    }
    // GPI & Tally Interface → ATEM
    if (isGpiTally(m, cfg)) {
      const ip = String(cfg.atemIp || '').trim(); const t = ip ? parIp(ip, a.uid) || parIp(ip) : null;
      let ok = false, why = '';
      if (!allume) why = 'Pas alimenté.';
      else if (!ip) why = 'Adresse de l\'ATEM vide (ATEM Setup / Blackmagic GPI and Tally Setup).';
      else if (!t) why = `${a.nom} cherche l'ATEM en ${ip} : personne.`;
      else if (!aService(M(t), 'atem')) why = `${t.nom} (${ip}) n'est pas un mélangeur ATEM.`;
      else if (!reach(a.uid, t.uid)) why = `L'ATEM ${t.nom} (${ip}) est injoignable : ${explainReach(B, E, a.uid, t.uid)}`;
      else ok = true;
      serv(`${a.uid}:atem:${t ? t.uid : ip || '?'}`, ok, why, `ATEM ${t ? t.nom : ip || '(vide)'}`);
      if (!ok && allume) alerte(a.uid, 'erreur', why);
    }
    // ATEM : HyperDeck pilotés, ISO, streaming
    if (isMelangeur(m) && Array.isArray(cfg.hyperdecks)) cfg.hyperdecks.forEach((h, i) => {
      const ip = h ? String(h.ip || '').trim() : ''; if (!ip) return;
      const t = parIp(ip, a.uid) || parIp(ip);
      let ok = false, why = '';
      if (!allume) why = 'Pas alimenté.';
      else if (!t) why = `HyperDeck ${i + 1} en ${ip} : personne.`;
      else if (!aService(M(t), 'hyperdeck')) why = `${t.nom} (${ip}) n'est pas un HyperDeck.`;
      else if (!reach(a.uid, t.uid)) why = `${t.nom} (${ip}) est injoignable : ${explainReach(B, E, a.uid, t.uid)}`;
      else if (t.cfg && t.cfg.distant === false) why = `${t.nom} : REMOTE est sur OFF, il refuse le pilotage (port 9993).`;
      else ok = true;
      serv(`${a.uid}:hyperdeck:${t ? t.uid : ip}`, ok, why, `HyperDeck ${i + 1} → ${t ? t.nom : ip}`);
      if (!ok && allume) alerte(a.uid, 'attention', why);
    });
    if (isMelangeur(m) && 'iso' in cfg) {
      const usb = m.ports.filter((p) => p.sig === 'usb'); const disque = usb.map((p) => mediaSur(a, p.id)).find(Boolean);
      const okIso = allume && !!cfg.iso && !!disque;
      serv(`${a.uid}:iso`, okIso, !allume ? 'Pas alimenté.' : !cfg.iso ? 'ISO n\'est pas activé.' : 'ISO : aucun disque USB-C branché.', `Enregistrement ISO${disque ? ' sur ' + disque.nom : ''}`);
      if (allume && cfg.iso && !disque) alerte(a.uid, 'erreur', 'ISO : aucun disque USB-C branché.');
    }
    if (isMelangeur(m) && cfg.stream && cfg.stream.on) {
      const r = internet(a.uid); const okS = allume && r.ok && !!(cfg.stream.cle || '').trim();
      serv(`${a.uid}:rtmp:internet`, okS, !allume ? 'Pas alimenté.' : !r.ok ? `Streaming : ${r.why}` : 'Streaming : clé de diffusion vide.', `Streaming ${cfg.stream.service || 'RTMP'}`);
      if (allume && !okS) alerte(a.uid, 'erreur', E.services[`${a.uid}:rtmp:internet`].why);
    }
    // PC de régie : ATEM Software Control, DashBoard, vMix (NDI, PTZ, enregistrement, streaming)
    if (m.famille === 'ordinateur' && cfg.logiciel) {
      if (cfg.logiciel === 'atem-control' || cfg.logiciel === 'dashboard') {
        const sid = cfg.logiciel === 'atem-control' ? 'atem' : 'rosstalk';
        const cibles = B.appareils.filter((t) => aService(M(t), sid));
        const usb = cfg.logiciel === 'atem-control' ? m.ports.filter((p) => p.sig === 'usb').map((p) => peer(a.uid, p.id)).map((o) => (o ? byUid.get(o.dev) : null)).find((t) => t && aService(M(t), 'atem')) : null;
        const t = usb || cibles.find((x) => reach(a.uid, x.uid)) || cibles[0] || null;
        const ok = allume && !!t && (!!usb || reach(a.uid, t.uid));
        serv(`${a.uid}:${sid}:${t ? t.uid : '?'}`, ok, !allume ? 'Pas alimenté.' : !t ? (sid === 'atem' ? 'Aucun mélangeur ATEM dans le montage.' : 'Aucun Carbonite dans le montage.') : `${t.nom} est injoignable : ${explainReach(B, E, a.uid, t.uid)}`, `${cfg.logiciel === 'atem-control' ? 'ATEM Software Control' : 'DashBoard'} → ${t ? t.nom : '?'}${usb ? ' (USB)' : ''}`);
        if (allume && !ok) alerte(a.uid, 'erreur', E.services[`${a.uid}:${sid}:${t ? t.uid : '?'}`].why);
      }
      if (isVmix(m, cfg)) {
        const v = cfg.vmix || {};
        for (const [n, e] of Object.entries(vmixIn[a.uid] || {})) {
          const src = (v.entrees || [])[+n - 1] || {};
          if (src.type === 'ndi') { serv(`${a.uid}:ndi:${e.cam || src.source || 'entree' + n}`, !!e.flux, e.why, `Entrée ${n} NDI|HX → ${e.cam ? nom(e.cam) : src.source || '(vide)'}`); if (allume && !e.flux) alerte(a.uid, 'erreur', `vMix entrée ${n} : ${e.why}`); } else if (allume && !e.flux) alerte(a.uid, 'attention', `vMix entrée ${n} : ${e.why}`);
        }
        slots[a.uid] = [];
        (Array.isArray(v.ptz) ? v.ptz : []).forEach((p, i) => {
          const ip = String((p && p.ip) || '').trim(); if (!ip) return;
          const t = parIp(ip, a.uid) || parIp(ip);
          let ok = false, why = '';
          if (!allume) why = 'Pas alimenté.';
          else if (!t) why = `vMix PTZ ${i + 1} : ${ip}, personne.`;
          else if (!aService(M(t), 'ptz-http')) why = `${t.nom} (${ip}) n'est pas une caméra pilotable.`;
          else if (!on(t.uid)) why = `${t.nom} n'est pas alimentée.`;
          else if (!reach(a.uid, t.uid)) why = `${t.nom} (${ip}) est injoignable : ${explainReach(B, E, a.uid, t.uid)}`;
          else ok = true;
          serv(`${a.uid}:ptz-http:${t ? t.uid : ip}`, ok, why, `PTZ ${i + 1} → ${t ? t.nom : ip}`);
          slots[a.uid].push({ slot: i + 1, cam: t ? t.uid : '', mode: 'ip', ok });
          if (allume && !ok) alerte(a.uid, 'erreur', why);
        });
        const pgm = Number(v.pgm) || 1; const onair = vmixIn[a.uid] && vmixIn[a.uid][pgm] ? vmixIn[a.uid][pgm].flux : null;
        if (v.enregistre) serv(`${a.uid}:enregistre`, allume && !!onair, !allume ? 'Pas alimenté.' : 'vMix enregistre, mais le programme est noir (aucune entrée à l\'antenne).', 'Enregistrement vMix');
        if (v.stream) { const r = internet(a.uid); serv(`${a.uid}:rtmp:internet`, allume && r.ok && !!onair, !allume ? 'Pas alimenté.' : !r.ok ? `Streaming : ${r.why}` : 'Streaming : programme noir.', 'Streaming vMix'); if (allume && !E.services[`${a.uid}:rtmp:internet`].ok) alerte(a.uid, 'erreur', E.services[`${a.uid}:rtmp:internet`].why); }
      }
    }
    // caméra : NDI|HX, RTMP
    if (isCamera(m) && cfg.rtmp) { const r = internet(a.uid); serv(`${a.uid}:rtmp:internet`, allume && r.ok, !allume ? 'Pas alimentée.' : `RTMP : ${r.why}`, 'Diffusion RTMP'); if (allume && !r.ok) alerte(a.uid, 'attention', `RTMP : ${r.why}`); }
    // HyperDeck : enregistre ?
    if (isEnregistreur(m, cfg)) {
      const src = cfg.source === 'hdmi' ? 'hdmi' : 'sdi';
      const pin = m.ports.find((p) => p.sig === src && p.dir === 'in') || m.ports.find((p) => isVideo(p) && p.dir === 'in');
      const f = pin ? E.video[key(a.uid, pin.id)] : null;
      const mediaPort = cfg.media ? (cfg.media === 'usb' ? (m.ports.find((p) => p.sig === 'usb') || { id: '' }).id : String(cfg.media)) : '';
      const support = mediaPort ? mediaSur(a, mediaPort) : null;
      const supports = m.ports.filter((p) => p.sig === 'media' || p.sig === 'usb').map((p) => mediaSur(a, p.id)).filter(Boolean);
      let ok = false, why = '';
      if (!allume) why = 'Pas alimenté.';
      else if (!f) why = `Rien n'arrive sur ${pin ? pin.label : 'l\'entrée'} (source ${src.toUpperCase()}).`;
      else if (!support) why = supports.length ? `Le support choisi (${cfg.media || 'aucun'}) est vide : ${supports.map((s) => s.nom).join(', ')} est ailleurs.` : 'Le HyperDeck n\'a pas de carte ni de disque.';
      else if (!cfg.enregistre) why = 'L\'enregistrement n\'est pas lancé (REC).';
      else ok = true;
      serv(`${a.uid}:enregistre`, ok, why, ok ? `Enregistre ${f.label} (${f.format}, ${cfg.codec || 'H.264'}) sur ${support.nom}` : 'Enregistrement');
      if (allume && !ok) alerte(a.uid, cfg.enregistre ? 'erreur' : 'attention', why);
    }
    // Teranex : la paire embarquée (embedder) ou sortie sur les XLR (désembedder)
    if (isTeranex(m, cfg)) {
      const paire = Number(cfg.paire) || 1; const voies = `${paire * 2 - 1}-${paire * 2}`;
      const sdiIn = m.ports.find((p) => p.sig === 'sdi' && p.dir === 'in'); const f = sdiIn ? E.video[key(a.uid, sdiIn.id)] : null;
      if (isEmbedder(m, cfg)) {
        const mic = microSur(a, entreeAudio(a, m));
        const ok = allume && !!f && !!mic;
        serv(`${a.uid}:audio`, ok, !allume ? 'Pas alimenté.' : !f ? 'Rien n\'arrive sur SDI IN : rien à embarquer.' : `Aucune source audio sur l'entrée ${String(cfg.entree || 'xlr').toUpperCase()}.`, `Embarque ${mic ? mic.nom : 'l\'entrée ' + String(cfg.entree || 'xlr').toUpperCase()} sur les voies ${voies}`);
        if (allume && !ok) alerte(a.uid, 'attention', E.services[`${a.uid}:audio`].why);
      } else {
        const present = !!f && f.audio.some((x) => x.ch === paire * 2 - 1 || x.ch === paire * 2);
        const ok = allume && present;
        serv(`${a.uid}:audio`, ok, !allume ? 'Pas alimenté.' : !f ? 'Rien n\'arrive sur SDI IN.' : `Le flux n'a pas d'audio sur les voies ${voies}${f.audio.length ? ' (présentes : ' + [...new Set(f.audio.map((x) => x.ch))].join(', ') + ')' : ''}.`, `Sort les voies ${voies} sur les XLR`);
        if (allume && !ok) alerte(a.uid, 'attention', E.services[`${a.uid}:audio`].why);
      }
    }
  }

  // ---- 6. tally ----
  for (const a of B.appareils) if (isCamera(M(a))) E.tally[a.uid] = { pgm: false, pvw: false, via: '' };
  /** câble tally/GPI valable d'un port de sortie de `src` vers un pupitre : les pupitres atteints, avec les relais transportés */
  const pupitresDepuis = (/** @type {Appareil} */ src) => {
    /** @type {Array<{ rp: Appareil, relais: number | 0, port: string }>} */ const l = [];
    for (const p of M(src).ports) {
      if ((p.sig !== 'tally' && p.sig !== 'gpio') || p.dir === 'in') continue;
      const o = peer(src.uid, p.id); if (!o) continue; const rp = byUid.get(o.dev); if (!rp || !isPupitre(M(rp), rp.cfg)) continue;
      const attendu = rp.cfg.tallyIn || 'gpio1'; if (o.port !== attendu) continue;
      l.push({ rp, relais: /^relais-?\d+$/.test(p.id) ? numOf(p.id) : 0, port: p.id });
    }
    return l;
  };
  /** allume le tally des caméras du slot n des pupitres atteints (relais n actif) */
  const allume = (/** @type {Array<{ rp: Appareil, relais: number, port: string }>} */ rps, /** @type {number} */ n, /** @type {'pgm' | 'pvw'} */ quoi, /** @type {string} */ chemin) => {
    for (const { rp, relais } of rps) {
      if (relais && relais !== n) continue;
      if (!on(rp.uid) || !rp.cfg.tallyIp) continue;
      for (const s of slots[rp.uid] || []) { if (s.slot !== n || !s.cam) continue; const t = E.services[`${rp.uid}:tally-ip:${s.cam}`]; if (t && t.ok) { E.tally[s.cam][quoi] = true; E.tally[s.cam].via = `${chemin} → ${rp.nom} (GPI ${n}, TALLY IP) → ${nom(s.cam)}`; } }
    }
  };
  for (const a of B.appareils) {
    const m = M(a); if (!m || !on(a.uid)) continue; const cfg = a.cfg || {};
    if (isMelangeur(m)) {
      const pgm = Number(cfg.pgm) || 1, pvw = Number(cfg.pvw) || 0;
      // chemin ATEM : les GPI & Tally qui joignent ce mélangeur, relais n = entrée n
      for (const g of B.appareils) {
        if (!isGpiTally(M(g), g.cfg) || !on(g.uid)) continue; const s = E.services[`${g.uid}:atem:${a.uid}`]; if (!s || !s.ok) continue;
        const rps = pupitresDepuis(g);
        allume(rps, pgm, 'pgm', `${a.nom} → ${g.nom}`); if (pvw) allume(rps, pvw, 'pvw', `${a.nom} → ${g.nom}`);
      }
      // chemin Carbonite : la prise TALLY du mélangeur, sortie s ↔ entrée cfg.tally[s]
      if (m.ports.some((p) => (p.sig === 'tally' || p.sig === 'gpio') && p.dir !== 'in')) {
        const rps = pupitresDepuis(a); const map = cfg.tally && typeof cfg.tally === 'object' ? cfg.tally : null;
        for (const { rp, relais, port } of rps) {
          for (let s = 1; s <= 16; s++) {
            const entree = map ? Number(map[s]) : s; if (!entree) continue;
            if (entree === pgm) allume([{ rp, relais, port }], s, 'pgm', `${a.nom} (TALLY ${s})`);
            if (pvw && entree === pvw) allume([{ rp, relais, port }], s, 'pvw', `${a.nom} (TALLY ${s})`);
          }
        }
      }
      // la caméra à l'antenne sans tally : on explique
      const f = entrees[a.uid] ? entrees[a.uid][pgm] : null;
      if (f && isCamera(M(byUid.get(f.src))) && !E.tally[f.src].pgm) {
        const gs = B.appareils.filter((g) => isGpiTally(M(g), g.cfg));
        const rps = B.appareils.filter((r) => isPupitre(M(r), r.cfg));
        let why = '';
        if (aService(m, 'atem')) {
          if (!gs.length) why = 'aucune interface GPI & Tally dans le montage';
          else if (!gs.some((g) => E.services[`${g.uid}:atem:${a.uid}`] && E.services[`${g.uid}:atem:${a.uid}`].ok)) why = `${gs[0].nom} ne joint pas l'ATEM (${(E.services[`${gs[0].uid}:atem:${gs[0].cfg.atemIp || '?'}`] || { why: 'adresse de l\'ATEM à régler' }).why})`;
          else if (!gs.some((g) => pupitresDepuis(g).length)) why = `pas de câble D-sub 25 de ${gs[0].nom} (TALLY) vers ${rps.length ? rps[0].nom + ' ' + (rps[0].cfg.tallyIn || 'gpio1').toUpperCase() : 'un pupitre'}`;
        } else if (!pupitresDepuis(a).length) why = `pas de câble D-sub 25 de la prise TALLY de ${a.nom} vers ${rps.length ? rps[0].nom + ' ' + (rps[0].cfg.tallyIn || 'gpio1').toUpperCase() : 'un pupitre'}`;
        if (!why) {
          const rp = rps.find((r) => (slots[r.uid] || []).length) || rps[0];
          if (!rp) why = 'aucun pupitre';
          else if (!on(rp.uid)) why = `${rp.nom} n'est pas alimenté`;
          else if (!rp.cfg.tallyIp) why = `TALLY IP est sur OFF dans le menu SYSTEM de ${rp.nom}`;
          else { const s = (slots[rp.uid] || []).find((x) => x.slot === pgm); const camAt = (slots[rp.uid] || []).find((x) => x.cam === f.src); why = !s || !s.cam ? `le slot ${pgm} de ${rp.nom} est vide` : s.cam !== f.src ? `l'entrée ${pgm} est ${nom(f.src)}, mais le slot ${pgm} de ${rp.nom} pilote ${nom(s.cam)}${camAt ? ' (' + nom(f.src) + ' est au slot ' + camAt.slot + ')' : ''}` : !s.ok ? `${rp.nom} ne joint pas ${nom(f.src)}` : (E.services[`${rp.uid}:tally-ip:${f.src}`] || { why: 'tally refusé' }).why; }
        }
        alerte(f.src, 'attention', `${nom(f.src)} est à l'antenne sur ${a.nom}, mais son tally reste éteint : ${why}.`);
      }
    }
    if (isVmix(m, cfg) && cfg.vmix && cfg.vmix.tally) {
      const pgm = Number(cfg.vmix.pgm) || 1; const e = vmixIn[a.uid] ? vmixIn[a.uid][pgm] : null;
      if (e && e.cam && isCamera(M(byUid.get(e.cam)))) {
        const s = (slots[a.uid] || []).find((x) => x.cam === e.cam);
        const tmode = byUid.get(e.cam).cfg && byUid.get(e.cam).cfg.tally;
        if (s && s.ok && tmode !== 'off') { E.tally[e.cam].pgm = true; E.tally[e.cam].via = `vMix (${a.nom}) → ${nom(e.cam)} (IP)`; } else alerte(e.cam, 'attention', `${nom(e.cam)} est à l'antenne dans vMix, mais son tally reste éteint : ${!s ? 'la caméra n\'est pas dans la liste PTZ de vMix' : !s.ok ? 'vMix ne la joint pas' : 'tally désactivé dans la caméra'}.`);
      }
    }
  }
  return E;
}

/**
 * Le tally qu'auraient les caméras si l'entrée `n` de ce mélangeur (ou de vMix) passait à l'antenne :
 * le montage est évalué avec cfg.pgm = n (ou vmix.pgm). Pour les missions (« tally sur les trois »)
 * et le panneau (survol d'une entrée). Pur : le montage n'est pas modifié.
 * @returns {Eval['tally']}
 */
export function tallyWould(/** @type {Build} */ B, /** @type {string} */ mixer, /** @type {number} */ n) {
  const appareils = B.appareils.map((a) => {
    if (a.uid !== mixer) return a;
    const cfg = structuredClone(a.cfg || {});
    if (cfg.logiciel === 'vmix') cfg.vmix = { ...(cfg.vmix || {}), pgm: n }; else cfg.pgm = n;
    return { ...a, cfg };
  });
  return evaluate({ ...B, appareils }).tally;
}

/**
 * Pourquoi `a` joint ou ne joint pas `b`, en français (lit E : rien n'est recalculé).
 * @param {Build} B @param {Eval} E @param {string} a @param {string} b
 */
export function explainReach(B, E, a, b) {
  const nomDe = (u) => { const x = B.appareils.find((y) => y.uid === u); return x ? x.nom : '?'; };
  const A = E.ip[a], Bb = E.ip[b];
  if (!A || !Bb) return `${nomDe(!A ? a : b)} n'a pas d'interface réseau.`;
  const off = (u) => !E.power[u] || !E.power[u].on;
  if (off(a) || off(b)) return `${nomDe(off(a) ? a : b)} n'est pas alimenté.`;
  if (!A.link) return `${nomDe(a)} n'a pas de lien réseau (câble, ou switch éteint).`;
  if (!Bb.link) return `${nomDe(b)} n'a pas de lien réseau (câble, ou switch éteint).`;
  if (A.domaine !== Bb.domaine) return `${nomDe(a)} (${A.domaine}) et ${nomDe(b)} (${Bb.domaine}) ne sont pas dans le même domaine de niveau 2 : pas le même switch, pas le même VLAN, ou pas de câble entre les deux.`;
  if (A.conflit) return `${nomDe(a)} est en conflit d'adresse (${A.ip}).`;
  if (Bb.conflit) return `${nomDe(b)} est en conflit d'adresse (${Bb.ip}) : deux machines répondent.`;
  const ia = parseIp(A.ip), ib = parseIp(Bb.ip), pa = parseMask(A.mask), pb = parseMask(Bb.mask);
  if (ia == null) return `${nomDe(a)} n'a pas d'adresse valide (${A.ip}).`;
  if (ib == null) return `${nomDe(b)} n'a pas d'adresse valide (${Bb.ip}).`;
  if (pa == null) return `Le masque de ${nomDe(a)} (${A.mask}) est invalide.`;
  if (pb == null) return `Le masque de ${nomDe(b)} (${Bb.mask}) est invalide.`;
  if (linkLocal(A.ip) !== linkLocal(Bb.ip)) return `${nomDe(linkLocal(A.ip) ? a : b)} est en adresse de lien local (${linkLocal(A.ip) ? A.ip : Bb.ip}) faute de serveur DHCP : une machine en adresse fixe ne peut pas la joindre.`;
  if (!sameNet(ia, ib, pa)) return `${Bb.ip} n'est pas dans le sous-réseau de ${nomDe(a)} (${ipStr(netOf(ia, pa))}/${pa}) : ${nomDe(a)} enverrait à sa passerelle${A.gw ? ' ' + A.gw : ', qu\'il n\'a pas'}.`;
  if (!sameNet(ia, ib, pb)) return `Vu de ${nomDe(b)} (masque ${Bb.mask}), ${A.ip} est hors de son sous-réseau (${ipStr(netOf(ib, pb))}/${pb}) : la réponse ne revient pas.`;
  return `${nomDe(a)} et ${nomDe(b)} sont dans le même domaine (${A.domaine}) et le même sous-réseau (${ipStr(netOf(ia, pa))}/${pa}) : ARP puis trames directes, sans routeur.`;
}

// ---------------- adresses : outils communs (repris de net/ctrlnet.js) ----------------
export { parseIp, ipStr, parseMask, netOf, sameNet };
/** une adresse est-elle de lien local (169.254.x.x) ? */
export const linkLocal = (/** @type {string} */ ip) => { const n = parseIp(ip); return n != null && netOf(n, 16) === netOf(/** @type {number} */ (parseIp('169.254.0.0')), 16); };

// @ts-check
import { CATALOGUE, portOf, compatibles } from './catalogue/index.js';
import { parseIp, ipStr, parseMask, netOf, sameNet } from '../net/ctrlnet.js';

// ----------------------------------------------------------------------------------
// Le moteur de l'entrepôt : à partir du montage (build.js) et du catalogue, il calcule ce qui
// marche vraiment. Pur (pas de DOM, pas d'état caché) : evaluate(build) renvoie un Eval
// (types.js). Les panneaux, la 3D et les missions lisent ce résultat ; rien d'autre ne décide.
//
// Ce qu'il calcule, dans l'ordre :
//   1. l'énergie : qui est alimenté (secteur par le mur et les bandeaux, 12 V par un bloc, PoE+ par
//      un port de switch qui le fournit, dans la limite de son budget), qui est allumé ;
//   2. les câbles : chaque liaison est-elle valable (signal, sens, connecteurs) ;
//   3. la vidéo : ce qui arrive sur chaque entrée SDI/HDMI (source, format, audio embarqué), en
//      traversant les boucles (HyperDeck, Teranex, RP150) et les mélangeurs (PGM, AUX, multiview) ;
//   4. l'IP : domaines de niveau 2 (switchs, VLAN des ports), adresses effectives (fixe, DHCP d'un
//      routeur, sinon 169.254.x.x), conflits d'adresses, qui joint qui (même sous-réseau) ;
//   5. les services : RP150 → caméras (HTTP 80), PC → ATEM (9910), ATEM → HyperDeck (9993), vMix →
//      caméras (HTTP, NDI|HX), streaming → Internet par le routeur, interface web d'un appareil ;
//   6. le tally : du mélangeur aux caméras, par le chemin qui existe (GPI & Tally Interface →
//      RP150 TALLY/GPIO1 → TALLY IP → caméras ; Carbonite TALLY → RP150 ; vMix → caméras en IP) ;
//   7. les alertes (par appareil) : ce qui manque, en français, pour le panneau et le tuteur.
// Le rédacteur « moteur » écrit ce fichier (voir le brief). Ci-dessous : le squelette, avec
// l'énergie et les câbles déjà calculés, pour que le reste de l'interface ait de quoi s'afficher.
// ----------------------------------------------------------------------------------
/** @typedef {import('./types.js').Build} Build */
/** @typedef {import('./types.js').Eval} Eval */
/** @typedef {import('./types.js').Appareil} Appareil */

/** budget électrique des prises murales (W), et d'un bandeau (W) */
export const MUR_W = 3680, BANDEAU_W = 2300;
/** adresse de secours quand un appareil en DHCP ne trouve pas de serveur (lien local, RFC 3927) */
export const LINK_LOCAL = '169.254.0.0/16';

const key = (dev, port) => `${dev}:${port}`;
export { key as portKey };

/**
 * @param {Build} B
 * @returns {Eval}
 */
export function evaluate(B) {
  const E = /** @type {Eval} */ ({ power: {}, poe: {}, cables: {}, video: {}, ip: {}, reach: {}, services: {}, tally: {}, alertes: [], ver: 0 });
  const byUid = new Map(B.appareils.map((a) => [a.uid, a]));
  const M = (/** @type {Appareil} */ a) => CATALOGUE[a.modele];
  const cablesAt = (dev, port) => B.cables.filter((c) => (c.a.dev === dev && c.a.port === port) || (c.b.dev === dev && c.b.port === port));
  const peer = (dev, port) => { const c = cablesAt(dev, port)[0]; if (!c) return null; const o = c.a.dev === dev && c.a.port === port ? c.b : c.a; return { ...o, cable: c }; };

  // ---- 2. câbles ----
  for (const c of B.cables) {
    const A = byUid.get(c.a.dev), Bb = byUid.get(c.b.dev);
    const pa = A ? portOf(A.modele, c.a.port) : null, pb = Bb ? portOf(Bb.modele, c.b.port) : null;
    if (!pa || !pb) { E.cables[c.uid] = { ok: false, why: 'Un bout du câble ne mène nulle part.' }; continue; }
    const r = compatibles(pa, pb); E.cables[c.uid] = { ok: r.ok, why: r.why };
  }

  // ---- 1. énergie ----
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
      if (p.sig === 'dc12' && E.power[o.dev] && E.power[o.dev].on) return { source: '12 V', via: o.dev, port: p.id };
      if (p.sig === 'ip' && p.poe) { const om = byUid.get(o.dev) ? M(byUid.get(o.dev)) : null; const op = om ? om.ports.find((x) => x.id === o.port) : null; if (op && op.poe && E.power[o.dev] && E.power[o.dev].on) return { source: 'PoE+', via: o.dev, port: p.id, watts: p.watts || 0 }; }
    }
    return null;
  };
  // on itère : l'énergie se propage de proche en proche (mur → bandeau → bloc 12 V → appareil…)
  const poeUsed = {};
  for (let pass = 0; pass < 6; pass++) {
    for (const a of B.appareils) {
      const m = M(a); if (!m) continue;
      if (m.pose === 'mur') { E.power[a.uid] = { on: true, source: 'réseau électrique', why: '', watts: 0 }; continue; }
      const f = fedBy(a);
      const sw = a.cfg && a.cfg.interrupteur === false;
      const needs = m.ports.some((p) => (p.sig === 'secteur' || p.sig === 'dc12' || (p.sig === 'ip' && p.poe)) && (p.dir === 'in' || p.dir === 'io'));
      if (!needs) { E.power[a.uid] = { on: true, source: 'sans alimentation', why: '', watts: 0 }; continue; }
      if (!f) { E.power[a.uid] = { on: false, source: '', why: 'Aucune alimentation branchée (secteur, 12 V ou PoE+).', watts: m.watts || 0 }; continue; }
      if (f.source === 'PoE+') { poeUsed[f.via] = (poeUsed[f.via] || 0) + (f.watts || m.watts || 0); }
      E.power[a.uid] = { on: !sw, source: f.source + (f.via && f.via !== 'mur' ? ` (${(byUid.get(f.via) || { nom: '?' }).nom})` : ''), why: sw ? 'Interrupteur sur arrêt.' : '', watts: m.watts || 0 };
      // ce que l'appareil fournit à son tour
      if (!sw) for (const p of m.ports) if ((p.sig === 'secteur' || p.sig === 'dc12') && p.dir === 'out') secteur.add(key(a.uid, p.id));
    }
  }
  // budget PoE des switchs
  for (const a of B.appareils) {
    const m = M(a); if (!m || !m.ports.some((p) => p.poe && p.sig === 'ip' && m.famille === 'reseau')) continue;
    const budget = Number((m.cfg && m.cfg.poeBudget) || (a.cfg && a.cfg.poeBudget) || 0);
    E.poe[a.uid] = { budget, used: Math.round(poeUsed[a.uid] || 0), ok: !budget || (poeUsed[a.uid] || 0) <= budget };
    if (!E.poe[a.uid].ok) E.alertes.push({ dev: a.uid, level: 'erreur', msg: `Budget PoE+ dépassé : ${E.poe[a.uid].used} W demandés pour ${budget} W.` });
  }
  // budget du mur et des bandeaux
  let total = 0; for (const a of B.appareils) if (E.power[a.uid] && E.power[a.uid].on && E.power[a.uid].source.startsWith('secteur')) total += E.power[a.uid].watts;
  if (total > MUR_W) E.alertes.push({ dev: 'mur', level: 'erreur', msg: `${total} W sur un disjoncteur de 16 A (${MUR_W} W) : il saute.` });
  for (const a of B.appareils) if (E.power[a.uid] && !E.power[a.uid].on) E.alertes.push({ dev: a.uid, level: 'erreur', msg: E.power[a.uid].why || 'Pas alimenté.' });
  for (const [id, c] of Object.entries(E.cables)) if (!c.ok) { const cb = B.cables.find((x) => x.uid === id); if (cb) E.alertes.push({ dev: cb.a.dev, level: 'erreur', msg: `Câble ${id} : ${c.why}` }); }

  // ---- 3 à 6 : vidéo, IP, services, tally (rédacteur « moteur ») ----
  return E;
}

// ---------------- adresses : outils communs (repris de net/ctrlnet.js) ----------------
export { parseIp, ipStr, parseMask, netOf, sameNet };
/** une adresse est-elle de lien local (169.254.x.x) ? */
export const linkLocal = (/** @type {string} */ ip) => { const n = parseIp(ip); return n != null && netOf(n, 16) === netOf(/** @type {number} */ (parseIp('169.254.0.0')), 16); };

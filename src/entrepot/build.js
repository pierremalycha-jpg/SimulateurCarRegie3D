// @ts-check
import { emit } from '../state.js';
import { PROG, saveProgressSoon } from '../shared.js';
import { CATALOGUE, portOf, compatibles } from './catalogue/index.js';

// ----------------------------------------------------------------------------------
// L'état du montage (le « build ») : les appareils sortis du stock, où ils sont posés, les câbles,
// la configuration de chacun. Pur (pas de DOM) : testable sous Node. Chaque changement passe par
// une fonction d'ici, qui incrémente B.ver et émet l'événement « entrepot » { type: 'change' } ;
// le moteur (engine.js) recalcule à la demande, les panneaux et la 3D se rafraîchissent.
// Le montage est enregistré avec la progression (PROG.entrepot.build) et peut être exporté.
// ----------------------------------------------------------------------------------
/** @typedef {import('./types.js').Build} Build */
/** @typedef {import('./types.js').Appareil} Appareil */
/** @typedef {import('./types.js').Cable} Cable */
/** @typedef {import('./types.js').Place} Place */
/** @typedef {import('./types.js').Bout} Bout */

/** la baie : 12 U ; la table : 8 emplacements ; le plateau : 4 emplacements (pieds) ; le mur : 1 (les prises) */
export const ZONES = { rack: { nom: 'Baie 19"', slots: 12 }, table: { nom: 'Table de régie', slots: 8 }, plateau: { nom: 'Plateau', slots: 4 }, mur: { nom: 'Mur', slots: 1 } };

/** @type {Build & { ver: number }} */
export const B = { appareils: [], cables: [], mission: '', ver: 0 };

let seq = 1;
const uid = (p) => `${p}${(seq++).toString(36)}${Date.now().toString(36).slice(-3)}`;
function changed(o = {}) { B.ver++; B.at = Date.now(); emit('entrepot', { type: 'change', ...o }); save(); }

export const appareil = (/** @type {string} */ id) => B.appareils.find((a) => a.uid === id) || null;
export const modeleDe = (/** @type {string} */ id) => { const a = appareil(id); return a ? CATALOGUE[a.modele] || null : null; };
export const cable = (/** @type {string} */ id) => B.cables.find((c) => c.uid === id) || null;
/** les câbles branchés sur un port */
export const cablesDe = (/** @type {string} */ dev, /** @type {string} */ port = '') => B.cables.filter((c) => (c.a.dev === dev && (!port || c.a.port === port)) || (c.b.dev === dev && (!port || c.b.port === port)));
/** l'autre bout d'un câble */
export const autreBout = (/** @type {Cable} */ c, /** @type {string} */ dev) => (c.a.dev === dev ? c.b : c.a);
/** les appareils d'une zone, par emplacement */
export const dansZone = (/** @type {Place['zone']} */ zone) => B.appareils.filter((a) => a.place.zone === zone).sort((x, y) => x.place.slot - y.place.slot);

/** les emplacements pris dans une zone (un appareil de baie de 2 U prend deux rangées) */
export function occupes(/** @type {Place['zone']} */ zone, /** @type {string} */ sauf = '') {
  const s = new Set();
  for (const a of B.appareils) {
    if (a.place.zone !== zone || a.uid === sauf) continue;
    const m = CATALOGUE[a.modele]; const h = zone === 'rack' ? Math.max(1, Math.ceil(m && m.u ? m.u : 1)) : 1;
    for (let i = 0; i < h; i++) s.add(a.place.slot + i);
  }
  return s;
}
/** premier emplacement libre pour un modèle dans sa zone de pose (null : plus de place) */
export function placeLibre(/** @type {string} */ modele, /** @type {string} */ sauf = '') {
  const m = CATALOGUE[modele]; if (!m) return null;
  const zone = m.pose; const occ = occupes(zone, sauf); const h = zone === 'rack' ? Math.max(1, Math.ceil(m.u || 1)) : 1;
  for (let s = 1; s + h - 1 <= ZONES[zone].slots; s++) { let ok = true; for (let i = 0; i < h; i++) if (occ.has(s + i)) ok = false; if (ok) return /** @type {Place} */ ({ zone, slot: s }); }
  return null;
}
/** nom proposé pour un nouvel exemplaire (CAM 1, CAM 2, HyperDeck 1…) */
function nomPropose(/** @type {import('./types.js').Modele} */ m) {
  const base = m.famille === 'camera' ? 'CAM' : m.court;
  const n = B.appareils.filter((a) => (CATALOGUE[a.modele] || {}).famille === m.famille && (m.famille === 'camera' || a.modele === m.id)).length + 1;
  return m.famille === 'camera' || n > 1 || B.appareils.some((a) => a.nom === base) ? `${base} ${n}` : base;
}

/**
 * Sort un modèle du stock et le pose (à l'emplacement donné, ou au premier libre).
 * @returns {{ ok: boolean, uid?: string, why?: string }}
 */
export function sortir(/** @type {string} */ modele, /** @type {Partial<Place>} */ place = {}) {
  const m = CATALOGUE[modele]; if (!m) return { ok: false, why: 'Modèle inconnu.' };
  if (m.pose === 'mur' && B.appareils.some((a) => a.modele === modele)) return { ok: false, why: 'Il n\'y a qu\'un tableau électrique.' };
  const p = place.zone && place.slot ? /** @type {Place} */ ({ zone: place.zone, slot: place.slot }) : placeLibre(modele);
  if (!p) return { ok: false, why: `Plus de place : ${ZONES[m.pose].nom} (${ZONES[m.pose].slots} emplacements).` };
  const a = /** @type {Appareil} */ ({ uid: uid('a'), modele, nom: nomPropose(m), place: p, cfg: structuredClone(m.cfg || {}) });
  B.appareils.push(a);
  changed({ what: 'sortir', dev: a.uid });
  return { ok: true, uid: a.uid };
}
/** remet un appareil au stock : ses câbles partent avec lui */
export function ranger(/** @type {string} */ id) {
  const i = B.appareils.findIndex((a) => a.uid === id); if (i < 0) return false;
  B.cables = B.cables.filter((c) => c.a.dev !== id && c.b.dev !== id);
  B.appareils.splice(i, 1);
  changed({ what: 'ranger', dev: id });
  return true;
}
/** déplace un appareil (même zone de pose que son modèle) ; refuse un emplacement pris */
export function poser(/** @type {string} */ id, /** @type {Place} */ place) {
  const a = appareil(id); const m = modeleDe(id); if (!a || !m) return { ok: false, why: 'Appareil inconnu.' };
  if (place.zone !== m.pose) return { ok: false, why: `${m.nom} se pose ${m.pose === 'rack' ? 'dans la baie' : m.pose === 'table' ? 'sur la table' : m.pose === 'plateau' ? 'sur le plateau' : 'au mur'}.` };
  const h = place.zone === 'rack' ? Math.max(1, Math.ceil(m.u || 1)) : 1; const occ = occupes(place.zone, id);
  if (place.slot < 1 || place.slot + h - 1 > ZONES[place.zone].slots) return { ok: false, why: 'Hors de la zone.' };
  for (let i = 0; i < h; i++) if (occ.has(place.slot + i)) return { ok: false, why: 'Emplacement déjà pris.' };
  a.place = { zone: place.zone, slot: place.slot };
  changed({ what: 'poser', dev: id });
  return { ok: true };
}
export function renommer(/** @type {string} */ id, /** @type {string} */ nom) { const a = appareil(id); if (!a) return false; a.nom = String(nom).trim().slice(0, 24) || a.nom; changed({ what: 'nom', dev: id }); return true; }
/** interrupteur d'un appareil */
export function allumer(/** @type {string} */ id, on = true) { const a = appareil(id); if (!a) return false; a.on = !!on; changed({ what: 'on', dev: id }); return true; }

/**
 * Relie deux ports par un câble. Vérifie que les ports existent, qu'ils sont compatibles (même
 * signal, sens, connecteurs) et libres (un port ne prend qu'un câble).
 * @returns {{ ok: boolean, uid?: string, why?: string }}
 */
export function relier(/** @type {Bout} */ a, /** @type {Bout} */ b, len = 0) {
  const A = appareil(a.dev), Bp = appareil(b.dev); if (!A || !Bp) return { ok: false, why: 'Appareil inconnu.' };
  if (a.dev === b.dev && a.port === b.port) return { ok: false, why: 'Un port sur lui-même.' };
  const pa = portOf(A.modele, a.port), pb = portOf(Bp.modele, b.port); if (!pa || !pb) return { ok: false, why: 'Port inconnu.' };
  const c = compatibles(pa, pb); if (!c.ok) return { ok: false, why: c.why };
  if (cablesDe(a.dev, a.port).length) return { ok: false, why: `${pa.label} de ${A.nom} est déjà câblé.` };
  if (cablesDe(b.dev, b.port).length) return { ok: false, why: `${pb.label} de ${Bp.nom} est déjà câblé.` };
  const cb = /** @type {Cable} */ ({ uid: uid('c'), a: { ...a }, b: { ...b }, sig: pa.sig, len: len || undefined });
  B.cables.push(cb);
  changed({ what: 'relier', cable: cb.uid });
  return { ok: true, uid: cb.uid };
}
export function debrancher(/** @type {string} */ id) { const i = B.cables.findIndex((c) => c.uid === id); if (i < 0) return false; B.cables.splice(i, 1); changed({ what: 'debrancher', cable: id }); return true; }
/** règle une configuration (fusion superficielle ; un chemin « a.b » règle une clé imbriquée) */
export function regler(/** @type {string} */ id, /** @type {Record<string, any>} */ patch, o = {}) {
  const a = appareil(id); if (!a) return false;
  for (const [k, v] of Object.entries(patch)) {
    const path = k.split('.'); let o2 = a.cfg;
    for (let i = 0; i < path.length - 1; i++) o2 = o2[path[i]] = o2[path[i]] && typeof o2[path[i]] === 'object' ? o2[path[i]] : {};
    o2[path[path.length - 1]] = v;
  }
  changed({ what: 'cfg', dev: id, quiet: !!o.quiet });
  return true;
}
/** remet la configuration d'usine */
export function usine(/** @type {string} */ id) { const a = appareil(id); const m = modeleDe(id); if (!a || !m) return false; a.cfg = structuredClone(m.cfg || {}); changed({ what: 'cfg', dev: id }); return true; }

/** vide l'entrepôt (le mur revient tout seul) */
export function vider(/** @type {string} */ mission = '') {
  B.appareils = []; B.cables = []; B.mission = mission;
  if (CATALOGUE.mur) { B.appareils.push({ uid: 'mur', modele: 'mur', nom: 'Tableau électrique', place: { zone: 'mur', slot: 1 }, cfg: {} }); }
  changed({ what: 'vider' });
}
/** le montage, sérialisable (export JSON, enregistrement) */
export function serialiser() { return /** @type {Build} */ ({ appareils: structuredClone(B.appareils), cables: structuredClone(B.cables), mission: B.mission, at: Date.now() }); }
/** recharge un montage (les modèles inconnus sont ignorés) */
export function charger(/** @type {Build | null | undefined} */ d) {
  if (!d || !Array.isArray(d.appareils)) return false;
  B.appareils = d.appareils.filter((a) => a && CATALOGUE[a.modele] && a.place).map((a) => ({ ...structuredClone(a), cfg: { ...structuredClone(CATALOGUE[a.modele].cfg || {}), ...(a.cfg || {}) } }));
  const ids = new Set(B.appareils.map((a) => a.uid));
  B.cables = (d.cables || []).filter((c) => c && ids.has(c.a.dev) && ids.has(c.b.dev) && portOf(appareil(c.a.dev).modele, c.a.port) && portOf(appareil(c.b.dev).modele, c.b.port)).map((c) => structuredClone(c));
  B.mission = d.mission || '';
  if (!B.appareils.some((a) => a.modele === 'mur') && CATALOGUE.mur) B.appareils.push({ uid: 'mur', modele: 'mur', nom: 'Tableau électrique', place: { zone: 'mur', slot: 1 }, cfg: {} });
  changed({ what: 'charger', quiet: true });
  return true;
}
let saving = true;
/** enregistre avec la progression (débrayable pour les tests) */
export function save() { if (!saving) return; const P = /** @type {any} */ (PROG); P.entrepot = P.entrepot || {}; P.entrepot.build = serialiser(); PROG.updatedAt = Date.now(); saveProgressSoon(); }
export function setSaving(on) { saving = !!on; }
/** le montage enregistré, s'il y en a un */
export function montageEnregistre() { const P = /** @type {any} */ (PROG); return P.entrepot && P.entrepot.build && P.entrepot.build.appareils && P.entrepot.build.appareils.length > 1 ? P.entrepot.build : null; }

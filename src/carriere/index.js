// @ts-check
import { EPISODES, episodeById, SOCIETE_DEFAUT } from './mails.js';
import { STATION_INFO } from '../content/stations.js';

// ----------------------------------------------------------------------------------
// La Carrière (mode de Jouer, lieu « L'entrepôt ») : un bureau, un ordinateur, des mails qui
// proposent un poste sur une prestation. Calcul pur, sans interface, lu dans la progression :
//   - une mission est réussie quand l'activité qu'elle reprend l'est (la visite guidée : les
//     parcours « prise-en-main » et « poste-* » terminés, PROG.tutor ; une mission de
//     l'entrepôt : son meilleur résultat, PROG.entrepot.missions) : rien ne se compte deux fois,
//     ce qui est acquis ailleurs l'est ici, et le livret ne voit que les activités elles-mêmes ;
//   - un épisode s'ouvre quand ceux qu'il demande sont réussis : son mail arrive, puis le mail
//     de retour quand sa mission est réussie ;
//   - PROG.carriere ne garde que la date de réception (recus) et de lecture (lus) de chaque
//     mail, fusionnées entre deux appareils (la plus ancienne gagne).
// Un mail a pour identifiant « offre:<épisode> » ou « retour:<épisode> ».
// ----------------------------------------------------------------------------------
/** @typedef {import('./mails.js').Episode} Episode */
/** @typedef {{ recus: Record<string, number>, lus: Record<string, number> }} Carriere */
/** @typedef {{ id: string, label: string, ok: boolean }} Point */
/** @typedef {{ fait: boolean, n: number, total: number, points: Point[], score: number | null }} Avancement */
/**
 * @typedef {object} Mail
 * @property {string} id
 * @property {'offre' | 'retour'} kind
 * @property {Episode} ep
 * @property {import('./mails.js').Expediteur} de
 * @property {string} objet
 * @property {string} corps
 * @property {number} recu date de réception
 * @property {boolean} lu
 */

const isObj = (/** @type {any} */ x) => !!x && typeof x === 'object' && !Array.isArray(x);
/** une table « id → date » propre (dates finies et positives) */
const dates = (/** @type {any} */ t) => { /** @type {Record<string, number>} */ const o = {}; if (isObj(t)) for (const [k, v] of Object.entries(t)) if (Number.isFinite(v) && v > 0 && !/^__/.test(k)) o[k] = Number(v); return o; };

/** la Carrière d'une progression, remise en forme (créée si besoin) @param {any} P @returns {Carriere} */
export function carriere(P) {
  const c = isObj(P.carriere) ? P.carriere : (P.carriere = {});
  if (!isObj(c.recus)) c.recus = {};
  if (!isObj(c.lus)) c.lus = {};
  return c;
}
/** la forme lue dans un fichier ou sur le serveur, nettoyée (migrateProgress) */
export function normaliser(/** @type {any} */ c) { return { recus: dates(isObj(c) ? c.recus : null), lus: dates(isObj(c) ? c.lus : null) }; }
/** fusion de deux Carrières : un mail reçu ou lu sur l'un des appareils l'est pour de bon, à la date la plus ancienne */
export function mergeCarriere(/** @type {any} */ mine, /** @type {any} */ theirs) {
  const a = normaliser(mine), b = normaliser(theirs);
  for (const k of /** @type {const} */ (['recus', 'lus'])) for (const [id, t] of Object.entries(b[k])) a[k][id] = a[k][id] ? Math.min(a[k][id], t) : t;
  return a;
}

// ---------------- les missions, lues dans la progression ----------------
const tutorDone = (/** @type {any} */ P, /** @type {string} */ id) => !!(P.tutor && P.tutor[id] && P.tutor[id].done);
/** le meilleur résultat d'une mission de l'entrepôt (null : jamais rendue) */
export function scoreEntrepot(/** @type {any} */ P, /** @type {string} */ id) {
  const m = P.entrepot && P.entrepot.missions && P.entrepot.missions[id]; const b = m && m.best;
  return b ? Number(b.score ?? b) : null;
}
/** ce qui est fait de la mission d'un épisode @param {Episode} ep @param {any} P @returns {Avancement} */
export function avancement(ep, P) {
  const a = ep.mission.action;
  if (a.type === 'visite') {
    /** @type {Point[]} */ const points = [];
    if (a.tour) points.push({ id: 'prise-en-main', label: 'Le tour du car', ok: tutorDone(P, 'prise-en-main') });
    for (const id of a.postes) points.push({ id: 'poste-' + id, label: STATION_INFO[id] ? STATION_INFO[id].title : id, ok: tutorDone(P, 'poste-' + id) });
    const n = points.filter((x) => x.ok).length;
    return { fait: n === points.length, n, total: points.length, points, score: null };
  }
  const s = scoreEntrepot(P, a.mission); const ok = s != null && s >= a.seuil;
  return { fait: ok, n: ok ? 1 : 0, total: 1, points: [{ id: a.mission, label: `Montage rendu, ${a.seuil} / 100 au moins${s != null ? ` (meilleur : ${s} / 100)` : ''}`, ok }], score: s };
}
export const fait = (/** @type {Episode} */ ep, /** @type {any} */ P) => avancement(ep, P).fait;
/** un épisode s'ouvre quand ses requis sont réussis */
export const ouvert = (/** @type {Episode} */ ep, /** @type {any} */ P) => ep.requis.every((id) => { const e = episodeById(id); return !!e && fait(e, P); });

// ---------------- la boîte de réception ----------------
/** la Carrière est commencée : un premier mail a été reçu */
export const commencee = (/** @type {any} */ P) => isObj(P.carriere) && isObj(P.carriere.recus) && Object.keys(P.carriere.recus).length > 0;
/** les mails qui doivent être dans la boîte, dans l'ordre d'arrivée (le retour d'un épisode avant l'offre suivante) */
export function attendus(/** @type {any} */ P) {
  const out = [];
  for (const ep of EPISODES) {
    if (!ouvert(ep, P)) continue;
    out.push('offre:' + ep.id);
    if (fait(ep, P)) out.push('retour:' + ep.id);
  }
  return out;
}
/** reçoit les mails arrivés depuis la dernière fois ; renvoie leurs identifiants (dans l'ordre d'arrivée) */
export function recevoir(/** @type {any} */ P, now = Date.now()) {
  const C = carriere(P); const nouveaux = [];
  let t = Math.max(now, ...Object.values(C.recus).map((x) => x + 1));
  for (const id of attendus(P)) if (!C.recus[id]) { C.recus[id] = t++; nouveaux.push(id); }
  return nouveaux;
}
export function marquerLu(/** @type {any} */ P, /** @type {string} */ id, now = Date.now()) { const C = carriere(P); if (C.recus[id] && !C.lus[id]) { C.lus[id] = now; return true; } return false; }
/** @param {any} P @param {{ societe?: string }} [o] @returns {Mail[]} du plus récent au plus ancien */
export function boite(P, o = {}) {
  const C = isObj(P.carriere) ? normaliser(P.carriere) : { recus: {}, lus: {} };
  const societe = (o.societe || '').trim() || SOCIETE_DEFAUT;
  /** @type {Mail[]} */ const out = [];
  for (const [id, recu] of Object.entries(C.recus)) {
    const [kind, epId] = id.split(':'); const ep = episodeById(epId);
    if (!ep || (kind !== 'offre' && kind !== 'retour')) continue;
    const ctx = { societe, score: ep.mission.action.type === 'entrepot' ? scoreEntrepot(P, ep.mission.action.mission) : null };
    const m = kind === 'offre' ? { de: ep.de, objet: ep.objet, corps: ep.corps(ctx) } : { de: ep.retour.de, objet: ep.retour.objet, corps: ep.retour.corps(ctx) };
    out.push({ id, kind, ep, ...m, recu, lu: !!C.lus[id] });
  }
  return out.sort((a, b) => b.recu - a.recu);
}
export const nonLus = (/** @type {any} */ P) => boite(P).filter((m) => !m.lu).length;
/** la mission en cours : la plus ancienne offre reçue dont la mission n'est pas encore réussie */
export function enCours(/** @type {any} */ P) {
  const C = isObj(P.carriere) ? normaliser(P.carriere) : { recus: {}, lus: {} };
  return EPISODES.find((ep) => C.recus['offre:' + ep.id] && !fait(ep, P)) || null;
}

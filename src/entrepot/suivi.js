// @ts-check
import { PROG, saveProgressSoon } from '../shared.js';

// ----------------------------------------------------------------------------------
// Le suivi de l'entrepôt : le résultat d'une mission rendue est enregistré avec la progression
// (PROG.entrepot.missions[id] = { best: { score, at }, runs: les 10 derniers essais }). C'est ce
// que lisent l'exercice noté x-entrepot du Cours (cours/exercices.js, entrepotBest) et le livret
// de compétences (livret.js). La fusion entre deux appareils est dans shared.js (mergeProgress).
// ----------------------------------------------------------------------------------
/**
 * @typedef {object} Essai
 * @property {number} score sur 100
 * @property {number} at date
 * @property {number | null} budget euros dépensés (ordre de grandeur), null sans budget
 * @property {string[]} ok exigences acquises
 */
/** @typedef {{ best: { score: number, at: number } | null, runs: Essai[] }} Resultat */

/** le résultat enregistré d'une mission (null : jamais rendue) */
export function resultat(/** @type {string} */ id) {
  const P = /** @type {any} */ (PROG);
  return P.entrepot && P.entrepot.missions && P.entrepot.missions[id] ? /** @type {Resultat} */ (P.entrepot.missions[id]) : null;
}

/**
 * Enregistre un essai de la mission (le bouton « Rendre le montage ») et garde le meilleur.
 * @param {string} id @param {{ score: number, items: Array<{ id: string, ok: boolean }>, budget: { used: number } | null }} N
 * @returns {Resultat & { nouveau: boolean }}
 */
export function rendre(id, N, at = Date.now()) {
  const P = /** @type {any} */ (PROG);
  P.entrepot = P.entrepot || {};
  const M = P.entrepot.missions = P.entrepot.missions || {};
  const r = /** @type {Resultat} */ (M[id] = M[id] || { best: null, runs: [] });
  /** @type {Essai} */ const essai = { score: N.score, at, budget: N.budget ? N.budget.used : null, ok: N.items.filter((i) => i.ok).map((i) => i.id) };
  r.runs = [...(r.runs || []), essai].slice(-10);
  const ancien = r.best ? Number(r.best.score ?? r.best) : -1;
  const nouveau = essai.score > ancien;
  if (nouveau) r.best = { score: essai.score, at };
  PROG.updatedAt = Date.now(); saveProgressSoon();
  return { ...r, nouveau };
}

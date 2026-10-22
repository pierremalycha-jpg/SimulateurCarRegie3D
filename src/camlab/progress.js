// @ts-check
import { PROG, saveProgressSoon } from '../shared.js';

// ----------------------------------------------------------------------------------
// La progression du module « La caméra en 3D », enregistrée avec celle du stagiaire (PROG.camera,
// comme PROG.cours pour le Cours) :
//   notions : meilleur score des trois questions d'Olivier de chaque fiche. Seule la première
//             réponse à chaque question compte ; une notion est ACQUISE quand les trois premières
//             réponses d'une même série sont justes (3 / 3), comme une leçon du Cours ;
//   quiz    : meilleur score du quiz de chaque chapitre (camlab/quiz.js) ;
//   mes     : la mise en service notée (camlab/mes.js) : le meilleur résultat et les derniers essais.
// Chaque fonction prend la progression en dernier paramètre (PROG par défaut) : les tests et le
// livret (src/livret.js, qui reprend la même règle) lisent aussi un document progress/<id>.
// ----------------------------------------------------------------------------------

/** score minimal de la mise en service pour la compter réussie (le seuil des exercices notés du livret) */
export const MES_SEUIL = 60;

/**
 * @typedef {{ score: number, total: number, at?: number }} Score
 * @typedef {{ score: number, sec: number, errs: number, ordre?: number, geste?: number, variante?: string, at?: number }} MesResult
 * @typedef {{ notions: Record<string, Score>, quiz: Record<string, Score>, mes: { best: MesResult | null, runs: MesResult[] } }} CamProg
 */

/** la progression du module (créée vide au besoin) */
export function camProg(P = PROG) {
  const p = /** @type {any} */ (P);
  const c = p.camera || (p.camera = {});
  c.notions = c.notions || {}; c.quiz = c.quiz || {}; c.mes = c.mes || { best: null, runs: [] };
  if (!Array.isArray(c.mes.runs)) c.mes.runs = [];
  return /** @type {CamProg} */ (c);
}
/** lecture seule (rien n'est créé dans une progression lue, celle d'un autre stagiaire par exemple) */
const read = (P) => /** @type {any} */ ((/** @type {any} */ (P) || {}).camera || {});
/** enregistre, sans l'écrire tout de suite (même délai que le reste de la progression) */
function touch(P) { if (P === PROG) { PROG.updatedAt = Date.now(); saveProgressSoon(); } }
const better = (old, score) => !old || score >= old.score;

// ---------------- les notions ----------------
/** une série des trois questions d'une fiche : score = premières réponses justes */
export function recordNotion(id, score, total, P = PROG) {
  const N = camProg(P).notions;
  if (better(N[id], score)) N[id] = { score, total, at: Date.now() };
  touch(P);
  return notionAcquise(id, P);
}
/** notion acquise : une série réussie en entier du premier coup */
export const notionAcquise = (id, P = PROG) => { const s = (read(P).notions || {})[id]; return !!s && s.total > 0 && s.score === s.total; };
/** combien de notions acquises parmi ids */
export const acquises = (ids, P = PROG) => ids.filter((id) => notionAcquise(id, P)).length;

// ---------------- les quiz de chapitre ----------------
export function recordChapterQuiz(n, score, total, P = PROG) {
  const Q = camProg(P).quiz;
  if (better(Q[n], score)) Q[n] = { score, total, at: Date.now() };
  touch(P);
}
/** meilleur score du quiz du chapitre n, ou null */
export const chapterQuizBest = (n, P = PROG) => (read(P).quiz || {})[n] || null;

// ---------------- la mise en service ----------------
/** un essai terminé : il entre dans les derniers essais (10 au plus) ; renvoie true si c'est le meilleur */
export function recordMes(r, P = PROG) {
  const M = camProg(P).mes; const run = { ...r, at: r.at || Date.now() };
  M.runs.push(run); M.runs = M.runs.slice(-10);
  const best = !M.best || r.score > M.best.score || (r.score === M.best.score && r.sec < M.best.sec);
  if (best) M.best = run;
  touch(P);
  return best;
}
/** meilleur résultat de la mise en service, ou null */
export const mesBest = (P = PROG) => (read(P).mes || {}).best || null;
/** mise en service réussie : au moins MES_SEUIL sur 100 */
export const mesReussie = (P = PROG) => { const b = mesBest(P); return !!b && b.score >= MES_SEUIL; };

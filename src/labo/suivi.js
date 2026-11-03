// @ts-check
// ----------------------------------------------------------------------------------
// Le suivi des défis du Labo dans la progression (PROG.labo, v19.28). Calcul pur, sans import :
// shared.js s'en sert pour remettre en forme et fusionner, le jeu (game/xp.js), le livret et
// l'écran Jouer pour lire ce qui est réussi.
//   labo.defis[id] = { best, seul, n, at, runs }
//     best : meilleur score (sur 100) ; seul : réussi (SEUIL_DEFI) sans demander de solution ;
//     n : nombre d'essais terminés ; at : date du dernier ; runs : les derniers scores (10 au plus),
//     lus par le bilan du professeur (comptes/bilan.js : essais manqués).
// ----------------------------------------------------------------------------------
/** un défi est réussi à partir de… (sur 100), comme l'exercice en autonomie d'une leçon */
export const SEUIL_DEFI = 60;
/** derniers scores gardés par défi */
export const RUNS_MAX = 10;

const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const score = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

/** un défi enregistré, remis en forme (null s'il est inutilisable) */
function defiNet(d) {
  if (!isObj(d) || !Number.isFinite(Number(d.best))) return null;
  const runs = Array.isArray(d.runs) ? d.runs.filter((x) => Number.isFinite(Number(x))).map(score).slice(-RUNS_MAX) : [];
  return { best: score(d.best), seul: !!d.seul, n: Math.max(runs.length, Math.floor(Number(d.n) || 0)), at: Number(d.at) || 0, runs };
}
/** PROG.labo remis en forme : les défis lisibles, le reste retiré */
export function normaliserLabo(L) {
  /** @type {{ defis: Record<string, any> }} */ const out = { defis: {} };
  if (!isObj(L) || !isObj(L.defis)) return out;
  for (const [id, d] of Object.entries(L.defis)) { const n = defiNet(d); if (n) out.defis[id] = n; }
  return out;
}
/** fusionne deux suivis (deux appareils) : rien ne se perd, le meilleur de chaque défi */
export function mergeLabo(a, b) {
  const A = normaliserLabo(a), B = normaliserLabo(b);
  for (const [id, d] of Object.entries(B.defis)) {
    const m = A.defis[id];
    if (!m) { A.defis[id] = d; continue; }
    const recent = (d.at || 0) > (m.at || 0) ? d : m, ancien = recent === d ? m : d;
    A.defis[id] = { best: Math.max(m.best, d.best), seul: m.seul || d.seul, n: Math.max(m.n, d.n), at: Math.max(m.at, d.at), runs: [...ancien.runs, ...recent.runs].slice(-RUNS_MAX) };
  }
  return A;
}
/**
 * Note un essai terminé dans le suivi (le modifie et le rend). seul : aucune solution demandée.
 * @returns {{ L: any, premier: boolean }} premier : c'est la première réussite seul de ce défi
 */
export function noterEssai(L, /** @type {string} */ id, /** @type {number} */ s, /** @type {boolean} */ seul, at = Date.now()) {
  const N = normaliserLabo(L);
  const d = N.defis[id] || { best: 0, seul: false, n: 0, at: 0, runs: [] };
  const ok = score(s) >= SEUIL_DEFI && seul;
  const premier = ok && !d.seul;
  N.defis[id] = { best: Math.max(d.best, score(s)), seul: d.seul || ok, n: d.n + 1, at, runs: [...d.runs, score(s)].slice(-RUNS_MAX) };
  return { L: N, premier };
}
/** le défi est réussi seul dans cette progression */
export const defiReussi = (P, /** @type {string} */ id) => { const d = ((P && P.labo) || {}).defis; return !!(d && d[id] && d[id].seul); };
/** le résultat d'un défi dans cette progression, ou null */
export const defiEtat = (P, /** @type {string} */ id) => { const d = ((P && P.labo) || {}).defis; return d && d[id] ? d[id] : null; };

// @ts-check
// ----------------------------------------------------------------------------------
// Revenir chaque jour : la série (jours d'activité d'affilée, un bonus de régularité au premier gain
// du jour) et trois défis du jour, les mêmes pour toute la classe (tirés de la date). Calcul pur : lit
// le journal des gains (game.log, chaque gain porte sa sorte « k ») ; game/xp.js donne les points.
//   game.jours : les jours d'activité ('2026-11-03'), triés, les 400 derniers
//   game.defis : jour → défis réussis ce jour-là (les 14 derniers jours)
// ----------------------------------------------------------------------------------

/** le jour (heure de l'ordinateur) d'un instant, « AAAA-MM-JJ » */
export function jourDe(t = Date.now()) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** le jour d'avant (« AAAA-MM-JJ ») */
export function veille(j) { const [a, m, d] = j.split('-').map(Number); return jourDe(new Date(a, m - 1, d - 1, 12).getTime()); }

/**
 * La série en cours : jours d'affilée jusqu'à aujourd'hui (ou hier : la série tient tant qu'on n'a
 * pas sauté un jour entier), et la meilleure série.
 * @param {string[]} jours @param {string} [auj]
 */
export function serie(jours, auj = jourDe()) {
  const set = new Set(jours || []);
  let n = 0, j = set.has(auj) ? auj : veille(auj);
  while (set.has(j)) { n++; j = veille(j); }
  const tri = [...set].sort(); let best = 0, cur = 0, prev = '';
  for (const x of tri) { cur = prev && veille(x) === prev ? cur + 1 : 1; best = Math.max(best, cur); prev = x; }
  return { n, best: Math.max(best, n), aujourdhui: set.has(auj) };
}
/** le bonus de régularité du premier gain du jour, selon la série (10 XP, puis 5 de plus par jour, 40 au plus) */
export const bonusSerie = (n) => 10 + 5 * Math.min(Math.max(n - 1, 0), 6);

/** @typedef {{ id: string, t: string, pts: number, sortes?: string[], n?: number, xp?: number }} Defi */
/** @type {Defi[]} les défis à gagner des XP (l'un d'eux chaque jour) */
export const DEFIS_XP = [
  { id: 'xp100', t: 'Gagner 100 XP', xp: 100, pts: 25 },
  { id: 'xp250', t: 'Gagner 250 XP', xp: 250, pts: 50 },
];
/** @type {Defi[]} les défis d'activité (deux chaque jour) */
export const DEFIS = [
  { id: 'lecon', t: 'Acquérir une leçon du Cours (quiz 3/3)', sortes: ['quiz'], n: 1, pts: 30 },
  { id: 'deux-lecons', t: 'Acquérir deux leçons du Cours', sortes: ['quiz'], n: 2, pts: 45 },
  { id: 'exo', t: 'Réussir l\'exercice en autonomie d\'une leçon', sortes: ['exo', 'exo3'], n: 1, pts: 30 },
  { id: 'olivier', t: 'Terminer un exercice avec Olivier', sortes: ['tutor'], n: 1, pts: 35 },
  { id: 'panne', t: 'Résoudre une panne cachée', sortes: ['panne'], n: 1, pts: 35 },
  { id: 'decouverte', t: 'Découvrir un poste ou un endroit du stade', sortes: ['poste', 'lieu'], n: 1, pts: 20 },
  { id: 'camera', t: 'Acquérir une notion de la caméra en 3D', sortes: ['notion', 'camquiz', 'mes'], n: 1, pts: 25 },
  { id: 'reseau', t: 'Réussir une mission réseau ST 2110', sortes: ['net'], n: 1, pts: 35 },
  { id: 'niveau', t: 'Valider un niveau du Cours ou réussir un test de niveau', sortes: ['niveau', 'test'], n: 1, pts: 40 },
  { id: 'antenne', t: 'Conduire une émission ou un jour de match', sortes: ['emission', 'scenario'], n: 1, pts: 40 },
  { id: 'car', t: 'Réussir une tâche du car vide ou un montage à l\'atelier', sortes: ['mission', 'brassage', 'atelier'], n: 1, pts: 30 },
  { id: 'labo', t: 'Réussir un défi d\'un atelier du Labo', sortes: ['labo'], n: 1, pts: 30 },
];
/** les trois défis réussis rapportent en plus */
export const BONUS_DEFIS = 50;
/** les gains qui ne comptent pas pour les défis (les récompenses des défis et de la série elles-mêmes) */
const HORS = new Set(['defi', 'serie']);

// un tirage stable pour un jour donné (le même pour tous)
function graine(j) { let h = 2166136261; for (const c of j) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
/** les trois défis d'un jour @param {string} [j] @returns {Defi[]} */
export function defisDuJour(j = jourDe()) {
  let h = graine(j);
  const next = () => { h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return h; };
  const pool = [...DEFIS]; const out = [DEFIS_XP[next() % DEFIS_XP.length]];
  for (let i = 0; i < 2; i++) out.push(pool.splice(next() % pool.length, 1)[0]);
  return out;
}
/**
 * Où en est chaque défi du jour, d'après le journal des gains.
 * @param {{ log?: Array<{ at: number, pts: number, k?: string }>, defis?: Record<string, string[]> }} g
 * @param {string} [j]
 */
export function etatDefis(g, j = jourDe()) {
  const log = (g.log || []).filter((l) => jourDe(l.at) === j && !HORS.has(l.k || ''));
  const faits = new Set(((g.defis || {})[j]) || []);
  return defisDuJour(j).map((d) => {
    const but = d.xp || d.n || 1;
    const val = d.xp ? log.reduce((s, l) => s + (l.pts || 0), 0) : log.filter((l) => d.sortes && d.sortes.includes(l.k || '')).length;
    return { defi: d, val: Math.min(val, but), but, fini: val >= but, recu: faits.has(d.id) };
  });
}
/** la sorte d'un gain, d'après sa clé (« quiz:son-n1 » → quiz) */
export const sorteDe = (key) => (key ? String(key).split(':')[0] : '');

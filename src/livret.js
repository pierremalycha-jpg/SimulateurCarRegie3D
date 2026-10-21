// @ts-check
import { BLOCS, COMPETENCES, RATTACHEMENT } from './content/referentiel.js';

// ----------------------------------------------------------------------------------
// Livret de compétences : à partir de la progression enregistrée d'un stagiaire (PROG, ou le
// document progress/<id> lu par le formateur), ce qu'il a pratiqué de chaque compétence du
// référentiel. Calcul pur, sans interface : ui/livret.js l'affiche.
//   absent      : aucune activité du simulateur ne la travaille (encore)
//   a_faire     : des activités existent, aucune n'est réussie
//   travaillee  : au moins une activité réussie
//   consolidee  : au moins trois activités différentes réussies (toutes, s'il y en a moins)
// Le livret dit ce qui a été pratiqué ; la validation d'une compétence reste au formateur.
// ----------------------------------------------------------------------------------

/** @typedef {'parcours' | 'mission' | 'phase' | 'reseau' | 'exercice' | 'cours'} Kind */
/** @typedef {'absent' | 'a_faire' | 'travaillee' | 'consolidee'} Niveau */
/** @typedef {{ kind: Kind, ref: string, done: boolean, aided: boolean }} Activite */

export const SEUIL_PHASE = 0.6, SEUIL_SCORE = 60, CONSOLIDE = 3;
/** @type {Record<Niveau, string>} */
export const NIVEAUX = { consolidee: 'Consolidée', travaillee: 'Travaillée', a_faire: 'À travailler', absent: 'Hors simulateur' };

/** @type {Record<Kind, Record<string, string[]>>} */
const TABLES = { parcours: RATTACHEMENT.parcours, mission: RATTACHEMENT.missions, phase: RATTACHEMENT.phases, reseau: RATTACHEMENT.reseau, exercice: RATTACHEMENT.exercices, cours: RATTACHEMENT.cours };
/** compétences travaillées par une activité */
export const codesOf = (/** @type {Kind} */ kind, /** @type {string} */ ref) => TABLES[kind][ref] || [];

/** activités rattachées à chaque compétence, dans l'ordre parcours, missions, jour de match, réseau, exercices, cours */
export const ACTIVITES = (() => {
  /** @type {Record<string, { kind: Kind, ref: string }[]>} */
  const m = Object.fromEntries(COMPETENCES.map((c) => [c.code, []]));
  for (const [kind, table] of Object.entries(TABLES)) for (const [ref, codes] of Object.entries(table)) for (const c of codes) m[c].push({ kind: /** @type {Kind} */ (kind), ref });
  return m;
})();

const best = (a) => (a || []).reduce((m, x) => Math.max(m, x.score || 0), 0);
/** réussite d'une activité d'après la progression enregistrée */
export function activityState(prog, /** @type {Kind} */ kind, /** @type {string} */ ref) {
  const P = prog || {}; const N = P.net || {};
  switch (kind) {
    case 'parcours': { const t = (P.tutor || {})[ref]; return { done: !!(t && t.done), aided: !!(t && t.done && t.aided) }; }
    case 'mission': return { done: !!(P.missions || {})[ref], aided: false };
    case 'cours': { const c = (P.cours || {})[ref]; return { done: !!(c && c.quiz && c.quiz.total && c.quiz.score === c.quiz.total), aided: false }; }
    case 'phase': return { done: (P.scenarios || []).some((s) => (s.phases || []).some((p) => p.id === ref && p.max > 0 && p.pts / p.max >= SEUIL_PHASE)), aided: false };
    case 'reseau': { const r = (N.missions || {})[ref]; return { done: !!r, aided: !!(r && r.aided) }; }
    case 'exercice': return {
      done: ref === 'brassage' ? (P.patchBest || 0) >= 100 : ref === 'atelier' ? (P.rigs || []).length > 0
        : ref === 'quiz2110' ? best(N.quiz) >= SEUIL_SCORE : ref === 'examenReseau' ? best(N.exams) >= SEUIL_SCORE : false,
      aided: false,
    };
  }
  return { done: false, aided: false };
}

/** @returns {Niveau} */
export function niveauOf(total, done) {
  if (!total) return 'absent';
  if (!done) return 'a_faire';
  return done >= Math.min(CONSOLIDE, total) ? 'consolidee' : 'travaillee';
}
const zero = () => ({ consolidee: 0, travaillee: 0, a_faire: 0, absent: 0 });

/** le livret d'un stagiaire, bloc par bloc */
export function livret(prog) {
  const comps = COMPETENCES.map((c) => {
    /** @type {Activite[]} */
    const acts = ACTIVITES[c.code].map((a) => ({ ...a, ...activityState(prog, a.kind, a.ref) }));
    const done = acts.filter((a) => a.done).length;
    return { ...c, acts, done, total: acts.length, niveau: niveauOf(acts.length, done) };
  });
  const count = zero();
  const blocs = BLOCS.map((b) => {
    const list = comps.filter((c) => c.code.startsWith(b.n + '.'));
    const n = zero(); for (const c of list) { n[c.niveau]++; count[c.niveau]++; }
    return { ...b, comps: list, count: n };
  });
  return { blocs, comps, count, total: comps.length };
}

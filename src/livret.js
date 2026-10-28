// @ts-check
import { BLOCS, COMPETENCES, RATTACHEMENT } from './content/referentiel.js';

// ----------------------------------------------------------------------------------
// Livret de compétences : à partir de la progression enregistrée d'un stagiaire (PROG, ou le
// document progress/<id> lu par le formateur), ce qu'il a pratiqué de chaque compétence du
// référentiel. Calcul pur, sans interface : ui/livret.js l'affiche.
//   absent      : aucune activité du simulateur ne la travaille (encore)
//   a_faire     : des activités existent, aucune n'est réussie
//   travaillee  : au moins une activité réussie
//   consolidee  : au moins trois activités différentes réussies (toutes, s'il y en a moins), dont au
//                 moins un exercice pratique (pas seulement des quiz) quand la compétence en a un
// Une activité n'est réussie que faite seul : un parcours terminé par « Fais-le pour moi » ou une
// mission réseau sauvée par la configuration de référence ne comptent pas (aided : à refaire seul),
// un montage d'atelier « à retravailler » non plus. Le livret dit ce qui a été pratiqué ; la validation
// d'une compétence reste au formateur.
// ----------------------------------------------------------------------------------

/** @typedef {'parcours' | 'mission' | 'phase' | 'reseau' | 'exercice' | 'cours' | 'exo' | 'camera'} Kind */
/** @typedef {'absent' | 'a_faire' | 'travaillee' | 'consolidee'} Niveau */
/** @typedef {{ kind: Kind, ref: string, done: boolean, aided: boolean, pratique: boolean }} Activite */

export const SEUIL_PHASE = 0.6, SEUIL_SCORE = 60, CONSOLIDE = 3;
/** un montage à l'atelier réussi : deux erreurs au plus (« Montage correct, quelques reprises », atelier.js) */
export const ATELIER_ERREURS = 2;
/** une activité pratique (un geste dans le car, à l'atelier, au réseau) ; les leçons du Cours, leurs exercices en autonomie (des calculs et
 * des situations sur le papier) et les notions de la caméra n'en sont pas */
export const estPratique = (/** @type {Kind} */ kind, /** @type {string} */ ref) => kind !== 'cours' && kind !== 'exo' && !(kind === 'camera' && ref !== 'mes');
/** @type {Record<Niveau, string>} */
export const NIVEAUX = { consolidee: 'Consolidée', travaillee: 'Travaillée', a_faire: 'À travailler', absent: 'Hors simulateur' };

/** @type {Record<Kind, Record<string, string[]>>} */
// l'exercice en autonomie d'une leçon (v19.18) travaille les compétences de sa leçon
const TABLES = { parcours: RATTACHEMENT.parcours, mission: RATTACHEMENT.missions, phase: RATTACHEMENT.phases, reseau: RATTACHEMENT.reseau, exercice: RATTACHEMENT.exercices, cours: RATTACHEMENT.cours, exo: RATTACHEMENT.cours, camera: RATTACHEMENT.camera };
/** compétences travaillées par une activité */
export const codesOf = (/** @type {Kind} */ kind, /** @type {string} */ ref) => TABLES[kind][ref] || [];

/** activités rattachées à chaque compétence, dans l'ordre parcours, missions, jour de match, réseau, exercices, cours, exercices du Cours, caméra */
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
    // réussi seul une fois au moins (clean), ou terminé sans « Fais-le pour moi » (progression d'avant la v19.4)
    case 'parcours': { const t = (P.tutor || {})[ref]; const fini = !!(t && t.done), seul = fini && !!(t.clean || !t.aided); return { done: seul, aided: fini && !seul }; }
    case 'mission': return { done: !!(P.missions || {})[ref], aided: false };
    case 'cours': { const c = (P.cours || {})[ref]; return { done: !!(c && c.quiz && c.quiz.total && c.quiz.score === c.quiz.total), aided: false }; }
    // l'exercice en autonomie : réussi (60 sur 100) sans demander de solution ; réussi avec une solution demandée : à refaire seul
    case 'exo': { const x = ((P.cours || {})[ref] || {}).exo; return { done: !!(x && x.seul), aided: !!(x && !x.seul && x.best >= SEUIL_SCORE) }; }
    // module caméra (même règle que camlab/progress.js) : la mise en service à 60 sur 100, une notion à 3 sur 3
    case 'camera': {
      const C = P.camera || {};
      if (ref === 'mes') { const b = (C.mes || {}).best; return { done: !!b && (b.score || 0) >= SEUIL_SCORE, aided: false }; }
      const n = (C.notions || {})[ref]; return { done: !!(n && n.total && n.score === n.total), aided: false };
    }
    case 'phase': return { done: (P.scenarios || []).some((s) => (s.phases || []).some((p) => p.id === ref && p.max > 0 && p.pts / p.max >= SEUIL_PHASE)), aided: false };
    case 'reseau': { const r = (N.missions || {})[ref]; const seul = !!r && !!(r.clean || !r.aided); return { done: seul, aided: !!r && !seul }; }
    case 'exercice': return {
      done: ref === 'brassage' ? (P.patchBest || 0) >= 100 : ref === 'atelier' ? (P.rigs || []).some((r) => r && (r.errs ?? 0) <= ATELIER_ERREURS)
        : ref === 'quiz2110' ? best(N.quiz) >= SEUIL_SCORE : ref === 'examenReseau' ? best(N.exams) >= SEUIL_SCORE
          : ref === 'entrepot' ? Object.values((P.entrepot || {}).missions || {}).some((m) => m && m.best && (m.best.score ?? m.best) >= SEUIL_SCORE)
            // l'émission en direct : 60 sur 100, les trois médias lancés soi-même (sinon : à refaire seul)
            : ref === 'emission' ? (P.emissions || []).some((e) => e && e.score >= SEUIL_SCORE && e.seul) : false,
      aided: ref === 'emission' && (P.emissions || []).some((e) => e && e.score >= SEUIL_SCORE && !e.seul) && !(P.emissions || []).some((e) => e && e.score >= SEUIL_SCORE && e.seul),
    };
  }
  return { done: false, aided: false };
}

/**
 * @param {number} total activités rattachées
 * @param {number} done activités réussies
 * @param {{ total: number, done: number }} [pratique] dont activités pratiques : consolidée demande d'en avoir réussi une
 * @returns {Niveau}
 */
export function niveauOf(total, done, pratique) {
  if (!total) return 'absent';
  if (!done) return 'a_faire';
  const geste = !pratique || !pratique.total || pratique.done > 0;
  return done >= Math.min(CONSOLIDE, total) && geste ? 'consolidee' : 'travaillee';
}
const zero = () => ({ consolidee: 0, travaillee: 0, a_faire: 0, absent: 0 });

/** le livret d'un stagiaire, bloc par bloc */
export function livret(prog) {
  const comps = COMPETENCES.map((c) => {
    /** @type {Activite[]} */
    const acts = ACTIVITES[c.code].map((a) => ({ ...a, ...activityState(prog, a.kind, a.ref), pratique: estPratique(a.kind, a.ref) }));
    const done = acts.filter((a) => a.done).length;
    const pratique = { total: acts.filter((a) => a.pratique).length, done: acts.filter((a) => a.pratique && a.done).length };
    return { ...c, acts, done, total: acts.length, pratique, niveau: niveauOf(acts.length, done, pratique) };
  });
  const count = zero();
  const blocs = BLOCS.map((b) => {
    const list = comps.filter((c) => c.code.startsWith(b.n + '.'));
    const n = zero(); for (const c of list) { n[c.niveau]++; count[c.niveau]++; }
    return { ...b, comps: list, count: n };
  });
  return { blocs, comps, count, total: comps.length };
}

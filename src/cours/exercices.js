// @ts-check
import { PROG } from '../shared.js';
import { lessonById as tutorLesson, progressOf } from '../tutor/engine.js';
import { NET_MISSIONS } from '../net/course.js';
import { allLessons } from './index.js';

// ----------------------------------------------------------------------------------
// Les exercices pratiques du Cours. Deux sortes :
//   - les parcours guidés d'Olivier, le chef de car (src/tutor/lessons) : on les fait dans le car,
//     il explique, on agit, il vérifie ; « Commencer » lance le car si besoin et ouvre le poste ;
//   - les exercices notés (« x-… ») : une vacation à part (atelier, car vide, jour de match) ou la
//     formation réseau, avec un résultat enregistré.
// Chaque exercice est rangé dans une leçon : soit dans la leçon elle-même (champ exercises des
// chapitres écrits dans cours/*.js), soit ici, pour les leçons écrites avant les exercices (BY_LESSON).
// Un exercice n'est rangé qu'une fois. Les présentations de postes (« Présente-moi ») et la prise
// en main forment le mode Visite guidée (écran Jouer), pas des exercices.
// ----------------------------------------------------------------------------------
/** @typedef {{ id: string, title: string, summary: string, duration: string, level: string, go: any, special?: boolean }} ExerciseInfo */

/** les exercices notés : une vacation à part ou la formation réseau */
export const SPECIAL = {
  'x-atelier': { title: 'Atelier : monter une caméra seul, chronométré', summary: 'Monter une caméra de stade pièce par pièce, du pied jusqu\'à la fibre, puis la régler. Le temps et les erreurs sont notés.', duration: '15 min', level: 'intermédiaire', go: { preset: 'atelier', label: 'Lancer l\'atelier' } },
  'x-brassage': { title: 'Le car vide : tout brasser, noté', summary: 'Rien n\'est brassé : reliez chaque liaison au bon endroit en suivant la liste de câblage, jusqu\'à ce que le multiview soit complet.', duration: '20 min', level: 'intermédiaire', go: { preset: 'brassage', label: 'Lancer le car vide' } },
  'x-reseau': { title: 'Formation réseau ST 2110 : 14 missions, quiz, examen', summary: 'Dans le poste Réseau IP : de la lecture de la topologie au dépannage, puis un quiz et un examen de trois pannes cachées.', duration: '2 h', level: 'avancé', go: { station: 'reseau', tab: 'learn', ip: true, label: 'Ouvrir la formation' } },
  'x-match': { title: 'Jour de match : line-up, test de ligne, direct avec pannes', summary: 'De 17 h 30 à l\'antenne : line-up des caméras, test de ligne avec la chaîne, puis le direct, avec des pannes à résoudre. Chronométré et noté.', duration: '30 min', level: 'avancé', go: { preset: 'scenario', label: 'Lancer le jour de match' } },
};
const best = (a) => (a && a.length ? Math.max(...a.map((x) => x.score || 0)) : null);
/** résultat d'un exercice noté : { done, text } */
export function specialState(id) {
  const P = PROG; const N = P.net || { missions: {}, quiz: [], exams: [] };
  if (id === 'x-atelier') { const r = (P.rigs || []).slice().sort((a, b) => a.errs - b.errs || a.sec - b.sec)[0]; return r ? { done: true, text: `meilleur montage : ${r.errs} erreur${r.errs > 1 ? 's' : ''}, ${Math.floor(r.sec / 60)} min` } : { done: false, text: 'pas encore fait' }; }
  if (id === 'x-brassage') return P.patchBest ? { done: P.patchBest >= 100, text: `brassage réussi à ${P.patchBest} %` } : { done: false, text: 'pas encore fait' };
  if (id === 'x-reseau') { const n = NET_MISSIONS.filter((m) => (N.missions || {})[m.id]).length; const e = best(N.exams); return { done: n === NET_MISSIONS.length && e != null && e >= 60, text: n || e != null ? `${n} / ${NET_MISSIONS.length} missions${e != null ? ` · examen ${e} %` : ''}` : 'pas encore commencé' }; }
  if (id === 'x-match') { const b = best(P.scenarios); return b != null ? { done: b >= 60, text: `meilleur score ${b} %` } : { done: false, text: 'pas encore joué' }; }
  return { done: false, text: '' };
}

/** exercices des leçons écrites avant les exercices : leçon → exercices et leur présentation */
/** @type {Record<string, Array<{ id: string, intro: string }>>} */
export const BY_LESSON = {
  'signal-niveaux': [{ id: 'vision-exposition', intro: '' }, { id: 'prism-waveform', intro: '' }],
  'signal-couleur': [{ id: 'vision-balance', intro: '' }, { id: 'prism-gamut', intro: '' }],
  'sdi-oeil': [{ id: 'prism-oeil', intro: '' }],
  'sdi-cable': [{ id: 'brassage-cordons', intro: '' }, { id: 'x-brassage', intro: '' }],
  'reseau-ip': [{ id: 'ctrlnet-bases', intro: '' }, { id: 'ctrlnet-machine', intro: '' }],
  'reseau-switch': [{ id: 'ctrlnet-depannage', intro: '' }],
  'reseau-multicast': [{ id: 'reseau-visite', intro: '' }, { id: 'reseau-leaf', intro: '' }, { id: 'reseau-passerelle', intro: '' }, { id: 'reseau-depannage', intro: '' }, { id: 'x-reseau', intro: '' }],
  'reseau-ptp': [{ id: 'reseau-ptp', intro: '' }],
  'hf-bilan': [{ id: 'hf-liaisons', intro: '' }],
};

/** les exercices d'une leçon (champ exercises de la leçon, puis BY_LESSON) */
export function exercisesOf(lesson) { return [...(lesson.exercises || []), ...(BY_LESSON[lesson.id] || [])]; }
/** fiche d'un exercice : titre, résumé, durée, niveau, cible du bouton « Commencer » */
/** @returns {ExerciseInfo | null} */
export function exerciseInfo(id) {
  if (SPECIAL[id]) return { id, ...SPECIAL[id], special: true };
  const l = tutorLesson(id); if (!l) return null;
  return { id, title: l.title, summary: l.summary, duration: l.duration, level: l.level, go: { lesson: id, label: l.title } };
}
/** exercice fait : parcours guidé terminé, ou exercice noté réussi */
export const exerciseDone = (id) => (SPECIAL[id] ? specialState(id).done : !!progressOf(id).done);
/** tous les exercices rangés dans le Cours, dans l'ordre des leçons */
export const allExercises = () => allLessons().flatMap(({ chapter, lesson }) => exercisesOf(lesson).map((x) => ({ chapter, lesson, ...x })));

// @ts-check
import { PROG, saveProgressSoon } from '../shared.js';
import { emit } from '../state.js';
import { shuffled } from '../util.js';
import { SEUIL_EXO } from './exo.js';

// ----------------------------------------------------------------------------------
// Les cours : des chapitres (le signal vidéo, le SDI, le réseau, la HF…) faits de leçons, une par
// terme technique. Chaque leçon donne l'essentiel en trois lignes, un schéma, une manipulation
// interactive qui fait comprendre, l'explication, « dans le car » (où ça se voit dans le
// simulateur), les fiches « ? » liées et un quiz court. Les leçons se lisent sans le stade 3D,
// depuis l'écran titre, un téléphone ou un vidéoprojecteur. L'interface est dans ui/cours_ui.js.
// ----------------------------------------------------------------------------------
/**
 * @typedef {object} Lesson
 * @property {string} id
 * @property {string} title
 * @property {string} [minutes] durée de lecture, ex. « 6 min »
 * @property {string} [partie] la partie du chapitre où la leçon se range dans le sommaire (titre), si le chapitre en a
 * @property {string[]} essentials l'essentiel, trois lignes au plus
 * @property {() => Element} [figure] le schéma (SVG ou canvas), construit à l'affichage
 * @property {(host: HTMLElement) => ({ destroy?: () => void } | void)} [demo] la manipulation interactive, montée dans host
 * @property {string} [demoTitle] consigne de la manipulation
 * @property {string} body l'explication (texte riche de ui/rich.js : **gras**, `code`, listes « - », paragraphes)
 * @property {string} [plus] pour aller plus loin (replié)
 * @property {{ text: string, station?: string, tab?: string, lesson?: string, arg?: any }} [car] où ça se voit dans le simulateur : poste (et onglet), parcours du chef de car
 * @property {string[]} [terms] fiches « ? » liées (identifiants de content/netterms.js et des fichiers terms_*.js)
 * @property {string[]} [competences] compétences du référentiel TIEE travaillées (content/referentiel.js, « 1.4 »…), pour le livret
 * @property {Array<{ id: string, intro: string }>} [exercises] exercices pratiques de la leçon : un parcours guidé d'Olivier
 *   (identifiant de src/tutor/lessons) ou un exercice noté (« x-atelier », « x-brassage », « x-reseau », « x-match », voir
 *   cours/exercices.js) ; intro : deux ou trois phrases qui relient la leçon au geste à faire dans le car
 * @property {string} [article] article de référence du guide (content/guide.js), proposé en « Pour aller plus loin »
 * @property {QuizQuestion[]} quiz la banque de questions (cinq au moins) : chaque essai en tire QUIZ_N, réponses mélangées ;
 *   un choix peut porter sa propre explication [texte, pourquoi]
 */
/** @typedef {{ q: string, choices: Array<string | [string, string]>, answer: number, why: string }} QuizQuestion */
/**
 * @typedef {object} Chapter
 * @property {string} id
 * @property {string} title
 * @property {string} icon icône (ui/icons.js)
 * @property {string} intro une ou deux phrases
 * @property {Lesson[]} lessons
 * @property {{ label: string, sub?: string, event: string, arg?: any }} [module] un module à part ouvert depuis le chapitre
 *   (ex. la caméra en 3D, src/camlab) : une entrée en tête de la liste du chapitre
 */
/** @type {Chapter[]} */
export const CHAPTERS = [];
/** ordre des chapitres (les autres viennent après, dans l'ordre d'enregistrement) */
const ORDER = ['signal', 'sdi', 'synchro', 'camera', 'realisation', 'ralentis', 'son', 'reseau', 'hf', 'exploitation'];
export function registerChapter(ch) {
  if (CHAPTERS.some((c) => c.id === ch.id)) return;
  CHAPTERS.push(ch);
  CHAPTERS.sort((a, b) => { const ia = ORDER.indexOf(a.id), ib = ORDER.indexOf(b.id); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
}
/** @returns {{ chapter: Chapter, lesson: Lesson, i: number } | null} */
export function lessonById(id) {
  for (const chapter of CHAPTERS) { const i = chapter.lessons.findIndex((l) => l.id === id); if (i >= 0) return { chapter, lesson: chapter.lessons[i], i }; }
  return null;
}
/** toutes les leçons, dans l'ordre des chapitres */
export const allLessons = () => CHAPTERS.flatMap((c) => c.lessons.map((l) => ({ chapter: c, lesson: l })));

// ---------------- progression (enregistrée avec celle du stagiaire) ----------------
export function coursProgress(id) {
  const P = PROG.cours = PROG.cours || {};
  return P[id] || (P[id] = { seen: false, quiz: /** @type {{ score: number, total: number } | null} */ (null) });
}
/** @typedef {{ best: number, seul: boolean, n: number, at: number }} ExoProgress exercice en autonomie : meilleur score sur 100, réussi seul (sans solution demandée) une fois au moins, essais */
// ---------------- le quiz d'une leçon : un tirage dans la banque ----------------
/** questions posées à chaque essai */
export const QUIZ_N = 3;
/**
 * Tire QUIZ_N questions de la banque, en commençant par celles qui n'étaient pas dans l'essai précédent
 * (refaire le quiz pose d'autres questions), et mélange l'ordre des réponses de chacune.
 * @param {QuizQuestion[]} bank
 * @param {number[]} [prev] questions (indices dans la banque) de l'essai précédent
 * @returns {{ i: number, order: number[] }[]} i : question de la banque ; order[k] : choix de la banque affiché en k
 */
export function drawQuiz(bank, prev = [], rnd = Math.random) {
  const all = bank.map((_, i) => i);
  const fresh = shuffled(all.filter((i) => !prev.includes(i)), rnd), old = shuffled(all.filter((i) => prev.includes(i)), rnd);
  const picked = [...fresh, ...old].slice(0, Math.min(QUIZ_N, bank.length));
  return shuffled(picked, rnd).map((i) => ({ i, order: shuffled(bank[i].choices.map((_, k) => k), rnd) }));
}

export function markSeen(id) { const p = coursProgress(id); if (!p.seen) { p.seen = true; PROG.updatedAt = Date.now(); saveProgressSoon(); } }
/** un essai de l'exercice en autonomie (cours/exo.js) : le meilleur score reste ; seul : aucune solution demandée */
export function recordExo(id, score, seul) {
  const p = /** @type {any} */ (coursProgress(id));
  const prev = p.exo || null;
  p.exo = { best: Math.max(prev ? prev.best : 0, score), seul: !!(prev && prev.seul) || (seul && score >= SEUIL_EXO), n: (prev ? prev.n : 0) + 1, at: Date.now() };
  PROG.updatedAt = Date.now(); saveProgressSoon(); emit('coursExo', { id, score, seul, best: p.exo.best, first: !prev || prev.best < SEUIL_EXO });
}
/** un test de niveau (cours/parcours.js) pour ouvrir le niveau d'un chapitre : le meilleur résultat reste (PROG.niveaux) */
export function recordTest(chapitre, niveau, score, total) {
  const P = /** @type {any} */ (PROG); const N = P.niveaux = P.niveaux || {}; const C = N[chapitre] = N[chapitre] || {};
  const prev = C[niveau];
  if (!prev || score / total > prev.score / prev.total) C[niveau] = { score, total, at: Date.now() };
  PROG.updatedAt = Date.now(); saveProgressSoon(); emit('niveauTest', { chapitre, niveau, score, total });
}
export function recordQuiz(id, score, total) { const p = coursProgress(id); if (!p.quiz || score >= p.quiz.score) p.quiz = { score, total }; PROG.updatedAt = Date.now(); saveProgressSoon(); emit('quiz', { id, score, total }); }
/** leçon acquise : quiz réussi en entier */
export const lessonDone = (id) => { const q = coursProgress(id).quiz; return !!q && q.score === q.total; };
export const chapterDone = (ch) => ch.lessons.filter((l) => lessonDone(l.id)).length;

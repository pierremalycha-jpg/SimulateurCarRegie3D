// @ts-check
import { PROG, saveProgressSoon } from '../shared.js';

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
 * @property {Array<{ q: string, choices: Array<string | [string, string]>, answer: number, why: string }>} quiz trois questions ; un choix peut porter sa propre explication [texte, pourquoi]
 */
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
export function markSeen(id) { const p = coursProgress(id); if (!p.seen) { p.seen = true; PROG.updatedAt = Date.now(); saveProgressSoon(); } }
export function recordQuiz(id, score, total) { const p = coursProgress(id); if (!p.quiz || score >= p.quiz.score) p.quiz = { score, total }; PROG.updatedAt = Date.now(); saveProgressSoon(); }
/** leçon acquise : quiz réussi en entier */
export const lessonDone = (id) => { const q = coursProgress(id).quiz; return !!q && q.score === q.total; };
export const chapterDone = (ch) => ch.lessons.filter((l) => lessonDone(l.id)).length;

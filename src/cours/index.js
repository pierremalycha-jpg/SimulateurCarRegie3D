// @ts-check
import { PROG, saveProgressSoon, addNote } from '../shared.js';
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
 * @property {string[]} [savoirs] savoirs du référentiel TIEE que la leçon enseigne (content/referentiel.js, « C9 », « K4 »…), cités en fin de leçon
 * @property {string[]} [competences] compétences du référentiel TIEE travaillées (content/referentiel.js, numéros officiels « C32 »…), pour le livret ; la même liste
 *   que RATTACHEMENT.cours (test unitaire)
 * @property {Array<{ id: string, intro: string }>} [exercises] exercices pratiques de la leçon : un parcours guidé d'Olivier
 *   (identifiant de src/tutor/lessons) ou un exercice noté (« x-atelier », « x-brassage », « x-reseau », « x-match », voir
 *   cours/exercices.js) ; intro : deux ou trois phrases qui relient la leçon au geste à faire dans le car
 * @property {string} [article] article de référence du guide (content/guide.js), proposé en « Pour aller plus loin »
 * @property {QuizQuestion[]} quiz la banque de questions : chaque essai du quiz en tire QUIZ_N parmi celles de niveau 1 et 2
 *   (cinq au moins), réponses mélangées ; les questions de niveau 3 forment le défi, facultatif ; un choix peut porter sa propre
 *   explication [texte, pourquoi]
 * La démarche de la leçon (v19.30, pour le débutant comme pour celui qui va vite) :
 * @property {string[]} [objectifs] ce que l'on saura faire à la fin, deux à quatre phrases qui commencent par un verbe
 *   (« Calculer le débit d'une image », « Reconnaître… »)
 * @property {{ texte: string, reponse: string }} [situation] le point de départ : un problème concret dans le car, qui finit
 *   par une question ; la réponse se lit après l'explication (« Retour à la situation »)
 * @property {string} [analogie] la rubrique « En clair » : une image de la vie courante pour entrer dans la notion, dite comme une image
 * @property {string[]} [retenir] la rubrique « À retenir » : trois à cinq points, les chiffres et les règles à savoir par cœur
 * @property {string[]} [pieges] la rubrique « Les pièges » : deux ou trois confusions fréquentes, chacune avec sa correction
 * @property {string[]} [prerequis] les leçons à connaître avant (identifiants, plus tôt dans le fil rouge, cours/fil_rouge.js)
 */
/**
 * Une question du quiz. niv : 1 « je reconnais » (une définition, un ordre de grandeur, à quoi sert un appareil), 2 « j'applique »
 * (une situation simple du car, un calcul en une étape avec les chiffres de l'énoncé), 3 « je maîtrise » (plusieurs étapes, un
 * cas limite, un dépannage fin : le défi). Sans niv, la question compte au niveau 2.
 * @typedef {{ q: string, choices: Array<string | [string, string]>, answer: number, why: string, niv?: 1 | 2 | 3 }} QuizQuestion
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
/** ordre des chapitres (les autres viennent après, dans l'ordre d'enregistrement) : celui de la chaîne, de la lumière du stade
 * à l'antenne (v19.30, le fil rouge de cours/fil_rouge.js) */
const ORDER = ['lumiere', 'camera', 'signal', 'sdi', 'synchro', 'son', 'realisation', 'ralentis', 'reseau', 'hf', 'exploitation'];
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
/** le niveau d'une question (2 sans indication) */
export const nivQ = (/** @type {QuizQuestion} */ q) => (q && (q.niv === 1 || q.niv === 3) ? q.niv : 2);
/** les questions du quiz (niveaux 1 et 2) et celles du défi (niveau 3), en indices de la banque */
export const indicesBase = (/** @type {QuizQuestion[]} */ bank) => bank.map((q, i) => (nivQ(q) <= 2 ? i : -1)).filter((i) => i >= 0);
export const indicesDefi = (/** @type {QuizQuestion[]} */ bank) => bank.map((q, i) => (nivQ(q) === 3 ? i : -1)).filter((i) => i >= 0);
/** la leçon a-t-elle un défi (deux questions de niveau 3 au moins) ? */
export const aDefi = (/** @type {Lesson} */ L) => indicesDefi(L.quiz).length >= 2;
/**
 * Tire QUIZ_N questions de la banque, en commençant par celles qui n'étaient pas dans l'essai précédent
 * (refaire le quiz pose d'autres questions), et mélange l'ordre des réponses de chacune. Le quiz (o.niv = 'base', par
 * défaut) ne pose que des questions de niveau 1 et 2, dont au moins une de niveau 1 quand la banque en a ; le défi
 * (o.niv = 'defi') pose celles de niveau 3 ; o.niv = 'tout' tire dans toute la banque.
 * @param {QuizQuestion[]} bank
 * @param {number[]} [prev] questions (indices dans la banque) de l'essai précédent
 * @param {{ niv?: 'base' | 'defi' | 'tout' }} [o]
 * @returns {{ i: number, order: number[] }[]} i : question de la banque ; order[k] : choix de la banque affiché en k
 */
export function drawQuiz(bank, prev = [], rnd = Math.random, o = {}) {
  const niv = o.niv || 'base';
  let all = niv === 'defi' ? indicesDefi(bank) : niv === 'tout' ? bank.map((_, i) => i) : indicesBase(bank);
  // une banque sans question de base (pas encore rangée) : toute la banque
  if (!all.length && niv !== 'defi') all = bank.map((_, i) => i);
  const fresh = shuffled(all.filter((i) => !prev.includes(i)), rnd), old = shuffled(all.filter((i) => prev.includes(i)), rnd);
  let picked = [...fresh, ...old].slice(0, Math.min(QUIZ_N, all.length));
  // le quiz commence en douceur : au moins une question de niveau 1 quand la banque en a
  if (niv === 'base' && picked.length && !picked.some((i) => nivQ(bank[i]) === 1)) {
    const un = [...fresh, ...old].find((i) => nivQ(bank[i]) === 1);
    if (un != null) picked = [...picked.slice(0, -1), un];
  }
  return shuffled(picked, rnd).map((i) => ({ i, order: shuffled(bank[i].choices.map((_, k) => k), rnd) }));
}

export function markSeen(id) { const p = coursProgress(id); if (!p.seen) { p.seen = true; PROG.updatedAt = Date.now(); saveProgressSoon(); } }
/** un essai de l'exercice en autonomie (cours/exo.js) : le meilleur score reste ; seul : aucune solution demandée */
/** @typedef {{ g?: number, h?: string, r?: any[], sec?: number, q?: any[] }} DetailEssai le détail d'un essai pour le carnet de notes (src/notes.js) */
export function recordExo(id, score, seul, /** @type {DetailEssai} */ detail = {}) {
  const p = /** @type {any} */ (coursProgress(id));
  const prev = p.exo || null;
  p.exo = { best: Math.max(prev ? prev.best : 0, score), seul: !!(prev && prev.seul) || (seul && score >= SEUIL_EXO), n: (prev ? prev.n : 0) + 1, at: Date.now() };
  addNote({ k: 'exo', id, s: score, t: 100, seul: !!seul, ...detail });
  PROG.updatedAt = Date.now(); saveProgressSoon(); emit('coursExo', { id, score, seul, best: p.exo.best, first: !prev || prev.best < SEUIL_EXO });
}
/** un test de niveau (cours/parcours.js) pour ouvrir le niveau d'un chapitre : le meilleur résultat reste (PROG.niveaux) */
export function recordTest(chapitre, niveau, score, total, /** @type {DetailEssai} */ detail = {}) {
  const P = /** @type {any} */ (PROG); const N = P.niveaux = P.niveaux || {}; const C = N[chapitre] = N[chapitre] || {};
  const prev = C[niveau];
  if (!prev || score / total > prev.score / prev.total) C[niveau] = { score, total, at: Date.now() };
  addNote({ k: 'test', id: `${chapitre}/${niveau}`, s: score, t: total, ...detail });
  PROG.updatedAt = Date.now(); saveProgressSoon(); emit('niveauTest', { chapitre, niveau, score, total });
}
/** un quiz validé : le meilleur résultat reste ; les essais se comptent (qn, v19.24 : le tableau de bord du professeur repère un quiz manqué plusieurs fois) */
export function recordQuiz(id, score, total, /** @type {DetailEssai} */ detail = {}) {
  const p = /** @type {any} */ (coursProgress(id)); p.qn = (p.qn || 0) + 1; if (!p.quiz || score >= p.quiz.score) p.quiz = { score, total };
  addNote({ k: 'quiz', id, s: score, t: total, ...detail });
  PROG.updatedAt = Date.now(); saveProgressSoon(); emit('quiz', { id, score, total });
}
/** le défi d'une leçon (v19.30, les questions de niveau 3) : facultatif, il ne ferme ni n'ouvre rien ; le meilleur résultat reste, les essais se comptent (dn) */
export function recordDefi(id, score, total, /** @type {DetailEssai} */ detail = {}) {
  const p = /** @type {any} */ (coursProgress(id)); p.dn = (p.dn || 0) + 1; if (!p.defi || score >= p.defi.score) p.defi = { score, total };
  addNote({ k: 'defi', id, s: score, t: total, ...detail });
  PROG.updatedAt = Date.now(); saveProgressSoon(); emit('coursDefi', { id, score, total });
}
/** défi réussi en entier */
export const defiReussi = (id, prog = PROG) => { const d = (((/** @type {any} */ (prog) || {}).cours || {})[id] || {}).defi; return !!d && d.total > 0 && d.score === d.total; };
/** leçon acquise : quiz réussi en entier */
export const lessonDone = (id) => { const q = coursProgress(id).quiz; return !!q && q.score === q.total; };
export const chapterDone = (ch) => ch.lessons.filter((l) => lessonDone(l.id)).length;

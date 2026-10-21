// @ts-check
import { S, emit, on } from '../state.js';
import { el } from '../util.js';
import { $, modal } from './common.js';
import { rich } from './rich.js';
import { q } from './term.js';
import { icon } from './icons.js';
import { TERMS } from '../content/netterms.js';
import { articlesInto, glossaireInto } from './guide.js';
import { CHAPTERS, lessonById, allLessons, coursProgress, markSeen, recordQuiz, lessonDone, chapterDone } from '../cours/index.js';

// ----------------------------------------------------------------------------------
// La fenêtre « Cours » (touche G, menu titre, pupitre) : à gauche les chapitres et leurs leçons,
// à droite la leçon (l'essentiel, le schéma, la manipulation, l'explication, « dans le car »,
// les fiches « ? », le quiz). Deux autres onglets : les articles du guide et le glossaire.
// Elle s'ouvre aussi depuis l'écran titre, sans entrer dans le car.
// ----------------------------------------------------------------------------------
const UI = { tab: 'chapitres', lesson: /** @type {string | null} */ (null), chapter: /** @type {string | null} */ (null), demo: /** @type {{ destroy?: () => void } | null | void} */ (null), fromTitle: false };
const TABS = [['chapitres', 'Chapitres'], ['articles', 'Articles'], ['glossaire', 'Glossaire']];

/**
 * @param {{ tab?: string, lesson?: string | null, chapter?: string | null } | string} [o] onglet, leçon ou chapitre à ouvrir
 */
export function openCours(o = {}) {
  const opts = typeof o === 'string' ? { lesson: o } : o;
  if (opts.tab) UI.tab = opts.tab;
  if (opts.lesson !== undefined) UI.lesson = opts.lesson;
  if (opts.chapter !== undefined) UI.chapter = opts.chapter;
  // depuis l'écran titre : il s'efface le temps du cours, et revient à la fermeture
  const t = $('#title'); UI.fromTitle = !!t && !t.hidden; if (UI.fromTitle) t.hidden = true;
  const tabs = el('div', { class: 'tabs co-tabs' }, ...TABS.map(([k, l]) => el('button', { class: 'tab' + (k === UI.tab ? ' on' : ''), 'data-k': k, onclick: () => { UI.tab = k; render(); } }, l)));
  const content = el('div', { class: 'co-body' });
  const root = el('div', { class: 'cours' }, tabs, content);
  const render = () => {
    stopDemo();
    [...tabs.children].forEach((b) => b.classList.toggle('on', b.dataset.k === UI.tab));
    content.replaceChildren();
    if (UI.tab === 'articles') articlesInto(content, UI.chapter);
    else if (UI.tab === 'glossaire') glossaireInto(content);
    else chapitres(content, render);
  };
  modal.open('Cours', root, { width: 1180, onClose: () => { stopDemo(); if (UI.fromTitle && S.mode === 'start' && t) { t.hidden = false; const p = /** @type {HTMLElement | null} */ ($('#ti-cours')); if (p) p.focus({ preventScroll: true }); } } });
  render();
}
on('cours', (o) => openCours(o || {}));
function stopDemo() { try { if (UI.demo && UI.demo.destroy) UI.demo.destroy(); } catch (e) { /* démonstration déjà démontée */ } UI.demo = null; }

// ---------------- chapitres et leçons ----------------
function chapitres(content, render) {
  const nav = el('nav', { class: 'co-nav', 'aria-label': 'Chapitres et leçons' });
  for (const ch of CHAPTERS) {
    const done = chapterDone(ch);
    const det = el('details', { class: 'co-chap', open: UI.chapter === ch.id || (!UI.chapter && CHAPTERS[0] === ch) ? '' : null },
      el('summary', {}, icon(ch.icon), el('span', {}, ch.title), el('small', {}, `${done} / ${ch.lessons.length}`)),
      el('ol', {}, ...ch.lessons.map((l) => el('li', {}, el('button', { type: 'button', class: 'co-les' + (UI.lesson === l.id ? ' on' : '') + (lessonDone(l.id) ? ' done' : ''), onclick: () => { UI.lesson = l.id; UI.chapter = ch.id; render(); } }, lessonDone(l.id) ? icon('fait') : null, l.title)))));
    det.addEventListener('toggle', () => { if (det.open) UI.chapter = ch.id; });
    nav.append(det);
  }
  const page = el('article', { class: 'co-page' });
  const found = UI.lesson ? lessonById(UI.lesson) : null;
  if (found) lessonPage(page, found, render);
  else home(page, render);
  content.append(el('div', { class: 'co-grid' }, nav, page));
}
function home(page, render) {
  const total = allLessons().length, done = allLessons().filter(({ lesson }) => lessonDone(lesson.id)).length;
  page.append(el('h3', {}, 'Les cours'),
    el('p', { class: 'lede' }, 'Un chapitre par domaine, une leçon par terme technique. Chaque leçon tient en quelques minutes : l\'essentiel, un schéma, une manipulation pour comprendre, puis où le retrouver dans le car et un quiz. Le chef de car vous y renvoie quand un terme vous manque.'),
    el('p', { class: 'note' }, total ? `${done} leçon${done > 1 ? 's' : ''} acquise${done > 1 ? 's' : ''} sur ${total} (quiz réussi en entier).` : 'Les chapitres arrivent.'),
    el('div', { class: 'co-cards' }, ...CHAPTERS.map((ch) => el('button', { type: 'button', class: 'co-card', onclick: () => { UI.chapter = ch.id; UI.lesson = ch.lessons[0] ? ch.lessons[0].id : null; render(); } },
      icon(ch.icon), el('b', {}, ch.title), el('span', {}, ch.intro), el('small', {}, `${ch.lessons.length} leçon${ch.lessons.length > 1 ? 's' : ''} · ${chapterDone(ch)} acquise${chapterDone(ch) > 1 ? 's' : ''}`)))));
}
function lessonPage(page, { chapter, lesson, i }, render) {
  markSeen(lesson.id);
  const L = lesson;
  page.append(el('p', { class: 'co-crumb' }, icon(chapter.icon), chapter.title, el('span', {}, ` · leçon ${i + 1} / ${chapter.lessons.length}`)),
    el('h3', {}, L.title, L.minutes ? el('small', {}, L.minutes) : null),
    el('section', { class: 'co-ess', 'aria-label': 'L\'essentiel' }, el('h4', {}, 'L\'essentiel'), el('ul', {}, ...L.essentials.map((t) => el('li', {}, rich(t, 'co-rich'))))));
  if (L.figure) { try { page.append(el('div', { class: 'co-figbox' }, L.figure())); } catch (e) { console.error(e); } }
  if (L.demo) {
    const host = el('div', { class: 'co-demo-host' });
    page.append(el('section', { class: 'co-demo', 'aria-label': 'Manipulation' }, el('h4', {}, icon('a_toi'), 'À vous : ', el('span', {}, L.demoTitle || 'essayez')), host));
    try { UI.demo = L.demo(host); } catch (e) { console.error(e); host.append(el('p', { class: 'note' }, 'La manipulation n\'a pas pu démarrer dans ce navigateur.')); }
  }
  page.append(el('section', { class: 'co-text' }, rich(L.body, 'co-rich')));
  if (L.car) {
    const inGame = S.mode !== 'start' && !!L.car.station;
    page.append(el('section', { class: 'co-car' }, el('h4', {}, icon('car'), 'Dans le car'), el('p', {}, L.car.text),
      inGame ? el('button', { class: 'btn small primary', onclick: () => { modal.close(); emit('openStationNow', { id: L.car.station }); } }, 'Aller au poste')
        : el('p', { class: 'note' }, 'Entrez dans le car pour y aller : le bouton apparaît alors ici.')));
  }
  const terms = (L.terms || []).filter((id) => TERMS[id]);
  if (terms.length) page.append(el('section', { class: 'co-terms' }, el('h4', {}, 'Fiches « ? »'), el('div', { class: 'co-chips' }, ...terms.map((id) => el('span', { class: 'co-chip' }, TERMS[id].t, q(id))))));
  page.append(quiz(L, render));
  const all = allLessons(); const k = all.findIndex((x) => x.lesson.id === L.id);
  const prev = all[k - 1], next = all[k + 1];
  page.append(el('div', { class: 'co-nextprev' },
    prev ? el('button', { class: 'btn small', onclick: () => { UI.lesson = prev.lesson.id; UI.chapter = prev.chapter.id; render(); } }, '◀ ' + prev.lesson.title) : el('span'),
    next ? el('button', { class: 'btn small primary', onclick: () => { UI.lesson = next.lesson.id; UI.chapter = next.chapter.id; render(); } }, next.lesson.title + ' ▶') : el('span')));
}
function quiz(L, render) {
  const p = coursProgress(L.id);
  const box = el('section', { class: 'co-quiz', 'aria-label': 'Quiz' });
  const head = el('h4', {}, 'Quiz', p.quiz ? el('small', {}, ` · meilleur score ${p.quiz.score} / ${p.quiz.total}`) : null);
  box.append(head);
  const answers = new Array(L.quiz.length).fill(null);
  const items = L.quiz.map((Q, qi) => {
    const why = el('p', { class: 'co-why', hidden: true });
    const btns = Q.choices.map((c, ci) => el('button', { type: 'button', class: 'btn small co-choice-btn', onclick: () => {
      if (answers[qi] != null) return;
      answers[qi] = ci;
      btns.forEach((b, bi) => { b.disabled = true; b.classList.toggle('good', bi === Q.answer); b.classList.toggle('bad', bi === ci && ci !== Q.answer); });
      why.hidden = false; why.replaceChildren(rich((ci === Q.answer ? '**Exact.** ' : `**Non, c'est « ${Q.choices[Q.answer]} ».** `) + Q.why, 'co-rich'));
      if (answers.every((a) => a != null)) { const score = answers.filter((a, k) => a === L.quiz[k].answer).length; recordQuiz(L.id, score, L.quiz.length); done.hidden = false; done.replaceChildren(el('b', {}, `${score} / ${L.quiz.length}`), score === L.quiz.length ? ' : leçon acquise.' : ' : relisez l\'essentiel et refaites le quiz.', el('button', { class: 'btn small', onclick: () => render() }, 'Refaire le quiz')); }
    } }, c));
    return el('div', { class: 'co-q' }, el('p', {}, `${qi + 1}. ${Q.q}`), el('div', { class: 'co-choices' }, ...btns), why);
  });
  const done = el('p', { class: 'co-score', hidden: true });
  box.append(...items, done);
  return box;
}
